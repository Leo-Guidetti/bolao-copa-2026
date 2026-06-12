import { prisma } from "@/lib/prisma";
import { activeProvider } from "@/lib/leigoMaster";

async function ping(url, opts, ms = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// GET /api/health  -> checagens baratas (banco, chaves, roasts do dia)
// GET /api/health?full=1 -> também pinga OpenAI e API-Football ao vivo (use no boletim diário)
export async function GET(req) {
  const full = new URL(req.url).searchParams.get("full") === "1";
  const out = { ok: true, time: new Date().toISOString() };

  // Banco (Supabase)
  try { await prisma.$queryRaw`SELECT 1`; out.db = "ok"; }
  catch (e) { out.db = "FALHA"; out.dbErro = String(e?.message || e).slice(0, 120); out.ok = false; }

  // IA do Leigo Master
  out.ia = {
    provedor: activeProvider(),
    openai: !!process.env.OPENAI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
  };
  out.apiFootball = { configurado: !!process.env.APIFOOTBALL_KEY };

  // Quantos já têm a opinião do dia
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const [participantes, comRoastHoje] = await Promise.all([
      prisma.participant.count(),
      prisma.participant.count({ where: { roastDay: today } }),
    ]);
    out.leigoMaster = { participantes, comRoastHoje };
  } catch { /* tabela pode não existir ainda */ }

  // Último sync da ESPN (carimbado pelo scripts/sync-espn.mjs a cada rodada)
  try {
    const row = await prisma.setting.findUnique({ where: { key: "lastSyncAt" } });
    const iso = row ? JSON.parse(row.value) : null;
    const minAtras = iso ? Math.round((Date.now() - new Date(iso).getTime()) / 60000) : null;
    out.sync = { lastSyncAt: iso, minutosAtras: minAtras };
    if (minAtras != null && minAtras > 90) { out.ok = false; out.sync.alerta = "sync parado há mais de 90 min"; }
    if (iso == null) out.sync.alerta = "nunca sincronizou";
  } catch { /* setting pode não existir ainda */ }

  if (full) {
    if (process.env.OPENAI_API_KEY) {
      try {
        const r = await ping("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
        out.ia.openaiPing = r.ok ? "ok" : `HTTP ${r.status}`;
        if (!r.ok) out.ok = false;
      } catch { out.ia.openaiPing = "FALHA"; out.ok = false; }
    }
    if (process.env.APIFOOTBALL_KEY) {
      try {
        const r = await ping("https://v3.football.api-sports.io/status", { headers: { "x-apisports-key": process.env.APIFOOTBALL_KEY } });
        const d = await r.json().catch(() => ({}));
        out.apiFootball.ping = r.ok ? "ok" : `HTTP ${r.status}`;
        const req = d?.response?.requests;
        if (req) out.apiFootball.requisicoes = `${req.current}/${req.limit_day} no dia`;
        if (!r.ok) out.ok = false;
      } catch { out.apiFootball.ping = "FALHA"; out.ok = false; }
    }
  }

  return Response.json(out);
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;
