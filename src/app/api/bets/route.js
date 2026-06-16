import { prisma } from "@/lib/prisma";
import { currentParticipant } from "@/lib/session";

export async function GET() {
  const p = await currentParticipant();
  if (!p) return Response.json([]);
  const bets = await prisma.bet.findMany({ where: { participantId: p.id } });
  return Response.json(bets);
}

export async function POST(req) {
  const p = await currentParticipant();
  if (!p) return Response.json({ error: "Faça login." }, { status: 401 });
  const { bets } = await req.json();
  const matches = await prisma.match.findMany();
  const matchById = Object.fromEntries(matches.map((m) => [m.id, m]));
  const now = Date.now();
  const LOCK_MS = 1 * 60 * 1000; // palpite trava 1 min antes do apito
  let saved = 0;
  for (const b of bets || []) {
    const m = matchById[b.matchId];
    if (!m || m.finished || new Date(m.kickoff).getTime() - LOCK_MS <= now) continue;
    if (b.homeGuess == null || b.awayGuess == null) continue;
    await prisma.bet.upsert({
      where: { participantId_matchId: { participantId: p.id, matchId: b.matchId } },
      update: { homeGuess: Number(b.homeGuess), awayGuess: Number(b.awayGuess) },
      create: { participantId: p.id, matchId: b.matchId, homeGuess: Number(b.homeGuess), awayGuess: Number(b.awayGuess) },
    });
    saved++;
  }
  return Response.json({ ok: true, saved });
}

export const dynamic = "force-dynamic";
