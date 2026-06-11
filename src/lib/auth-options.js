import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const ADMINS = (process.env.ADMIN_EMAILS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export const isAdminEmail = (email) => !!email && ADMINS.includes(email.toLowerCase());

export const authOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize(c) {
        if (!c?.email || !c?.password) return null;
        const p = await prisma.participant.findUnique({ where: { email: c.email.toLowerCase().trim() } });
        if (!p || !p.passwordHash) return null;
        const ok = await bcrypt.compare(c.password, p.passwordHash);
        if (!ok) return null;
        return { id: p.id, name: p.name, email: p.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) { if (user) token.pid = user.id; return token; },
    async session({ session, token }) {
      if (session.user) { session.user.pid = token.pid; session.user.isAdmin = isAdminEmail(session.user.email); }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
