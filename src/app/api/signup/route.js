import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req) {
  const { name, email, password, inviteCode } = await req.json();
  if (!name || !email || !password) return Response.json({ error: "Preencha nome, email e senha." }, { status: 400 });
  if (String(inviteCode || "") !== String(process.env.INVITE_CODE || "")) return Response.json({ error: "Código de convite inválido." }, { status: 403 });
  if (password.length < 6) return Response.json({ error: "A senha precisa de ao menos 6 caracteres." }, { status: 400 });
  const e = email.toLowerCase().trim();
  const exists = await prisma.participant.findUnique({ where: { email: e } });
  if (exists) return Response.json({ error: "Já existe uma conta com esse email." }, { status: 409 });
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.participant.create({ data: { name: name.trim(), email: e, passwordHash } });
  return Response.json({ ok: true });
}

export const dynamic = "force-dynamic";
