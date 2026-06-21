"use client";

import { useEffect, useMemo, useState } from "react";
import { flagUrl, teamAbbr } from "@/lib/flags";
import { groupStandings, rankThirds } from "@/lib/groupTable";
import { R32, LATER, STAGE_NAME, thirdsByCol } from "@/lib/bracket";

function Flag({ t }) {
  const u = t ? flagUrl(t) : null;
  return <span className="inline-flex h-3.5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)] align-middle">{u ? <img src={u} alt="" className="h-full w-full object-cover" /> : null}</span>;
}

export default function SimuladorPage() {
  const [matches, setMatches] = useState(null);
  const [sim, setSim] = useState({}); // matchId -> { h, a }
  const [picks, setPicks] = useState({}); // matchNo -> "a" | "b"

  useEffect(() => { fetch("/api/matches").then((r) => r.json()).then(setMatches); }, []);

  // monta grupos a partir dos jogos
  const groups = useMemo(() => {
    const g = {};
    for (const m of matches || []) {
      if (m.stage !== "GROUP" || !m.group) continue;
      (g[m.group] ||= { letter: m.group, games: [], set: new Set() });
      g[m.group].games.push(m);
      g[m.group].set.add(m.homeTeam); g[m.group].set.add(m.awayTeam);
    }
    for (const k of Object.keys(g)) g[k].teams = [...g[k].set].sort();
    return g;
  }, [matches]);
  const groupKeys = useMemo(() => Object.keys(groups).sort(), [groups]);

  const scoreOf = (m) => {
    if (m.finished && m.homeScore != null && m.awayScore != null) return { hs: m.homeScore, as: m.awayScore, real: true };
    const s = sim[m.id];
    if (s && s.h !== "" && s.a !== "" && s.h != null && s.a != null) return { hs: Number(s.h), as: Number(s.a), real: false };
    return { hs: null, as: null, real: false };
  };

  // classificação por grupo
  const tables = useMemo(() => {
    const out = {};
    for (const k of groupKeys) {
      const gm = groups[k].games.map((m) => { const s = scoreOf(m); return { homeTeam: m.homeTeam, awayTeam: m.awayTeam, hs: s.hs, as: s.as }; });
      out[k] = { standings: groupStandings(groups[k].teams, gm), complete: gm.every((x) => x.hs != null && x.as != null) };
    }
    return out;
  }, [groups, groupKeys, sim, matches]);

  const completeCount = groupKeys.filter((k) => tables[k]?.complete).length;
  const allComplete = groupKeys.length === 12 && completeCount === 12;

  // 8 melhores terceiros + alocação oficial (Annex C)
  const thirdsInfo = useMemo(() => {
    if (!allComplete) return null;
    const ranked = rankThirds(groupKeys.map((k) => ({ group: k, row: tables[k].standings[2] })));
    const top8 = ranked.slice(0, 8);
    const alloc = thirdsByCol(top8.map((t) => t.group));
    return { ranked, top8set: new Set(top8.map((t) => t.group)), alloc };
  }, [allComplete, tables, groupKeys]);

  const teamForSlot = (slot) => {
    const t = tables[slot.g];
    if (slot.t === "W") return t?.complete ? t.standings[0].team : null;
    if (slot.t === "R") return t?.complete ? t.standings[1].team : null;
    if (slot.t === "3") { if (!thirdsInfo) return null; return tables[thirdsInfo.alloc[slot.col]]?.standings[2]?.team || null; }
    return null;
  };

  // resolve times e vencedores do mata-mata
  const ko = useMemo(() => {
    const teams = {}, winner = {}, loser = {};
    for (const m of R32) {
      teams[m.no] = { a: teamForSlot(m.a), b: teamForSlot(m.b) };
      const p = picks[m.no]; if (p && teams[m.no][p]) { winner[m.no] = teams[m.no][p]; loser[m.no] = teams[m.no][p === "a" ? "b" : "a"]; }
    }
    for (const m of LATER) {
      const a = m.a.w != null ? winner[m.a.w] : loser[m.a.l];
      const b = m.b.w != null ? winner[m.b.w] : loser[m.b.l];
      teams[m.no] = { a: a || null, b: b || null };
      const p = picks[m.no]; if (p && teams[m.no][p]) { winner[m.no] = teams[m.no][p]; loser[m.no] = teams[m.no][p === "a" ? "b" : "a"]; }
    }
    return { teams, winner };
  }, [tables, thirdsInfo, picks]);

  const setScore = (id, side, v) => setSim((s) => ({ ...s, [id]: { ...(s[id] || { h: "", a: "" }), [side]: v.replace(/[^0-9]/g, "").slice(0, 2) } }));
  const pick = (no, side, team) => { if (team) setPicks((p) => ({ ...p, [no]: side })); };
  const reset = () => { setSim({}); setPicks({}); };

  if (!matches) return <p className="text-[var(--muted)]">Carregando…</p>;

  const champion = ko.winner[104];
  const laterByStage = (st) => LATER.filter((m) => m.stage === st);

  function KOCard({ no }) {
    const t = ko.teams[no] || {};
    const w = ko.winner[no];
    const Row = ({ side }) => {
      const tm = t[side];
      const isW = w && tm === w && picks[no] === side;
      return (
        <button type="button" disabled={!tm} onClick={() => pick(no, side, tm)}
          className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition ${isW ? "bg-emerald-500/15 font-semibold text-emerald-700" : tm ? "hover:bg-[var(--hover)]" : "opacity-40"}`}>
          <Flag t={tm} /><span className="truncate text-xs">{tm ? teamAbbr(tm) : "—"}</span>
        </button>
      );
    };
    return (
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <Row side="a" /><div className="border-t border-[var(--border)]" /><Row side="b" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Simulador</h1>
        <p className="mt-2 text-[var(--muted)]">Preencha os placares que faltam, veja a classificação dos grupos e monte o chaveamento do mata-mata.</p>
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <span className={`pill ${allComplete ? "bg-brand-light text-brand-dark" : "bg-[var(--hover)] text-[var(--muted)]"}`}>{completeCount}/12 grupos completos</span>
          <button onClick={reset} className="btn-ghost text-sm">↺ Limpar simulação</button>
        </div>
      </section>

      {/* GRUPOS */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Grupos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groupKeys.map((k) => {
            const tb = tables[k];
            return (
              <div key={k} className="card p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="font-semibold">Grupo {k}</h3>
                  {tb.complete && <span className="pill bg-brand-light text-[10px] text-brand-dark">completo</span>}
                </div>
                <table className="w-full text-xs">
                  <thead className="text-[var(--faint)]">
                    <tr><th className="text-left font-medium">Time</th><th className="w-7 text-center font-medium">P</th><th className="w-8 text-center font-medium">SG</th><th className="w-7 text-center font-medium">Pts</th></tr>
                  </thead>
                  <tbody>
                    {tb.standings.map((r, i) => {
                      const isThird = i === 2;
                      const thirdQual = isThird && thirdsInfo?.top8set.has(k);
                      const cls = i < 2 ? "bg-emerald-500/10" : thirdQual ? "bg-amber-500/15" : isThird ? "bg-[var(--hover)]" : "";
                      return (
                        <tr key={r.team} className={cls}>
                          <td className="flex items-center gap-1.5 py-1"><span className="w-3 text-[10px] text-[var(--faint)]">{i + 1}</span><Flag t={r.team} /><span className="truncate">{teamAbbr(r.team)}</span></td>
                          <td className="text-center tabular-nums">{r.P}</td>
                          <td className="text-center tabular-nums">{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
                          <td className="text-center font-semibold tabular-nums">{r.Pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* jogos do grupo: input pros que faltam */}
                <div className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
                  {groups[k].games.map((m) => {
                    const s = scoreOf(m);
                    return (
                      <div key={m.id} className="flex items-center justify-center gap-1.5 text-xs">
                        <span className="flex w-20 items-center justify-end gap-1 truncate"><span className="truncate">{teamAbbr(m.homeTeam)}</span><Flag t={m.homeTeam} /></span>
                        {s.real ? (
                          <span className="tabular-nums font-semibold text-[var(--muted)]">{s.hs}×{s.as}</span>
                        ) : (
                          <span className="flex items-center gap-0.5">
                            <input inputMode="numeric" value={sim[m.id]?.h ?? ""} onChange={(e) => setScore(m.id, "h", e.target.value)} className="h-6 w-6 rounded border border-[var(--border)] bg-[var(--bg)] text-center" />
                            <span className="text-[var(--faint)]">×</span>
                            <input inputMode="numeric" value={sim[m.id]?.a ?? ""} onChange={(e) => setScore(m.id, "a", e.target.value)} className="h-6 w-6 rounded border border-[var(--border)] bg-[var(--bg)] text-center" />
                          </span>
                        )}
                        <span className="flex w-20 items-center gap-1 truncate"><Flag t={m.awayTeam} /><span className="truncate">{teamAbbr(m.awayTeam)}</span></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--faint)]">Verde = passa em 1º/2º · amarelo = 3º classificado (entre os 8 melhores) · cinza = 3º fora. Desempate: pontos → saldo → gols.</p>
      </section>

      {/* CLASSIFICADOS / TERCEIROS */}
      {allComplete ? (
        <section className="card p-5">
          <h2 className="text-lg font-semibold">Ranking dos terceiros (8 melhores passam)</h2>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {thirdsInfo.ranked.map((t, i) => (
              <div key={t.group} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${i < 8 ? "bg-emerald-500/10" : "bg-[var(--hover)] opacity-70"}`}>
                <span className="w-5 text-xs text-[var(--faint)]">{i + 1}º</span>
                <Flag t={t.row.team} /><span className="flex-1 truncate">{teamAbbr(t.row.team)} <span className="text-[var(--faint)]">(Grupo {t.group})</span></span>
                <span className="tabular-nums text-[var(--muted)]">{t.row.Pts} pts · {t.row.GD > 0 ? `+${t.row.GD}` : t.row.GD}</span>
                {i < 8 ? <span className="text-emerald-600">✓</span> : <span className="text-[var(--faint)]">✗</span>}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="card border-l-4 border-l-accent p-4 text-sm text-[var(--muted)]">
          Complete os <b>12 grupos</b> (faltam {12 - completeCount}) para liberar o ranking dos terceiros e o chaveamento oficial do mata-mata.
        </section>
      )}

      {/* MATA-MATA */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mata-mata</h2>
          {champion && <span className="pill bg-accent/20 font-semibold text-yellow-700">🏆 Campeão: {teamAbbr(champion)}</span>}
        </div>
        {!allComplete && <p className="mb-3 text-xs text-[var(--faint)]">As vagas de 1º/2º já aparecem por grupo completo; os 3ºs entram quando os 12 grupos estiverem definidos. Clique num time pra avançá-lo.</p>}

        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">16-avos</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {R32.map((m) => <KOCard key={m.no} no={m.no} />)}
            </div>
          </div>
          {["R16", "QF", "SF"].map((st) => (
            <div key={st}>
              <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">{STAGE_NAME[st]}</h3>
              <div className={`grid gap-2 ${st === "SF" ? "grid-cols-2 sm:grid-cols-2 sm:max-w-md" : "grid-cols-2 sm:grid-cols-4"}`}>
                {laterByStage(st).map((m) => <KOCard key={m.no} no={m.no} />)}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div><h3 className="mb-2 text-sm font-semibold text-yellow-700">🏆 Final</h3>{laterByStage("FINAL").map((m) => <KOCard key={m.no} no={m.no} />)}</div>
            <div><h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">3º lugar</h3>{laterByStage("THIRD").map((m) => <KOCard key={m.no} no={m.no} />)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
