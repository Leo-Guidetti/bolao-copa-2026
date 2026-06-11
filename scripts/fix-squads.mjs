// Ajustes manuais de seleção (exceção pós-fechamento de mercado).
// Uso:
//   node scripts/fix-squads.mjs           -> só MOSTRA o que vai fazer (dry-run, não grava)
//   node scripts/fix-squads.mjs --apply   -> grava no banco
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// Carrega o .env na mão (node puro não carrega sozinho como o CLI do Prisma)
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch (e) { console.warn("Aviso: não consegui ler o .env:", e?.message); }
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// --- Trocas de camisa 10 (jogador precisa já estar na seleção do participante) ---
const CAPTAINS = [
  { participant: "Almir", player: "Mbappe", team: "Franca" },
  { participant: "Werner", player: "Olise", team: "Franca" },
  { participant: "Caio", player: "Vini Jr", team: "Brasil" },
];

// --- ProJ: time inteiro novo (camisa 10 = Harry Kane) ---
const PROJ_NAME = "ProJ";
const PROJ = [
  { hint: "Harry Kane", team: "Inglaterra", captain: true },
  { hint: "Olise", team: "Franca" },
  { hint: "Ferran Torres", team: "Espanha" },
  { hint: "Casemiro", team: "Brasil" },
  { hint: "Pedri", team: "Espanha" },
  { hint: "De Paul", team: "Argentina" },
  { hint: "Cancelo", team: "Portugal" },
  { hint: "Kimmich", team: "Alemanha" },
  { hint: "Gabriel Magalhaes", team: "Brasil" },
  { hint: "Schlotterbeck", team: "Alemanha" },
  { hint: "Dibu", team: "Argentina" },
  { hint: "Flekken", team: "Holanda" },
  { hint: "Van de Ven", team: "Holanda" },
  { hint: "Malo Gusto", team: "Franca" },
  { hint: "Paredes", team: "Argentina" },
  { hint: "Endrick", team: "Brasil" },
];

function pickPlayer(players, hint, team) {
  let pool = team ? players.filter((p) => norm(p.team) === norm(team)) : players;
  const h = norm(hint);
  let m = pool.filter((p) => norm(p.name) === h);
  if (!m.length) m = pool.filter((p) => norm(p.name).includes(h) || h.includes(norm(p.name)));
  if (!m.length) { const sur = h.split(" ").pop(); m = pool.filter((p) => norm(p.name).split(" ").includes(sur)); }
  return m;
}

async function findParticipant(name) {
  const all = await prisma.participant.findMany({ select: { id: true, name: true } });
  const m = all.filter((p) => norm(p.name).includes(norm(name)) || norm(name).includes(norm(p.name)));
  return m;
}

async function getBudgetCap() {
  const s = await prisma.setting.findUnique({ where: { key: "squadRules" } });
  try { return s ? (JSON.parse(s.value).budgetCap ?? 60) : 60; } catch { return 60; }
}

async function main() {
  const players = await prisma.player.findMany({ select: { id: true, name: true, team: true, position: true, price: true } });
  const budgetCap = await getBudgetCap();
  let problems = 0;
  const plan = [];
  console.log(`Orçamento (budgetCap): ${budgetCap}¢\n`);

  // 1) Trocas de camisa 10
  for (const c of CAPTAINS) {
    const parts = await findParticipant(c.participant);
    if (parts.length !== 1) { console.log(`⚠️  Participante "${c.participant}": ${parts.length} encontrados (${parts.map(p=>p.name).join(", ")||"nenhum"}). Pulei.`); problems++; continue; }
    const part = parts[0];
    const squad = await prisma.squad.findUnique({ where: { participantId: part.id }, include: { players: { include: { player: true } } } });
    if (!squad) { console.log(`⚠️  ${part.name}: sem seleção montada. Pulei.`); problems++; continue; }
    const cand = pickPlayer(squad.players.map(sp => sp.player), c.player, c.team);
    if (cand.length !== 1) { console.log(`⚠️  ${part.name}: "${c.player}" → ${cand.length} matches na seleção dele (${cand.map(p=>p.name).join(", ")||"nenhum — ele não tem esse jogador"}). Pulei.`); problems++; continue; }
    console.log(`✅ ${part.name}: camisa 10 = ${cand[0].name} (${cand[0].team})`);
    plan.push(() => prisma.squad.update({ where: { participantId: part.id }, data: { captainId: cand[0].id } }));
  }

  // 2) ProJ time inteiro
  const pp = await findParticipant(PROJ_NAME);
  if (pp.length !== 1) { console.log(`\n⚠️  Participante "${PROJ_NAME}": ${pp.length} encontrados. Pulei o time do ProJ.`); problems++; }
  else {
    const part = pp[0];
    console.log(`\n=== ProJ (${part.name}) ===`);
    const chosen = []; let capId = null; let bad = false;
    for (const it of PROJ) {
      const m = pickPlayer(players, it.hint, it.team);
      if (m.length !== 1) { console.log(`  ⚠️  "${it.hint}" (${it.team}) → ${m.length} matches: ${m.map(p=>p.name).join(", ")||"nenhum"}`); bad = true; continue; }
      chosen.push(m[0]); if (it.captain) capId = m[0].id;
      console.log(`  • ${m[0].name} (${m[0].team}, ${m[0].position}, ${m[0].price}¢)${it.captain ? "  ← camisa 10" : ""}`);
    }
    const cost = chosen.reduce((s, p) => s + (p.price || 0), 0);
    console.log(`  Jogadores: ${chosen.length}/16 | Custo: ${cost}¢ / ${budgetCap}¢ | ${cost <= budgetCap ? "✅ dentro" : "❌ ESTOUROU"}`);
    if (bad || chosen.length !== 16) { console.log("  ❌ Não vou aplicar o time do ProJ (faltou resolver algum nome ou não deu 16)."); problems++; }
    else if (cost > budgetCap) { console.log("  ❌ Não vou aplicar: acima do orçamento."); problems++; }
    else {
      // reserva = o mais barato de cada posição; restante titular (só pra exibição; pontuação soma os 16)
      const byPos = {}; for (const p of chosen) (byPos[p.position] ||= []).push(p);
      const reserveIds = new Set();
      for (const pos in byPos) { const arr = byPos[pos].slice().sort((a,b)=>(a.price||0)-(b.price||0)); reserveIds.add(arr[0].id); }
      plan.push(async () => {
        const squad = await prisma.squad.upsert({ where: { participantId: part.id }, update: { captainId: capId }, create: { participantId: part.id, formation: "4-3-3", captainId: capId } });
        await prisma.squadPlayer.deleteMany({ where: { squadId: squad.id } });
        await prisma.squadPlayer.createMany({ data: chosen.map(p => ({ squadId: squad.id, playerId: p.id, isStarter: !reserveIds.has(p.id) })) });
      });
      console.log("  ✅ Pronto pra aplicar (camisa 10 = Harry Kane).");
    }
  }

  console.log(`\n${problems ? `⚠️  ${problems} item(ns) com pendência acima.` : "Tudo certo."}`);
  if (!APPLY) { console.log("\n(Isto foi um DRY-RUN. Rode com --apply para gravar.)"); return; }
  for (const fn of plan) await fn();
  console.log(`\n✅ APLICADO: ${plan.length} ajuste(s) gravado(s).`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
