"use client";

import { useEffect, useState } from "react";
import { flagUrl, teamFull } from "@/lib/flags";

const fmtPts = (n) => Number((n || 0).toFixed(1)).toString();

function TeamTag({ team, align }) {
  const url = flagUrl(team);
  return (
    <span className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <span className="flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)]">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
      </span>
      <span className="truncate">{teamFull(team)}</span>
    </span>
  );
}

// Modal: palpites de todos os participantes num jogo, ordenados por pontos.
export default function MatchBets({ match, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!match) return;
    setData(null);
    fetch(`/api/match-bets?matchId=${match.id}`).then((r) => r.json()).then(setData).catch(() => setData({ locked: false, bets: [] }));
  }, [match]);
  if (!match) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card max-h-[80vh] w-full max-w-md space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="flex flex-1 items-center gap-2 text-sm font-semibold">
            <div className="min-w-0 flex-1"><TeamTag team={match.homeTeam} align="right" /></div>
            <span className="shrink-0 tabular-nums">{match.finished ? `${match.homeScore} × ${match.awayScore}` : "×"}</span>
            <div className="min-w-0 flex-1"><TeamTag team={match.awayTeam} /></div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--hover)] text-[var(--muted)]">×</button>
        </div>

        {!data ? (
          <p className="py-2 text-sm text-[var(--muted)]">Carregando…</p>
        ) : !data.locked ? (
          <p className="py-2 text-sm text-[var(--muted)]">Os palpites de todos aparecem quando o jogo travar (30 min antes do apito).</p>
        ) : data.bets.length === 0 ? (
          <p className="py-2 text-sm text-[var(--muted)]">Ninguém palpitou nesse jogo.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {data.bets.map((b, i) => (
              <li key={i} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="w-5 text-center text-xs font-bold text-[var(--faint)]">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
                <span className="tabular-nums text-[var(--muted)]">{b.homeGuess}×{b.awayGuess}</span>
                {b.points != null && (
                  <span className={`pill font-bold ${b.points > 0 ? "bg-brand-light text-brand-dark" : "bg-[var(--hover)] text-[var(--muted)]"}`}>{fmtPts(b.points)} pts</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
