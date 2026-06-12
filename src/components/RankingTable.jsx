"use client";

import { Fragment, useState } from "react";

const medal = ["🥇", "🥈", "🥉"];
const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtW = (w) => String(w).replace(".", ",");

export default function RankingTable({ ranked = [], prizeByPlace = {}, wB = 0.7, wS = 0.3, pctBets = 70, pctSquad = 30 }) {
  const [open, setOpen] = useState(null);

  if (!ranked.length) {
    return <div className="px-4 py-10 text-center text-[var(--muted)]">Nenhum participante ainda. Cadastre no painel de Admin.</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="bg-[var(--hover)] text-left text-[var(--muted)]">
        <tr>
          <th className="px-4 py-3 font-medium">#</th>
          <th className="px-4 py-3 font-medium">Participante</th>
          <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Placar ({pctBets}%)</th>
          <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Seleção ({pctSquad}%)</th>
          <th className="px-4 py-3 text-right font-medium">Final</th>
          <th className="px-4 py-3 text-right font-medium">Prêmio</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((r) => {
          const betC = r.betPts * wB, sqC = r.squadPts * wS, tot = betC + sqC;
          const betShare = tot > 0 ? Math.round((betC / tot) * 100) : 0;
          const sqShare = tot > 0 ? 100 - betShare : 0;
          const isOpen = open === r.participantId;
          return (
            <Fragment key={r.participantId}>
              <tr onClick={() => setOpen(isOpen ? null : r.participantId)}
                className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--hover)]">
                <td className="px-4 py-3 font-semibold">{medal[r.place - 1] || r.place}</td>
                <td className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`text-[var(--faint)] transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                    {r.name}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{r.betPts.toFixed(1)}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{r.squadPts.toFixed(1)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.final.toFixed(1)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-brand-dark">{prizeByPlace[r.place] ? brl(prizeByPlace[r.place]) : "—"}</td>
              </tr>
              {isOpen && (
                <tr className="border-t border-[var(--border)] bg-[var(--hover)]">
                  <td colSpan={6} className="px-4 py-3">
                    <div className="text-xs font-semibold text-[var(--muted)]">Composição dos {r.final.toFixed(1)} pts finais</div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[var(--border)]">
                      <div className="bg-brand" style={{ width: `${betShare}%` }} />
                      <div className="bg-accent" style={{ width: `${sqShare}%` }} />
                    </div>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface)] p-2">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-brand" />⚽ Apostas de placar</span>
                        <span className="tabular-nums text-[var(--muted)]">{r.betPts.toFixed(1)} × {fmtW(wB)} = <b className="text-[var(--text)]">{betC.toFixed(1)}</b></span>
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface)] p-2">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full bg-accent" />🌟 Minha seleção</span>
                        <span className="tabular-nums text-[var(--muted)]">{r.squadPts.toFixed(1)} × {fmtW(wS)} = <b className="text-[var(--text)]">{sqC.toFixed(1)}</b></span>
                      </div>
                    </div>
                    <div className="mt-1.5 text-right text-xs text-[var(--faint)]">{betShare}% placar · {sqShare}% seleção</div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
