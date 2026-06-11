"use client";

import { useEffect, useMemo, useState } from "react";
import Pitch from "@/components/Pitch";
import PlayerStats from "@/components/PlayerStats";
import { playerScore } from "@/lib/scoring";
import { FORMATIONS, RESERVES, POSITIONS } from "@/lib/defaults";

export default function IdealPage() {
  const [players, setPlayers] = useState([]);
  const [rules, setRules] = useState(null);
  const [formation, setFormation] = useState("4-3-3");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    fetch("/api/players").then((r) => r.json()).then(setPlayers);
    fetch("/api/settings").then((r) => r.json()).then((s) => setRules(s.squadRules));
  }, []);

  const scout = rules?.scout || {};
  const ptsOf = (p) => playerScore(p, scout);

  const { starters, reserves } = useMemo(() => {
    const shape = FORMATIONS[formation] || FORMATIONS["4-3-3"];
    const need = { GOL: 1, ZAG: shape.ZAG, LAT: shape.LAT, MEI: shape.MEI, ATA: shape.ATA };
    const byPos = {};
    for (const p of players) (byPos[p.position] ||= []).push(p);
    for (const k in byPos) byPos[k].sort((a, b) => ptsOf(b) - ptsOf(a) || (b.price || 0) - (a.price || 0));
    const st = [], rs = [];
    for (const pos of POSITIONS) {
      const arr = byPos[pos] || [];
      st.push(...arr.slice(0, need[pos]));
      rs.push(...arr.slice(need[pos], need[pos] + (RESERVES[pos] || 0)));
    }
    return { starters: st, reserves: rs };
  }, [players, rules, formation]);

  const total = [...starters, ...reserves].reduce((s, p) => s + ptsOf(p), 0);
  const POS_ORDER = { GOL: 0, ZAG: 1, LAT: 2, MEI: 3, ATA: 4 };
  const ranked = [...starters, ...reserves].sort((a, b) => (POS_ORDER[a.position] - POS_ORDER[b.position]) || ptsOf(b) - ptsOf(a));

  return (
    <div className="space-y-6">
      {detail && <PlayerStats player={detail} scout={scout} onClose={() => setDetail(null)} />}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Seleção ideal</h1>
        <p className="mt-1 text-[var(--muted)]">Os melhores de cada posição pela pontuação atual — atualiza a cada rodada. Clique num jogador pra ver a composição dos pontos.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--muted)]">Formação</span>
        <select className="input w-28" value={formation} onChange={(e) => setFormation(e.target.value)}>
          {Object.keys(FORMATIONS).map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="ml-auto pill bg-brand-light font-bold text-brand-dark">{total.toFixed(1)} pts</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="mx-auto w-full max-w-[360px]">
          <Pitch formation={formation} starters={starters} reserves={reserves} camisa10Id={null} showPoints pointsOf={ptsOf} />
        </div>
        <div className="card p-4">
          <h2 className="mb-2 font-semibold">Escalação (titulares + reservas)</h2>
          <ul className="divide-y divide-[var(--border)]">
            {ranked.map((p, i) => (
              <li key={p.id}>
                <button onClick={() => setDetail(p)} className="flex w-full items-center gap-2 py-1.5 text-left text-sm hover:opacity-80">
                  <span className="w-5 text-center text-xs font-bold text-[var(--faint)]">{i + 1}</span>
                  <span className="w-8 text-center text-[10px] font-bold text-[var(--muted)]">{p.position}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name} <span className="text-[var(--faint)]">{p.team}</span></span>
                  <span className="font-bold tabular-nums">{ptsOf(p).toFixed(1)}<span className="text-[10px] font-normal text-[var(--faint)]"> pts</span></span>
                </button>
              </li>
            ))}
            {ranked.length === 0 && <li className="py-3 text-center text-[var(--muted)]">Carregando…</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
