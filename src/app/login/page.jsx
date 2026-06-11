"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({ name: "", email: "", password: "", inviteCode: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      if (mode === "signup") {
        const r = await fetch("/api/signup", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form),
        });
        const data = await r.json();
        if (!r.ok) { setMsg(data.error || "Erro no cadastro."); setBusy(false); return; }
      }
      const res = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
      if (res?.error) { setMsg("Email ou senha incorretos."); setBusy(false); return; }
      router.push("/");
      router.refresh();
    } catch {
      setMsg("Algo deu errado. Tente de novo."); setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-sm">
      <div className="card space-y-4 p-6">
        <div className="text-center">
          <div className="text-3xl">🏆</div>
          <h1 className="mt-1 text-xl font-semibold">Leigos da Bola</h1>
          <p className="text-sm text-[var(--muted)]">{mode === "login" ? "Entre para apostar" : "Crie sua conta (precisa do código de convite)"}</p>
        </div>

        <div className="flex rounded-full bg-[var(--hover)] p-1 text-sm">
          <button onClick={() => setMode("login")} className={`flex-1 rounded-full py-1.5 ${mode === "login" ? "bg-brand text-white" : "text-[var(--muted)]"}`}>Entrar</button>
          <button onClick={() => setMode("signup")} className={`flex-1 rounded-full py-1.5 ${mode === "signup" ? "bg-brand text-white" : "text-[var(--muted)]"}`}>Cadastrar</button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input className="input" placeholder="Seu nome" value={form.name} onChange={set("name")} required />
          )}
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
          <input className="input" type="password" placeholder="Senha" value={form.password} onChange={set("password")} required />
          {mode === "signup" && (
            <input className="input" placeholder="Código de convite" value={form.inviteCode} onChange={set("inviteCode")} required />
          )}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
        </form>
        {msg && <p className="text-center text-sm text-red-600">{msg}</p>}
      </div>
    </div>
  );
}
