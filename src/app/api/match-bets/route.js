import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/config";
import { betPoints } from "@/lib/scoring";

const LOCK_MS = 30 * 60 * 1000; // mesmo lock das apostas (30 min antes)

// GET /api/match-bets?matchId=... -> palpites de TODOS naquele jogo (só depois de travar),
// ordenados por pontos no jogo (desc).
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return Response.json({ locked: false, bets: [] });

  const locked = match.finished || new Date(match.kickoff).getTime() - LOCK_MS <= Date.now();
  if (!locked) return Response.json({ locked: false, bets: [] });

  const scoring = await getSetting("scoring");
  const bets = await prisma.bet.findMany({ where: { matchId }, include: { participant: true } });
  const rows = bets.map((b) => ({
    name: b.participant.name,
    homeGuess: b.homeGuess,
    awayGuess: b.awayGuess,
    points: match.finished ? betPoints(b, match, scoring) : null,
  })).sort((a, b) => (b.points || 0) - (a.points || 0) || a.name.localeCompare(b.name));

  return Response.json({ locked: true, finished: match.finished, bets: rows });
}

export const dynamic = "force-dynamic";
