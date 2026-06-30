import { prisma } from "@/lib/prisma";
import { currentParticipant } from "@/lib/session";
import { getSquadLock, getKoWindow } from "@/lib/locks";
import { getSetting } from "@/lib/config";
import { playerScore } from "@/lib/scoring";
import { eliminatedFrom } from "@/lib/elimination";

const STAT_FIELDS = ["goals", "assists", "cleanSheet", "saves", "yellow", "red", "ownGoals", "shots", "shotsOnTarget", "shotsOnPost", "tackles", "interceptions", "penaltiesSaved", "penaltiesMissed", "shootOutSaved", "blockedShots", "foulsSuffered", "foulsCommitted", "goalsConceded"];

export async function GET() {
  const me = await currentParticipant();
  if (!me) return Response.json({ locked: false, squads: [] }, { status: 401 });
  const lock = await getSquadLock();
  if (!lock.locked) return Response.json({ locked: false, deadline: lock.deadline, squads: [] });

  const ko = await getKoWindow();
  const squadRules = await getSetting("squadRules");
  const scout = squadRules?.scout || {};
  const showGroup = !ko.started; // antes do mata-mata começar, mostra o time de grupos (o que pontua)

  const [parts, matches, allStats, snapRow, allPlayers] = await Promise.all([
    prisma.participant.findMany({ include: { squad: { include: { players: { include: { player: true } } } } }, orderBy: { name: "asc" } }),
    prisma.match.findMany({ select: { id: true, stage: true, finished: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, advancer: true } }),
    prisma.matchPlayerStat.findMany(),
    prisma.setting.findUnique({ where: { key: "groupSquadSnapshot" } }),
    prisma.player.findMany(),
  ]);
  let snapshot = {};
  try { snapshot = JSON.parse(snapRow?.value || "{}"); } catch {}
  const stageBy = Object.fromEntries(matches.map((m) => [m.id, m.stage]));
  const byId = Object.fromEntries(allPlayers.map((p) => [p.id, p]));

  const koAgg = {};
  for (const st of allStats) {
    if (stageBy[st.matchId] === "GROUP") continue;
    const b = (koAgg[st.playerId] ||= {});
    for (const f of STAT_FIELDS) b[f] = (b[f] || 0) + (st[f] || 0);
  }
  const elim = eliminatedFrom(matches);
  const withKo = (pl) => ({ ...pl, koPts: playerScore({ position: pl.position, ...(koAgg[pl.id] || {}) }, scout), eliminated: elim.has(pl.team) });
  const fromSnap = (snap, starter) => snap.players.filter((x) => x.isStarter === starter).map((x) => byId[x.playerId]).filter(Boolean).map(withKo);

  const squads = parts.filter((p) => p.squad || snapshot[p.id]).map((p) => {
    const isMe = p.id === me.id;
    const live = p.squad;
    const snap = snapshot[p.id];
    let starters = [], reserves = [], captainId = null, formation = "4-3-3", subbedInIds = [], subbedOut = [];
    if (showGroup && snap) {
      // Time da FASE DE GRUPOS (congelado)
      starters = fromSnap(snap, true);
      reserves = fromSnap(snap, false);
      captainId = snap.captainId;
      formation = snap.formation || "4-3-3";
    } else if (live) {
      // Time do MATA-MATA (ao vivo), com as trocas marcadas
      starters = live.players.filter((sp) => sp.isStarter).map((sp) => withKo(sp.player));
      reserves = live.players.filter((sp) => !sp.isStarter).map((sp) => withKo(sp.player));
      captainId = live.captainId;
      formation = live.formation || "4-3-3";
      if (snap) {
        const snapSet = new Set(snap.players.map((x) => x.playerId));
        const liveSet = new Set(live.players.map((sp) => sp.playerId));
        subbedInIds = [...liveSet].filter((id) => !snapSet.has(id));
        subbedOut = snap.players.filter((x) => !liveSet.has(x.playerId)).map((x) => byId[x.playerId]).filter(Boolean).map(withKo);
      }
    } else if (snap) {
      starters = fromSnap(snap, true);
      reserves = fromSnap(snap, false);
      captainId = snap.captainId;
      formation = snap.formation || "4-3-3";
    }
    return { participantId: p.id, name: p.name, avatarUrl: p.avatarUrl, formation, captainId, starters, reserves, subbedInIds, subbedOut, isMe };
  });

  return Response.json({ locked: true, koStarted: ko.started, squads });
}

export const dynamic = "force-dynamic";
