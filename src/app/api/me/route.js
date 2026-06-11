import { currentParticipant, isAdminEmail } from "@/lib/session";
export async function GET() {
  const p = await currentParticipant();
  if (!p) return Response.json(null);
  return Response.json({ id: p.id, name: p.name, email: p.email, isAdmin: isAdminEmail(p.email), entryFee: p.entryFee, paid: !!p.paid, avatarUrl: p.avatarUrl });
}

export const dynamic = "force-dynamic";
