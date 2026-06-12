"use client";

import { useEffect, useMemo, useState } from "react";
import Pitch from "@/components/Pitch";
import LeigoMaster from "@/components/LeigoMaster";
import { playerScore } from "@/lib/scoring";
import { flagUrl } from "@/lib/flags";

function Avatar({ url, name, size = "h-7 w-7" }) {
  const i = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hover)] text-[11px] font-bold text-[var(--muted)]`}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : i}
    </span>
  );
}

function CmpCard({ p, pts, win }) {
  if (!p) return <div className="card flex items-center justify-center p-1.5 text-xs text-[var(--faint)] opacity-50">—</div>;
  const flag = flagUrl(p.team);
  return (
    <div className={`card flex items-center gap-1.5 p-1.5 ${win ? "ring-2 ring-brand" : ""}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hover)]">
        {flag ? <img src={flag} alt="" className="h-full w-full object-cover" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium leading-tight">{p.name}</span>
        <span className="block truncate text-[10px] text-[var(--faint)]">{p.position} · {p.team}</span>
      </span>
      <span className={`shrink-0 text-sm font-bold tabular-nums ${win ? "text-brand-dark" : ""}`}>{pts.toFixed(1)}</span>
    </div>
  );
}

export default function TimesPage() {
  const [me, setMe] = useState(undefined);
  const [data, setData] = useState(null);
  const [rules, setRules] = useState(null);
  const [sel, setSel] = useState(0);
  const [compareId, setCompareId] = useState("");

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then(setMe);
    fetch("/api/squads").then((r) => r.json()).then(setData);
    fetch("/api/settings").then((r) => r.json()).then((s) => setRules(s.squadRules));
  }, []);

  const scout = rules?.scout || {};
  const capMult = rules?.camisa10Multiplier ?? 2;
  const ptsTotal = (sq) => [...sq.starters, ...sq.reserves].reduce((s, pl) => s + playerScore(pl, scout) * (pl.id === sq.captainId ? capMult : 1), 0);
  const squads = useMemo(() => (data?.squads || []).slice().sort((a, b) => ptsTotal(b) - ptsTotal(a)), [data, rules]);

  if (me === null) return (
    <div className="mx-auto mt-10 max-w-sm card space-y-3 p-6 text-center">
      <div className="text-3xl">🔒</div>
      <p className="text-[var(--muted)]">Faça login para ver os times.</p>
      <a className="btn-primary" href="/login">Entrar</a>
    </div>
  );
  if (!data) return <p className="text-[var(--muted)]">Carregando…</p>;

  if (!data.locked) return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Times dos competidores</h1>
      <div className="card border-l-4 border-l-amber-500 p-4 text-sm">
        🙈 As seleções dos outros ficam visíveis só quando o <b>mercado fechar</b> (30 min antes da estreia). Assim ninguém copia o time alheio antes da hora.
      </div>
    </div>
  );

  const cur = squads[sel] || squads[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Times dos competidores</h1>
        <p className="mt-1 text-[var(--muted)]">Veja a seleção montada por cada um (somente leitura). Pontuação parcial atualiza a cada rodada.</p>
      </div>

      <LeigoMaster context="times" />

      {squads.length > 0 && (
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Comparar</h2>
            <span className="text-sm text-[var(--muted)]">seu time vs</span>
            <select className="input w-48" value={compareId} onChange={(e) => setCompareId(e.target.value)}>
              <option value="">escolha um adversário…</option>
              {squads.filter((s) => s.participantId !== me?.id).map((s) => <option key={s.participantId} value={s.participantId}>{s.name}</option>)}
            </select>
          </div>
          {(() => {
            const mine = squads.find((s) => s.participantId === me?.id);
            const opp = squads.find((s) => s.participantId === compareId);
            if (!mine) return <p className="text-sm text-[var(--muted)]">Você ainda não montou sua seleção.</p>;
            if (!opp) return null;
            const mt = ptsTotal(mine), ot = ptsTotal(opp);
            const pp = (p, sq) => playerScore(p, scout) * (p.id === sq.captainId ? capMult : 1);
            const POS = ["GOL", "ZAG", "LAT", "MEI", "ATA"];
            const listOf = (sq, pos) => [...sq.starters, ...sq.reserves].filter((p) => p.position === pos).sort((x, y) => pp(y, sq) - pp(x, sq));
            const rows = [];
            for (const pos of POS) {
              const A = listOf(mine, pos), B = listOf(opp, pos);
              for (let k = 0; k < Math.max(A.length, B.length); k++) rows.push({ pos, a: A[k] || null, b: B[k] || null });
            }
            return (
              <div className="space-y-2">
                <div className="grid grid-cols-3 items-end gap-2 text-center">
                  <div><div className="truncate text-sm font-semibold">{mine.name}</div><div className={`text-3xl font-bold tabular-nums ${mt >= ot ? "text-brand-dark" : ""}`}>{mt.toFixed(1)}</div></div>
                  <div className="text-xs text-[var(--faint)]">{mt > ot ? "você lidera 🔥" : mt < ot ? "você atrás" : "empate"}</div>
                  <div><div className="truncate text-sm font-semibold">{opp.name}</div><div className={`text-3xl font-bold tabular-nums ${ot > mt ? "text-brand-dark" : ""}`}>{ot.toFixed(1)}</div></div>
                </div>
                <div className="space-y-1.5">
                  {rows.map((r, idx) => {
                    const pa = r.a ? pp(r.a, mine) : null, pb = r.b ? pp(r.b, opp) : null;
                    const aWin = pa != null && (pb == null || pa > pb), bWin = pb != null && (pa == null || pb > pa);
                    return (
                      <div key={idx} className="grid grid-cols-2 gap-2">
                        <CmpCard p={r.a} pts={pa} win={aWin} />
                        <CmpCard p={r.b} pts={pb} win={bWin} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {squads.length === 0 ? (
        <div className="card p-4 text-sm text-[var(--muted)]">Ninguém montou seleção ainda.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_1fr]">
          <div className="card overflow-hidden p-0">
            <div className="bg-[var(--hover)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">Competidores ({squads.length})</div>
            <div className="divide-y divide-[var(--border)]">
              {squads.map((sq, i) => (
                <button key={sq.participantId} onClick={() => setSel(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${i === sel ? "bg-[var(--hover)]" : "hover:bg-[var(--hover)]"}`}>
                  <span className="w-5 text-center text-xs font-bold text-[var(--faint)]">{i + 1}</span>
                  <Avatar url={sq.avatarUrl} name={sq.name} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {sq.name}{sq.participantId === me?.id && <span className="pill ml-1 bg-brand-light text-brand-dark">você</span>}
                  </span>
                  <span className="text-sm font-bold tabular-nums">{ptsTotal(sq).toFixed(1)}<span className="text-[10px] font-normal text-[var(--faint)]"> pts</span></span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Avatar url={cur.avatarUrl} name={cur.name} size="h-9 w-9" />
              <div>
                <h2 className="font-semibold leading-tight">{cur.name}</h2>
                <div className="text-xs text-[var(--faint)]">Formação {cur.formation}</div>
              </div>
              <span className="ml-auto pill bg-brand-light text-brand-dark">{ptsTotal(cur).toFixed(1)} pts</span>
            </div>
            <div className="max-w-[340px]">
              <Pitch formation={cur.formation} starters={cur.starters} reserves={cur.reserves} camisa10Id={cur.captainId}
                showPoints pointsOf={(pl) => playerScore(pl, scout) * (pl.id === cur.captainId ? capMult : 1)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
