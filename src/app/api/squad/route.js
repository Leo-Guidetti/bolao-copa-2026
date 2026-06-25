import { prisma } from "@/lib/prisma";
import { currentParticipant } from "@/lib/session";
import { getSquadLock, getKoWindow } from "@/lib/locks";
import { getSetting } from "@/lib/config";

async function snapshotIdsFor(participantId) {
  const s = await prisma.setting.findUnique({ where: { key: "groupSquadSnapshot" } });
  let snap = {};
  try { snap = JSON.parse(s?.value || "{}"); } catch {}
  return (snap[participantId]?.players || []).map((x) => x.playerId);
}

export async function GET() {
  const p = await currentParticipant();
  if (!p) return Response.json(null);
  const squad = await prisma.squad.findUnique({ where: { participantId: p.id }, include: { players: true } });
  const ko = await getKoWindow();
  if (!squad) return Response.json(null);
  // Na janela de troca do mata-mata mandamos também o time congelado (base) pra contar as trocas.
  const snapshotIds = ko.open ? await snapshotIdsFor(p.id) : null;
  return Response.json({ ...squad, koOpen: ko.open, koDeadline: ko.deadline, koMaxSubs: ko.maxSubs, snapshotIds });
}

export async function POST(req) {
  const p = await currentParticipant();
  if (!p) return Response.json({ error: "Faça login." }, { status: 401 });
  const lock = await getSquadLock();
  const ko = await getKoWindow();
  const koMode = lock.locked && ko.open; // grupos travados, mas janela do mata-mata aberta
  if (lock.locked && !ko.open) return Response.json({ error: "Prazo para editar a seleção encerrado." }, { status: 403 });

  const { formation, captainId, starterIds = [], reserveIds = [] } = await req.json();
  const ids = [...starterIds, ...reserveIds];

  // Orçamento
  if (ids.length) {
    const pls = await prisma.player.findMany({ where: { id: { in: ids } }, select: { price: true } });
    const cost = pls.reduce((s, x) => s + (x.price || 0), 0);
    const cap = (await getSetting("squadRules"))?.budgetCap ?? 50;
    if (cost > cap) return Response.json({ error: `Seleção acima do orçamento (${cost}¢ de ${cap}¢). Ajuste para salvar.` }, { status: 422 });
  }

  // Janela do mata-mata: no máximo N trocas em relação ao time congelado (snapshot).
  if (koMode) {
    const base = new Set(await snapshotIdsFor(p.id));
    if (base.size) {
      const subs = ids.filter((id) => !base.has(id)).length;
      if (subs > (ko.maxSubs ?? 4)) return Response.json({ error: `Máximo de ${ko.maxSubs ?? 4} trocas para o mata-mata (você fez ${subs}).` }, { status: 422 });
    }
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
