import { prisma } from "@/lib/prisma";
import { currentParticipant } from "@/lib/session";
import { getSquadLock } from "@/lib/locks";
import { getSetting } from "@/lib/config";

export async function GET() {
  const p = await currentParticipant();
  if (!p) return Response.json(null);
  const squad = await prisma.squad.findUnique({ where: { participantId: p.id }, include: { players: true } });
  return Response.json(squad);
}

export async function POST(req) {
  const p = await currentParticipant();
  if (!p) return Response.json({ error: "Faça login." }, { status: 401 });
  const lock = await getSquadLock();
  if (lock.locked) return Response.json({ error: "Prazo para editar a seleção encerrado (30 min antes da estreia)." }, { status: 403 });
  const { formation, captainId, starterIds = [], reserveIds = [] } = await req.json();
  // Bloqueia salvar seleção acima do orçamento
  const ids = [...starterIds, ...reserveIds];
  if (ids.length) {
    const pls = await prisma.player.findMany({ where: { id: { in: ids } }, select: { price: true } });
    const cost = pls.reduce((s, x) => s + (x.price || 0), 0);
    const cap = (await getSetting("squadRules"))?.budgetCap ?? 50;
    if (cost > cap) return Response.json({ error: `Seleção acima do orçamento (${cost}¢ de ${cap}¢). Ajuste para salvar.` }, { status: 422 });
  }
  const squad = await prisma.squad.upsert({
    where: { participantId: p.id },
    update: { formation, captainId: captainId || null },
    create: { participantId: p.id, formation, captainId: captainId || null },
  });
  await prisma.squadPlayer.deleteMany({ where: { squadId: squad.id } });
  const rows = [
    ...starterIds.map((playerId) => ({ squadId: squad.id, playerId, isStarter: true })),
    ...reserveIds.map((playerId) => ({ squadId: squad.id, playerId, isStarter: false })),
  ];
  if (rows.length) await prisma.squadPlayer.createMany({ data: rows });
  return Response.json({ ok: true });
}

export const dynamic = "force-dynamic";
