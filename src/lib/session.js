import { getServerSession } from "next-auth";
import { authOptions, isAdminEmail } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function currentParticipant() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.pid) return null;
  return prisma.participant.findUnique({ where: { id: s.user.pid } });
}
export async function requireAdmin() {
  const s = await getServerSession(authOptions);
  if (!s?.user?.email || !isAdminEmail(s.user.email)) return null;
  return s.user;
}
export { isAdminEmail };
