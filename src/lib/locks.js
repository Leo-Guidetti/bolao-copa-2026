import { prisma } from "./prisma";

const SQUAD_LOCK_BEFORE_MS = 30 * 60 * 1000; // 30 min antes da estreia

// A seleção pode ser editada até 30min antes do PRIMEIRO jogo da Copa.
export async function getSquadLock() {
  const first = await prisma.match.findFirst({ orderBy: { kickoff: "asc" }, select: { kickoff: true } });
  if (!first) return { locked: false, deadline: null, opening: null };
  const deadline = new Date(new Date(first.kickoff).getTime() - SQUAD_LOCK_BEFORE_MS);
  return { locked: Date.now() >= deadline.getTime(), deadline: deadline.toISOString(), opening: first.kickoff };
}
