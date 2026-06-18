// Sync da ESPN (placares + scout por jogador), reutilizável pela rota admin "Atualizar resultados".
// Recebe o prisma client (não abre conexão). Usa fetch global (Node 18+).
//   sinceDays: limita aos jogos dos últimos N dias (null = tudo desde a abertura).
//   includeLive: inclui jogos EM ANDAMENTO no scout (parcial ao vivo).

const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const CORE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world";
const START = "2026-06-11";

const TEAM_ALIAS = {
  "Brazil": "Brasil", "Mexico": "Mexico", "South Africa": "Africa do Sul", "South Korea": "Coreia do Sul", "Korea Republic": "Coreia do Sul",
  "Czechia": "Republica Tcheca", "Czech Republic": "Republica Tcheca", "Canada": "Canada", "Bosnia-Herzegovina": "Bosnia", "Bosnia and Herzegovina": "Bosnia",
  "Qatar": "Catar", "Switzerland": "Suica", "Morocco": "Marrocos", "Haiti": "Haiti", "Scotland": "Escocia", "USA": "Estados Unidos", "United States": "Estados Unidos",
  "Paraguay": "Paraguai", "Australia": "Australia", "Turkey": "Turquia", "Türkiye": "Turquia", "Germany": "Alemanha", "Curacao": "Curacao", "Curaçao": "Curacao",
  "Ivory Coast": "Costa do Marfim", "Ecuador": "Equador", "Netherlands": "Holanda", "Japan": "Japao", "Sweden": "Suecia", "Tunisia": "Tunisia", "Belgium": "Belgica",
  "Egypt": "Egito", "Iran": "Ira", "IR Iran": "Ira", "New Zealand": "Nova Zelandia", "Spain": "Espanha", "Cape Verde": "Cabo Verde", "Cape Verde Islands": "Cabo Verde",
  "Saudi Arabia": "Arabia Saudita", "Uruguay": "Uruguai", "France": "Franca", "Senegal": "Senegal", "Iraq": "Iraque", "Norway": "Noruega", "Argentina": "Argentina",
  "Algeria": "Argelia", "Austria": "Austria", "Jordan": "Jordania", "Portugal": "Portugal", "Congo DR": "RD Congo", "DR Congo": "RD Congo", "Uzbekistan": "Uzbequistao",
  "Colombia": "Colombia", "Croatia": "Croacia", "Ghana": "Gana", "England": "Inglaterra", "Panama": "Panama",
};

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const toApp = (n) => TEAM_ALIAS[n] || n;
const pairKey = (a, b) => [norm(a), norm(b)].sort().join("|");
const cval = (cats, cat, name) => {
  const c = (cats || []).find((x) => x.name === cat);
  const s = (c?.stats || []).find((y) => y.name === name);
  return s ? (Number(s.value) || 0) : 0;
};

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (bolao-leigos)" } });
  if (!r.ok) throw new Error(`ESPN HTTP ${r.status}`);
  return r.json();
}
async function pool(items, n, worker) {
  const out = []; let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx]); }
  });
  await Promise.all(runners);
  return out;
}
function dateList(sinceDays) {
  const out = [];
  const start = sinceDays != null ? (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - sinceDays); return d; })() : new Date(START + "T00:00:00Z");
  const d = new Date(start);
  const end = new Date(); end.setUTCDate(end.getUTCDate() + 1);
  while (d <= end) {
    out.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
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
    state: e.status?.type?.state,
  };
}

