import { regenerateAll } from "@/lib/leigoMaster";
import { requireAdmin } from "@/lib/session";

// GET: chamado pelo Vercel Cron de madrugada. Protegido por CRON_SECRET (a Vercel envia o header automaticamente).
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await regenerateAll();
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ error: e?.message || "falhou" }, { status: 500 });
  }
}

// POST: botão "Atualizar agora" do admin (força a regeração de todos).
export async function POST() {
  if (!(await requireAdmin())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const r = await regenerateAll();
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ error: e?.message || "falhou" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
