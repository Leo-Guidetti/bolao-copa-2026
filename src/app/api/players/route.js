import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { playerScore } from "@/lib/scoring";
import { getSetting } from "@/lib/config";

const STAT_FIELDS = ["goals", "assists", "cleanSheet", "saves", "yellow", "red", "ownGoals", "shots", "shotsOnTarget", "shotsOnPost", "tackles", "interceptions", "penaltiesSaved", "penaltiesMissed", "shootOutSaved", "blockedShots", "foulsSuffered", "foulsCommitted", "goalsConceded"];

export async function GET() {
  const players = await prisma.player.findMany({ orderBy: [{ team: "asc" }, { name: "asc" }] });
  // minutos jogados (soma das partidas) -> usado para "quem já jogou"
  const mins = await prisma.matchPlayerStat.groupBy({ by: ["playerId"], _sum: { minutes: true } });
  const minMap = Object.fromEntries(mins.map((m) => [m.playerId, m._sum.minutes || 0]));

  // Pontuação SÓ do mata-mata por jogador (usada quando o jogador entrou na troca do KO).
  const [koMatches, allStats, squadRules] = await Promise.all([
    prisma.match.findMany({ where: { stage: { not: "GROUP" } }, select: { id: true } }),
    prisma.matchPlayerStat.findMany(),
    getSetting("squadRules"),
  ]);
  const koIds = new Set(koMatches.map((m) => m.id));
  const scout = squadRules?.scout || {};
  const koAgg = {};
  for (const st of allStats) {
    if (!koIds.has(st.matchId)) continue;
    const b = (koAgg[st.playerId] ||= {});
    for (const f of STAT_FIELDS) b[f] = (b[f] || 0) + (st[f] || 0);
  }

  return Response.json(players.map((p) => ({
    ...p,
    minutes: minMap[p.id] || 0,
    koPts: playerScore({ position: p.position, ...(koAgg[p.id] || {}) }, scout),
  })));
}

export async function POST(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const b = await req.json();
  const p = await prisma.player.create({
    data: {
      name: b.name,
      team: b.team,
      position: b.position || "MEI",
      price: Number(b.price) || 5,
    },
  });
  return Response.json(p);
}

// Atualiza scout do jogador (admin). Idealmente isto viria de uma API de resultados.
export async function PATCH(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const b = await req.json();
  const num = (x) => (x == null ? undefined : Number(x));
  const p = await prisma.player.update({
    where: { id: b.id },
    data: {
      goals: num(b.goals),
      assists: num(b.assists),
      cleanSheet: num(b.cleanSheet),
      saves: num(b.saves),
      yellow: num(b.yellow),
      red: num(b.red),
      ownGoals: num(b.ownGoals),
      price: num(b.price),
      position: b.position || undefined,
    },
  });
  return Response.json(p);
}

export async function DELETE(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const { searchParams } = new URL(req.url);
  await prisma.player.delete({ where: { id: searchParams.get("id") } });
  return Response.json({ ok: true });
}

export const dynamic = "force-dynamic";
