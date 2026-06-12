import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { syncEspn } from "@/lib/espnSync";

// POST /api/admin/sync -> puxa placares + scout (inclui jogos ao vivo) dos últimos 2 dias.
export async function POST() {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  try {
    const r = await syncEspn({ prisma, sinceDays: 2, includeLive: true });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ ok: false, error: e.message || "Falha no sync" }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
