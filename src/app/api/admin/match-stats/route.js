import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { getSetting } from "@/lib/config";
import { playerScore } from "@/lib/scoring";

const ALL = ["goals", "assists", "cleanSheet", "saves", "yellow", "red", "ownGoals", "shots", "shotsOnTarget", "shotsOnPost", "tackles", "interceptions", "penaltiesSaved", "penaltiesMissed", "shootOutSaved", "blockedShots", "foulsSuffered", "foulsCommitted", "goalsConceded"];
// Campos que o admin edita na mão (ESPN não fornece). O resto vem do sync.
const MANUAL = ["tackles", "interceptions", "penaltiesSaved"];

// Total do jogador = soma de TODAS as suas linhas por jogo.
async function recomputeOne(playerId) {
  const g = await prisma.matchPlayerStat.aggregate({
    where: { playerId },
    _sum: Object.fromEntries(ALL.map((f) => [f, true])),
  });
  const data = Object.fromEntries(ALL.map((f) => [f, g._sum[f] || 0]));
  await prisma.player.update({ where: { id: playerId }, data });
}

// GET /api/admin/match-stats -> jogos encerrados com placar + stats por jogador + pontos de fantasy do jogo
export async function GET() {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const squadRules = await getSetting("squadRules");
  const scout = squadRules.scout;

  const matches = await prisma.match.findMany({
    where: { finished: true },
    orderBy: { order: "asc" },
    include: { playerStats: { include: { player: true } } },
  });

  const out = matches.map((m) => {
    const players = m.playerStats.map((s) => {
      const pos = s.player.position;
      const points = playerScore({ ...s, position: pos }, scout);
      return {
        id: s.id, playerId: s.playerId,
        name: s.player.name, team: s.player.team, position: pos,
        minutes: s.minutes, goals: s.goals, assists: s.assists, cleanSheet: s.cleanSheet,
        saves: s.saves, yellow: s.yellow, red: s.red, ownGoals: s.ownGoals,
        shots: s.shots, shotsOnTarget: s.shotsOnTarget, tackles: s.tackles,
        interceptions: s.interceptions, penaltiesSaved: s.penaltiesSaved, points,
      };
    }).sort((a, b) => b.points - a.points || a.team.localeCompare(b.team));
    return {
      id: m.id, stage: m.stage, group: m.group, round: m.round, kickoff: m.kickoff,
      homeTeam: m.homeTeam, awayTeam: m.awayTeam, homeScore: m.homeScore, awayScore: m.awayScore,
      hasStats: players.length > 0, players,
    };
  });

  return Response.json(out);
}

// PATCH -> edita os campos manuais (desarme/interceptação/pênalti) de uma linha e recomputa o total.
// Body: { id, tackles?, interceptions?, penaltiesSaved? }
export async function PATCH(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const b = await req.json();
  if (!b.id) return new Response("Falta id", { status: 400 });
  const data = {};
  for (const f of MANUAL) {
    if (b[f] !== undefined) data[f] = Math.max(0, Number(b[f]) || 0);
  }
  if (!Object.keys(data).length) return new Response("Nada para atualizar", { status: 400 });

  const row = await prisma.matchPlayerStat.update({ where: { id: b.id }, data, include: { player: true } });
  await recomputeOne(row.playerId);

  const scout = (await getSetting("squadRules")).scout;
  const points = playerScore({ ...row, position: row.player.position }, scout);
  return Response.json({ ok: true, id: row.id, points, tackles: row.tackles, interceptions: row.interceptions, penaltiesSaved: row.penaltiesSaved });
}

export const dynamic = "force-dynamic";
