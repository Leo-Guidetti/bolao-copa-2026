"use client";

import { useEffect, useMemo, useState } from "react";
import { flagUrl, teamAbbr } from "@/lib/flags";
import { STAGE_LABELS } from "@/lib/defaults";

const WD = ["D", "S", "T", "Q", "Q", "S", "S"];
const fmtTime = (d) => new Date(d).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function Flag({ t }) {
  const u = flagUrl(t);
  return <span className="flex h-4 w-6 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)]">{u ? <img src={u} alt="" className="h-full w-full object-cover" /> : null}</span>;
}

export default function MatchCalendar() {
  const [matches, setMatches] = useState([]);
  const [cursor, setCursor] = useState(null); // { y, m }
  const [sel, setSel] = useState(null); // "YYYY-MM-DD"

  useEffect(() => {
    fetch("/api/matches").then((r) => r.json()).then((ms) => {
      setMatches(ms);
      const today = dayKey(new Date());
      const days = ms.map((m) => dayKey(m.kickoff)).sort();
      const start = days.find((d) => d >= today) || days[0] || today;
      const [y, mo] = start.split("-").map(Number);
      setCursor({ y, m: mo - 1 });
      setSel(start);
    });
  }, []);

  const byDay = useMemo(() => {
    const map = {};
    for (const m of matches) (map[dayKey(m.kickoff)] ||= []).push(m);
    for (const k in map) map[k].sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
    return map;
  }, [matches]);

  if (!cursor) return null;
  const { y, m } = cursor;
  const startWd = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ d, key, count: (byDay[key] || []).length });
  }
  const monthLabel = new Date(Date.UTC(y, m, 1)).toLocaleDateString("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
  const prev = () => setCursor(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
  const next = () => setCursor(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });
  const today = dayKey(new Date());
  const selGames = sel ? (byDay[sel] || []) : [];
  const tag = (mt) => (mt.stage === "GROUP" ? `Grupo ${mt.group}` : STAGE_LABELS[mt.stage]);

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">📅 Calendário da Copa</h2>
        <div className="flex items-center gap-1">
          <button onClick={prev} aria-label="Mês anterior" className="flex h-7 w-7 items-center justify-center rounded-full text-lg hover:bg-[var(--hover)]">‹</button>
          <span className="w-28 text-center text-sm font-medium capitalize">{monthLabel}</span>
          <button onClick={next} aria-label="Próximo mês" className="flex h-7 w-7 items-center justify-center rounded-full text-lg hover:bg-[var(--hover)]">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[var(--faint)]">
        {WD.map((w, i) => <div key={i}>{w}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => c === null ? <div key={i} /> : (
          <button key={i} onClick={() => setSel(c.key)}
            className={`relative flex aspect-square items-center justify-center rounded-lg text-xs transition ${c.key === sel ? "bg-brand font-bold text-white" : c.key === today ? "bg-[var(--hover)] font-bold" : c.count ? "hover:bg-[var(--hover)]" : "text-[var(--faint)]"}`}>
            {c.d}
            {c.count > 0 && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${c.key === sel ? "bg-white" : "bg-brand"}`} />}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <div className="text-xs font-semibold capitalize text-[var(--muted)]">
          {sel ? new Date(sel + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : ""}
        </div>
        {selGames.length === 0 ? (
          <p className="text-sm text-[var(--faint)]">Sem jogos nesse dia.</p>
        ) : selGames.map((mt) => (
          <div key={mt.id} className="flex items-center gap-2 rounded-xl bg-[var(--hover)] p-2">
            <div className="w-10 shrink-0 text-center">
              <div className="text-xs font-bold tabular-nums">{fmtTime(mt.kickoff)}</div>
              <div className="text-[9px] text-[var(--faint)]">{tag(mt)}</div>
            </div>
            <div className="flex flex-1 items-center justify-center gap-2 text-sm">
              <span className="flex items-center gap-1.5">{teamAbbr(mt.homeTeam)}<Flag t={mt.homeTeam} /></span>
              {mt.finished ? <b className="tabular-nums">{mt.homeScore} × {mt.awayScore}</b> : <span className="text-[var(--faint)]">×</span>}
              <span className="flex items-center gap-1.5"><Flag t={mt.awayTeam} />{teamAbbr(mt.awayTeam)}</span>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-[var(--faint)]">📺 Todos os jogos ao vivo na <b>CazéTV</b> (YouTube). Jogos selecionados também na Globo, SBT, SporTV e Globoplay.</p>
      </div>
    </section>
  );
}
