import { prisma } from "./prisma";

// Time eliminado = perdeu um jogo de mata-mata já encerrado (no tempo normal, ou na
// disputa de pênaltis via `advancer`). Usado pra apagar/deixar P&B a foto e a bandeira.
export function eliminatedFrom(matches) {
  const set = new Set();
  for (const m of matches) {
    if (m.stage === "GROUP") continue;
    if (m.homeScore == null || m.awayScore == null) continue;
    let loser = null;
    if (m.homeScore > m.awayScore) loser = m.awayTeam;
    else if (m.awayScore > m.homeScore) loser = m.homeTeam;
    else if (m.advancer === "home") loser = m.awayTeam;
    else if (m.advancer === "away") loser = m.homeTeam;
    if (loser) set.add(loser);
  }
  return set;
}

export async function getEliminatedTeams() {
  const ko = await prisma.match.findMany({
    where: { stage: { not: "GROUP" }, finished: true },
    select: { stage: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, advancer: true },
  });
  return eliminatedFrom(ko);
}
