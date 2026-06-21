// Classificação de grupo — critérios OFICIAIS da Copa 2026 (FIFA), na ordem:
//  1) pontos · 2) confronto direto (pontos) · 3) confronto direto (saldo) · 4) confronto direto (gols)
//  5) saldo geral · 6) gols geral · 7) fair play / ranking FIFA (aqui: alfabético, dados indisponíveis).
// O confronto direto é aplicado de forma recursiva entre os times empatados.

function overallStats(teams, games) {
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
  for (const t of teams) row[t].GD = row[t].GF - row[t].GA;
  return row;
}

// Ordena um conjunto de times empatados em PONTOS, usando confronto direto (recursivo) e depois geral.
function resolveTie(tied, games, overall) {
  if (tied.length === 1) return tied;
  const set = new Set(tied);
  const among = games.filter((g) => g.hs != null && g.as != null && set.has(g.homeTeam) && set.has(g.awayTeam));
  const h2h = overallStats(tied, among);
  const key = (t) => `${h2h[t].Pts}|${h2h[t].GD}|${h2h[t].GF}`;
  const buckets = {};
  for (const t of tied) (buckets[key(t)] ||= []).push(t);
  const orderedKeys = Object.keys(buckets).sort((A, B) => {
    const [pa, da, ga] = A.split("|").map(Number), [pb, db, gb] = B.split("|").map(Number);
    return pb - pa || db - da || gb - ga;
  });
  const out = [];
  for (const k of orderedKeys) {
    const b = buckets[k];
    if (b.length === 1) out.push(b[0]);
    else if (b.length === tied.length) {
      // confronto direto não separou: vai pro saldo/gols geral, depois alfabético
      out.push(...b.slice().sort((x, y) => overall[y].GD - overall[x].GD || overall[y].GF - overall[x].GF || x.localeCompare(y)));
    } else {
      out.push(...resolveTie(b, games, overall)); // subconjunto ainda empatado: reaplica confronto direto
    }
  }
  return out;
}

export function groupStandings(teams, games) {
  const overall = overallStats(teams, games);
  const byPts = {};
  for (const t of teams) (byPts[overall[t].Pts] ||= []).push(t);
  const levels = Object.keys(byPts).map(Number).sort((a, b) => b - a);
  const ordered = [];
  for (const p of levels) ordered.push(...resolveTie(byPts[p], games, overall));
  return ordered.map((t) => overall[t]);
}

// Ranking dos terceiros (entre grupos diferentes — sem confronto direto):
// pontos → saldo geral → gols geral → alfabético (fair play/ranking indisponíveis).
export function rankThirds(thirds) {
  return thirds.slice().sort((x, y) =>
    y.row.Pts - x.row.Pts || y.row.GD - x.row.GD || y.row.GF - x.row.GF || x.group.localeCompare(y.group)
  );
}
