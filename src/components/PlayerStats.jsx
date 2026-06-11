"use client";

import { scoreBreakdown, playerScore } from "@/lib/scoring";
import { flagUrl } from "@/lib/flags";

// Modal com a composição da pontuação de um jogador (stats + pontos por evento, do maior pro menor).
export default function PlayerStats({ player, scout, capMult = 1, isCaptain = false, onClose }) {
  if (!player) return null;
  const rows = scoreBreakdown(player, scout || {});
  const base = playerScore(player, scout || {});
  const total = base * (isCaptain ? capMult : 1);
  const flag = flagUrl(player.team);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--hover)]">
            {flag ? <img src={flag} alt="" className="h-full w-full object-cover" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{player.name}{isCaptain && <span className="pill ml-1 bg-accent/20 text-yellow-700">C10</span>}</div>
            <div className="text-xs text-[var(--faint)]">{player.position} · {player.team} · {player.price}¢</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--hover)] text-[var(--muted)]">×</button>
        </div>

        {rows.length === 0 ? (
          <p className="py-3 text-center text-sm text-[var(--muted)]">Ainda não pontuou nesta competição.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--faint)]">
                <th className="text-left font-normal">Evento</th>
                <th className="text-center font-normal">Qtd</th>
                <th className="text-center font-normal">×</th>
                <th className="text-right font-normal">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-[var(--border)]">
                  <td className="py-1">{r.label}</td>
                  <td className="text-center tabular-nums">{r.count}</td>
                  <td className="text-center tabular-nums text-[var(--faint)]">{r.weight}</td>
                  <td className={`text-right font-semibold tabular-nums ${r.points >= 0 ? "text-brand-dark" : "text-red-500"}`}>{r.points.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {isCaptain && capMult !== 1 && rows.length > 0 && (
          <div className="flex justify-between border-t border-[var(--border)] pt-1 text-xs text-[var(--muted)]">
            <span>Camisa 10 (×{capMult})</span><span className="tabular-nums">{base.toFixed(1)} → {total.toFixed(1)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[var(--border)] pt-2 font-bold">
          <span>Total</span><span className="tabular-nums">{total.toFixed(1)} pts</span>
        </div>
      </div>
    </div>
  );
}
