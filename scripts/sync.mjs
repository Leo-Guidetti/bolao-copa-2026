// Sincroniza Copa 2026 a partir da API-Football (api-sports.io).
//  - Placares: sempre (homeScore/awayScore + finished). Pontos das apostas recomputam sozinhos.
//  - Scout dos jogadores (gols, assist., cartoes, gol contra, jogo sem sofrer gol, defesas): com --stats.
//    Grava tambem o scout POR JOGO (tabela MatchPlayerStat) que alimenta a aba "Stats dos jogos".
// Uso:
//   node scripts/sync.mjs            -> aplica placares
//   node scripts/sync.mjs --stats    -> aplica placares + scout (total + por jogo)
//   node scripts/sync.mjs --dry      -> so mostra, nao grava (combina com --stats)
// .env: APIFOOTBALL_KEY="...". Opcional: APIFOOTBALL_LEAGUE=1, APIFOOTBALL_SEASON=2026
import { PrismaClient } from "@prisma/client";

const BASE = "https://v3.football.api-sports.io";
const FINAL = new Set(["FT", "AET", "PEN"]);

export const TEAM_ALIAS = {
  "Brazil": "Brasil", "Mexico": "Mexico", "South Africa": "Africa do Sul", "South Korea": "Coreia do Sul",
  "Czech Republic": "Republica Tcheca", "Czechia": "Republica Tcheca", "Canada": "Canada",
  "Bosnia and Herzegovina": "Bosnia", "Bosnia": "Bosnia", "Qatar": "Catar", "Switzerland": "Suica",
  "Morocco": "Marrocos", "Haiti": "Haiti", "Scotland": "Escocia", "USA": "Estados Unidos", "United States": "Estados Unidos",
  "Paraguay": "Paraguai", "Australia": "Australia", "Turkey": "Turquia", "Türkiye": "Turquia", "Germany": "Alemanha",
  "Curacao": "Curacao", "Ivory Coast": "Costa do Marfim", "Ecuador": "Equador", "Netherlands": "Holanda",
  "Japan": "Japao", "Sweden": "Suecia", "Tunisia": "Tunisia", "Belgium": "Belgica", "Egypt": "Egito",
  "Iran": "Ira", "New Zealand": "Nova Zelandia", "Spain": "Espanha", "Cape Verde Islands": "Cabo Verde",
  "Cape Verde": "Cabo Verde", "Saudi Arabia": "Arabia Saudita", "Uruguay": "Uruguai", "France": "Franca",
  "Senegal": "Senegal", "Iraq": "Iraque", "Norway": "Noruega", "Argentina": "Argentina", "Algeria": "Argelia",
  "Austria": "Austria", "Jordan": "Jordania", "Portugal": "Portugal", "Congo DR": "RD Congo", "DR Congo": "RD Congo",
  "Uzbekistan": "Uzbequistao", "Colombia": "Colombia", "Croatia": "Croacia", "Ghana": "Gana", "England": "Inglaterra",
  "Panama": "Panama",
};

export const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
export const toApp = (apiName) => TEAM_ALIAS[apiName] || apiName;
const pairKey = (a, b) => [norm(a), norm(b)].sort().join("|");

// Pura: decide quais jogos atualizar. Testavel sem rede.
export function planScoreUpdates(matches, fixtures) {
  const byPair = new Map();
  for (const m of matches) {
    if (m.homeTeam === "A definir" || m.awayTeam === "A definir") continue;
    byPair.set(pairKey(m.homeTeam, m.awayTeam), m);
  }
  const updates = [], unmatched = [];
  for (const f of fixtures) {
    const home = toApp(f.teams?.home?.name), away = toApp(f.teams?.away?.name);
    const m = byPair.get(pairKey(home, away));
    if (!m) { unmatched.push(`${f.teams?.home?.name} x ${f.teams?.away?.name}`); continue; }
    const finished = FINAL.has(f.fixture?.status?.short);
    let hs = f.goals?.home, as = f.goals?.away;
    if (hs == null || as == null) continue;
    if (norm(home) !== norm(m.homeTeam)) { const t = hs; hs = as; as = t; } // alinha mandante
    if (m.homeScore !== hs || m.awayScore !== as || m.finished !== finished)
      updates.push({ id: m.id, label: `${m.homeTeam} ${hs} x ${as} ${m.awayTeam}`, hs, as, finished });
  }
  return { updates, unmatched };
}