export async function syncEspn({ prisma, sinceDays = null, includeLive = false, dry = false, log = () => {}, concurrency = 8, scoresOnly = false }) {
  const dates = dateList(sinceDays);
  const byId = new Map();
  for (const dt of dates) {
    try { const j = await getJSON(`${SITE}/scoreboard?dates=${dt}`); for (const e of j.events || []) byId.set(e.id, e); } catch {}
  }
  const events = [...byId.values()].map(parseEvent);

  const matches = await prisma.match.findMany();
  const byPair = new Map();
  for (const m of matches) {
    if (m.homeTeam === "A definir" || m.awayTeam === "A definir") continue;
    byPair.set(pairKey(m.homeTeam, m.awayTeam), m);
  }
  const matchFor = (ev) => byPair.get(pairKey(ev.homeApp, ev.awayApp)) || null;

  // ---- placares ----
  let placares = 0;
  for (const ev of events) {
    const m = matchFor(ev);
    if (!m || ev.homeScore == null || ev.awayScore == null) continue;
    let hs = ev.homeScore, as = ev.awayScore;
    if (norm(ev.homeApp) !== norm(m.homeTeam)) { const t = hs; hs = as; as = t; }
    if (m.homeScore !== hs || m.awayScore !== as || m.finished !== ev.finished) {
      placares++;
      if (!dry) await prisma.match.update({ where: { id: m.id }, data: { homeScore: hs, awayScore: as, finished: ev.finished } });
    }
  }

  // ---- scout por jogador (pulado no modo scoresOnly: só placares/ao vivo) ----
  let scoutLinhas = 0, target = [];
  const semMatch = new Set();
  if (!scoresOnly) {
  const players = await prisma.player.findMany();
  const byTeam = new Map();
  for (const p of players) {
    const tn = norm(p.team);
    if (!byTeam.has(tn)) byTeam.set(tn, []);
    byTeam.get(tn).push({ p, full: norm(p.name), tokens: p.name.split(/\s+/).map(norm).filter(Boolean) });
  }
  const tokMatch = (a, b) => a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a));
  // Casa o nome da ESPN com o jogador do banco (apelidos/nomes curtos), sempre exigindo unicidade.
  const find = (teamApp, name) => {
    const list = byTeam.get(norm(teamApp));
    if (!list || !list.length) return null;
    const full = norm(name);
    const toks = (name || "").split(/\s+/).map(norm).filter(Boolean);
    const uniq = (arr) => (arr.length === 1 ? arr[0].p : null);
    // 1. nome completo idêntico
    const exact = list.filter((x) => x.full && x.full === full);
    if (exact.length) return exact[0].p;
    // 2. um nome contém o outro (ex.: "Alisson" ⊂ "Alisson Becker")
    let r = uniq(list.filter((x) => x.full && (x.full.includes(full) || full.includes(x.full))));
    if (r) return r;
    // 3. mesmo último sobrenome
    const last = toks[toks.length - 1] || "";
    r = uniq(list.filter((x) => last && x.tokens[x.tokens.length - 1] === last));
    if (r) return r;
    // 4. tokens significativos (>=3) do nome curto batem por prefixo (ex.: "Vini Jr." ↔ "Vinícius Júnior")
    r = uniq(list.filter((x) => {
      const a = toks.filter((t) => t.length >= 3), b = x.tokens.filter((t) => t.length >= 3);
      if (!a.length || !b.length) return false;
      const [s, l] = a.length <= b.length ? [a, b] : [b, a];
      return s.every((t) => l.some((u) => tokMatch(t, u)));
    }));
    if (r) return r;
    // 5. compartilham um token relevante (>=4), de forma única
    return uniq(list.filter((x) => x.tokens.some((t) => t.length >= 4 && toks.some((u) => u.length >= 4 && tokMatch(t, u)))));
  };

  target = events.filter((e) => (e.finished || (includeLive && e.state === "in")) && matchFor(e));
  // Correções manuais que devem sobreviver ao sync: Setting "statOverrides" = { "matchId:playerId": { campo: valor } }
  let statOverrides = {};
  try { statOverrides = JSON.parse((await prisma.setting.findUnique({ where: { key: "statOverrides" } }))?.value || "{}"); } catch {}
  const photoUpdates = new Map();
  for (const ev of target) {
    const m = matchFor(ev);
    let sum;
    try { sum = await getJSON(`${SITE}/summary?event=${ev.id}`); } catch { continue; }
    const targets = [];
    for (const block of sum.rosters || []) {
      const teamApp = toApp(block.team?.displayName), teamId = block.team?.id;
      for (const r of block.roster || []) {
        const p = find(teamApp, r.athlete?.displayName);
        if (!p) { semMatch.add(`${r.athlete?.displayName} (${teamApp})`); continue; }
        const photo = r.athlete?.headshot?.href;
        if (photo && p.photoUrl !== photo) photoUpdates.set(p.id, photo);
        targets.push({ p, teamId, athId: r.athlete?.id });
      }
    }
    const stats = await pool(targets, concurrency, async (t) => {
      try { const j = await getJSON(`${CORE}/events/${ev.id}/competitions/${ev.id}/competitors/${t.teamId}/roster/${t.athId}/statistics/0`); return { t, cats: j.splits?.categories }; }
      catch { return { t, cats: null }; }
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
        goals: gls, assists: cval(cats, "offensive", "goalAssists"),
        shots: offTarget, shotsOnTarget: Math.max(0, onTarget - gls), shotsOnPost: firstGame ? 0 : onPost, penaltiesMissed: penMissed,
        saves: cval(cats, "goalKeeping", "saves"), penaltiesSaved: cval(cats, "goalKeeping", "penaltyKicksSaved"),
        shootOutSaved: cval(cats, "goalKeeping", "shootOutKicksSaved"),
        blockedShots: cval(cats, "defensive", "blockedShots"),
        foulsSuffered: cval(cats, "general", "foulsSuffered"), foulsCommitted: cval(cats, "general", "foulsCommitted"),
        tackles: cval(cats, "defensive", "totalTackles"), interceptions: cval(cats, "defensive", "interceptions"),
        yellow: cval(cats, "general", "yellowCards"), red: cval(cats, "general", "redCards"), ownGoals: cval(cats, "general", "ownGoals"),
        minutes, cleanSheet: (minutes > 0 && teamConceded === 0 && ["GOL", "ZAG", "LAT"].includes(p.position)) ? 1 : 0,
        goalsConceded: p.position === "GOL" ? conceded : 0,
      };
      const _ov = statOverrides[`${m.id}:${p.id}`]; if (_ov) Object.assign(data, _ov);
      scoutLinhas++;
      if (!dry) {
        await prisma.matchPlayerStat.upsert({
          where: { matchId_playerId: { matchId: m.id, playerId: p.id } },
          update: { ...data, fixtureId: Number(ev.id) || null },
          create: { matchId: m.id, playerId: p.id, fixtureId: Number(ev.id) || null, ...data },
        });
      }
    }
  }
  if (!dry) for (const [id, photoUrl] of photoUpdates) await prisma.player.update({ where: { id }, data: { photoUrl } });
  } // fim do bloco scoresOnly (scout)

  if (!dry) {
    if (!scoresOnly) await recomputeTotals(prisma);
    await prisma.setting.upsert({
      where: { key: "lastSyncAt" },
      update: { value: JSON.stringify(new Date().toISOString()) },
      create: { key: "lastSyncAt", value: JSON.stringify(new Date().toISOString()) },
    });
  }
  log(`placares=${placares} scout=${scoutLinhas} jogos=${target.length}`);
  return { placares, scoutLinhas, jogos: target.length, semMatch: semMatch.size };
}

async function recomputeTotals(prisma) {
  const ALL = ["goals", "assists", "cleanSheet", "saves", "yellow", "red", "ownGoals", "shots", "shotsOnTarget", "shotsOnPost", "tackles", "interceptions", "penaltiesSaved", "penaltiesMissed", "shootOutSaved", "blockedShots", "foulsSuffered", "foulsCommitted", "goalsConceded"];
  const grouped = await prisma.matchPlayerStat.groupBy({ by: ["playerId"], _sum: Object.fromEntries(ALL.map((f) => [f, true])) });
  for (const g of grouped) await prisma.player.update({ where: { id: g.playerId }, data: Object.fromEntries(ALL.map((f) => [f, g._sum[f] || 0])) });
  // Zera só quem NÃO tem nenhuma linha de stat (evita janela com tudo zerado durante o sync).
  await prisma.player.updateMany({ where: { id: { notIn: grouped.map((g) => g.playerId) } }, data: Object.fromEntries(ALL.map((f) => [f, 0])) });
}
