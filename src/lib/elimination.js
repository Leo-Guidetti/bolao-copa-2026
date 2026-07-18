import { prisma } from "./prisma";
import { flagUrl } from "./flags";

// Time eliminado, em dois casos:
//  1) Perdeu um jogo de MATA-MATA já encerrado (no tempo normal, ou na disputa via `advancer`).
//  2) Não se classificou na FASE DE GRUPOS — ou seja, depois que o R32 está todo definido,
//     qualquer seleção que jogou os grupos e NÃO aparece no chaveamento está fora.
// Recalcula a cada chamada (sempre reflete os resultados mais recentes do banco).
export function eliminatedFrom(matches) {
  const out = new Set();
  const groupTeams = new Set();
  const r32Real = new Set();
  let r32Total = 0, r32Defined = 0;

  for (const m of matches) {
    if (m.stage === "GROUP") { groupTeams.add(m.homeTeam); groupTeams.add(m.awayTeam); continue; }

    if (m.stage === "R32") {
      r32Total++;
      const hReal = !!flagUrl(m.homeTeam), aReal = !!flagUrl(m.awayTeam); // placeholder ("Venc.", "1º Grupo…") não tem bandeira
      if (hReal) r32Real.add(m.homeTeam);
      if (aReal) r32Real.add(m.awayTeam);
      if (hReal && aReal) r32Defined++;
    }

    // Mata-mata encerrado: quem perdeu está eliminado.
    if (m.homeScore != null && m.awayScore != null) {
      if (m.stage === "SF") {
        // Perdedor da semi ainda joga a DISPUTA DE 3º LUGAR — não elimina ainda (ainda pontua).
      } else if (m.stage === "THIRD" || m.stage === "FINAL") {
        // Fim de linha pros dois: acabou o torneio pra eles.
        out.add(m.homeTeam); out.add(m.awayTeam);
      } else {
        let loser = null;
        if (m.homeScore > m.awayScore) loser = m.awayTeam;
        else if (m.awayScore > m.homeScore) loser = m.homeTeam;
        else if (m.advancer === "home") loser = m.awayTeam;
        else if (m.advancer === "away") loser = m.homeTeam;
        if (loser) out.add(loser);
      }
    }
  }

  // Fase de grupos: só marca eliminados quando o R32 está 100% definido (já sabemos quem classificou).
  if (r32Total > 0 && r32Defined === r32Total) {
    for (const t of groupTeams) if (!r32Real.has(t)) out.add(t);
  }
  return out;
}

export async function getEliminatedTeams() {
  const matches = await prisma.match.findMany({
    select: { stage: true, homeTeam: true, awayTeam: true, homeScore: true, awayScore: true, advancer: true },
  });
  return eliminatedFrom(matches);
}