export async function runSync({ httpGet, prisma, dry = false, stats = false, log = console.log }) {
  const league = process.env.APIFOOTBALL_LEAGUE || "1";
  const season = process.env.APIFOOTBALL_SEASON || "2026";
  const fixtures = await httpGet(`/fixtures?league=${league}&season=${season}`);
  log(`API-Football: ${fixtures.length} jogos (liga ${league}, temporada ${season}).`);

  const matches = await prisma.match.findMany();
  const { updates, unmatched } = planScoreUpdates(matches, fixtures);
  for (const u of updates) {
    log(`${u.finished ? "[FT]" : "[--]"} ${u.label}`);
    if (!dry) await prisma.match.update({ where: { id: u.id }, data: { homeScore: u.hs, awayScore: u.as, finished: u.finished } });
  }
  log(`${dry ? "[DRY] " : ""}Placares atualizados: ${updates.length}.`);
  if (unmatched.length) log(`Times sem match (${unmatched.length}): ${[...new Set(unmatched)].join(", ")}`);

  if (stats) await syncStats({ httpGet, prisma, fixtures, dry, log });
}

// Scout por jogador: total acumulado (colunas do Player) + por jogo (MatchPlayerStat).
export async function syncStats({ httpGet, prisma, fixtures, dry = false, log = console.log }) {
  const players = await prisma.player.findMany();
  const idx = new Map();           // teamNorm|nameNorm -> player
  const idxLast = new Map();       // teamNorm|lastNorm -> player
  for (const p of players) {
    idx.set(norm(p.team) + "|" + norm(p.name), p);
    const parts = p.name.split(" ");
    idxLast.set(norm(p.team) + "|" + norm(parts[parts.length - 1]), p);
  }
  const find = (teamApp, name) =>
    idx.get(norm(teamApp) + "|" + norm(name)) ||
    idxLast.get(norm(teamApp) + "|" + norm(name.split(" ").pop())) || null;

  // casa cada fixture da API com um jogo do nosso calendario (por par de times)
  const matches = await prisma.match.findMany();
  const byPair = new Map();
  for (const m of matches) {
    if (m.homeTeam === "A definir" || m.awayTeam === "A definir") continue;
    byPair.set(pairKey(m.homeTeam, m.awayTeam), m);
  }
  const fixtureMatch = (f) => byPair.get(pairKey(toApp(f.teams?.home?.name), toApp(f.teams?.away?.name))) || null;

  const blank = () => ({ goals:0,assists:0,cleanSheet:0,saves:0,yellow:0,red:0,ownGoals:0,shots:0,shotsOnTarget:0,tackles:0,interceptions:0,penaltiesSaved:0 });
  const acc = new Map();        // playerId -> totais (colunas do Player)
  const perMatch = new Map();   // matchId|playerId -> linha por jogo
  const bump = (p, field, n = 1) => { const a = acc.get(p.id) || (acc.set(p.id, blank()), acc.get(p.id)); a[field] += n; };
  const pm = (match, p, fixtureId) => {
    const k = match.id + "|" + p.id;
    let r = perMatch.get(k);
    if (!r) { r = { ...blank(), matchId: match.id, playerId: p.id, fixtureId: fixtureId ?? null, minutes: 0 }; perMatch.set(k, r); }
    return r;
  };

  const finished = fixtures.filter((f) => FINAL.has(f.fixture?.status?.short));
  const touchedMatches = new Set();
  const unmatched = new Set();
  for (const f of finished) {
    const fid = f.fixture?.id;
    const match = fixtureMatch(f);
    if (match) touchedMatches.add(match.id);
    const homeApp = toApp(f.teams?.home?.name), awayApp = toApp(f.teams?.away?.name);
    const concededBy = { [norm(homeApp)]: f.goals?.away ?? 0, [norm(awayApp)]: f.goals?.home ?? 0 };
    let lineups = [];
    try { lineups = await httpGet(`/fixtures/players?fixture=${fid}`); } catch (e) { log("  (sem players p/ fixture " + fid + ")"); }
    for (const teamBlock of lineups) {
      const teamApp = toApp(teamBlock.team?.name);
      for (const row of teamBlock.players || []) {
        const st = (row.statistics && row.statistics[0]) || {};
        const p = find(teamApp, row.player?.name);
        if (!p) { unmatched.add(`${row.player?.name} (${teamApp})`); continue; }
        const minutes = st.games?.minutes || 0;
        const s = {
          goals: st.goals?.total || 0, assists: st.goals?.assists || 0, saves: st.goals?.saves || 0,
          yellow: st.cards?.yellow || 0, red: st.cards?.red || 0,
          shots: st.shots?.total || 0, shotsOnTarget: st.shots?.on || 0,
          tackles: st.tackles?.total || 0, interceptions: st.tackles?.interceptions || 0,
          penaltiesSaved: st.penalty?.saved || 0,
          cleanSheet: (minutes > 0 && concededBy[norm(teamApp)] === 0 && ["GOL","ZAG","LAT"].includes(p.position)) ? 1 : 0,
        };
        for (const k of Object.keys(s)) if (s[k]) bump(p, k, s[k]);
        if (match) { const r = pm(match, p, fid); r.minutes = minutes; for (const k of Object.keys(s)) r[k] += s[k]; }
      }
    }
    // gols contra via eventos
    let events = [];
    try { events = await httpGet(`/fixtures/events?fixture=${fid}`); } catch {}
    for (const ev of events) {
      if (ev.type === "Goal" && ev.detail === "Own Goal") {
        const p = find(toApp(ev.team?.name), ev.player?.name);
        if (p) { bump(p, "ownGoals", 1); if (match) pm(match, p, fid).ownGoals += 1; }
      }
    }
  }

  log(`Scout: ${acc.size} jogadores com estatistica (de ${finished.length} jogos encerrados). Por jogo: ${perMatch.size} linhas em ${touchedMatches.size} jogos.`);
  if (unmatched.size) log(`Jogadores sem match (${unmatched.size}) - ex: ${[...unmatched].slice(0,8).join(", ")}`);
  if (!dry) {
    // zera todos e aplica os acumulados (idempotente)
    await prisma.player.updateMany({ data: blank() });
    for (const [id, s] of acc) await prisma.player.update({ where: { id }, data: s });
    // regrava as linhas por jogo so dos jogos tocados (idempotente)
    if (touchedMatches.size) await prisma.matchPlayerStat.deleteMany({ where: { matchId: { in: [...touchedMatches] } } });
    const rows = [...perMatch.values()];
    if (rows.length) await prisma.matchPlayerStat.createMany({ data: rows });
  }
  return { acc, perMatch };
}

// ---- execucao real (so quando rodado direto) ----
const isMain = process.argv[1] && /(^|[\\/])sync\.mjs$/.test(process.argv[1]);
if (isMain) {
  const KEY = process.env.APIFOOTBALL_KEY;
  if (!KEY) { console.error("Falta APIFOOTBALL_KEY no .env (chave gratis em https://www.api-football.com/)."); process.exit(1); }
  const httpGet = async (path) => {
    const r = await fetch(BASE + path, { headers: { "x-apisports-key": KEY } });
    if (!r.ok) throw new Error(`API-Football ${path} -> HTTP ${r.status}`);
    const j = await r.json();
    if (j.errors && Object.keys(j.errors).length) throw new Error("API-Football: " + JSON.stringify(j.errors));
    return j.response || [];
  };
  const prisma = new PrismaClient();
  runSync({ httpGet, prisma, dry: process.argv.includes("--dry"), stats: process.argv.includes("--stats") })
    .catch((e) => { console.error(e.message || e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
