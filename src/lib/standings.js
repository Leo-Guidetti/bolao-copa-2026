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

  return { ranked, totalPot, prizes, settings };
}