import { prisma } from "@/lib/prisma";
import { currentParticipant } from "@/lib/session";
import { getSquadLock, getKoWindow } from "@/lib/locks";
import { getSetting } from "@/lib/config";
import { playerScore } from "@/lib/scoring";

const STAT_FIELDS = ["goals", "assists", "cleanSheet", "saves", "yellow", "red", "ownGoals", "shots", "shotsOnTarget", "shotsOnPost", "tackles", "interceptions", "penaltiesSaved", "penaltiesMissed", "shootOutSaved", "blockedShots", "foulsSuffered", "foulsCommitted", "goalsConceded"];

export async function GET() {
  const me = await currentParticipant();
  if (!me) return Response.json({ locked: false, squads: [] }, { status: 401 });
  const lock = await getSquadLock();
  if (!lock.locked) return Response.json({ locked: false, deadline: lock.deadline, squads: [] });

  const ko = await getKoWindow();
  const squadRules = await getSetting("squadRules");
  const scout = squadRules?.scout || {};

  const [parts, matches, allStats, snapRow, allPlayers] = await Promise.all([
    prisma.participant.findMany({ include: { squad: { include: { players: { include: { player: true } } } } }, orderBy: { name: "asc" } }),
    prisma.match.findMany({ select: { id: true, stage: true } }),
    prisma.matchPlayerStat.findMany(),
    prisma.setting.findUnique({ where: { key: "groupSquadSnapshot" } }),
    prisma.player.findMany(),
  ]);
  let snapshot = {};
  try { snapshot = JSON.parse(snapRow?.value || "{}"); } catch {}
  const stageBy = Object.fromEntries(matches.map((m) => [m.id, m.stage]));
  const byId = Object.fromEntries(allPlayers.map((p) => [p.id, p]));

  // koPts por jogador = pontos só dos jogos de MATA-MATA (0 enquanto não houver mata-mata).
  const koAgg = {};
  for (const st of allStats) {
    if (stageBy[st.matchId] === "GROUP") continue;
    const b = (koAgg[st.playerId] ||= {});
    for (const f of STAT_FIELDS) b[f] = (b[f] || 0) + (st[f] || 0);
  }
  const withKo = (pl) => ({ ...pl, koPts: playerScore({ position: pl.position, ...(koAgg[pl.id] || {}) }, scout) });

  const hideSubs = ko.open; // durante a janela de troca, esconde as trocas dos OUTROS

  const squads = parts.filter((p) => p.squad || snapshot[p.id]).map((p) => {
    const isMe = p.id === me.id;
    const live = p.squad;
    const snap = snapshot[p.id];
    const showLive = isMe || !hideSubs || !snap; // outros, na janela, veem o time congelado
    let starters = [], reserves = [], captainId = null, formation = "4-3-3", subbedInIds = [], subbedOut = [];
    if (showLive && live) {
      starters = live.players.filter((sp) => sp.isStarter).map((sp) => withKo(sp.player));
      reserves = live.players.filter((sp) => !sp.isStarter).map((sp) => withKo(sp.player));
      captainId = live.captainId;
      formation = live.formation || "4-3-3";
      if (snap) {
        // marca trocas (só chega aqui quem mostra o time ao vivo: eu sempre, e os outros só após a janela fechar)
        const snapSet = new Set(snap.players.map((x) => x.playerId));
        const liveSet = new Set(live.players.map((sp) => sp.playerId));
        subbedInIds = [...liveSet].filter((id) => !snapSet.has(id));
        subbedOut = snap.players.filter((x) => !liveSet.has(x.playerId)).map((x) => byId[x.playerId]).filter(Boolean).map(withKo);
      }
    } else if (snap) {
      starters = snap.players.filter((x) => x.isStarter).map((x) => byId[x.playerId]).filter(Boolean).map(withKo);
      reserves = snap.players.filter((x) => !x.isStarter).map((x) => byId[x.playerId]).filter(Boolean).map(withKo);
      captainId = snap.captainId;
      formation = snap.formation || "4-3-3";
    }
    return { participantId: p.id, name: p.name, avatarUrl: p.avatarUrl, formation, captainId, starters, reserves, subbedInIds, subbedOut, isMe };
  });

  return Response.json({ locked: true, koOpen: ko.open, squads });
}

export const dynamic = "force-dynamic";
