"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flagUrl, teamAbbr } from "@/lib/flags";
import { STAGE_LABELS } from "@/lib/defaults";
import { betPoints } from "@/lib/scoring";
import LeigoMaster from "@/components/LeigoMaster";
import MatchBets from "@/components/MatchBets";

const fmtPts = (n) => n.toFixed(n % 1 === 0 ? 0 : 1);

const KO_ORDER = ["R32", "R16", "QF", "SF", "THIRD", "FINAL"];
// Dia "lógico" do jogo: madrugada até 4h (BRT) conta como o dia anterior.
const matchDay = (d) => new Date(new Date(d).getTime() - 4 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const BET_LOCK_MS = 1 * 60 * 1000; // palpite trava 1 min antes do apito
function fmtRemain(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}
function fmtDate(m) {
  return new Date(m.kickoff).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Flag({ team, align }) {
  const url = flagUrl(team);
  const placeholder = !url; // sem bandeira = vaga ainda não definida (mata-mata) ou "A definir"
  return (
    <span className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className="flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)]">
        {url ? <img src={url} alt={team} className="h-full w-full object-cover" /> : <span className="text-[9px] text-[var(--faint)]">{team === "A definir" ? "?" : ""}</span>}
      </span>
      <span className={`text-sm font-medium ${placeholder ? "text-[var(--faint)]" : ""}`} title={team}>{teamAbbr(team)}</span>
    </span>
  );
}

function Row({ m, g, savedG, lock, onChange, onSaveOne, savingId, scoring, onOpen, now = Date.now(), koBetsOpen = false }) {
  const done = m.finished && m.homeScore != null && m.awayScore != null;
  const tbd = !flagUrl(m.homeTeam) || !flagUrl(m.awayTeam) || (m.stage !== "GROUP" && !koBetsOpen); // só aposta com os dois times reais e mata-mata liberado
  const lockAt = new Date(m.kickoff).getTime() - BET_LOCK_MS;
  const showCount = !done && !tbd && now < lockAt;
  const hasGuess = g && g.home !== "" && g.home != null && g.away !== "" && g.away != null;
  const isSaved = hasGuess && savedG && String(savedG.home) === String(g.home) && String(savedG.away) === String(g.away);
  const pending = hasGuess && !isSaved;
  const pts = done && hasGuess && scoring ? betPoints({ homeGuess: Number(g.home), awayGuess: Number(g.away) }, m, scoring) : 0;
  return (
    <div className={`py-2 ${lock ? "cursor-pointer opacity-80 hover:bg-[var(--hover)]" : ""}`} onClick={lock && onOpen ? () => onOpen(m) : undefined} title={lock ? "Ver palpites de todos" : undefined}>
      <div className="mb-0.5 text-center text-[10px] text-[var(--faint)]">
        {fmtDate(m)} (BRT){lock && !showCount ? " 🔒" : ""}
        {showCount && <span className="ml-1.5 font-bold text-emerald-400" style={{ textShadow: "0 0 8px rgba(16,185,129,0.7)" }}>⏱ fecha em {fmtRemain(lockAt - now)}</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1"><Flag team={m.homeTeam} align="right" /></div>
        <input type="number" inputMode="numeric" min="0" disabled={lock} className="input w-12 px-0 text-center" value={g.home ?? ""} onChange={(e) => onChange(m.id, "home", e.target.value)} />
        <span className="text-[var(--faint)]">×</span>
        <input type="number" inputMode="numeric" min="0" disabled={lock} className="input w-12 px-0 text-center" value={g.away ?? ""} onChange={(e) => onChange(m.id, "away", e.target.value)} />
        <div className="flex-1"><Flag team={m.awayTeam} /></div>
      </div>
      {!done && (
        <div className="mt-1 flex items-center justify-center gap-2">
          {isSaved && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">✓ Salvo · {g.home}×{g.away}</span>}
          {pending && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-600">● Não salvo</span>}
          {!hasGuess && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-500">⚠ Sem palpite</span>}
          {pending && !lock && <button type="button" onClick={(e) => { e.stopPropagation(); onSaveOne(m.id); }} disabled={savingId === m.id} className="rounded-full bg-brand px-3 py-0.5 text-[11px] font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60">{savingId === m.id ? "Salvando…" : "Salvar"}</button>}
        </div>
      )}
      {done && (
        <div className="mt-1 flex items-center justify-center gap-2 text-[11px]">
          <span className="text-[var(--faint)]">Resultado real: <b className="tabular-nums text-[var(--text)]">{m.homeScore} × {m.awayScore}</b></span>
          {hasGuess
            ? <span className={`pill font-bold ${pts > 0 ? "bg-brand-light text-brand-dark" : "bg-[var(--hover)] text-[var(--muted)]"}`}>{pts > 0 ? `+${fmtPts(pts)}` : "0"} pts</span>
            : <span className="pill bg-[var(--hover)] text-[var(--faint)]">sem palpite</span>}
        </div>
      )}
    </div>
  );
}

export default function ApostasPage() {
  const [me, setMe] = useState(undefined);
  const [matches, setMatches] = useState([]);
  const [guesses, setGuesses] = useState({});
  const [saved, setSaved] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [weights, setWeights] = useState(null);
  const [scoring, setScoring] = useState(null);
  const [koBetsOpen, setKoBetsOpen] = useState(false);
  const [viewMode, setViewMode] = useState("crono");
  const [timeTab, setTimeTab] = useState("prox"); // prox = a acontecer | fim = já aconteceram
  const [openMatch, setOpenMatch] = useState(null);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then(setMe);
    fetch("/api/matches").then((r) => r.json()).then(setMatches);
    fetch("/api/settings").then((r) => r.json()).then((st) => { setWeights(st.ranking); setScoring(st.scoring); setKoBetsOpen(!!st.koBets?.open); });
  }, []);

  useEffect(() => {
    if (!me) return;
    fetch("/api/bets").then((r) => r.json()).then((bets) => {
      const g = {};
      for (const b of bets) g[b.matchId] = { home: b.homeGuess, away: b.awayGuess };
      setGuesses(g);
      setSaved(JSON.parse(JSON.stringify(g)));
    });
  }, [me]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const _wB = weights?.weightBets ?? 0.6, _wS = weights?.weightSquad ?? 0.4, _sumW = (_wB + _wS) || 1;
  const pctBets = Math.round((_wB / _sumW) * 100);
  const myBetPts = useMemo(() => {
    if (!scoring) return 0;
    return matches.reduce((s, m) => {
      const g = guesses[m.id];
      if (m.finished && m.homeScore != null && g && g.home !== "" && g.home != null && g.away !== "" && g.away != null)
        return s + betPoints({ homeGuess: Number(g.home), awayGuess: Number(g.away) }, m, scoring);
      return s;
    }, 0);
  }, [matches, guesses, scoring]);
  const tbd = (m) => !flagUrl(m.homeTeam) || !flagUrl(m.awayTeam) || (m.stage !== "GROUP" && !koBetsOpen);
  const locked = (m) => m.finished || tbd(m) || new Date(m.kickoff).getTime() - BET_LOCK_MS <= now;
  const pendingCount = useMemo(() => {
    let n = 0;
    for (const m of matches) {
      if (m.finished || tbd(m) || new Date(m.kickoff).getTime() - BET_LOCK_MS <= now) continue;
      const g = guesses[m.id];
      if (!g || g.home === "" || g.away === "" || g.home == null || g.away == null) continue;
      const s = saved[m.id];
      if (!s || String(s.home) !== String(g.home) || String(s.away) !== String(g.away)) n++;
    }
    return n;
  }, [matches, guesses, saved, now]);
  const guessesRef = useRef({});
  useEffect(() => { guessesRef.current = guesses; }, [guesses]);

  async function reloadSaved() {
    const bets = await (await fetch("/api/bets")).json();
    const g = {};
    for (const b of bets) g[b.matchId] = { home: b.homeGuess, away: b.awayGuess };
    setSaved(g);
  }
  async function saveOne(id) {
    const v = guessesRef.current[id];
    if (!v || v.home === "" || v.away === "" || v.home == null || v.away == null) return;
    setSavingId(id); setMsg("");
    const res = await fetch("/api/bets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bets: [{ matchId: id, homeGuess: v.home, awayGuess: v.away }] }) });
    setSavingId(null);
    if (res.ok) setSaved((s) => ({ ...s, [id]: { home: v.home, away: v.away } }));
    else { const d = await res.json().catch(() => ({})); setMsg(d.error || "Erro ao salvar (prazo pode ter encerrado)."); }
  }
  async function saveAll() {
    const g = guessesRef.current;
    const bets = Object.entries(g)
      .filter(([, v]) => v && v.home !== "" && v.away !== "" && v.home != null && v.away != null)
      .map(([matchId, v]) => ({ matchId, homeGuess: v.home, awayGuess: v.away }));
    if (!bets.length) return;
    setSaving(true); setMsg("");
    const res = await fetch("/api/bets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bets }) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { await reloadSaved(); setMsg(`✓ ${data.saved} salvo(s)`); }
    else setMsg(data.error || "Erro ao salvar.");
  }
  const saveTimer = useRef(null);
  async function autoSave() {
    const g = guessesRef.current;
    const bets = Object.entries(g)
      .filter(([, v]) => v && v.home !== "" && v.away !== "" && v.home != null && v.away != null)
      .map(([matchId, v]) => ({ matchId, homeGuess: v.home, awayGuess: v.away }));
    if (!bets.length) return;
    setSaving(true);
    const res = await fetch("/api/bets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bets }) });
    setSaving(false);
    if (res.ok) { const sv = {}; for (const b of bets) sv[b.matchId] = { home: b.homeGuess, away: b.awayGuess }; setSaved((s) => ({ ...s, ...sv })); setMsg(""); }
    else { const d = await res.json().catch(() => ({})); setMsg(d.error || "Erro ao salvar."); }
  }
  const scheduleSave = () => { clearTimeout(saveTimer.current); saveTimer.current = setTimeout(autoSave, 1000); };
  const setGuess = (id, side, v) => { setGuesses((g) => ({ ...g, [id]: { ...g[id], [side]: v === "" ? "" : Math.max(0, Number(v)) } })); scheduleSave(); };

  const groups = useMemo(() => {
    const g = {};
    for (const m of matches.filter((x) => x.stage === "GROUP")) { (g[m.group] ||= {}); (g[m.group][m.round] ||= []).push(m); }
    return g;
  }, [matches]);
  const knockout = useMemo(() => {
    const k = {};
    for (const m of matches.filter((x) => x.stage !== "GROUP")) (k[m.stage] ||= []).push(m);
    return k;
  }, [matches]);
  const chrono = useMemo(() => {
    const arr = matches.slice().sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    const days = []; let cur = null;
    for (const m of arr) {
      const key = matchDay(m.kickoff);
      if (!cur || cur.key !== key) {
        const day = new Date(key + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });
        cur = { key, day, items: [] }; days.push(cur);
      }
      cur.items.push(m);
    }
    return days;
  }, [matches]);
  const tag = (m) => (m.stage === "GROUP" ? `Grupo ${m.group} · Rodada ${m.round}` : STAGE_LABELS[m.stage]);

  if (me === null) return (
    <div className="mx-auto mt-10 max-w-sm card space-y-3 p-6 text-center">
      <div className="text-3xl">🔒</div>
      <p className="text-[var(--muted)]">Faça login para apostar nos placares.</p>
      <a className="btn-primary" href="/login">Entrar</a>
    </div>
  );

  return (
    <div className="space-y-6">
      {openMatch && <MatchBets match={openMatch} onClose={() => setOpenMatch(null)} />}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Apostas de Placar</h1>
        <p className="mt-1 text-[var(--muted)]">Calendário completo por grupo e rodada. <b className="text-[var(--text)]">Salva automaticamente</b> ao digitar; se quiser garantir, use os botões "Salvar" / "Salvar todos". Cada palpite trava 1 min antes do apito. <span className="text-[var(--faint)]">Valem {pctBets}% da pontuação final.</span></p>
      </div>

      <div className="card sticky top-16 z-10 flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm text-[var(--muted)]">Apostando como <b className="text-[var(--text)]">{me?.name || "..."}</b></span>
        <span className="pill bg-brand-light text-xs font-bold text-brand-dark">Meus pontos: {fmtPts(myBetPts)}</span>
        <div className="flex rounded-full bg-[var(--hover)] p-0.5 text-xs">
          <button type="button" onClick={() => setViewMode("crono")} className={`rounded-full px-3 py-1 transition ${viewMode === "crono" ? "bg-[var(--surface)] font-semibold shadow" : "text-[var(--muted)]"}`}>Cronológico</button>
          <button type="button" onClick={() => setViewMode("grupos")} className={`rounded-full px-3 py-1 transition ${viewMode === "grupos" ? "bg-[var(--surface)] font-semibold shadow" : "text-[var(--muted)]"}`}>Por grupo</button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-[var(--faint)]">{saving ? "Salvando…" : (msg || (pendingCount ? `${pendingCount} não salvo(s)` : "Tudo salvo ✓"))}</span>
          <button className="btn-primary" onClick={saveAll} disabled={saving || !pendingCount}>Salvar todos{pendingCount ? ` (${pendingCount})` : ""}</button>
        </div>
      </div>

      <LeigoMaster context="palpites" />

      {viewMode === "grupos" ? (
        <>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Fase de grupos</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.keys(groups).sort().map((gl) => (
            <div key={gl} className="card p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{gl}</span>
                <h3 className="font-semibold">Grupo {gl}</h3>
              </div>
              {[1, 2, 3].map((r) => (
                <div key={r} className="mt-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">Rodada {r}</div>
                  <div className="divide-y divide-[var(--border)]">{(groups[gl][r] || []).map((m) => <Row key={m.id} m={m} g={guesses[m.id] || {}} savedG={saved[m.id]} lock={locked(m)} onChange={setGuess} onSaveOne={saveOne} savingId={savingId} scoring={scoring} onOpen={setOpenMatch} now={now} koBetsOpen={koBetsOpen} />)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Mata-mata</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {KO_ORDER.filter((s) => knockout[s]).map((s) => (
            <div key={s} className="card p-4">
              <h3 className="mb-2 font-semibold">{STAGE_LABELS[s]}</h3>
              <div className="divide-y divide-[var(--border)]">
                {knockout[s].map((m, i) => (<div key={m.id}><div className="pt-2 text-[11px] text-[var(--faint)]">Jogo {i + 1}</div><Row m={m} g={guesses[m.id] || {}} savedG={saved[m.id]} lock={locked(m)} onChange={setGuess} onSaveOne={saveOne} savingId={savingId} scoring={scoring} onOpen={setOpenMatch} now={now} koBetsOpen={koBetsOpen} /></div>))}
              </div>
              <p className="mt-2 text-xs text-[var(--faint)]">Confrontos definidos após a fase de grupos.</p>
            </div>
          ))}
        </div>
      </section>
        </>
      ) : (
        <section className="mx-auto max-w-2xl space-y-4">
          <div className="flex justify-center">
            <div className="flex rounded-full bg-[var(--hover)] p-0.5 text-sm">
              <button type="button" onClick={() => setTimeTab("prox")} className={`rounded-full px-4 py-1 transition ${timeTab === "prox" ? "bg-[var(--surface)] font-semibold shadow" : "text-[var(--muted)]"}`}>A acontecer</button>
              <button type="button" onClick={() => setTimeTab("fim")} className={`rounded-full px-4 py-1 transition ${timeTab === "fim" ? "bg-[var(--surface)] font-semibold shadow" : "text-[var(--muted)]"}`}>Já aconteceram</button>
            </div>
          </div>
          {(() => {
            const happened = (m) => m.finished; // só conta como "já aconteceu" quando o jogo termina (resultado/pontos computados)
            let days = chrono
              .map((d) => {
                let items = d.items.filter((m) => (timeTab === "fim" ? happened(m) : !happened(m)));
                if (timeTab === "fim") items = items.slice().reverse(); // mais tarde -> mais cedo
                return { ...d, items };
              })
              .filter((d) => d.items.length);
            if (timeTab === "fim") days = days.slice().reverse(); // já aconteceram: mais recentes primeiro
            if (!days.length) return <p className="text-center text-[var(--muted)]">{chrono.length ? "Nenhum jogo nessa aba." : "Carregando jogos…"}</p>;
            return days.map((d) => (
              <div key={d.day} className="card p-4">
                <h3 className="mb-2 font-semibold capitalize">{d.day}</h3>
                <div className="divide-y divide-[var(--border)]">
                  {d.items.map((m) => (
                    <div key={m.id}>
                      <div className="pt-1 text-center text-[10px] font-medium text-[var(--muted)]">{tag(m)}</div>
                      <Row m={m} g={guesses[m.id] || {}} savedG={saved[m.id]} lock={locked(m)} onChange={setGuess} onSaveOne={saveOne} savingId={savingId} scoring={scoring} onOpen={setOpenMatch} now={now} koBetsOpen={koBetsOpen} />
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </section>
      )}
    </div>
  );
}
