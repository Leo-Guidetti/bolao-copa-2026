import { currentParticipant } from "@/lib/session";
import { getRoast, VALID } from "@/lib/leigoMaster";

export async function GET(req) {
  const me = await currentParticipant();
  if (!me) return Response.json({ error: "Faça login." }, { status: 401 });
  const ctxParam = new URL(req.url).searchParams.get("ctx");
  const ctx = VALID.includes(ctxParam) ? ctxParam : "home";
  const res = await getRoast(me, ctx);
  if (res.error) return Response.json({ error: res.error }, { status: res.status || 502 });
  return Response.json({ text: res.text, day: res.day, stale: !!res.stale });
}

export const dynamic = "force-dynamic";
