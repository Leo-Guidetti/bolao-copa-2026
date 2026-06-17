// Preenche a foto (photoUrl) dos jogadores:
//   1) ESPN (headshot) — grátis, mas cobre poucos jogadores.
//   2) API-Football (/players/squads por seleção) — cobre o resto, com a chave APIFOOTBALL_KEY.
// É RESUMÍVEL: só busca quem ainda não tem foto. A API-Football tem limite por minuto no plano free,
// então pode parar no meio — é só rodar de novo (espaçando ~1 min) até completar.
//   node scripts/backfill-photos.mjs
import { PrismaClient } from "@prisma/client";
import fs from "fs";

// Carrega o .env (DATABASE_URL, DIRECT_URL, APIFOOTBALL_KEY) pra rodar local sem setup.
try {
  for (const l of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {}

const prisma = new PrismaClient();
const KEY = process.env.APIFOOTBALL_KEY;
const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TEAM_ALIAS = { "Brazil": "Brasil", "Mexico": "Mexico", "South Africa": "Africa do Sul", "South Korea": "Coreia do Sul", "Korea Republic": "Coreia do Sul", "Czechia": "Republica Tcheca", "Czech Republic": "Republica Tcheca", "Canada": "Canada", "Bosnia-Herzegovina": "Bosnia", "Bosnia and Herzegovina": "Bosnia", "Qatar": "Catar", "Switzerland": "Suica", "Morocco": "Marrocos", "Haiti": "Haiti", "Scotland": "Escocia", "USA": "Estados Unidos", "United States": "Estados Unidos", "Paraguay": "Paraguai", "Australia": "Australia", "Turkey": "Turquia", "Türkiye": "Turquia", "Germany": "Alemanha", "Curacao": "Curacao", "Curaçao": "Curacao", "Ivory Coast": "Costa do Marfim", "Ecuador": "Equador", "Netherlands": "Holanda", "Japan": "Japao", "Sweden": "Suecia", "Tunisia": "Tunisia", "Belgium": "Belgica", "Egypt": "Egito", "Iran": "Ira", "IR Iran": "Ira", "New Zealand": "Nova Zelandia", "Spain": "Espanha", "Cape Verde": "Cabo Verde", "Cape Verde Islands": "Cabo Verde", "Saudi Arabia": "Arabia Saudita", "Uruguay": "Uruguai", "France": "Franca", "Senegal": "Senegal", "Iraq": "Iraque", "Norway": "Noruega", "Argentina": "Argentina", "Algeria": "Argelia", "Austria": "Austria", "Jordan": "Jordania", "Portugal": "Portugal", "Congo DR": "RD Congo", "DR Congo": "RD Congo", "Uzbekistan": "Uzbequistao", "Colombia": "Colombia", "Croatia": "Croacia", "Ghana": "Gana", "England": "Inglaterra", "Panama": "Panama" };
const toApp = (n) => TEAM_ALIAS[n] || n;
// PT -> EN (nome para buscar a seleção na API-Football)
const PT_EN = { "Brasil": "Brazil", "Argentina": "Argentina", "Franca": "France", "Espanha": "Spain", "Portugal": "Portugal", "Alemanha": "Germany", "Inglaterra": "England", "Holanda": "Netherlands", "Uruguai": "Uruguay", "Croacia": "Croatia", "Belgica": "Belgium", "Mexico": "Mexico", "Estados Unidos": "USA", "Canada": "Canada", "Marrocos": "Morocco", "Senegal": "Senegal", "Colombia": "Colombia", "Equador": "Ecuador", "Japao": "Japan", "Coreia do Sul": "South Korea", "Suica": "Switzerland", "Austria": "Austria", "Noruega": "Norway", "Suecia": "Sweden", "Escocia": "Scotland", "Gana": "Ghana", "Costa do Marfim": "Ivory Coast", "Egito": "Egypt", "Tunisia": "Tunisia", "Argelia": "Algeria", "Africa do Sul": "South Africa", "Catar": "Qatar", "Arabia Saudita": "Saudi Arabia", "Ira": "Iran", "Australia": "Australia", "Nova Zelandia": "New Zealand", "Paraguai": "Paraguay", "Panama": "Panama", "Cabo Verde": "Cape Verde", "Curacao": "Curacao", "Haiti": "Haiti", "Bosnia": "Bosnia", "Republica Tcheca": "Czech Republic", "Turquia": "Turkey", "Iraque": "Iraq", "RD Congo": "Congo DR", "Uzbequistao": "Uzbekistan", "Jordania": "Jordan" };

const tok = (a, b) => a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a));
const makeFind = (list) => (name) => {
  const full = norm(name); const toks = (name || "").split(/\s+/).map(norm).filter(Boolean); const u = (a) => (a.length === 1 ? a[0] : null);
  const ex = list.filter((x) => x.full === full && full); if (ex.length) return ex[0];
  let r = u(list.filter((x) => x.full && (x.full.includes(full) || full.includes(x.full)))); if (r) return r;
  const last = toks[toks.length - 1] || ""; r = u(list.filter((x) => last && x.tokens[x.tokens.length - 1] === last)); if (r) return r;
  r = u(list.filter((x) => { const a = toks.filter((t) => t.length >= 3), b = x.tokens.filter((t) => t.length >= 3); if (!a.length || !b.length) return false; const [s, l] = a.length <= b.length ? [a, b] : [b, a]; return s.every((t) => l.some((z) => tok(t, z))); })); if (r) return r;
  return u(list.filter((x) => x.tokens.some((t) => t.length >= 4 && toks.some((z) => z.length >= 4 && tok(t, z)))));
};
const getJSON = async (u) => { const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (bolao)" } }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
const af = async (p) => { const r = await fetch(`https://v3.football.api-sports.io${p}`, { headers: { "x-apisports-key": KEY } }); return { j: await r.json(), rem: r.headers.get("x-ratelimit-requests-remaining") }; };
const ds = (off) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + off); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`; };

const players = await prisma.player.findMany();
const byTeamNorm = new Map();
for (const p of players) { const tn = norm(p.team); if (!byTeamNorm.has(tn)) byTeamNorm.set(tn, []); byTeamNorm.get(tn).push({ p, full: norm(p.name), tokens: p.name.split(/\s+/).map(norm).filter(Boolean) }); }

// ---- 1) ESPN ----
let espnSet = 0;
const byId = new Map();
for (let off = -14; off <= 0; off++) { try { const j = await getJSON(`${SITE}/scoreboard?dates=${ds(off)}`); for (const e of j.events || []) byId.set(e.id, e); } catch {} }
for (const e of byId.values()) {
  if (e.status?.type?.state !== "post") continue;
  let sum; try { sum = await getJSON(`${SITE}/summary?event=${e.id}`); } catch { continue; }
  for (const block of sum.rosters || []) {
    const find = makeFind(byTeamNorm.get(norm(toApp(block.team?.displayName))) || []);
    for (const r of block.roster || []) {
      const hs = r.athlete?.headshot?.href; if (!hs) continue;
      const hit = find(r.athlete?.displayName);
      if (hit && hit.p.photoUrl !== hs) { await prisma.player.update({ where: { id: hit.p.id }, data: { photoUrl: hs } }); hit.p.photoUrl = hs; espnSet++; }
    }
  }
}
console.log(`ESPN: +${espnSet} fotos.`);

// ---- 2) API-Football (só quem ainda falta) ----
let afSet = 0, rem = "?";
if (KEY) {
  const teams = {}; for (const p of players) (teams[p.team] ||= []).push(p);
  const todo = Object.keys(teams).filter((t) => teams[t].some((p) => !p.photoUrl));
  for (const team of todo) {
    const en = PT_EN[team] || team;
    try {
      const ts = await af(`/teams?search=${encodeURIComponent(en)}`); rem = ts.rem;
      const nat = (ts.j.response || []).find((x) => x.team?.national) || ts.j.response?.[0];
      if (!nat) { console.log(`  ${team}: seleção não encontrada na API-Football`); }
      else {
        const sq = await af(`/players/squads?team=${nat.team.id}`); rem = sq.rem;
        const list = teams[team].filter((p) => !p.photoUrl).map((p) => ({ p, full: norm(p.name), tokens: p.name.split(/\s+/).map(norm).filter(Boolean) }));
        const find = makeFind(list); let n = 0;
        for (const ap of sq.j.response?.[0]?.players || []) { const hit = find(ap.name); if (hit && ap.photo) { await prisma.player.update({ where: { id: hit.p.id }, data: { photoUrl: ap.photo } }); hit.full = "__"; hit.tokens = []; afSet++; n++; } }
        console.log(`  ${team}: +${n} (cota restante: ${rem})`);
      }
      if (rem !== "?" && rem != null && Number(rem) <= 2) { console.log("Cota da API-Football no limite — rode de novo daqui a ~1 min."); break; }
      await sleep(6500); // respeita o limite por minuto do plano free
    } catch (e) { console.log(`  ${team}: erro ${e.message}`); }
  }
}
const withP = await prisma.player.count({ where: { photoUrl: { not: null } } });
const total = await prisma.player.count();
console.log(`\nFotos: ${withP}/${total}. (rode de novo pra completar o resto)`);
await prisma.$disconnect();
