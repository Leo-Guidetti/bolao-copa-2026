// Classificação de um grupo a partir dos jogos com placar resolvido (real ou simulado).
// teams: array de nomes; games: [{homeTeam, awayTeam, hs, as}] (hs/as número ou null).
// Critérios: pontos → saldo → gols pró → ordem alfabética (desempate simples).
export function groupStandings(teams, games) {
  const row = {};
  for (const t of teams) row[t] = { team: t, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 };
  for (const g of games) {
    if (g.hs == null || g.as == null) continue;
    const h = row[g.homeTeam], a = row[g.awayTeam];
    if (!h || !a) continue;
    h.P++; a.P++; h.GF += g.hs; h.GA += g.as; a.GF += g.as; a.GA += g.hs;
    if (g.hs > g.as) { h.W++; a.L++; h.Pts += 3; }
    else if (g.hs < g.as) { a.W++; h.L++; a.Pts += 3; }
    else { h.D++; a.D++; h.Pts++; a.Pts++; }
  }
  const arr = teams.map((t) => ({ ...row[t], GD: row[t].GF - row[t].GA }));
  arr.sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.team.localeCompare(y.team));
  return arr;
}

// Ranking dos terceiros colocados: recebe [{group, row}] e devolve ordenado (melhor primeiro).
export function rankThirds(thirds) {
  return thirds.slice().sort((x, y) =>
    y.row.Pts - x.row.Pts || y.row.GD - x.row.GD || y.row.GF - x.row.GF || x.group.localeCompare(y.group)
  );
}
