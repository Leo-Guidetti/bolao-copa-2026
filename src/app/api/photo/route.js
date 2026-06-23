// Proxy de imagem: serve as fotos dos jogadores pelo NOSSO domínio, evitando que
// bloqueadores (uBlock/Brave/AdGuard) barrem o CDN do API-Football (media.api-sports.io).
// Só busca hosts da allowlist (evita virar proxy aberto / SSRF).
const ALLOW = ["media.api-sports.io", "a.espncdn.com", "espncdn.com"];

export async function GET(req) {
  const u = new URL(req.url).searchParams.get("u");
  if (!u) return new Response("missing u", { status: 400 });
  let target;
  try { target = new URL(u); } catch { return new Response("bad url", { status: 400 }); }
  if (target.protocol !== "https:" || !ALLOW.some((h) => target.hostname === h || target.hostname.endsWith("." + h))) {
    return new Response("forbidden host", { status: 403 });
  }
  try {
    const r = await fetch(target.toString(), { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return new Response("upstream " + r.status, { status: 502 });
    const buf = await r.arrayBuffer();
    return new Response(buf, {
      headers: {
        "content-type": r.headers.get("content-type") || "image/png",
        "cache-control": "public, max-age=2592000, s-maxage=2592000, immutable",
      },
    });
  } catch {
    return new Response("upstream error", { status: 502 });
  }
}

export const dynamic = "force-dynamic";
