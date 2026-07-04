import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  const matches = await prisma.match.findMany({ orderBy: { order: "asc" } });
  return Response.json(matches);
}

export async function POST(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const b = await req.json();
  const count = await prisma.match.count();
  const m = await prisma.match.create({
    data: {
      homeTeam: b.homeTeam,
      awayTeam: b.awayTeam,
      stage: b.stage || "GROUP",
      group: b.group || null,
      round: b.round ? Number(b.round) : null,
      kickoff: b.kickoff ? new Date(b.kickoff) : new Date(),
      order: count + 1,
    },
  });
  return Response.json(m);
}

// Atualiza qualquer campo enviado (placar, times, fase, etc.)
export async function PATCH(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const b = await req.json();
  const data = {};
  if (b.homeTeam !== undefined) data.homeTeam = b.homeTeam;
  if (b.awayTeam !== undefined) data.awayTeam = b.awayTeam;
  if (b.stage !== undefined) data.stage = b.stage;
  if (b.group !== undefined) data.group = b.group || null;
  if (b.round !== undefined) data.round = b.round === "" || b.round == null ? null : Number(b.round);
  if (b.kickoff) data.kickoff = new Date(b.kickoff);
  if (b.homeScore !== undefined) data.homeScore = b.homeScore === "" || b.homeScore == null ? null : Number(b.homeScore);
  if (b.awayScore !== undefined) data.awayScore = b.awayScore === "" || b.awayScore == null ? null : Number(b.awayScore);
  if (b.finished !== undefined) data.finished = !!b.finished;
  if (b.advancer !== undefined) data.advancer = b.advancer === "home" || b.advancer === "away" ? b.advancer : null;
  if (b.manualResult !== undefined) data.manualResult = !!b.manualResult;
  const m = await prisma.match.update({ where: { id: b.id }, data });
  return Response.json(m);
}

export async function DELETE(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const { searchParams } = new URL(req.url);
  await prisma.match.delete({ where: { id: searchParams.get("id") } });
  return Response.json({ ok: true });
}

export const dynamic = "force-dynamic";
