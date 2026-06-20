import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { syncEspn } from "@/lib/espnSync";

// POST /api/admin/sync
//   body {} ou { scout:false } -> só PLACARES (inclui ao vivo), leve e rápido.
//   body { scout:true }        -> PLACARES + SCOUT (pontos por jogador) dos 2 jogos mais recentes + ao vivo.
// O scout completo (horizonte maior) continua no GitHub Action de hora em hora.
export async function POST(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  let scout = false;
  try { scout = !!(await req.json())?.scout; } catch {}
  try {
    const r = scout
      ? await syncEspn({ prisma, sinceDays: 2, includeLive: true, scoresOnly: false, scoutMaxGames: 2 })
      : await syncEspn({ prisma, sinceDays: null, includeLive: true, scoresOnly: true });
    return Response.json({ ok: true, scout, ...r });
  } catch (e) {
    return Response.json({ ok: false, error: e.message || "Falha no sync" }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
