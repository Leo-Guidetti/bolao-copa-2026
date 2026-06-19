"use client";

import { useEffect, useRef, useState } from "react";
import { fileToAvatar } from "@/lib/avatar";

function Avatar({ url, name, size = "h-24 w-24 text-3xl" }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hover)] font-bold text-[var(--muted)]`}>
      {url ? <img src={url} alt={name} className="h-full w-full object-cover" /> : initial}
    </span>
  );
}

export default function PerfilPage() {
  const [me, setMe] = useState(undefined);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [photoMsg, setPhotoMsg] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const fileRef = useRef(null);

  const [name, setName] = useState("");
  const [nameMsg, setNameMsg] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [conf, setConf] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((p) => { setMe(p); setAvatarUrl(p?.avatarUrl || null); setName(p?.name || ""); });
  }, []);

  async function saveName() {
    setNameMsg("");
    const nm = name.trim();
    if (nm.length < 2) return setNameMsg("❌ O nome precisa de ao menos 2 caracteres.");
    setSavingName(true);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: nm }) });
    const data = await res.json();
    setSavingName(false);
    if (res.ok) { setMe((m) => ({ ...m, name: nm })); setNameMsg("✅ Nome atualizado!"); }
    else setNameMsg("❌ " + (data.error || "Erro ao salvar nome."));
  }

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoMsg(""); setSavingPhoto(true);
    try {
      const dataUrl = await fileToAvatar(file);
      const res = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ avatarUrl: dataUrl }) });
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao salvar foto.");
      setAvatarUrl(dataUrl); setPhotoMsg("✅ Foto atualizada!");
    } catch (err) { setPhotoMsg("❌ " + err.message); }
    setSavingPhoto(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removePhoto() {
    setSavingPhoto(true); setPhotoMsg("");
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ avatarUrl: "" }) });
    setSavingPhoto(false);
    if (res.ok) { setAvatarUrl(null); setPhotoMsg("Foto removida."); }
  }

  async function changePassword() {
    setPwMsg("");
    if (nw !== conf) return setPwMsg("❌ A confirmação não confere.");
    if (nw.length < 6) return setPwMsg("❌ A nova senha precisa de ao menos 6 caracteres.");
    setSavingPw(true);
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: cur, newPassword: nw }) });
    const data = await res.json();
    setSavingPw(false);
    if (res.ok) { setPwMsg("✅ Senha alterada!"); setCur(""); setNw(""); setConf(""); }
    else setPwMsg("❌ " + (data.error || "Erro ao alterar senha."));
  }

  if (me === undefined) return <p className="text-[var(--muted)]">Carregando…</p>;
  if (me === null) return (
    <div className="mx-auto mt-10 max-w-sm card space-y-3 p-6 text-center">
      <div className="text-3xl">🔒</div>
      <p className="text-[var(--muted)]">Faça login para ver seu perfil.</p>
      <a className="btn-primary" href="/login">Entrar</a>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Meu perfil</h1>

      <section className="card flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
        <Avatar url={avatarUrl} name={me.name} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold">{me.name}</div>
          <div className="truncate text-sm text-[var(--muted)]">{me.email}</div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <button className="btn-primary" disabled={savingPhoto} onClick={() => fileRef.current?.click()}>
              {savingPhoto ? "Enviando…" : avatarUrl ? "Trocar foto" : "Adicionar foto"}
            </button>
            {avatarUrl && <button className="btn-ghost" disabled={savingPhoto} onClick={removePhoto}>Remover</button>}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
          </div>
          {photoMsg && <p className="mt-2 text-sm text-brand-dark">{photoMsg}</p>}
        </div>
      </section>

      {me.isAdmin && (
        <a href="/admin" className="card flex items-center justify-between gap-3 p-5 transition hover:bg-[var(--hover)]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛠️</span>
            <div>
              <div className="font-semibold">Painel do Admin</div>
              <div className="text-sm text-[var(--muted)]">Atualizar resultados, stats dos jogos e participantes</div>
            </div>
          </div>
          <span className="text-lg text-brand">→</span>
        </a>
      )}

      <section className="card space-y-3 p-6">
        <h2 className="font-semibold">Nome de exibição</h2>
        <p className="text-sm text-[var(--muted)]">É como você aparece no ranking e pros amigos.</p>
        <input className="input" placeholder="Seu nome" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={savingName || !name.trim() || name.trim() === me.name} onClick={saveName}>{savingName ? "Salvando…" : "Salvar nome"}</button>
          {nameMsg && <span className="text-sm text-brand-dark">{nameMsg}</span>}
        </div>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-semibold">Alterar senha</h2>
        <input type="password" className="input" placeholder="Senha atual" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input type="password" className="input" placeholder="Nova senha (mín. 6)" value={nw} onChange={(e) => setNw(e.target.value)} />
        <input type="password" className="input" placeholder="Confirmar nova senha" value={conf} onChange={(e) => setConf(e.target.value)} />
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={savingPw || !cur || !nw} onClick={changePassword}>{savingPw ? "Salvando…" : "Salvar senha"}</button>
          {pwMsg && <span className="text-sm text-brand-dark">{pwMsg}</span>}
        </div>
      </section>
    </div>
  );
}
