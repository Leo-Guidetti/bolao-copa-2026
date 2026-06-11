"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  function toggle() {
    const el = document.documentElement;
    const next = !el.classList.contains("dark");
    el.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  }
  return (
    <button onClick={toggle} title="Alternar tema" aria-label="Alternar tema"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base hover:bg-[var(--hover)]">
      {dark ? "☀️" : "🌙"}
    </button>
  );
}

export default function Nav() {
  const path = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin;
  const [me, setMe] = useState(null);
  useEffect(() => { if (session?.user) fetch("/api/me").then((r) => r.json()).then(setMe); }, [session]);
  const links = [
    { href: "/", label: "Home" },
    { href: "/ranking", label: "Ranking" },
    { href: "/apostas", label: "Meus palpites" },
    { href: "/selecao", label: "Minha seleção" },
    { href: "/times", label: "Times" },
    { href: "/ideal", label: "Seleção ideal" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-2 px-3 py-2.5 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-1.5 font-semibold tracking-tight">
          <img src="/icon-192.png" alt="Leigos da Bola" className="h-6 w-6 rounded-md" />
          <span className="hidden sm:inline">Leigos da Bola</span>
          <span className="hidden text-[var(--faint)] md:inline">|</span>
          <span className="hidden text-brand md:inline">Copa 2026</span>
        </Link>
        <div className="ml-auto flex items-center gap-0.5 overflow-x-auto">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
                className={`rounded-full px-2.5 py-1.5 text-sm transition sm:px-3 ${active ? "bg-brand text-white" : "text-[var(--muted)] hover:bg-[var(--hover)]"}`}>
                {l.label}
              </Link>
            );
          })}
          {session?.user ? (
            <>
              <Link href="/perfil" title="Meu perfil"
                className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold ${path.startsWith("/perfil") ? "ring-2 ring-brand" : ""} bg-[var(--hover)] text-[var(--muted)]`}>
                {me?.avatarUrl ? <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" /> : (me?.name || session.user.name || "?").charAt(0).toUpperCase()}
              </Link>
              <button onClick={() => signOut({ callbackUrl: "/login" })}
                className="rounded-full px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]" title={session.user.email}>Sair</button>
            </>
          ) : (
            <Link href="/login" className="rounded-full px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]">Entrar</Link>
          )}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
