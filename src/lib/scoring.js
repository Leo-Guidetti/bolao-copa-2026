// Motor de pontuação do bolão.

// --- Etapa 1: pontos de uma aposta de placar ---
export function betPoints(bet, match, scoring) {
  if (!match.finished || match.homeScore == null || match.awayScore == null) return 0;

  const gh = bet.homeGuess;
  const ga = bet.awayGuess;
  const rh = match.homeScore;
  const ra = match.awayScore;

  const exact = gh === rh && ga === ra;
  const resultMatch = sign(gh - ga) === sign(rh - ra);
  const diffMatch = gh - ga === rh - ra;
  const isDraw = gh === ga && rh === ra; // previu empate e deu empate (saldo é sempre 0)
  const oneTeamMatch = gh === rh || ga === ra; // acertou os gols de pelo menos um time

  let base;
  if (exact) {
    base = scoring.exactScore;
  } else if (resultMatch && diffMatch && !isDraw) {
    // mesmo vencedor E mesmo saldo de gols (mas placar não exato).
    // Não vale para empates: o saldo de um empate é sempre 0, então acertar
    // o empate (placar errado) conta como "só o resultado".
    base = scoring.winnerGoalDiff;
  } else if (resultMatch) {
    // só o resultado (vitória/empate/derrota)
    base = scoring.winnerOnly;
  } else {
    base = scoring.miss;
  }

  // Critério separado: acertar a quantidade de gols de um dos times (independe do resultado).
  // Não soma no placar exato, que já é o máximo. Entra antes do multiplicador para "pontuar igual" ao saldo em todas as fases.
  if (!exact && oneTeamMatch) base += scoring.teamGoalsBonus ?? 0;

  const mult = scoring.phaseMultipliers?.[match.stage] ?? 1;
  let pts = base * mult;

  // bônus zebra: placar exato em vitória do azarão (favorito definido pelo admin via match.underdogWon, opcional)
  if (scoring.zebraBonus && exact && match.zebra) {
    pts += scoring.zebraBonus;
  }
  return pts;
}

function sign(n) {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

// --- Etapa 2: pontos de um jogador pelo scout acumulado ---
export function playerScore(player, scout) {
  const pos = player.position;
  const v = (ev) => scout[ev]?.[pos] ?? 0;
  const n = (f) => player[f] || 0;
  let sum = 0;
  sum += n("goals") * v("goal");
  sum += n("assists") * v("assist");
  sum += n("shotsOnTarget") * v("shotOnTarget");
  sum += n("shotsOnPost") * v("shotOnPost");
  sum += n("shots") * v("shot");
  sum += n("penaltiesMissed") * v("penaltyMissed");
  // Desarme + Interceptacao = scout unico
  sum += (n("tackles") + n("interceptions")) * v("tackleInterception");
  sum += n("cleanSheet") * v("cleanSheet");
  sum += n("saves") * v("save");
  sum += n("penaltiesSaved") * v("penaltySaved");
  sum += n("yellow") * v("yellow");
  sum += n("red") * v("red");
  sum += n("ownGoals") * v("ownGoal");
  sum += n("goalsConceded") * v("goalConceded");
  return sum;
}

// Decompõe a pontuação de um jogador: [{label, count, weight, points}] do maior pro menor.
const SCOUT_EVENTS = [
  { key: "goal", label: "Gol", stat: "goals" },
  { key: "assist", label: "Assistência", stat: "assists" },
  { key: "shotOnTarget", label: "Finalização no alvo", stat: "shotsOnTarget" },
  { key: "shotOnPost", label: "Finalização na trave", stat: "shotsOnPost" },
  { key: "shot", label: "Finalização pra fora", stat: "shots" },
  { key: "tackleInterception", label: "Desarme / Interceptação", stat: ["tackles", "interceptions"] },
  { key: "cleanSheet", label: "Sem sofrer gol", stat: "cleanSheet" },
  { key: "save", label: "Defesa", stat: "saves" },
  { key: "penaltySaved", label: "Defesa de pênalti", stat: "penaltiesSaved" },
  { key: "penaltyMissed", label: "Pênalti perdido", stat: "penaltiesMissed" },
  { key: "yellow", label: "Cartão amarelo", stat: "yellow" },
  { key: "red", label: "Cartão vermelho", stat: "red" },
  { key: "ownGoal", label: "Gol contra", stat: "ownGoals" },
  { key: "goalConceded", label: "Gol sofrido", stat: "goalsConceded" },
];
export function scoreBreakdown(player, scout) {
  const pos = player.position;
  const v = (ev) => scout?.[ev]?.[pos] ?? 0;
  const out = [];
  for (const e of SCOUT_EVENTS) {
    const count = Array.isArray(e.stat) ? e.stat.reduce((s, k) => s + (player[k] || 0), 0) : (player[e.stat] || 0);
    if (!count) continue;
    out.push({ key: e.key, label: e.label, count, weight: v(e.key), points: count * v(e.key) });
  }
  return out.sort((a, b) => b.points - a.points);
}

// pontos totais de uma escalação
export function squadScore(squad, scout, captainMultiplier) {
  let total = 0;
  for (const sp of squad.players) {
    let p = playerScore(sp.player, scout);
    if (squad.captainId && sp.playerId === squad.captainId) {
      p *= captainMultiplier;
    }
    total += p;
  }
  return total;
}

// --- Etapa 3: ranking combinado normalizado ---
// Recebe arrays de { participantId, betPts, squadPts } e os pesos.
export function combinedRanking(rows, ranking) {
  const maxBet = Math.max(1, ...rows.map((r) => r.betPts));
  const maxSquad = Math.max(1, ...rows.map((r) => r.squadPts));

  return rows
    .map((r) => {
      // Soma ponderada dos PONTOS BRUTOS: final = peso_placar·placar + peso_seleção·seleção
      // ex.: 0,7·10 + 0,3·8 = 9,4
      const final = r.betPts * ranking.weightBets + r.squadPts * ranking.weightSquad;
      // mantidos para eventual exibição (não entram no cálculo do final)
      const betPct = r.betPts / maxBet;
      const squadPct = r.squadPts / maxSquad;
      return { ...r, betPct, squadPct, final };
    })
    // Desempate: 1º) mais cravadas (placar exato); 2º) pontuação de seleção; 3º) pontuação de placar.
    .sort((a, b) => b.final - a.final || (b.cravadas || 0) - (a.cravadas || 0) || b.squadPts - a.squadPts || b.betPts - a.betPts)
    .map((r, i) => ({ ...r, place: i + 1 }));
}

// --- Premiação: valor por colocação ---
export function prizeBreakdown(totalPot, distribution) {
  return distribution
    .slice()
    .sort((a, b) => a.place - b.place)
    .map((d) => ({
      place: d.place,
      pct: d.pct,
      amount: (totalPot * d.pct) / 100,
    }));
}
