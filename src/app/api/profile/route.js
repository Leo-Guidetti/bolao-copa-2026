import { prisma } from "@/lib/prisma";
import { currentParticipant } from "@/lib/session";
import bcrypt from "bcryptjs";

export async function GET() {
  const p = await currentParticipant();
  if (!p) return Response.json(null);
  return Response.json({ id: p.id, name: p.name, email: p.email, avatarUrl: p.avatarUrl });
}

export async function PATCH(req) {
  const p = await currentParticipant();
  if (!p) return Response.json({ error: "Faça login." }, { status: 401 });
  const body = await req.json();
  const data = {};

  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl || null;

  if (body.newPassword) {
    if (String(body.newPassword).length < 6) return Response.json({ error: "A nova senha precisa de ao menos 6 caracteres." }, { status: 400 });
    if (!p.passwordHash || !(await bcrypt.compare(String(body.currentPassword || ""), p.passwordHash)))
      return Response.json({ error: "Senha atual incorreta." }, { status: 403 });
    data.passwordHash = await bcrypt.hash(String(body.newPassword), 10);
  }

  if (Object.keys(data).length === 0) return Response.json({ error: "Nada para atualizar." }, { status: 400 });
  await prisma.participant.update({ where: { id: p.id }, data });
  return Response.json({ ok: true });
}

export const dynamic = "force-dynamic";
