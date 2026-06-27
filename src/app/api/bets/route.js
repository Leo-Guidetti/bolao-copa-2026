import { prisma } from "@/lib/prisma";
import { currentParticipant } from "@/lib/session";
import { flagUrl } from "@/lib/flags";
import { getSetting } from "@/lib/config";

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
  const koBetsOpen = !!(await getSetting("koBets"))?.open; // palpites do mata-mata liberados?
  let saved = 0;
  for (const b of bets || []) {
    const m = matchById[b.matchId];
    if (!m || m.finished || new Date(m.kickoff).getTime() - LOCK_MS <= now) continue;
    if (!flagUrl(m.homeTeam) || !flagUrl(m.awayTeam)) continue; // não aposta em vaga ainda indefinida (mata-mata)
    if (m.stage !== "GROUP" && !koBetsOpen) continue; // mata-mata fechado por enquanto
    if (b.homeGuess == null || b.awayGuess == null) continue;
    const gh = Number(b.homeGuess), ga = Number(b.awayGuess);

    // Quem classifica (só mata-mata): vitória pré-define automaticamente; empate exige a escolha.
    let advance = null;
    if (m.stage !== "GROUP") {
      if (gh > ga) advance = "home";
      else if (ga > gh) advance = "away";
      else advance = (b.advance === "home" || b.advance === "away") ? b.advance : null;
      if (advance == null) continue; // empate no mata-mata sem escolher quem passa: não salva
    }

    await prisma.bet.upsert({
      where: { participantId_matchId: { participantId: p.id, matchId: b.matchId } },
      update: { homeGuess: gh, awayGuess: ga, advance },
      create: { participantId: p.id, matchId: b.matchId, homeGuess: gh, awayGuess: ga, advance },
    });
    saved++;
  }
  return Response.json({ ok: true, saved });
}

export const dynamic = "force-dynamic";
