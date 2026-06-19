// Sincroniza a Copa 2026 a partir da API publica e GRATUITA da ESPN (sem chave).
//  - Placares: scoreboard.
//  - Scout COMPLETO por jogador via API "core" da ESPN: gols, assist, finalizacoes,
//    finaliz. no alvo, defesas, DESARME, INTERCEPTACAO, defesa de penalti, cartoes,
//    gol contra, minutos e "sem sofrer gol" (derivado). 100% automatico.
//  Total de cada jogador (colunas do Player) = soma das linhas por jogo (MatchPlayerStat).
// Uso:
//   node scripts/sync-espn.mjs          -> aplica placares + scout
//   node scripts/sync-espn.mjs --dry    -> so mostra, nao grava
import { PrismaClient } from "@prisma/client";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const CORE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world";
const START = "2026-06-11";

const TEAM_ALIAS = {
  "Brazil": "Brasil", "Mexico": "Mexico", "South Africa": "Africa do Sul", "South Korea": "Coreia do Sul",
  "Korea Republic": "Coreia do Sul", "Czechia": "Republica Tcheca", "Czech Republic": "Republica Tcheca",
  "Canada": "Canada", "Bosnia-Herzegovina": "Bosnia", "Bosnia and Herzegovina": "Bosnia", "Qatar": "Catar",
  "Switzerland": "Suica", "Morocco": "Marrocos", "Haiti": "Haiti", "Scotland": "Escocia",
  "USA": "Estados Unidos", "United States": "Estados Unidos", "Paraguay": "Paraguai", "Australia": "Australia",
  "Turkey": "Turquia", "Türkiye": "Turquia", "Germany": "Alemanha", "Curacao": "Curacao", "Curaçao": "Curacao",
  "Ivory Coast": "Costa do Marfim", "Ecuador": "Equador", "Netherlands": "Holanda", "Japan": "Japao",
  "Sweden": "Suecia", "Tunisia": "Tunisia", "Belgium": "Belgica", "Egypt": "Egito", "Iran": "Ira",
  "IR Iran": "Ira", "New Zealand": "Nova Zelandia", "Spain": "Espanha", "Cape Verde": "Cabo Verde",
  "Cape Verde Islands": "Cabo Verde", "Saudi Arabia": "Arabia Saudita", "Uruguay": "Uruguai", "France": "Franca",
  "Senegal": "Senegal", "Iraq": "Iraque", "Norway": "Noruega", "Argentina": "Argentina", "Algeria": "Argelia",
  "Austria": "Austria", "Jordan": "Jordania", "Portugal": "Portugal", "Congo DR": "RD Congo", "DR Congo": "RD Congo",
  "Uzbekistan": "Uzbequistao", "Colombia": "Colombia", "Croatia": "Croacia", "Ghana": "Gana", "England": "Inglaterra",
  "Panama": "Panama",
};

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const toApp = (n) => TEAM_ALIAS[n] || n;
const pairKey = (a, b) => [norm(a), norm(b)].sort().join("|");

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (bolao-leigos)" } });
  if (!r.ok) throw new Error(`ESPN ${url.slice(0, 80)} -> HTTP ${r.status}`);
  return r.json();
}

// pool de concorrencia (pra nao martelar a ESPN)
async function pool(items, n, worker) {
  const out = []; let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx], idx); }
  });
  await Promise.all(runners);
  return out;
}

