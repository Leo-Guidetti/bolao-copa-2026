import { prisma } from "@/lib/prisma";
import { betPoints, playerScore } from "@/lib/scoring";
import { getSetting } from "@/lib/config";
import { computeStandings } from "@/lib/standings";

export const VERSION = 6;
export const VALID = ["home", "palpites", "selecao", "ranking", "times"];

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const dayOf = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const tomorrowStr = () => new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const yesterdayStr = () => new Date(Date.now() - 24 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const fmtPts = (n) => Number((n || 0).toFixed(1)).toString();
const clean = (t) => (t || "").replace(/\*+/g, "").replace(/^#+\s*/gm, "").replace(/__+/g, "").trim();

// memoiza o cálculo do ranking por ~60s (regenerateAll roda vários de uma vez)
let _standCache = null, _standAt = 0;
function standingsCached() {
  if (_standCache && Date.now() - _standAt < 60000) return _standCache;
  _standAt = Date.now();
  _standCache = computeStandings();
  return _standCache;
}

// Qual provedor/modelo está ativo (pela env). Prioridade: OpenAI > OpenRouter > Gemini.
export function activeProvider() {
  if (process.env.OPENAI_API_KEY) return `OpenAI ${process.env.OPENAI_MODEL || "gpt-4o-mini"}`;
  if (process.env.OPENROUTER_API_KEY) return `OpenRouter ${process.env.OPENROUTER_MODEL || "openrouter/free"}`;
  if (process.env.GEMINI_API_KEY) return `Gemini ${process.env.GEMINI_MODEL || "gemini-2.0-flash"}`;
  return "nenhum (sem chave)";
}

// fetch com timeout, pra um provedor lento não travar tudo
async function fetchTimeout(url, opts, ms = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// roda em paralelo com limite de concorrência
async function pool(items, limit, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await worker(items[idx]); }
  });
  await Promise.all(runners);
}

async function callOpenRouter(prompt) {
  const key = process.env.OPENROUTER_API_KEY;
  // Só modelos fortes (bons em português). Sem roteador "free" genérico, que costuma cair em modelo fraco.
  // openrouter/free = roteador que escolhe um modelo grátis disponível (resiliente à troca de catálogo).
  const models = [...new Set([
    process.env.OPENROUTER_MODEL || "openrouter/free",
    "openrouter/free",
  ])].filter(Boolean);
  let lastErr = "nenhum modelo respondeu";
  for (const model of models) {
    try {
      const r = await fetchTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
          "HTTP-Referer": process.env.NEXTAUTH_URL || "https://leigos-da-copa2026.vercel.app",
          "X-Title": "Leigos da Bola",
        },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.85, max_tokens: 280 }),
      });
      const d = await r.json();
      if (!r.ok) { lastErr = d?.error?.message || `HTTP ${r.status}`; continue; }
      const text = (d?.choices?.[0]?.message?.content || "").trim();
      if (text) return text;
      lastErr = "resposta vazia";
    } catch (e) { lastErr = e?.message || "falha de rede"; }
  }
  throw new Error(`OpenRouter: ${lastErr}`);
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.85, maxOutputTokens: 280 } }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || "Gemini recusou.");
  const text = (d?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("Resposta vazia do modelo.");
  return text;
}

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.85, max_tokens: 280 }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `OpenAI HTTP ${r.status}`);
  const text = (d?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("Resposta vazia do modelo.");
  return text;
}

const BASE = `Você é o "Leigo Master", um comentarista de futebol no estilo do Craque Neto comentando um bolão da Copa do Mundo 2026 entre amigos brasileiros. Tom: bombástico, dramático, MUITO opinativo e empolgado, com bordões e exagero (ex.: "Pô, meu amigo!", "Vou te falar uma coisa...", "Isso é um ABSURDO!", "joga DEMAIS!", "escuta o que eu tô falando"). Você ACOMPANHA a competição: comenta placares, zebras, quem brilhou e quem decepcionou, e crava prognósticos com convicção total. Exalta e detona com paixão, mas SEM ofensa pesada e SEM palavrão. É resenha de amigo — o exagero deixa claro que é zoeira. Português do Brasil correto e coerente. CURTO: no máximo ~70 palavras, 1 ou 2 emojis. Texto corrido, SEM markdown, asteriscos, títulos ou listas. IMPORTANTíSSIMO: use SOMENTE os dados fornecidos abaixo — não invente jogos, placares, nomes nem fatos que não estejam aqui.`;

