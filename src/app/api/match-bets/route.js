import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/config";
import { betPoints } from "@/lib/scoring";

const LOCK_MS = 1 * 60 * 1000; // mesmo lock das apostas (1 min antes)

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

  // Agrupa por placar igual; ordena por mais palpitado, depois por mais gols no total.
  const groups = new Map();
  for (const p of participants) {
    const b = byP.get(p.id);
    if (!b) continue;
    const key = `${b.homeGuess}-${b.awayGuess}`;
    if (!groups.has(key)) groups.set(key, { hg: b.homeGuess, ag: b.awayGuess, names: [] });
    groups.get(key).names.push(p.name);
  }
  const gArr = [...groups.values()].map((g) => ({
    ...g, count: g.names.length, total: g.hg + g.ag,
    points: match.finished ? betPoints({ homeGuess: g.hg, awayGuess: g.ag }, match, scoring) : null,
  })).sort((a, b) => (match.finished
    ? ((b.points || 0) - (a.points || 0) || b.count - a.count || b.total - a.total)
    : (b.count - a.count || b.total - a.total)) || a.hg - b.hg || a.ag - b.ag);

  const rows = [];
  for (const g of gArr) {
    g.names.sort((a, b) => a.localeCompare(b));
    for (const n of g.names) rows.push({ name: n, homeGuess: g.hg, awayGuess: g.ag, points: g.points, noBet: false });
  }
  // quem não palpitou vai pro fim
  for (const p of participants.filter((p) => !byP.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))) {
    rows.push({ name: p.name, noBet: true });
  }

  // distribuição de resultado (mandante / empate / visitante) entre quem palpitou
  let home = 0, draw = 0, away = 0;
  for (const b of bets) { if (b.homeGuess > b.awayGuess) home++; else if (b.homeGuess < b.awayGuess) away++; else draw++; }
  const dist = { home, draw, away, total: bets.length };

  return Response.json({ locked: true, finished: match.finished, bets: rows, dist });
}

export const dynamic = "force-dynamic";
