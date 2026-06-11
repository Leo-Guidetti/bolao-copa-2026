import { prisma } from "@/lib/prisma";
import { currentParticipant } from "@/lib/session";
import { getSquadLock } from "@/lib/locks";

export async function GET() {
  const me = await currentParticipant();
  if (!me) return Response.json({ locked: false, squads: [] }, { status: 401 });
  const lock = await getSquadLock();
  if (!lock.locked) return Response.json({ locked: false, deadline: lock.deadline, squads: [] });

  const parts = await prisma.participant.findMany({
    include: { squad: { include: { players: { include: { player: true } } } } },
    orderBy: { name: "asc" },
  });
  const squads = parts.filter((p) => p.squad).map((p) => ({
    participantId: p.id,
    name: p.name,
    avatarUrl: p.avatarUrl,
    formation: p.squad.formation || "4-3-3",
    captainId: p.squad.captainId,
    starters: p.squad.players.filter((sp) => sp.isStarter).map((sp) => sp.player),
    reserves: p.squad.players.filter((sp) => !sp.isStarter).map((sp) => sp.player),
  }));
  return Response.json({ locked: true, squads });
}

export const dynamic = "force-dynamic";
