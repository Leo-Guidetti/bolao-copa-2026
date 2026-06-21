"use client";

import { useEffect, useMemo, useState } from "react";
import { flagUrl, teamAbbr } from "@/lib/flags";
import { groupStandings, rankThirds } from "@/lib/groupTable";
import { R32, LATER, STAGE_NAME, thirdsByCol } from "@/lib/bracket";

// Chaveamento espelhado: metade esquerda (avança →) e metade direita (avança ←), final no centro.
const L_R32 = [74, 77, 73, 75, 83, 84, 81, 82];
const L_R16 = [89, 90, 93, 94];
const L_QF = [97, 98];
const L_SF = [101];
const R_R32 = [76, 78, 79, 80, 86, 88, 85, 87];
const R_R16 = [91, 92, 95, 96];
const R_QF = [99, 100];
const R_SF = [102];

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

  // Ranking dos terceiros: provisório (com os resultados que já existem) ou final quando os 12 grupos fecham.
  const thirdsInfo = useMemo(() => {
    if (groupKeys.length !== 12) return null;
    const ranked = rankThirds(groupKeys.map((k) => ({ group: k, row: tables[k].standings[2] })));
    const top8 = ranked.slice(0, 8);
    return { ranked, top8set: new Set(top8.map((t) => t.group)), alloc: thirdsByCol(top8.map((t) => t.group)), provisional: !allComplete };
  }, [tables, groupKeys, allComplete]);

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

  // ---- card do chaveamento ---- dir: "r" conector à direita | "l" à esquerda | "none"
  function KOCard({ no, dir = "r" }) {
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
        {dir === "r" && <span className="pointer-events-none absolute left-full top-1/2 h-px w-3 bg-[var(--border)]" />}
        {dir === "l" && <span className="pointer-events-none absolute right-full top-1/2 h-px w-3 bg-[var(--border)]" />}
      </div>
    );
  }
  const Col = ({ title, nos, dir }) => (
    <div className="flex shrink-0 flex-col">
      <h4 className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">{title}</h4>
      <div className="flex flex-1 flex-col justify-around gap-2">{nos.map((no) => <KOCard key={no} no={no} dir={dir} />)}</div>
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
                  <table className="w-full text-[11px]">
                    <thead className="text-[var(--faint)]">
                      <tr>
                        <th className="py-1 text-left font-medium" colSpan={2}>Equipe</th>
                        <th className="px-1 text-center font-semibold text-[var(--muted)]">Pts</th>
                        <th className="px-1 text-center font-medium">J</th>
                        <th className="px-1 text-center font-medium">V</th>
                        <th className="px-1 text-center font-medium">E</th>
                        <th className="px-1 text-center font-medium">D</th>
                        <th className="px-1 text-center font-medium">GP</th>
                        <th className="px-1 text-center font-medium">GC</th>
                        <th className="px-1 text-center font-medium">SG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tb.standings.map((r, i) => {
                        const thirdQual = i === 2 && thirdsInfo?.top8set.has(k);
                        const cls = i < 2 ? "bg-emerald-500/10" : thirdQual ? "bg-amber-500/15" : i === 2 ? "bg-[var(--hover)]" : "";
                        return (
                          <tr key={r.team} className={cls}>
                            <td className="w-3 py-1 text-center text-[10px] text-[var(--faint)]">{i + 1}</td>
                            <td className="py-1"><span className="flex items-center gap-1.5"><MiniFlag team={r.team} /><span className="truncate">{teamAbbr(r.team)}</span></span></td>
                            <td className="px-1 text-center font-bold tabular-nums">{r.Pts}</td>
                            <td className="px-1 text-center tabular-nums">{r.P}</td>
                            <td className="px-1 text-center tabular-nums">{r.W}</td>
                            <td className="px-1 text-center tabular-nums">{r.D}</td>
                            <td className="px-1 text-center tabular-nums">{r.L}</td>
                            <td className="px-1 text-center tabular-nums">{r.GF}</td>
                            <td className="px-1 text-center tabular-nums">{r.GA}</td>
                            <td className="px-1 text-center tabular-nums">{r.GD > 0 ? `+${r.GD}` : r.GD}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-2 divide-y divide-[var(--border)] border-t border-[var(--border)]">
                    {groups[k].games.map((m) => {
                      const s = scoreOf(m); const played = s.real;
                      return (
                        <div key={m.id} className="py-2">
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
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--faint)]">Verde = passa em 1º/2º · amarelo = 3º entre os 8 melhores · cinza = 3º fora. Jogos travados já têm o resultado real. Desempate oficial: confronto direto → saldo geral → gols.</p>
        </section>
      )}

      {/* TERCEIROS */}
      {tab === "terceiros" && thirdsInfo && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Ranking dos terceiros</h2>
            {thirdsInfo.provisional && <span className="pill bg-amber-500/20 text-[11px] font-semibold text-amber-700">parcial · {completeCount}/12 grupos</span>}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">Os <b>8 melhores</b> avançam (pontos → saldo → gols). Sem confronto direto, pois são de grupos diferentes.{thirdsInfo.provisional ? " Muda conforme os jogos que faltam." : ""}</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-[var(--hover)] text-left text-[var(--faint)]">
                <tr>
                  <th className="px-1.5 py-2 font-medium" colSpan={2}>Seleção</th>
                  <th className="px-1.5 py-2 text-center font-medium">Gr.</th>
                  <th className="px-1 py-2 text-center font-semibold text-[var(--muted)]">Pts</th>
                  <th className="px-1 py-2 text-center font-medium">J</th>
                  <th className="px-1 py-2 text-center font-medium">V</th>
                  <th className="px-1 py-2 text-center font-medium">E</th>
                  <th className="px-1 py-2 text-center font-medium">D</th>
                  <th className="px-1 py-2 text-center font-medium">GP</th>
                  <th className="px-1 py-2 text-center font-medium">GC</th>
                  <th className="px-1 py-2 text-center font-medium">SG</th>
                </tr>
              </thead>
              <tbody>
                {thirdsInfo.ranked.map((t, i) => (
                  <tr key={t.group} className={`border-t border-[var(--border)] ${i < 8 ? "bg-emerald-500/10" : "text-[var(--muted)] opacity-70"} ${i === 7 ? "border-b-2 border-dashed border-emerald-500/50" : ""}`}>
                    <td className="w-4 px-1.5 py-1.5 text-center text-[10px] text-[var(--faint)]">{i + 1}</td>
                    <td className="px-1 py-1.5"><span className="flex items-center gap-1.5"><MiniFlag team={t.row.team} /><span className="truncate font-medium">{teamAbbr(t.row.team)}</span></span></td>
                    <td className="px-1.5 py-1.5 text-center">{t.group}</td>
                    <td className="px-1 py-1.5 text-center font-bold tabular-nums">{t.row.Pts}</td>
                    <td className="px-1 py-1.5 text-center tabular-nums">{t.row.P}</td>
                    <td className="px-1 py-1.5 text-center tabular-nums">{t.row.W}</td>
                    <td className="px-1 py-1.5 text-center tabular-nums">{t.row.D}</td>
                    <td className="px-1 py-1.5 text-center tabular-nums">{t.row.L}</td>
                    <td className="px-1 py-1.5 text-center tabular-nums">{t.row.GF}</td>
                    <td className="px-1 py-1.5 text-center tabular-nums">{t.row.GA}</td>
                    <td className="px-1 py-1.5 text-center tabular-nums">{t.row.GD > 0 ? `+${t.row.GD}` : t.row.GD}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-[var(--faint)]">Linha tracejada = corte dos 8 que se classificam (verde). Abaixo dela, fora.</p>
        </section>
      )}

      {/* CHAVEAMENTO */}
      {tab === "chave" && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-[var(--faint)]">Clique no time que avança. 1º/2º aparecem por grupo completo; os 3ºs já entram de forma <b>parcial</b> conforme os resultados.</p>
            {champion && <span className="pill bg-accent/20 font-semibold text-yellow-700">🏆 {teamAbbr(champion)}</span>}
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex items-stretch gap-3" style={{ minHeight: "560px" }}>
              <Col title="16-avos" nos={L_R32} dir="r" />
              <Col title="Oitavas" nos={L_R16} dir="r" />
              <Col title="Quartas" nos={L_QF} dir="r" />
              <Col title="Semi" nos={L_SF} dir="r" />
              <div className="flex shrink-0 flex-col">
                <h4 className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-yellow-700">Final 🏆</h4>
                <div className="flex flex-1 flex-col justify-around"><KOCard no={104} dir="none" /></div>
              </div>
              <Col title="Semi" nos={R_SF} dir="l" />
              <Col title="Quartas" nos={R_QF} dir="l" />
              <Col title="Oitavas" nos={R_R16} dir="l" />
              <Col title="16-avos" nos={R_R32} dir="l" />
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
