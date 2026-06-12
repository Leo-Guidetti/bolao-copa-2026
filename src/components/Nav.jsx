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
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base hover:bg-[var(--hover)]">
      {dark ? "☀️" : "🌙"}
    </button>
  );
}

export default function Nav() {
  const path = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin;
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (session?.user) fetch("/api/me").then((r) => r.json()).then(setMe); }, [session]);
  useEffect(() => { setOpen(false); }, [path]);

  const links = [
    { href: "/", label: "Home" },
    { href: "/ranking", label: "Ranking" },
    { href: "/apostas", label: "Meus palpites" },
    { href: "/selecao", label: "Minha seleção" },
    { href: "/times", label: "Times" },
    { href: "/ideal", label: "Seleção ideal" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  const isActive = (href) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-2 px-3 py-2.5 sm:px-4">
        <button onClick={() => setOpen(true)} aria-label="Abrir menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl hover:bg-[var(--hover)]">☰</button>
        <Link href="/" className="flex shrink-0 items-center gap-1.5 font-semibold tracking-tight">
          <img src="/icon-192.png" alt="Leigos da Bola" className="h-6 w-6 rounded-md" />
          <span className="hidden sm:inline">Leigos da Bola</span>
          <span className="hidden text-brand sm:inline">| Copa 2026</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {session?.user ? (
            <Link href="/perfil" title="Meu perfil"
              className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold ${path.startsWith("/perfil") ? "ring-2 ring-brand" : ""} bg-[var(--hover)] text-[var(--muted)]`}>
              {me?.avatarUrl ? <img src={me.avatarUrl} alt="" className="h-full w-full object-cover" /> : (me?.name || session.user.name || "?").charAt(0).toUpperCase()}
            </Link>
          ) : (
            <Link href="/login" className="rounded-full px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]">Entrar</Link>
          )}
          <ThemeToggle />
        </div>
      </nav>
    </header>

      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-[var(--bg)] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-2">
              <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-md" />
              <span className="font-semibold tracking-tight">Leigos da Bola</span>
              <button onClick={() => setOpen(false)} aria-label="Fechar"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-lg hover:bg-[var(--hover)]">×</button>
            </div>
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                  className={`rounded-xl px-3 py-2.5 text-sm transition ${isActive(l.href) ? "bg-brand font-semibold text-white" : "text-[var(--text)] hover:bg-[var(--hover)]"}`}>
                  {l.label}
                </Link>
              ))}
            </nav>
            {session?.user && (
              <button onClick={() => signOut({ callbackUrl: "/login" })}
                className="mt-auto rounded-xl px-3 py-2.5 text-left text-sm text-[var(--muted)] hover:bg-[var(--hover)]">Sair</button>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
