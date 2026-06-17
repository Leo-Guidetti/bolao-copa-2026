"use client";

import { useEffect, useState } from "react";
import { playerScore } from "@/lib/scoring";
import { flagUrl, teamFull, teamAbbr } from "@/lib/flags";
import PlayerAvatar from "@/components/PlayerAvatar";

const fmt = (n) => (Number(n) || 0).toFixed(1);

function MiniFlag({ t }) {
  const u = flagUrl(t);
  return <span className="inline-flex h-3.5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)]">{u ? <img src={u} alt="" className="h-full w-full object-cover" /> : null}</span>;
}

// Modal com a pontuação do jogador JOGO A JOGO (stats + pontos de cada partida) + total.
export default function PlayerStats({ player, scout, capMult = 1, isCaptain = false, onClose }) {
  const [data, setData] = useState(null);
  const [owners, setOwners] = useState(null);
  useEffect(() => {
    if (!player) return;
    setData(null); setOwners(null);
    fetch(`/api/player-games?playerId=${player.id}`).then((r) => r.json())
      .then((d) => { setData(d.games || []); setOwners(d.owners || []); })
      .catch(() => { setData([]); setOwners([]); });
  }, [player?.id]);
  if (!player) return null;

  const base = playerScore(player, scout || {});
  const total = base * (isCaptain ? capMult : 1);
  const flag = flagUrl(player.team);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-sm space-y-3 overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <PlayerAvatar player={player} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{player.name}{isCaptain && <span className="pill ml-1 bg-accent/20 text-yellow-700">C10</span>}</div>
            <div className="text-xs text-[var(--faint)]">{player.position} · {teamFull(player.team)} · {player.price}¢</div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold tabular-nums ${total < 0 ? "text-red-500" : isCaptain ? "text-yellow-600" : "text-brand-dark"}`}>{fmt(total)}</div>
            <div className="text-[10px] text-[var(--faint)]">total{isCaptain && capMult !== 1 ? ` ×${capMult}` : ""}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--hover)] text-[var(--muted)]">×</button>
        </div>

        {owners && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">Escalado por ({owners.length})</div>
            {owners.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--faint)]">Ninguém escalou esse jogador.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {owners.map((o, i) => (
                  <span key={i} className={`pill text-xs ${o.captain ? "bg-accent/20 font-semibold text-yellow-700" : "bg-[var(--hover)] text-[var(--muted)]"}`}>
                    {o.name}{o.captain ? " · C10" : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">Por jogo</div>
        {data === null ? (
          <p className="py-2 text-sm text-[var(--muted)]">Carregando…</p>
        ) : data.length === 0 ? (
          <p className="py-2 text-sm text-[var(--muted)]">Ainda não pontuou nesta competição.</p>
        ) : (
          <div className="space-y-2">
            {data.map((g) => (
              <div key={g.matchId} className="rounded-xl border border-[var(--border)] p-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex min-w-0 flex-1 items-center gap-1 font-medium">
                    <MiniFlag t={g.homeTeam} />
                    <span className="truncate">{teamAbbr(g.homeTeam)} <b className="tabular-nums">{g.homeScore ?? "-"}×{g.awayScore ?? "-"}</b> {teamAbbr(g.awayTeam)}</span>
                    <MiniFlag t={g.awayTeam} />
                    {!g.finished && <span className="shrink-0 text-[10px] text-[var(--faint)]">(ao vivo)</span>}
                  </span>
                  <span className={`shrink-0 font-bold tabular-nums ${g.points < 0 ? "text-red-500" : "text-brand-dark"}`}>{fmt(g.points)} pts</span>
                </div>
                {g.breakdown.length > 0 ? (
                  <table className="mt-1 w-full text-xs">
                    <tbody>
                      {g.breakdown.map((b) => (
                        <tr key={b.key} className="border-t border-[var(--border)]">
                          <td className="py-0.5 text-[var(--muted)]">{b.label}</td>
                          <td className="text-center tabular-nums">{b.count}</td>
                          <td className="text-center tabular-nums text-[var(--faint)]">×{b.weight}</td>
                          <td className={`text-right font-semibold tabular-nums ${b.points < 0 ? "text-red-500" : "text-brand-dark"}`}>{fmt(b.points)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="mt-0.5 text-[11px] text-[var(--faint)]">Entrou {g.minutes}', sem pontos.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