function datesFrom(start) {
  const out = [];
  const d = new Date(start + "T00:00:00Z");
  const end = new Date(); end.setUTCDate(end.getUTCDate() + 1);
  while (d <= end) {
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function fetchEvents(log) {
  const byId = new Map();
  for (const dt of datesFrom(START)) {
    let j;
    try { j = await getJSON(`${SITE}/scoreboard?dates=${dt}`); } catch (e) { log(`  (scoreboard ${dt}: ${e.message})`); continue; }
    for (const e of j.events || []) byId.set(e.id, e);
  }
  return [...byId.values()];
}

function parseEvent(e) {
  const c = e.competitions?.[0] || {};
  const cs = c.competitors || [];
  const home = cs.find((x) => x.homeAway === "home");
  const away = cs.find((x) => x.homeAway === "away");
  return {
    id: e.id,
    homeApp: toApp(home?.team?.displayName), awayApp: toApp(away?.team?.displayName),
    homeScore: home?.score != null ? Number(home.score) : null,
    awayScore: away?.score != null ? Number(away.score) : null,
    finished: e.status?.type?.state === "post",
    state: e.status?.type?.state, // pre | in | post
  };
}

const cval = (cats, cat, name) => {
  const c = (cats || []).find((x) => x.name === cat);
  const s = (c?.stats || []).find((y) => y.name === name);
  return s ? (Number(s.value) || 0) : 0;
};

export async function run({ prisma, dry = false, log = console.log }) {
  const events = (await fetchEvents(log)).map(parseEvent);
  log(`ESPN: ${events.length} jogos encontrados.`);

  const matches = await prisma.match.findMany();
  const byPair = new Map();
  for (const m of matches) {
    if (m.homeTeam === "A definir" || m.awayTeam === "A definir") continue;
    byPair.set(pairKey(m.homeTeam, m.awayTeam), m);
  }
  const matchFor = (ev) => byPair.get(pairKey(ev.homeApp, ev.awayApp)) || null;

  // ---- 1) PLACARES ----
  let placUpd = 0; const unmatched = new Set();
  for (const ev of events) {
    const m = matchFor(ev);
    if (!m) { if (ev.homeApp && ev.awayApp) unmatched.add(`${ev.homeApp} x ${ev.awayApp}`); continue; }
    if (ev.homeScore == null || ev.awayScore == null) continue;
    let hs = ev.homeScore, as = ev.awayScore;
    if (norm(ev.homeApp) !== norm(m.homeTeam)) { const t = hs; hs = as; as = t; }
    if (m.homeScore !== hs || m.awayScore !== as || m.finished !== ev.finished) {
      log(`${ev.finished ? "[FT]" : "[--]"} ${m.homeTeam} ${hs} x ${as} ${m.awayTeam}`);
      placUpd++;
      if (!dry) await prisma.match.update({ where: { id: m.id }, data: { homeScore: hs, awayScore: as, finished: ev.finished } });
    }
  }
  log(`${dry ? "[DRY] " : ""}Placares atualizados: ${placUpd}.`);
  if (unmatched.size) log(`Jogos da ESPN sem match (${unmatched.size}): ${[...unmatched].slice(0, 8).join(", ")}`);

  // ---- 2) SCOUT COMPLETO POR JOGO (via API core) ----
  const players = await prisma.player.findMany();
  const byTeam = new Map();
  for (const p of players) {
    const tn = norm(p.team);
    if (!byTeam.has(tn)) byTeam.set(tn, []);
    byTeam.get(tn).push({ p, full: norm(p.name), tokens: p.name.split(/\s+/).map(norm).filter(Boolean) });
  }
  const tokMatch = (a, b) => a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a));
  // Casa o nome da ESPN com o jogador do banco (apelidos/nomes curtos), exigindo unicidade.
  const find = (teamApp, name) => {
    const list = byTeam.get(norm(teamApp));
    if (!list || !list.length) return null;
    const full = norm(name);
    const toks = (name || "").split(/\s+/).map(norm).filter(Boolean);
    const uniq = (arr) => (arr.length === 1 ? arr[0].p : null);
    const exact = list.filter((x) => x.full && x.full === full);
    if (exact.length) return exact[0].p;
    let r = uniq(list.filter((x) => x.full && (x.full.includes(full) || full.includes(x.full))));
    if (r) return r;
    const last = toks[toks.length - 1] || "";
    r = uniq(list.filter((x) => last && x.tokens[x.tokens.length - 1] === last));
    if (r) return r;
    r = uniq(list.filter((x) => {
      const a = toks.filter((t) => t.length >= 3), b = x.tokens.filter((t) => t.length >= 3);
      if (!a.length || !b.length) return false;
      const [s, l] = a.length <= b.length ? [a, b] : [b, a];
      return s.every((t) => l.some((u) => tokMatch(t, u)));
    }));
    if (r) return r;
    return uniq(list.filter((x) => x.tokens.some((t) => t.length >= 4 && toks.some((u) => u.length >= 4 && tokMatch(t, u)))));
  };

  // Scout (pesado: stats por jogador) só dos jogos MAIS RECENTES — recém-encerrados (≤ ~6h, janela
  // que cobre o último jogo + os que acabaram de terminar) + os em andamento. Os placares de TODOS
  // os jogos já foram atualizados acima (chamada barata); o scout de jogos antigos não muda mais.
  // Janela do scout pesado: 6h por padrão; SYNC_SINCE_HOURS permite um backfill pontual (ex.: 72) sem mudar código.
  const RECENT_MS = (Number(process.env.SYNC_SINCE_HOURS) || 6) * 3600 * 1000;
  const finished = events.filter((e) => {
    const m = matchFor(e);
    if (!m) return false;
    if (e.state === "in") return true;
    return e.finished && Date.now() - new Date(m.kickoff).getTime() <= RECENT_MS;
  });
  const playerMiss = new Set();
  const photoUpdates = new Map();
  let rows = 0;
  // Correções manuais que sobrevivem ao sync: Setting "statOverrides" = { "matchId:playerId": { campo: valor } }
  let statOverrides = {};
  try { statOverrides = JSON.parse((await prisma.setting.findUnique({ where: { key: "statOverrides" } }))?.value || "{}"); } catch {}
  for (const ev of finished) {
    const m = matchFor(ev);
    let sum;
    try { sum = await getJSON(`${SITE}/summary?event=${ev.id}`); } catch (e) { log(`  (sem summary ${ev.id})`); continue; }
    // monta lista de (player do nosso banco, teamId, athId)
    const targets = [];
    for (const block of sum.rosters || []) {
      const teamApp = toApp(block.team?.displayName);
      const teamId = block.team?.id;
      for (const r of block.roster || []) {
        const p = find(teamApp, r.athlete?.displayName);
        if (!p) { playerMiss.add(`${r.athlete?.displayName} (${teamApp})`); continue; }
        const photo = r.athlete?.headshot?.href;
        if (photo && p.photoUrl !== photo) photoUpdates.set(p.id, photo);
        targets.push({ p, teamId, athId: r.athlete?.id });
      }
    }
    // busca stats core em paralelo
    const stats = await pool(targets, 6, async (t) => {
      try {
        const j = await getJSON(`${CORE}/events/${ev.id}/competitions/${ev.id}/competitors/${t.teamId}/roster/${t.athId}/statistics/0`);
        return { t, cats: j.splits?.categories };
      } catch { return { t, cats: null }; }
    });
    for (const { t, cats } of stats) {
      if (!cats) continue;
      const p = t.p;
      const minutes = cval(cats, "general", "minutes");
      const conceded = cval(cats, "goalKeeping", "goalsConceded");
      const onTarget = cval(cats, "offensive", "shotsOnTarget");
      const offTarget = cval(cats, "offensive", "shotsOffTarget");
      const onPost = cval(cats, "offensive", "shotsOnPost");
      const penMissed = cval(cats, "offensive", "penaltyKicksMissed");
      const gls = cval(cats, "offensive", "totalGoals");
      const firstGame = m.stage === "GROUP" && m.round === 1; // trave só conta a partir do 2º jogo do time
      // "Sem sofrer gol" olha o PLACAR DO JOGO (o time sofreu gol ou não), não o stat individual.
      const teamConceded = (norm(p.team) === norm(ev.homeApp)) ? ev.awayScore : ev.homeScore;
      const data = {
        goals: gls,
        assists: cval(cats, "offensive", "goalAssists"),
        // Buckets exclusivos (campos separados da ESPN): fora / no alvo (exclui gols) / trave.
        shots: offTarget,                            // finalização pra fora
        shotsOnTarget: Math.max(0, onTarget - gls),  // no alvo que não viraram gol
        shotsOnPost: firstGame ? 0 : onPost,         // trave (só a partir do 2º jogo do time)
        penaltiesMissed: penMissed,                  // pênalti perdido
        saves: cval(cats, "goalKeeping", "saves"),
        penaltiesSaved: cval(cats, "goalKeeping", "penaltyKicksSaved"),
        shootOutSaved: firstGame ? 0 : cval(cats, "goalKeeping", "shootOutKicksSaved"), // defesa de pênalti na disputa (só da 2ª rodada)
        blockedShots: firstGame ? 0 : cval(cats, "defensive", "outfielderBlock"), // bloqueio FEITO pelo jogador (só da 2ª rodada)
        foulsSuffered: firstGame ? 0 : cval(cats, "general", "foulsSuffered"),
        foulsCommitted: firstGame ? 0 : cval(cats, "general", "foulsCommitted"),
        tackles: cval(cats, "defensive", "totalTackles"),
        interceptions: cval(cats, "defensive", "interceptions"),
        yellow: cval(cats, "general", "yellowCards"),
        red: cval(cats, "general", "redCards"),
        ownGoals: cval(cats, "general", "ownGoals"),
        minutes,
        cleanSheet: (minutes > 0 && teamConceded === 0 && ["GOL", "ZAG", "LAT"].includes(p.position)) ? 1 : 0,
        goalsConceded: p.position === "GOL" ? conceded : 0,
      };
      const _ov = statOverrides[`${m.id}:${p.id}`]; if (_ov) Object.assign(data, _ov);
      rows++;
      if (!dry) {
        await prisma.matchPlayerStat.upsert({
          where: { matchId_playerId: { matchId: m.id, playerId: p.id } },
          update: { ...data, fixtureId: Number(ev.id) || null },
          create: { matchId: m.id, playerId: p.id, fixtureId: Number(ev.id) || null, ...data },
        });
      }
    }
    log(`  ${m.homeTeam} x ${m.awayTeam}: ${targets.length} jogadores`);
  }
  log(`${dry ? "[DRY] " : ""}Scout por jogo: ${rows} linhas em ${finished.length} jogos encerrados.`);
  if (playerMiss.size) log(`Jogadores sem match (${playerMiss.size}) - ex: ${[...playerMiss].slice(0, 10).join(", ")}`);
  if (!dry) for (const [id, photoUrl] of photoUpdates) await prisma.player.update({ where: { id }, data: { photoUrl } });

  // ---- 3) RECOMPUTA TOTAIS + carimba o horário do último sync ----
  if (!dry) {
    await recomputeTotals(prisma);
    await prisma.setting.upsert({
      where: { key: "lastSyncAt" },
      update: { value: JSON.stringify(new Date().toISOString()) },
      create: { key: "lastSyncAt", value: JSON.stringify(new Date().toISOString()) },
    });
  }
  log(`${dry ? "[DRY] " : ""}Totais recomputados.`);
}

