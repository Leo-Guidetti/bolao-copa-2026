import { prisma } from "./prisma";
import { getAllSettings } from "./config";
import { betPoints, squadScore, combinedRanking, prizeBreakdown } from "./scoring";

// Calcula tudo o que o ranking precisa, do banco.
export async function computeStandings() {
  const [participants, matches, settings] = await Promise.all([
    prisma.participant.findMany({
      include: {
        bets: true,
        squad: { include: { players: { include: { player: true } } } },
      },
    }),
    prisma.match.findMany(),
    getAllSettings(),
  ]);

  const matchById = Object.fromEntries(matches.map((m) => [m.id, m]));
  const cashIn = settings.entry?.amount ?? 50;
  const budgetCap = settings.squadRules?.budgetCap ?? 50;

  const rows = participants.map((p) => {
    // Etapa 1
    let betPts = 0, cravadas = 0; const cravadasList = [];
    for (const bet of p.bets) {
      const m = matchById[bet.matchId];
      if (!m) continue;
      betPts += betPoints(bet, m, settings.scoring);
      // cravada = placar exato num jogo já finalizado
      if (m.finished && m.homeScore != null && m.awayScore != null && bet.homeGuess === m.homeScore && bet.awayGuess === m.awayScore) {
        cravadas++;
        cravadasList.push({ homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeScore: m.homeScore, awayScore: m.awayScore, kickoff: m.kickoff });
      }
    }
    cravadasList.sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    // Etapa 2 — seleção acima do orçamento NÃO conta
    let squadPts = 0, squadCost = 0, squadOver = false;
    if (p.squad) {
      squadCost = p.squad.players.reduce((sum, sp) => sum + (sp.player?.price || 0), 0);
      squadOver = squadCost > budgetCap;
      if (!squadOver) squadPts = squadScore(p.squad, settings.squadRules.scout, settings.squadRules.camisa10Multiplier);
    }
    return { participantId: p.id, name: p.name, paid: !!p.paid, betPts, squadPts, cravadas, cravadasList, squadCost, squadOver, hasSquad: !!p.squad };
  });

  const ranked = combinedRanking(rows, settings.ranking);

  const totalPot = participants.length * cashIn;
  const prizes = prizeBreakdown(totalPot, settings.prize.distribution);

  // Prêmio da MELHOR SELEÇÃO: R$60, tirando R$15 de cada colocação do 1º ao 4º.
  const BEST_SQUAD_PRIZE = settings.prize?.bestSquadPrize ?? 60;
  const TAKE_FROM_EACH = settings.prize?.bestSquadTakeFromEach ?? 15;
  for (const pz of prizes) if (pz.place >= 1 && pz.place <= 4) pz.amount = Math.max(0, pz.amount - TAKE_FROM_EACH);
  // Melhor seleção = maior squadPts (entre quem tem seleção válida e pontuou).
  let best = null;
  for (const r of ranked) {
    if (r.squadOver || !r.hasSquad || r.squadPts <= 0) continue;
    if (!best || r.squadPts > best.squadPts) best = r;
  }
  const bestSquad = best ? { participantId: best.participantId, name: best.name, squadPts: best.squadPts, amount: BEST_SQUAD_PRIZE } : { participantId: null, name: null, squadPts: 0, amount: BEST_SQUAD_PRIZE };

  return { ranked, totalPot, prizes, bestSquad, settings };
}