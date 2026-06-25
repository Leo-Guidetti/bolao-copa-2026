import { prisma } from "./prisma";
import { getAllSettings } from "./config";
import { betPoints, playerScore, combinedRanking, prizeBreakdown } from "./scoring";

// Campos de scout agregados por fase (a partir do MatchPlayerStat).
const STAT_FIELDS = ["goals", "assists", "cleanSheet", "saves", "yellow", "red", "ownGoals", "shots", "shotsOnTarget", "shotsOnPost", "tackles", "interceptions", "penaltiesSaved", "penaltiesMissed", "shootOutSaved", "blockedShots", "foulsSuffered", "foulsCommitted", "goalsConceded"];

// Calcula tudo o que o ranking precisa, do banco.
export async function computeStandings() {
  const [participants, matches, settings, allPlayers, allStats, snapRow] = await Promise.all([
    prisma.participant.findMany({ include: { bets: true, squad: { include: { players: true } } } }),
    prisma.match.findMany(),
    getAllSettings(),
    prisma.player.findMany({ select: { id: true, position: true, price: true } }),
    prisma.matchPlayerStat.findMany(),
    prisma.setting.findUnique({ where: { key: "groupSquadSnapshot" } }),
  ]);

  const matchById = Object.fromEntries(matches.map((m) => [m.id, m]));
  const cashIn = settings.entry?.amount ?? 50;
  const budgetCap = settings.squadRules?.budgetCap ?? 50;
  const scout = settings.squadRules.scout;
  const capMult = settings.squadRules.camisa10Multiplier ?? 2;

  // Snapshot do time de grupos (congelado quando abrimos a janela de troca do mata-mata).
  let snapshot = {};
  try { snapshot = JSON.parse(snapRow?.value || "{}"); } catch {}

  const playerInfo = {};
  for (const pl of allPlayers) playerInfo[pl.id] = { position: pl.position, price: pl.price };

  // Agrega o scout de cada jogador POR FASE (GROUP = fase de grupos, KO = mata-mata).
  const agg = {};
  for (const st of allStats) {
    const m = matchById[st.matchId];
    if (!m) continue;
    const phase = m.stage === "GROUP" ? "GROUP" : "KO";
    const bucket = (agg[st.playerId] ||= { GROUP: {}, KO: {} })[phase];
    for (const f of STAT_FIELDS) bucket[f] = (bucket[f] || 0) + (st[f] || 0);
  }

  const scorePhase = (ids, captainId, phase) =>
    ids.reduce((sum, id) => {
      const info = playerInfo[id];
      if (!info) return sum;
      let pts = playerScore({ position: info.position, ...(agg[id]?.[phase] || {}) }, scout);
      if (captainId && id === captainId) pts *= capMult;
      return sum + pts;
    }, 0);
  const cost = (ids) => ids.reduce((s, id) => s + (playerInfo[id]?.price || 0), 0);

  const rows = participants.map((p) => {
    // Etapa 1 — apostas de placar
    let betPts = 0, cravadas = 0; const cravadasList = [];
    for (const bet of p.bets) {
      const m = matchById[bet.matchId];
      if (!m) continue;
      betPts += betPoints(bet, m, settings.scoring);
      if (m.finished && m.homeScore != null && m.awayScore != null && bet.homeGuess === m.homeScore && bet.awayGuess === m.awayScore) {
        cravadas++;
        cravadasList.push({ homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeScore: m.homeScore, awayScore: m.awayScore, kickoff: m.kickoff });
      }
    }
    cravadasList.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));

    // Etapa 2 — seleção POR FASE:
    //   grupos = time congelado (snapshot) × scout da fase de grupos
    //   mata-mata = time atual (com até 4 trocas) × scout do mata-mata
    const liveIds = p.squad ? p.squad.players.map((sp) => sp.playerId) : [];
    const liveCaptain = p.squad?.captainId || null;
    const snap = snapshot[p.id];
    const groupIds = snap ? snap.players.map((x) => x.playerId) : liveIds;
    const groupCaptain = snap ? snap.captainId : liveCaptain;

    const groupCost = cost(groupIds), koCost = cost(liveIds);
    const groupPart = groupCost <= budgetCap ? scorePhase(groupIds, groupCaptain, "GROUP") : 0;
    const koPart = koCost <= budgetCap ? scorePhase(liveIds, liveCaptain, "KO") : 0;
    const squadPts = groupPart + koPart;

    return {
      participantId: p.id, name: p.name, paid: !!p.paid,
      betPts, squadPts, cravadas, cravadasList,
      squadCost: koCost, squadOver: koCost > budgetCap, hasSquad: !!p.squad,
    };
  });

  const ranked = combinedRanking(rows, settings.ranking);

  const totalPot = participants.length * cashIn;
  const prizes = prizeBreakdown(totalPot, settings.prize.distribution);

  // Prêmio da MELHOR SELEÇÃO: R$60, tirando R$15 de cada colocação do 1º ao 4º.
  const BEST_SQUAD_PRIZE = settings.prize?.bestSquadPrize ?? 60;
  const TAKE_FROM_EACH = settings.prize?.bestSquadTakeFromEach ?? 15;
  for (const pz of prizes) if (pz.place >= 1 && pz.place <= 4) pz.amount = Math.max(0, pz.amount - TAKE_FROM_EACH);
  let best = null;
  for (const r of ranked) {
    if (r.squadOver || !r.hasSquad || r.squadPts <= 0) continue;
    if (!best || r.squadPts > best.squadPts) best = r;
  }
  const bestSquad = best
    ? { participantId: best.participantId, name: best.name, squadPts: best.squadPts, amount: BEST_SQUAD_PRIZE }
    : { participantId: null, name: null, squadPts: 0, amount: BEST_SQUAD_PRIZE };

  return { ranked, totalPot, prizes, bestSquad, settings };
}
