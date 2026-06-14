import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { syncEspn } from "@/lib/espnSync";

// POST /api/admin/sync -> só PLACARES (inclui jogos ao vivo), leve e rápido.
// O scout pesado (pontos por jogador) fica por conta do GitHub Action de hora em hora.
export async function POST() {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  try {
    const r = await syncEspn({ prisma, sinceDays: null, includeLive: true, scoresOnly: true });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ ok: false, error: e.message || "Falha no sync" }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
