import { getAllSettings, setSetting } from "@/lib/config";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  const settings = await getAllSettings();
  return Response.json(settings);
}

// Salva uma ou mais chaves de config. Body: { key, value } ou { settings: {...} }
export async function PUT(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const body = await req.json();
  if (body.key) {
    await setSetting(body.key, body.value);
  } else if (body.settings) {
    for (const [k, v] of Object.entries(body.settings)) await setSetting(k, v);
  }
  const settings = await getAllSettings();
  return Response.json(settings);
}

export const dynamic = "force-dynamic";