export async function recomputeTotals(prisma) {
  const ALL = ["goals", "assists", "cleanSheet", "saves", "yellow", "red", "ownGoals", "shots", "shotsOnTarget", "shotsOnPost", "tackles", "interceptions", "penaltiesSaved", "penaltiesMissed", "shootOutSaved", "blockedShots", "foulsSuffered", "foulsCommitted", "goalsConceded"];
  const grouped = await prisma.matchPlayerStat.groupBy({ by: ["playerId"], _sum: Object.fromEntries(ALL.map((f) => [f, true])) });
  for (const g of grouped) {
    await prisma.player.update({ where: { id: g.playerId }, data: Object.fromEntries(ALL.map((f) => [f, g._sum[f] || 0])) });
  }
  // Zera só quem NÃO tem nenhuma linha de stat (evita janela com tudo zerado durante o sync).
  await prisma.player.updateMany({ where: { id: { notIn: grouped.map((g) => g.playerId) } }, data: Object.fromEntries(ALL.map((f) => [f, 0])) });
}

const isMain = process.argv[1] && /sync-espn\.mjs$/.test(process.argv[1]);
if (isMain) {
  const prisma = new PrismaClient();
  run({ prisma, dry: process.argv.includes("--dry") })
    .catch((e) => { console.error(e.message || e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