async function buildPrompt(me, ctx) {
  const [bets, matches, squad] = await Promise.all([
    prisma.bet.findMany({ where: { participantId: me.id } }),
    prisma.match.findMany(),
    prisma.squad.findUnique({ where: { participantId: me.id }, include: { players: { include: { player: true } } } }),
  ]);
  const mById = Object.fromEntries(matches.map((m) => [m.id, m]));
  const squadTxt = () => {
    if (!squad || !squad.players.length) return "(ainda não montou a seleção)";
    const st = squad.players.filter((p) => p.isStarter).map((p) => `${p.player.name} (${p.player.team}, ${p.player.position}, ${p.player.price}¢)`);
    const capP = squad.captainId ? squad.players.find((p) => p.playerId === squad.captainId)?.player : null;
    const cost = squad.players.reduce((s, p) => s + (p.player.price || 0), 0);
    return `Formação ${squad.formation || "4-3-3"}, custo ${cost}¢, camisa 10 ${capP ? capP.name : "nenhum"}. Titulares: ${st.join("; ")}.`;
  };

  if (ctx === "home") {
    const ydStr = yesterdayStr(), tdStr = today();
    const byMatch = Object.fromEntries(bets.map((b) => [b.matchId, b]));
    const sc = await getSetting("scoring");
    const yd = matches.filter((m) => dayOf(m.kickoff) === ydStr && m.finished).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    const td = matches.filter((m) => dayOf(m.kickoff) === tdStr).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    const ydLines = yd.map((m) => {
      const b = byMatch[m.id];
      const meTxt = b ? `(${me.name} palpitou ${b.homeGuess}x${b.awayGuess}, fez ${fmtPts(betPoints(b, m, sc))} pts)` : `(${me.name} ficou SEM PALPITE)`;
      return `${m.homeTeam} ${m.homeScore}x${m.awayScore} ${m.awayTeam} ${meTxt}`;
    });
    const tdLines = td.map((m) => { const b = byMatch[m.id]; return `${m.homeTeam} x ${m.awayTeam}${b ? ` (palpite dele: ${b.homeGuess}x${b.awayGuess})` : " (ele ainda NÃO palpitou)"}`; });
    const parts = [];
    parts.push(yd.length ? `JOGOS DE ONTEM (resultados reais) e como ${me.name} se saiu:\n${ydLines.join("\n")}` : "Ontem não teve jogo encerrado da Copa.");
    parts.push(td.length ? `JOGOS DE HOJE e os palpites de ${me.name}:\n${tdLines.join("\n")}` : "Hoje não tem jogo da Copa.");
    return `${BASE}\n\nVocê está comentando para ${me.name}. FALE APENAS sobre ONTEM e HOJE — nada de rodadas antigas ou de dias futuros.\n\n${parts.join("\n\n")}\n\nComente os destaques dos jogos de ONTEM (zebras, goleadas, quem brilhou) e como ${me.name} foi nos palpites; depois esquente os jogos de HOJE com um prognóstico bem convicto. Curtíssimo, no estilo Craque Neto:`;
  }

  if (ctx === "ranking" || ctx === "times") {
    const { ranked } = await standingsCached();
    if (ctx === "ranking") {
      const i = ranked.findIndex((r) => r.participantId === me.id);
      const meRow = ranked[i] || { final: 0, place: ranked.length };
      const ahead = i > 0 ? ranked[i - 1] : null;
      const top = ranked.slice(0, 5).map((r, k) => `${k + 1}º ${r.name} ${fmtPts(r.final)}`).join(" | ");
      return `${BASE}\n\nParticipante: ${me.name}\n\nRANKING GERAL (top 5): ${top}.\nEle está em ${meRow.place || i + 1}º com ${fmtPts(meRow.final)} pts.${ahead ? ` Logo à frente: ${ahead.name} (${fmtPts(ahead.final)}).` : " Tá na liderança!"} Líder: ${ranked[0]?.name} (${fmtPts(ranked[0]?.final)}).\n\nComente a posição dele no ranking (alfineta se tá longe, exalta se tá bem). Curtíssimo, Leigo Master:`;
    }
    const bySquad = [...ranked].sort((a, b) => b.squadPts - a.squadPts);
    const i = bySquad.findIndex((r) => r.participantId === me.id);
    const meRow = bySquad[i] || { squadPts: 0 };
    const top = bySquad.slice(0, 5).map((r, k) => `${k + 1}º ${r.name} ${fmtPts(r.squadPts)}`).join(" | ");
    return `${BASE}\n\nParticipante: ${me.name}\n\nRANKING DAS SELEÇÕES — Monte sua Seleção (top 5): ${top}.\nA seleção dele está em ${i + 1}º com ${fmtPts(meRow.squadPts)} pts.\n\nComente a seleção dele comparada às dos adversários (quem montou melhor, se a dele tá rendendo ou furou). Curtíssimo, Leigo Master:`;
  }

  if (ctx === "palpites") {
    const ydStr = yesterdayStr(), tdStr = today();
    const byMatch = Object.fromEntries(bets.map((b) => [b.matchId, b]));
    const sc = await getSetting("scoring");
    const yd = matches.filter((m) => dayOf(m.kickoff) === ydStr && m.finished).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    const ydLines = yd.map((m) => {
      const b = byMatch[m.id];
      if (!b) return `${m.homeTeam} ${m.homeScore}x${m.awayScore} ${m.awayTeam}: ele ficou SEM PALPITE`;
      return `${m.homeTeam} ${m.homeScore}x${m.awayScore} ${m.awayTeam} — palpitou ${b.homeGuess}x${b.awayGuess}, fez ${fmtPts(betPoints(b, m, sc))} pts`;
    });
    const td = matches.filter((m) => dayOf(m.kickoff) === tdStr).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    const tdLines = td.map((m) => { const b = byMatch[m.id]; return `${m.homeTeam} x ${m.awayTeam}: ${b ? `${b.homeGuess}x${b.awayGuess}` : "SEM PALPITE"}`; });
    const parts = [];
    parts.push(yd.length ? `Resultados de ONTEM e como ele se saiu:\n${ydLines.join("\n")}` : "Ontem não teve jogo encerrado.");
    parts.push(td.length ? `Jogos de HOJE e os palpites dele:\n${tdLines.join("\n")}` : "Hoje não tem jogo da Copa.");
    return `${BASE}\n\nParticipante: ${me.name}\n\n${parts.join("\n\n")}\n\nPrimeiro comente como ele se saiu nos palpites de ONTEM (zoa os furos, exalta os acertos pela pontuação). Depois CORNETE os palpites de HOJE (alfinete quem ficou SEM PALPITE) e arrisque um prognóstico duvidoso. Curtíssimo, Leigo Master:`;
  }

  if (ctx === "selecao") {
    if (!squad || !squad.players.length) return `${BASE}\n\nParticipante: ${me.name}\n\nEle ainda NÃO montou a seleção.\n\nZoa ele por estar enrolando pra montar o time. Leigo Master:`;
    const sr = await getSetting("squadRules");
    const scout = sr.scout || {};
    const capMult = sr.camisa10Multiplier ?? 2;
    const ptsOf = (pl) => playerScore(pl, scout);
    const st = squad.players.filter((p) => p.isStarter).map((p) => `${p.player.name} (${p.player.team}, ${p.player.position}, ${p.player.price}¢, ${fmtPts(ptsOf(p.player))} pts)`);
    const rs = squad.players.filter((p) => !p.isStarter).map((p) => `${p.player.name} (${p.player.team}, ${p.player.position}, ${fmtPts(ptsOf(p.player))} pts)`);
    const capP = squad.captainId ? squad.players.find((p) => p.playerId === squad.captainId)?.player : null;
    const cost = squad.players.reduce((s, p) => s + (p.player.price || 0), 0);
    const total = squad.players.reduce((s, p) => s + ptsOf(p.player) * (p.playerId === squad.captainId ? capMult : 1), 0);
    return `${BASE}\n\nParticipante: ${me.name}\n\nA Copa já COMEÇOU. Avalie a QUALIDADE da seleção (fama/nível dos jogadores, uso do orçamento ${cost}¢, escolha do camisa 10 ${capP ? capP.name : "nenhum"}) E comente o desempenho REAL até agora pela pontuação de cada um — quem tá rendendo e quem virou furada. Use só os números abaixo, não invente.\nFormação ${squad.formation || "4-3-3"}. Total do time até agora: ${fmtPts(total)} pts.\nTitulares: ${st.join("; ")}.\nReservas: ${rs.join("; ")}.\n\nSolte sua opinião zoeira citando 1 ou 2 destaques e 1 ou 2 decepções pela pontuação. Curtíssimo, Leigo Master:`;
  }

  const betLines = bets.map((b) => { const m = mById[b.matchId]; return m ? `${m.homeTeam} ${b.homeGuess}x${b.awayGuess} ${m.awayTeam}` : null; }).filter(Boolean).slice(0, 30);
  return `${BASE}\n\nParticipante: ${me.name}\n\nPalpites de placar (${betLines.length}): ${betLines.length ? betLines.join(" | ") : "nenhum ainda"}\n\nSeleção: ${squadTxt()}\n\nFaça um resumão geral e zoeiro do bolão dele (palpites + seleção). Leigo Master:`;
}

