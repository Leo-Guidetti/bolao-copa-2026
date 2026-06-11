import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  const participants = await prisma.participant.findMany({ orderBy: { name: "asc" } });
  return Response.json(participants);
}

export async function POST(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const body = await req.json();
  const p = await prisma.participant.create({
    data: {
      name: body.name,
      email: body.email || null,
      entryFee: Number(body.entryFee) || 0,
      isAdmin: !!body.isAdmin,
      avatarUrl: body.avatarUrl || null,
    },
  });
  return Response.json(p);
}

export async function PATCH(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const body = await req.json();
  const data = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.entryFee !== undefined) data.entryFee = Number(body.entryFee) || 0;
  if (body.isAdmin !== undefined) data.isAdmin = !!body.isAdmin;
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl || null;
  if (body.paid !== undefined) data.paid = !!body.paid;
  const p = await prisma.participant.update({ where: { id: body.id }, data });
  return Response.json(p);
}

export async function DELETE(req) {
  if (!(await requireAdmin())) return new Response("Nao autorizado", { status: 401 });
  const { searchParams } = new URL(req.url);
  await prisma.participant.delete({ where: { id: searchParams.get("id") } });
  return Response.json({ ok: true });
}

export const dynamic = "force-dynamic";
