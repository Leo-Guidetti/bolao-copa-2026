"use client";

import { Fragment, useState } from "react";
import { flagUrl, teamAbbr } from "@/lib/flags";

const medal = ["🥇", "🥈", "🥉"];

function Flag({ t }) {
  const u = flagUrl(t);
  return <span className="inline-flex h-3.5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)] align-middle">{u ? <img src={u} alt="" className="h-full w-full object-cover" /> : null}</span>;
}
const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtW = (w) => String(w);
const placeBadge = (place, prized) => (place <= 3 ? medal[place - 1] : prized ? "💰" : `${place}º`);

export default function RankingTable({ ranked = [], prizeByPlace = {}, wB = 0.7, wS = 0.3, pctBets = 70, pctSquad = 30, meId = null }) {
  const [open, setOpen] = useState(null);
  const [sort, setSort] = useState("final"); // final | bets | squad | cravadas

  if (!ranked.length) {
    return <div className="px-4 py-10 text-center text-[var(--muted)]">Nenhum participante ainda. Cadastre no painel de Admin.</div>;
  }

  const sortKey = { final: "final", bets: "betPts", squad: "squadPts", cravadas: "cravadas" }[sort];
  const rows = [...ranked].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));

  const Th = ({ id, children, className }) => (
    <th className={className}>
      <button type="button" onClick={() => setSort(id)} className={`inline-flex items-center gap-0.5 ${sort === id ? "text-brand-dark" : "hover:text-[var(--text)]"}`}>
        {children}{sort === id && <span className="text-[9px]">▼</span>}
      </button>
    </th>
  );

  return (
    <table className="w-full text-sm">
      <thead className="bg-[var(--hover)] text-left text-[var(--muted)]">
        <tr>
          <th className="px-4 py-3 font-medium">#</th>
          <th className="px-4 py-3 font-medium">Participante</th>
          <Th id="bets" className="hidden px-4 py-3 text-right font-medium sm:table-cell">Placar ({pctBets}%)</Th>
          <Th id="cravadas" className="px-2 py-3 text-center font-medium" title="Cravadas (placar exato)">🎯</Th>
          <Th id="squad" className="hidden px-4 py-3 text-right font-medium sm:table-cell">Seleção ({pctSquad}%)</Th>
          <Th id="final" className="px-4 py-3 text-right font-medium">Final</Th>
          <th className="px-4 py-3 text-right font-medium">Prêmio</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const betC = r.betPts * wB, sqC = r.squadPts * wS, tot = betC + sqC;
          const betShare = tot > 0 ? Math.round((betC / tot) * 100) : 0;
          const sqShare = tot > 0 ? 100 - betShare : 0;
          const isOpen = open === r.participantId;
          const isMe = meId && r.participantId === meId;
          return (
            <Fragment key={r.participantId}>
              <tr onClick={() => setOpen(isOpen ? null : r.participantId)}
                className={`cursor-pointer border-t border-[var(--border)] hover:bg-[var(--hover)] ${isMe ? "bg-emerald-500/10 outline outline-2 -outline-offset-2 outline-emerald-500" : ""}`}>
                <td className="px-4 py-3 font-semibold">{placeBadge(r.place, !!prizeByPlace[r.place])}</td>
                <td className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`text-[var(--faint)] transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                    {r.name}{isMe && <span className="pill bg-emerald-500/15 text-[10px] font-bold text-emerald-600">você</span>}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{r.betPts.toFixed(1)}</td>
                <td className="px-2 py-3 text-center font-semibold tabular-nums">{r.cravadas || 0}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{r.squadPts.toFixed(1)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.final.toFixed(1)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-brand-dark">{prizeByPlace[r.place] ? brl(prizeByPlace[r.place]) : "—"}</td>
              </tr>
              {isOpen && (
                <tr className="border-t border-[var(--border)] bg-[var(--hover)]">
                  <td colSpan={7} className="px-4 py-3">
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
                    <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--faint)]">
                      <span>🎯 {r.cravadas || 0} cravada{(r.cravadas || 0) === 1 ? "" : "s"} (placar exato)</span>
                      <span>{betShare}% placar · {sqShare}% seleção</span>
                    </div>
                    {(r.cravadasList || []).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.cravadasList.map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px]">
                            <Flag t={c.homeTeam} />{teamAbbr(c.homeTeam)} <b className="tabular-nums">{c.homeScore}×{c.awayScore}</b> {teamAbbr(c.awayTeam)}<Flag t={c.awayTeam} />
                          </span>
                        ))}
                      </div>
                    )}
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