async function makeRoast(me, ctx) {
  const prompt = await buildPrompt(me, ctx);
  let raw;
  if (process.env.OPENAI_API_KEY) raw = await callOpenAI(prompt);
  else if (process.env.OPENROUTER_API_KEY) raw = await callOpenRouter(prompt);
  else raw = await callGemini(prompt);
  return clean(raw);
}

// Lê o roast do dia (cache) ou gera. Se a geração falhar, devolve a opinião ANTERIOR (stale) em vez de erro.
export async function getRoast(me, ctx) {
  const d = today();
  let stored = {};
  try { stored = JSON.parse(me.roastText || "{}") || {}; } catch { stored = {}; }
  const fresh = stored._v === VERSION && stored._day === d;
  if (fresh && stored[ctx]) return { text: stored[ctx], day: d };
  if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
    if (stored[ctx]) return { text: stored[ctx], stale: true };
    return { error: "not_configured", status: 503 };
  }
  try {
    const text = await makeRoast(me, ctx);
    if (!fresh) stored = { _v: VERSION, _day: d };
    stored[ctx] = text;
    await prisma.participant.update({ where: { id: me.id }, data: { roastText: JSON.stringify(stored), roastDay: d } });
    return { text, day: d };
  } catch (e) {
    if (stored[ctx]) return { text: stored[ctx], stale: true };
    return { error: e.message || "Falha ao gerar a zoeira.", status: 502 };
  }
}

// Pré-gera (madrugada via cron) as opiniões de todos. Se um modelo falhar, mantém a anterior.
export async function regenerateAll() {
  const parts = await prisma.participant.findMany();
  const d = today();
  const start = Date.now();
  let done = 0, fail = 0, processed = 0, partial = false;
  // Vários participantes em paralelo; e os 3 contextos de cada um também em paralelo.
  await pool(parts, 5, async (me) => {
    if (Date.now() - start > 55000) { partial = true; return; }
    let stored = {};
    try { stored = JSON.parse(me.roastText || "{}") || {}; } catch { stored = {}; }
    if (stored._v !== VERSION || stored._day !== d) stored = { _v: VERSION, _day: d };
    const results = await Promise.all(VALID.map(async (ctx) => {
      try { return [ctx, await makeRoast(me, ctx)]; } catch { return [ctx, null]; }
    }));
    for (const [ctx, text] of results) { if (text) { stored[ctx] = text; done++; } else fail++; }
    await prisma.participant.update({ where: { id: me.id }, data: { roastText: JSON.stringify(stored), roastDay: d } });
    processed++;
  });
  return { participants: parts.length, processed, done, fail, partial, provider: activeProvider() };
}
