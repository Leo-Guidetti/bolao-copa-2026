import { prisma } from "./prisma";

const SQUAD_LOCK_BEFORE_MS = 30 * 60 * 1000; // 30 min antes da estreia

// A seleção pode ser editada até 30min antes do PRIMEIRO jogo da Copa.
export async function getSquadLock() {
  const first = await prisma.match.findFirst({ orderBy: { kickoff: "asc" }, select: { kickoff: true } });
  if (!first) return { locked: false, deadline: null, opening: null };
  const deadline = new Date(new Date(first.kickoff).getTime() - SQUAD_LOCK_BEFORE_MS);
  return { locked: Date.now() >= deadline.getTime(), deadline: deadline.toISOString(), opening: first.kickoff };
}

// Janela de troca do mata-mata: reabre a seleção pra ATÉ 4 trocas. As trocas só pontuam no mata-mata
// (a fase de grupos continua usando o snapshot). Controlada pela Setting "koWindow" = { open, deadline }.
export async function getKoWindow() {
  const s = await prisma.setting.findUnique({ where: { key: "koWindow" } });
  let cfg = {};
  try { cfg = JSON.parse(s?.value || "{}"); } catch {}
  const deadline = cfg.deadline || null;
  const open = !!cfg.open && (!deadline || Date.now() < new Date(deadline).getTime());
  return { open, deadline, maxSubs: cfg.maxSubs ?? 4 };
}
