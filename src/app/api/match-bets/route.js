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
  const [participants, bets] = await Promise.all([
    prisma.participant.findMany({ select: { id: true, name: true } }),
    prisma.bet.findMany({ where: { matchId } }),
  ]);
  const byP = new Map(bets.map((b) => [b.participantId, b]));
  const rows = participants.map((p) => {
    const b = byP.get(p.id);
    if (!b) return { name: p.name, noBet: true };
    return { name: p.name, homeGuess: b.homeGuess, awayGuess: b.awayGuess, points: match.finished ? betPoints(b, match, scoring) : null, noBet: false };
  }).sort((a, b) => {
    if (a.noBet !== b.noBet) return a.noBet ? 1 : -1;             // quem palpitou primeiro
    if (a.noBet) return a.name.localeCompare(b.name);             // sem palpite em ordem alfabética
    return (b.points || 0) - (a.points || 0) || a.name.localeCompare(b.name);
  });

  return Response.json({ locked: true, finished: match.finished, bets: rows });
}

export const dynamic = "force-dynamic";
