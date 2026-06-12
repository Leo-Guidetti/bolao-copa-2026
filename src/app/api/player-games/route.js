import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/config";
import { playerScore, scoreBreakdown } from "@/lib/scoring";

// GET /api/player-games?playerId=... -> desempenho do jogador JOGO A JOGO (stats + pontos por partida).
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get("playerId");
  if (!playerId) return Response.json({ position: null, games: [] });
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return Response.json({ position: null, games: [] });

  const scout = (await getSetting("squadRules")).scout;
  const rows = await prisma.matchPlayerStat.findMany({ where: { playerId }, include: { match: true } });
  const pos = player.position;

  const games = rows.map((s) => ({
    matchId: s.matchId,
    label: `${s.match.homeTeam} ${s.match.homeScore ?? "-"}×${s.match.awayScore ?? "-"} ${s.match.awayTeam}`,
    kickoff: s.match.kickoff,
    finished: s.match.finished,
    minutes: s.minutes,
    points: playerScore({ ...s, position: pos }, scout),
    breakdown: scoreBreakdown({ ...s, position: pos }, scout),
  }))
    .filter((g) => g.minutes > 0 || g.points !== 0 || g.breakdown.length > 0)
    .sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff));

  return Response.json({ position: pos, games });
}

export const dynamic = "force-dynamic";
