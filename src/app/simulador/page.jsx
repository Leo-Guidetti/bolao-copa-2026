"use client";

import { useEffect, useMemo, useState } from "react";
import { flagUrl, teamAbbr } from "@/lib/flags";
import { groupStandings, rankThirds } from "@/lib/groupTable";
import { R32, LATER, STAGE_NAME, thirdsByCol } from "@/lib/bracket";

// ordem de cima pra baixo em cada coluna do chaveamento (árvore conectada)
const COL_R32 = [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87];
const COL_R16 = [89, 90, 93, 94, 91, 92, 95, 96];
const COL_QF = [97, 98, 99, 100];
const COL_SF = [101, 102];

const fmtDate = (m) => new Date(m.kickoff).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Flag({ team, align }) {
  const url = team ? flagUrl(team) : null;
  return (
    <span className={`flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className="flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)]">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : null}
      </span>
      <span className="text-sm font-medium" title={team || ""}>{team ? teamAbbr(team) : "—"}</span>
    </span>
  );
}
function MiniFlag({ team }) {
  const u = team ? flagUrl(team) : null;
  return <span className="inline-flex h-3.5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)] align-middle">{u ? <img src={u} alt="" className="h-full w-full object-cover" /> : null}</span>;
}

export default function SimuladorPage() {
  const [matches, setMatches] = useState(null);
  const [sim, setSim] = useState({});
  const [picks, setPicks] = useState({});
  const [tab, setTab] = useState("grupos");

  useEffect(() => { fetch("/api/matches").then((r) => r.json()).then(setMatches); }, []);

  const groups = useMemo(() => {
    const g = {};
    for (const m of matches || []) {
      if (m.stage !== "GROUP" || !m.group) continue;
      (g[m.group] ||= { letter: m.group, games: [], set: new Set() });
      g[m.group].games.push(m); g[m.group].set.add(m.homeTeam); g[m.group].set.add(m.awayTeam);
    }
    for (const k of Object.keys(g)) { g[k].teams = [...g[k].set].sort(); g[k].games.sort((a, b) => (a.round || 0) - (b.round || 0) || new Date(a.kickoff) - new Date(b.kickoff)); }
    return g;
  }, [matches]);
  const groupKeys = useMemo(() => Object.keys(groups).sort(), [groups]);

  const scoreOf = (m) => {
    if (m.finished && m.homeScore != null && m.awayScore != null) return { hs: m.homeScore, as: m.awayScore, real: true };
    const s = sim[m.id];
    if (s && s.h !== "" && s.a !== "" && s.h != null && s.a != null) return { hs: Number(s.h), as: Number(s.a), real: false };
    return { hs: null, as: null, real: false };
  };

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

  const thirdsInfo = useMemo(() => {
    if (!allComplete) return null;
    const ranked = rankThirds(groupKeys.map((k) => ({ group: k, row: tables[k].standings[2] })));
    const top8 = ranked.slice(0, 8);
    return { ranked, top8set: new Set(top8.map((t) => t.group)), alloc: thirdsByCol(top8.map((t) => t.group)) };
  }, [allComplete, tables, groupKeys]);

  const teamForSlot = (slot) => {
    const t = tables[slot.g];
    if (slot.t === "W") return t?.complete ? t.standings[0].team : null;
    if (slot.t === "R") return t?.complete ? t.standings[1].team : null;
    if (slot.t === "3") { if (!thirdsInfo) return null; return tables[thirdsInfo.alloc[slot.col]]?.standings[2]?.team || null; }
    return null;
  };

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

  // ---- jogo do grupo no estilo "palpites" ----
  function GameRow({ m }) {
    const s = scoreOf(m);
    const played = s.real;
    return (
      <div className="py-2">
        <div className="mb-0.5 text-center text-[10px] text-[var(--faint)]">{fmtDate(m)} (BRT){played ? " · 🔒 resultado" : ""}</div>
        <div className="flex items-center gap-2">
          <div className="flex-1"><Flag team={m.homeTeam} align="right" /></div>
          <input inputMode="numeric" disabled={played} value={played ? s.hs : (sim[m.id]?.h ?? "")} onChange={(e) => setScore(m.id, "h", e.target.value)} className="input w-12 px-0 text-center disabled:opacity-100" />
          <span className="text-[var(--faint)]">×</span>
          <input inputMode="numeric" disabled={played} value={played ? s.as : (sim[m.id]?.a ?? "")} onChange={(e) => setScore(m.id, "a", e.target.value)} className="input w-12 px-0 text-center disabled:opacity-100" />
          <div className="flex-1"><Flag team={m.awayTeam} /></div>
        </div>
      </div>
    );
  }

  // ---- card do chaveamento ----
  function KOCard({ no, last }) {
    const t = ko.teams[no] || {};
    const w = ko.winner[no];
    const Row = ({ side }) => {
      const tm = t[side];
      const isW = w && tm === w && picks[no] === side;
      return (
        <button type="button" disabled={!tm} onClick={() => pick(no, side, tm)}
          className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition ${isW ? "bg-emerald-500/15 font-semibold text-emerald-700" : tm ? "hover:bg-[var(--hover)]" : "opacity-40"}`}>
          <MiniFlag team={tm} /><span className="truncate text-xs">{tm ? teamAbbr(tm) : "—"}</span>
        </button>
      );
    };
    return (
      <div className="relative w-32 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <Row side="a" /><div className="border-t border-[var(--border)]" /><Row side="b" />
        {!last && <span className="pointer-events-none absolute left-full top-1/2 h-px w-3 bg-[var(--border)]" />}
      </div>
    );
  }
  const Col = ({ title, nos, last }) => (
    <div className="flex shrink-0 flex-col">
      <h4 className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">{title}</h4>
      <div className="flex flex-1 flex-col justify-around gap-2">{nos.map((no) => <KOCard key={no} no={no} last={last} />)}</div>
    </div>
  );

  const Tab = ({ id, children }) => (
    <button type="button" onClick={() => setTab(id)} className={`rounded-full px-4 py-1 text-sm transition ${tab === id ? "bg-[var(--surface)] font-semibold shadow" : "text-[var(--muted)]"}`}>{children}</button>
  );

  return (
    <div className="space-y-6">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Simulador</h1>
        <p className="mt-2 text-[var(--muted)]">Preencha os placares que faltam e monte o chaveamento do mata-mata.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <div className="flex rounded-full bg-[var(--hover)] p-0.5">
            <Tab id="grupos">Grupos</Tab>
            <Tab id="terceiros">Terceiros</Tab>
            <Tab id="chave">Chaveamento</Tab>
          </div>
          <span className={`pill text-xs ${allComplete ? "bg-brand-light text-brand-dark" : "bg-[var(--hover)] text-[var(--muted)]"}`}>{completeCount}/12 grupos</span>
          <button onClick={reset} className="btn-ghost text-sm">↺ Limpar</button>
        </div>
      </section>

      {/* GRUPOS */}
      {tab === "grupos" && (
        <section>
          <div className="grid gap-4 lg:grid-cols-2">
            {groupKeys.map((k) => {
              const tb = tables[k];
              return (
                <div key={k} className="card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{k}</span>
                    <h3 className="font-semibold">Grupo {k}</h3>
                    {tb.complete && <span className="pill bg-brand-light text-[10px] text-brand-dark">completo</span>}
                  </div>
                  <table className="w-full text-xs">
                    <thead className="text-[var(--faint)]"><tr><th className="text-left font-medium">Time</th><th className="w-7 text-center font-medium">P</th><th className="w-7 text-center font-medium">V</th><th className="w-8 text-center font-medium">SG</th><th className="w-7 text-center font-medium">Pts</th></tr></thead>
                    <tbody>
                      {tb.standings.map((r, i) => {
                        const thirdQual = i === 2 && thirdsInfo?.top8set.has(k);
                        const cls = i < 2 ? "bg-emerald-500/10" : thirdQual ? "bg-amber-500/15" : i === 2 ? "bg-[var(--hover)]" : "";
                        return (
                          <tr key={r.team} className={cls}>
                            <td className="flex items-center gap-1.5 py-1"><span className="w-3 text-[10px] text-[var(--faint)]">{i + 1}</span><MiniFlag team={r.team} /><span className="truncate">{teamAbbr(r.team)}</span></td>
                            <td className="text-center tabular-nums">{r.P}</td>
                            <td className="text-center tabular-nums">{r.W}</td>
                            <td className="text-center tabular-nums">{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
                            <td className="text-center font-semibold tabular-nums">{r.Pts}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-2 divide-y divide-[var(--border)] border-t border-[var(--border)]">
                    {groups[k].games.map((m) => <GameRow key={m.id} m={m} />)}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--faint)]">Verde = passa em 1º/2º · amarelo = 3º entre os 8 melhores · cinza = 3º fora. Jogos travados já têm o resultado real. Desempate oficial: confronto direto → saldo geral → gols.</p>
        </section>
      )}

      {/* TERCEIROS */}
      {tab === "terceiros" && (
        allComplete ? (
          <section className="card p-5">
            <h2 className="text-lg font-semibold">Ranking dos terceiros</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Os <b>8 melhores</b> avançam (pontos → saldo → gols). Sem confronto direto, pois são de grupos diferentes.</p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {thirdsInfo.ranked.map((t, i) => (
                <div key={t.group} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${i < 8 ? "bg-emerald-500/10" : "bg-[var(--hover)] opacity-70"}`}>
                  <span className="w-5 text-xs text-[var(--faint)]">{i + 1}º</span>
                  <MiniFlag team={t.row.team} /><span className="flex-1 truncate">{teamAbbr(t.row.team)} <span className="text-[var(--faint)]">· Grupo {t.group}</span></span>
                  <span className="tabular-nums text-[var(--muted)]">{t.row.Pts} pts · {t.row.GD > 0 ? `+${t.row.GD}` : t.row.GD}</span>
                  <span className={i < 8 ? "text-emerald-600" : "text-[var(--faint)]"}>{i < 8 ? "✓" : "✗"}</span>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="card border-l-4 border-l-accent p-4 text-sm text-[var(--muted)]">
            Complete os <b>12 grupos</b> na aba Grupos (faltam {12 - completeCount}) para ver o ranking dos terceiros.
          </section>
        )
      )}

      {/* CHAVEAMENTO */}
      {tab === "chave" && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-[var(--faint)]">Clique no time que avança. 1º/2º aparecem por grupo completo; os 3ºs entram com os 12 grupos definidos.</p>
            {champion && <span className="pill bg-accent/20 font-semibold text-yellow-700">🏆 {teamAbbr(champion)}</span>}
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex items-stretch gap-3" style={{ minHeight: "520px" }}>
              <Col title="16-avos" nos={COL_R32} />
              <Col title="Oitavas" nos={COL_R16} />
              <Col title="Quartas" nos={COL_QF} />
              <Col title="Semi" nos={COL_SF} />
              <Col title="Final" nos={[104]} last />
            </div>
          </div>
          <div className="mt-4 max-w-xs">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">Disputa de 3º lugar</h4>
            <KOCard no={103} last />
          </div>
        </section>
      )}
    </div>
  );
}
