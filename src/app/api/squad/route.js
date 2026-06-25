import { prisma } from "@/lib/prisma";
import { currentParticipant } from "@/lib/session";
import { getSquadLock, getKoWindow } from "@/lib/locks";
import { getSetting } from "@/lib/config";

async function snapshotFor(participantId) {
  const s = await prisma.setting.findUnique({ where: { key: "groupSquadSnapshot" } });
  let snap = {};
  try { snap = JSON.parse(s?.value || "{}"); } catch {}
  return snap[participantId] || null;
}
async function snapshotIdsFor(participantId) {
  const snap = await snapshotFor(participantId);
  return snap ? snap.players.map((x) => x.playerId) : null;
}

export async function GET() {
  const p = await currentParticipant();
  if (!p) return Response.json(null);
  const squad = await prisma.squad.findUnique({ where: { participantId: p.id }, include: { players: true } });
  const ko = await getKoWindow();
  if (!squad) return Response.json(null);
  // Time congelado (base) pra marcar/contar as trocas (sempre que houver snapshot, mesmo fora da janela).
  const snapshotIds = await snapshotIdsFor(p.id);
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

  // Janela do mata-mata: no máximo N trocas em relação ao time congelado, e o CAMISA 10 NÃO pode mudar.
  let effectiveCaptain = captainId || null;
  if (koMode) {
    const snap = await snapshotFor(p.id);
    if (snap) {
      const base = new Set(snap.players.map((x) => x.playerId));
      const subs = ids.filter((id) => !base.has(id)).length;
      if (subs > (ko.maxSubs ?? 4)) return Response.json({ error: `Máximo de ${ko.maxSubs ?? 4} trocas para o mata-mata (você fez ${subs}).` }, { status: 422 });
      effectiveCaptain = snap.captainId || null; // camisa 10 travado na janela do mata-mata
    }
  }

  const squad = await prisma.squad.upsert({
    where: { participantId: p.id },
    update: { formation, captainId: effectiveCaptain },
    create: { participantId: p.id, formation, captainId: effectiveCaptain },
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
