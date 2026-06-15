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
function fmtDate(m) {
  return new Date(m.kickoff).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Flag({ team, align }) {
  const url = flagUrl(team);
  const tbd = team === "A definir";
  return (
    <span className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className="flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)]">
        {url ? <img src={url} alt={team} className="h-full w-full object-cover" /> : <span className="text-[9px] text-[var(--faint)]">{tbd ? "?" : ""}</span>}
      </span>
      <span className={`text-sm font-medium ${tbd ? "text-[var(--faint)]" : ""}`} title={team}>{teamAbbr(team)}</span>
    </span>
  );
}

function Row({ m, g, lock, onChange, scoring, onOpen }) {
  const done = m.finished && m.homeScore != null && m.awayScore != null;
  const hasGuess = g && g.home !== "" && g.home != null && g.away !== "" && g.away != null;
  const pts = done && hasGuess && scoring ? betPoints({ homeGuess: Number(g.home), awayGuess: Number(g.away) }, m, scoring) : 0;
  return (
    <div className={`py-2 ${lock ? "cursor-pointer opacity-80 hover:bg-[var(--hover)]" : ""}`} onClick={lock && onOpen ? () => onOpen(m) : undefined} title={lock ? "Ver palpites de todos" : undefined}>
      <div className="mb-0.5 text-center text-[10px] text-[var(--faint)]">{fmtDate(m)} (BRT){lock ? " 🔒" : ""}</div>
      <div className="flex items-center gap-2">
        <div className="flex-1"><Flag team={m.homeTeam} align="right" /></div>
        <input type="number" inputMode="numeric" min="0" disabled={lock} className="input w-12 px-0 text-center" value={g.home ?? ""} onChange={(e) => onChange(m.id, "home", e.target.value)} />
        <span className="text-[var(--faint)]">×</span>
        <input type="number" inputMode="numeric" min="0" disabled={lock} className="input w-12 px-0 text-center" value={g.away ?? ""} onChange={(e) => onChange(m.id, "away", e.target.value)} />
        <div className="flex-1"><Flag team={m.awayTeam} /></div>
      </div>
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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [weights, setWeights] = useState(null);
  const [scoring, setScoring] = useState(null);
  const [viewMode, setViewMode] = useState("crono");
  const [timeTab, setTimeTab] = useState("prox"); // prox = a acontecer | fim = já aconteceram
  const [openMatch, setOpenMatch] = useState(null);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then(setMe);
    fetch("/api/matches").then((r) => r.json()).then(setMatches);
    fetch("/api/settings").then((r) => r.json()).then((st) => { setWeights(st.ranking); setScoring(st.scoring); });
  }, []);

  useEffect(() => {
    if (!me) return;
    fetch("/api/bets").then((r) => r.json()).then((bets) => {
      const g = {};
      for (const b of bets) g[b.matchId] = { home: b.homeGuess, away: b.awayGuess };
      setGuesses(g);
    });
  }, [me]);

  const now = Date.now();
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
  const tbd = (m) => m.homeTeam === "A definir" || m.awayTeam === "A definir";
  const BET_LOCK_MS = 30 * 60 * 1000; // 30 min antes do jogo
  const locked = (m) => m.finished || tbd(m) || new Date(m.kickoff).getTime() - BET_LOCK_MS <= now;
  const guessesRef = useRef({});
  useEffect(() => { guessesRef.current = guesses; }, [guesses]);
  const saveTimer = useRef(null);

  async function doSave() {
    const g = guessesRef.current;
    const bets = Object.entries(g)
      .filter(([, v]) => v && v.home !== "" && v.away !== "" && v.home != null && v.away != null)
      .map(([matchId, v]) => ({ matchId, homeGuess: v.home, awayGuess: v.away }));
    if (!bets.length) return;
    setSaving(true);
    const res = await fetch("/api/bets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bets }) });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setMsg(res.ok ? `✓ Salvo (${data.saved})` : (data.error || "Erro ao salvar."));
  }
  const scheduleSave = () => { clearTimeout(saveTimer.current); saveTimer.current = setTimeout(doSave, 900); };
  const save = doSave;
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
        <p className="mt-1 text-[var(--muted)]">Calendário completo por grupo e rodada. Cada palpite trava 30 min antes do apito inicial do jogo. <span className="text-[var(--faint)]">Valem {pctBets}% da pontuação final.</span></p>
      </div>

      <div className="card sticky top-16 z-10 flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm text-[var(--muted)]">Apostando como <b className="text-[var(--text)]">{me?.name || "..."}</b></span>
        <span className="pill bg-brand-light text-xs font-bold text-brand-dark">Meus pontos: {fmtPts(myBetPts)}</span>
        <div className="flex rounded-full bg-[var(--hover)] p-0.5 text-xs">
          <button type="button" onClick={() => setViewMode("crono")} className={`rounded-full px-3 py-1 transition ${viewMode === "crono" ? "bg-[var(--surface)] font-semibold shadow" : "text-[var(--muted)]"}`}>Cronológico</button>
          <button type="button" onClick={() => setViewMode("grupos")} className={`rounded-full px-3 py-1 transition ${viewMode === "grupos" ? "bg-[var(--surface)] font-semibold shadow" : "text-[var(--muted)]"}`}>Por grupo</button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-[var(--faint)]">{saving ? "Salvando…" : (msg || "Salva automaticamente")}</span>
          <button className="btn-primary" onClick={save} disabled={saving}>Salvar agora</button>
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
                  <div className="divide-y divide-[var(--border)]">{(groups[gl][r] || []).map((m) => <Row key={m.id} m={m} g={guesses[m.id] || {}} lock={locked(m)} onChange={setGuess} scoring={scoring} onOpen={setOpenMatch} />)}</div>
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
                {knockout[s].map((m, i) => (<div key={m.id}><div className="pt-2 text-[11px] text-[var(--faint)]">Jogo {i + 1}</div><Row m={m} g={guesses[m.id] || {}} lock={locked(m)} onChange={setGuess} scoring={scoring} onOpen={setOpenMatch} /></div>))}
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
              .map((d) => ({ ...d, items: d.items.filter((m) => (timeTab === "fim" ? happened(m) : !happened(m))) }))
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
                      <Row m={m} g={guesses[m.id] || {}} lock={locked(m)} onChange={setGuess} scoring={scoring} onOpen={setOpenMatch} />
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
