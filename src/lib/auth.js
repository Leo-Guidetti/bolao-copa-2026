// Checagem simples de admin via senha no header. Suficiente para MVP entre amigos.
// Para produção real, troque por autenticação de verdade (NextAuth, Supabase Auth, etc.).
export function isAdmin(req) {
  const pass = req.headers.get("x-admin-password");
  return pass && pass === (process.env.ADMIN_PASSWORD || "copa2026");
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Não autorizado" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
