"use client";

import { useEffect, useState } from "react";
import { flagUrl, teamAbbr } from "@/lib/flags";

const fmtPts = (n) => Number((n || 0).toFixed(1)).toString();
const pct1 = (n, t) => (t ? (n / t) * 100 : 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const COLORS = { home: "#1f2937", draw: "#64748b", away: "#cbd5e1" };

function Flag({ team, big }) {
  const url = flagUrl(team);
  const cls = big ? "h-5 w-7" : "h-4 w-6";
  return (
    <span className={`inline-flex ${cls} shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)] align-middle`}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
    </span>
  );
}

function TeamTag({ team, align }) {
  return (
    <span className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <Flag team={team} big />
      <span className="truncate">{teamAbbr(team)}</span>
    </span>
  );
}

// Pizza simples em SVG (3 fatias: mandante / empate / visitante).
function Pie({ dist, size = 116 }) {
  const segs = [
    { v: dist.home, c: COLORS.home },
    { v: dist.draw, c: COLORS.draw },
    { v: dist.away, c: COLORS.away },
  ].filter((s) => s.v > 0);
  const total = dist.total || 1;
  const r = size / 2, cx = r, cy = r;
  if (segs.length === 1) {
    return <svg viewBox={`0 0 ${size} ${size}`} className="h-28 w-28"><circle cx={cx} cy={cy} r={r} fill={segs[0].c} /></svg>;
  }
  let acc = 0;
  const arc = (f0, f1) => {
    const a0 = f0 * 2 * Math.PI - Math.PI / 2, a1 = f1 * 2 * Math.PI - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = f1 - f0 > 0.5 ? 1 : 0;
    return `M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-28 w-28">
      {segs.map((s, i) => { const f0 = acc / total; acc += s.v; const f1 = acc / total; return <path key={i} d={arc(f0, f1)} fill={s.c} />; })}
    </svg>
  );
}

const Dot = ({ c }) => <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} />;

// Modal: palpites de todos num jogo (só depois de travar), com pizza de resultado e agrupados por placar.
export default function MatchBets({ match, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!match) return;
    setData(null);
    fetch(`/api/match-bets?matchId=${match.id}`).then((r) => r.json()).then(setData).catch(() => setData({ locked: false, bets: [] }));
  }, [match]);
  if (!match) return null;

  const dist = data?.dist;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card relative max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hover)] text-[var(--muted)]">×</button>
        <div className="flex items-center gap-2 px-7 text-sm font-semibold">
          <div className="min-w-0 flex-1"><TeamTag team={match.homeTeam} align="right" /></div>
          <span className="shrink-0 tabular-nums">{match.finished ? `${match.homeScore} × ${match.awayScore}` : "×"}</span>
          <div className="min-w-0 flex-1"><TeamTag team={match.awayTeam} /></div>
        </div>

        {!data ? (
          <p className="py-2 text-sm text-[var(--muted)]">Carregando…</p>
        ) : !data.locked ? (
          <p className="py-2 text-sm text-[var(--muted)]">Os palpites de todos aparecem quando o jogo travar (1 min antes do apito).</p>
        ) : (
          <>
            {dist && dist.total > 0 ? (
              <div className="flex flex-col items-center gap-2">
                <Pie dist={dist} />
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
                  <span className="flex items-center gap-1"><Dot c={COLORS.home} /><Flag team={match.homeTeam} /> <b className="tabular-nums">{pct1(dist.home, dist.total)}%</b></span>
                  <span className="flex items-center gap-1"><Dot c={COLORS.draw} /> Empate <b className="tabular-nums">{pct1(dist.draw, dist.total)}%</b></span>
                  <span className="flex items-center gap-1"><Dot c={COLORS.away} /><Flag team={match.awayTeam} /> <b className="tabular-nums">{pct1(dist.away, dist.total)}%</b></span>
                </div>
              </div>
            ) : (
              <p className="py-2 text-sm text-[var(--muted)]">Ninguém palpitou nesse jogo.</p>
            )}

            <ul className="divide-y divide-[var(--border)]">
              {data.bets.map((b, i) => (
                <li key={i} className={`flex items-center gap-2 py-1.5 text-sm ${b.noBet ? "opacity-40" : ""}`}>
                  <span className="w-5 text-center text-xs font-bold text-[var(--faint)]">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
                  {b.noBet ? (
                    <span className="text-xs italic text-[var(--faint)]">sem palpite</span>
                  ) : (
                    <>
                      <span className="tabular-nums text-[var(--muted)]">{b.homeGuess}×{b.awayGuess}</span>
                      {b.points != null && (
                        <span className={`pill font-bold ${b.points > 0 ? "bg-brand-light text-brand-dark" : "bg-[var(--hover)] text-[var(--muted)]"}`}>{fmtPts(b.points)} pts</span>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
