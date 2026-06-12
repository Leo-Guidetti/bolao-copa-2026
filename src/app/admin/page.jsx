"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flagUrl } from "@/lib/flags";
import { fileToAvatar } from "@/lib/avatar";

const STAGES = ["GROUP", "R32", "R16", "QF", "SF", "THIRD", "FINAL"];
const STAGE_LABELS = { GROUP: "Grupos", R32: "16 avos", R16: "Oitavas", QF: "Quartas", SF: "Semi", THIRD: "3º lugar", FINAL: "Final" };
const POSITIONS = ["GOL", "ZAG", "LAT", "MEI", "ATA"];
const PRICE_TIERS = [[1, "Comum"], [2, "Bom"], [3, "Muito bom"], [5, "Fundamental"], [8, "Craque"]];
const EVENT_LABELS = { goal:"Gol", assist:"Assistencia", shotOnTarget:"Finaliz. no alvo", shot:"Finalizacao", tackleInterception:"Desarme / Interceptação", cleanSheet:"Sem sofrer gol", save:"Defesa", penaltySaved:"Defesa de penalti", yellow:"Amarelo", red:"Vermelho", ownGoal:"Gol contra" };
const TABS = [
  ["scoring", "Pontuação (placar)"],
  ["squadRules", "Regras da seleção"],
  ["ranking", "Pesos do ranking"],
  ["prize", "Premiação"],
  ["participants", "Participantes"],
  ["matches", "Jogos & resultados"],
  ["matchstats", "Stats dos jogos"],
  ["players", "Jogadores & scout"],
];

export default function AdminPage() {
  const [me, setMe] = useState(undefined);
  const [tab, setTab] = useState("scoring");
  const [leigoBusy, setLeigoBusy] = useState(false);
  const [leigoMsg, setLeigoMsg] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  useEffect(() => { fetch("/api/me").then((r) => r.json()).then(setMe); }, []);

  async function syncEspnNow() {
    setSyncBusy(true); setSyncMsg("Puxando placares e parciais da ESPN…");
    try {
      const r = await fetch("/api/admin/sync", { method: "POST" });
      const d = await r.json();
      setSyncMsg(r.ok ? `✓ ${d.placares} placar(es) e ${d.scoutLinhas} linhas de scout em ${d.jogos} jogo(s).` : `❌ ${d.error || "erro"}`);
    } catch { setSyncMsg("❌ falha/timeout — tente de novo em alguns segundos."); }
    setSyncBusy(false);
  }

  async function regenLeigo() {
    setLeigoBusy(true); setLeigoMsg("Gerando para todos… pode levar alguns segundos");
    try {
      const r = await fetch("/api/leigo-master/cron", { method: "POST" });
      const d = await r.json();
      setLeigoMsg(r.ok ? `✓ ${d.done} opiniões via ${d.provider} (${d.processed}/${d.participants} pessoas${d.fail ? `, ${d.fail} falhas` : ""}${d.partial ? " — parcial, rode de novo" : ""})` : `❌ ${d.error || "erro"}`);
    } catch { setLeigoMsg("❌ falha de conexão"); }
    setLeigoBusy(false);
  }

  if (me === undefined) return <p className="text-[var(--muted)]">Carregando…</p>;
  if (!me) return (
    <div className="mx-auto mt-10 max-w-sm card space-y-3 p-6 text-center">
      <div className="text-3xl">🔒</div>
      <p className="text-[var(--muted)]">Faça login para acessar o painel.</p>
      <a className="btn-primary" href="/login">Entrar</a>
    </div>
  );
  if (!me.isAdmin) return (
    <div className="mx-auto mt-10 max-w-sm card p-6 text-center">
      <div className="text-3xl">🚫</div>
      <p className="mt-2 text-[var(--muted)]">Acesso restrito ao admin.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <button className="btn-ghost ml-auto" onClick={syncEspnNow} disabled={syncBusy}>{syncBusy ? "Atualizando…" : "🔄 Atualizar resultados"}</button>
        <button className="btn-ghost" onClick={regenLeigo} disabled={leigoBusy}>{leigoBusy ? "Gerando…" : "🎤 Atualizar Leigo Master"}</button>
      </div>
      {syncMsg && <p className="text-sm text-[var(--muted)]">{syncMsg}</p>}
      {leigoMsg && <p className="text-sm text-[var(--muted)]">{leigoMsg}</p>}
      <div className="flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm transition ${tab === id ? "bg-brand text-white" : "bg-[var(--hover)] text-[var(--muted)] hover:bg-[var(--hover)]"}`}>
            {label}
          </button>
        ))}
      </div>
      {["scoring", "squadRules", "ranking", "prize"].includes(tab) && <SettingsEditor tab={tab} />}
      {tab === "participants" && <Participants />}
      {tab === "matches" && <Matches />}
      {tab === "matchstats" && <MatchStats />}
      {tab === "players" && <Players />}
    </div>
  );
}

function useSettings() {
  const [settings, setSettings] = useState(null);
  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then(setSettings); }, []);
  return [settings, setSettings];
}

async function saveSetting(key, value) {
  const r = await fetch("/api/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (r.status === 401) throw new Error("Senha de admin incorreta.");
  return r.json();
}

function Num({ label, value, onChange, step = 1, suffix }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="flex items-center gap-1">
        <input type="number" step={step} className="input w-24 text-right" value={value}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
        {suffix && <span className="text-[var(--faint)]">{suffix}</span>}
      </span>
    </label>
  );
}

function SaveBar({ onSave, msg }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button className="btn-primary" onClick={onSave}>Salvar</button>
      {msg && <span className="text-sm text-brand-dark">{msg}</span>}
    </div>
  );
}

function SettingsEditor({ tab }) {
  const [settings, setSettings] = useSettings();
  const [msg, setMsg] = useState("");
  if (!settings) return <p className="text-[var(--muted)]">Carregando…</p>;

  const cfg = settings[tab];
  const update = (patch) => setSettings((s) => ({ ...s, [tab]: { ...s[tab], ...patch } }));
  const updateEntry = (amount) => setSettings((s) => ({ ...s, entry: { ...s.entry, amount } }));

  async function save() {
    try {
      await saveSetting(tab, settings[tab]);
      if (tab === "prize") await saveSetting("entry", settings.entry);
      setMsg("✅ Salvo!");
    } catch (e) { setMsg("❌ " + e.message); }
  }

  return (
    <div className="card max-w-2xl space-y-4 p-6">
      {tab === "scoring" && (
        <>
          <h2 className="font-semibold">Critérios de pontos</h2>
          <Num label="Placar exato" value={cfg.exactScore} onChange={(v) => update({ exactScore: v })} suffix="pts" />
          <Num label="Vencedor + saldo de gols" value={cfg.winnerGoalDiff} onChange={(v) => update({ winnerGoalDiff: v })} suffix="pts" />
          <Num label="Só o resultado" value={cfg.winnerOnly} onChange={(v) => update({ winnerOnly: v })} suffix="pts" />
          <Num label="Acertar os gols de um time (extra)" value={cfg.teamGoalsBonus} onChange={(v) => update({ teamGoalsBonus: v })} suffix="pts" />
          <Num label="Bônus zebra" value={cfg.zebraBonus} onChange={(v) => update({ zebraBonus: v })} suffix="pts" />
          <h3 className="pt-2 font-medium text-[var(--text)]">Multiplicador por fase</h3>
          {STAGES.map((st) => (
            <Num key={st} label={STAGE_LABELS[st]} step={0.5} value={cfg.phaseMultipliers[st]}
              onChange={(v) => update({ phaseMultipliers: { ...cfg.phaseMultipliers, [st]: v } })} suffix="×" />
          ))}
        </>
      )}

      {tab === "squadRules" && (
        <>
          <h2 className="font-semibold">Regras da seleção</h2>
          <p className="text-sm text-[var(--muted)]">Titulares pela formação (11) + 5 reservas (1 de cada posição). Pontuação e custo somam os 16. Preços em ¢: 1/2/3/5/8.</p>
          <Num label="Multiplicador do camisa 10" value={cfg.camisa10Multiplier} step={0.5} onChange={(v) => update({ camisa10Multiplier: v })} suffix="×" />
          <Num label="Teto de orçamento" value={cfg.budgetCap} onChange={(v) => update({ budgetCap: v })} suffix="¢" />
          <h3 className="pt-2 font-medium text-[var(--text)]">Scout (pontos por evento × posição)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[var(--muted)]"><th className="text-left">Evento</th>{POSITIONS.map((p) => <th key={p} className="px-2">{p}</th>)}</tr></thead>
              <tbody>
                {Object.entries(cfg.scout).map(([ev, vals]) => (
                  <tr key={ev} className="border-t border-[var(--border)]">
                    <td className="py-1 text-[var(--muted)]">{EVENT_LABELS[ev] || ev}</td>
                    {POSITIONS.map((pos) => (
                      <td key={pos} className="px-1 py-1">
                        <input type="number" className="input w-14 text-center" value={vals[pos]}
                          onChange={(e) => update({ scout: { ...cfg.scout, [ev]: { ...vals, [pos]: Number(e.target.value) } } })} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "ranking" && (
        <>
          <h2 className="font-semibold">Pesos do ranking final</h2>
          <p className="text-sm text-[var(--muted)]">Devem somar 1.0 (ex: 0.6 + 0.4).</p>
          <Num label="Peso — Apostas de placar" value={cfg.weightBets} step={0.05} onChange={(v) => update({ weightBets: v })} />
          <Num label="Peso — Monte sua Seleção" value={cfg.weightSquad} step={0.05} onChange={(v) => update({ weightSquad: v })} />
          <p className="text-xs text-[var(--faint)]">Soma atual: {(Number(cfg.weightBets) + Number(cfg.weightSquad)).toFixed(2)}</p>
        </>
      )}

      {tab === "prize" && (
        <>
          <h2 className="font-semibold">Cash-in & Premiação</h2>
          <div className="rounded-xl bg-[var(--hover)] p-3">
            <Num label="Cash-in por participante (R$)" value={settings.entry?.amount ?? 50} onChange={(v) => updateEntry(v)} suffix="R$" />
            <p className="mt-1 text-xs text-[var(--faint)]">Valor padrão sugerido ao cadastrar quem pagou. O bolo é a soma do que cada um pagou (aba Participantes).</p>
          </div>
          <p className="text-sm text-[var(--muted)]">Premiação: % do bolo total. Some 100%.</p>
          {cfg.distribution.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-16 text-sm">{d.place}º lugar</span>
              <input type="number" className="input w-24 text-right" value={d.pct}
                onChange={(e) => {
                  const dist = cfg.distribution.slice();
                  dist[i] = { ...dist[i], pct: Number(e.target.value) };
                  update({ distribution: dist });
                }} />
              <span className="text-[var(--faint)]">%</span>
              <button className="btn-ghost ml-auto" onClick={() => update({ distribution: cfg.distribution.filter((_, j) => j !== i) })}>Remover</button>
            </div>
          ))}
          <button className="btn-ghost" onClick={() => update({ distribution: [...cfg.distribution, { place: cfg.distribution.length + 1, pct: 0 }] })}>
            + Adicionar colocação
          </button>
          <p className="text-xs text-[var(--faint)]">Soma atual: {cfg.distribution.reduce((s, d) => s + Number(d.pct), 0)}%</p>
        </>
      )}

      <SaveBar onSave={save} msg={msg} />
    </div>
  );
}

function Participants() {
  const [list, setList] = useState([]);
  const [cashIn, setCashIn] = useState(50);
  const [form, setForm] = useState({ name: "", email: "", entryFee: 50, isAdmin: false });
  const [msg, setMsg] = useState("");
  const load = () => fetch("/api/participants").then((r) => r.json()).then(setList);
  useEffect(() => { load(); fetch("/api/settings").then((r) => r.json()).then((s) => setCashIn(s.entry?.amount ?? 50)); }, []);

  async function add() {
    const r = await fetch("/api/participants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    if (r.status === 401) return setMsg("❌ Senha incorreta.");
    setForm({ name: "", email: "", entryFee: cashIn, isAdmin: false }); setMsg(""); load();
  }
  async function patch(id, data) {
    await fetch("/api/participants", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    load();
  }
  async function del(id) { await fetch(`/api/participants?id=${id}`, { method: "DELETE" }); load(); }
  async function onPhoto(p, e) {
    const file = e.target.files?.[0]; if (!file) return;
    try { const url = await fileToAvatar(file); await patch(p.id, { avatarUrl: url }); } catch (err) { setMsg("❌ " + err.message); }
    e.target.value = "";
  }

  const pot = list.length * cashIn;
  const paidCount = list.filter((p) => p.paid).length;

  return (
    <div className="card space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Participantes & pagamentos</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="pill bg-[var(--hover)] text-[var(--muted)]">Cash-in: R$ {cashIn}</span>
          <span className="pill bg-brand-light text-brand-dark">Pote: R$ {pot}</span>
          <span className="pill bg-[var(--hover)] text-[var(--muted)]">{paidCount}/{list.length} pagaram</span>
        </div>
      </div>
      <p className="text-xs text-[var(--faint)]">Todos os participantes contam R$ {cashIn} no pote automaticamente. O toggle "pagou" é só pra você controlar quem já te pagou (não afeta o pote). A foto pode ser trocada aqui (clique no avatar) ou pelo próprio usuário no perfil.</p>

      <div className="flex flex-wrap items-end gap-2">
        <input className="input flex-1" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input flex-1" placeholder="Email (opcional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.isAdmin} onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })} /> admin</label>
        <button className="btn-primary" onClick={add} disabled={!form.name}>Adicionar</button>
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <ul className="divide-y divide-[var(--border)]">
        {list.map((p) => {
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <label className="cursor-pointer" title="Trocar foto">
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--hover)] text-xs font-bold text-[var(--muted)]">
                  {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" /> : (p.name || "?").charAt(0).toUpperCase()}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(p, e)} />
              </label>
              <span className="min-w-[7rem] flex-1">{p.name} {p.isAdmin && <span className="pill bg-brand-light text-brand-dark">admin</span>}</span>
              <label className="flex cursor-pointer items-center gap-1.5" title="Marcar se já te pagou">
                <input type="checkbox" checked={!!p.paid} onChange={(e) => patch(p.id, { paid: e.target.checked })} />
                <span className={`pill ${p.paid ? "bg-brand-light text-brand-dark" : "bg-[var(--hover)] text-[var(--muted)]"}`}>{p.paid ? "pagou" : "pendente"}</span>
              </label>
              <button className="text-red-500 hover:underline" onClick={() => del(p.id)}>excluir</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Matches() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ homeTeam: "", awayTeam: "", stage: "GROUP", group: "", round: "", kickoff: "" });
  const [fStage, setFStage] = useState("GROUP");
  const [fGroup, setFGroup] = useState("");
  const load = () => fetch("/api/matches").then((r) => r.json()).then(setList);
  useEffect(() => { load(); }, []);

  async function add() {
    await fetch("/api/matches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    setForm({ homeTeam: "", awayTeam: "", stage: "GROUP", group: "", round: "", kickoff: "" }); load();
  }
  async function save(m) {
    const body = {
      id: m.id,
      homeTeam: m._home ?? m.homeTeam,
      awayTeam: m._away ?? m.awayTeam,
      homeScore: m._h ?? m.homeScore,
      awayScore: m._a ?? m.awayScore,
    };
    const hs = body.homeScore, as = body.awayScore;
    body.finished = hs !== "" && hs != null && as !== "" && as != null;
    await fetch("/api/matches", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    load();
  }
  async function del(id) { await fetch(`/api/matches?id=${id}`, { method: "DELETE" }); load(); }

  const groups = [...new Set(list.map((m) => m.group).filter(Boolean))].sort();
  const filtered = list.filter((m) => (!fStage || m.stage === fStage) && (!fGroup || m.group === fGroup));

  const Flag = ({ team }) => {
    const u = flagUrl(team);
    return <span className="inline-flex h-4 w-6 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)] align-middle">{u ? <img src={u} alt="" className="h-full w-full object-cover" /> : null}</span>;
  };

  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-semibold">Jogos & resultados</h2>
      <p className="text-sm text-[var(--muted)]">Lance o placar e os pontos são contabilizados. No mata-mata, edite os times "A definir" conforme os grupos terminam.</p>

      <div className="flex flex-wrap items-end gap-2">
        <input className="input w-36" placeholder="Mandante" value={form.homeTeam} onChange={(e) => setForm({ ...form, homeTeam: e.target.value })} />
        <input className="input w-36" placeholder="Visitante" value={form.awayTeam} onChange={(e) => setForm({ ...form, awayTeam: e.target.value })} />
        <select className="input w-28" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <input className="input w-16" placeholder="Grupo" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
        <input className="input w-20" placeholder="Rodada" value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })} />
        <input type="datetime-local" className="input w-52" value={form.kickoff} onChange={(e) => setForm({ ...form, kickoff: e.target.value })} />
        <button className="btn-primary" onClick={add} disabled={!form.homeTeam || !form.awayTeam}>Adicionar</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-36" value={fStage} onChange={(e) => setFStage(e.target.value)}>
          <option value="">Todas as fases</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <select className="input w-28" value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
          <option value="">Todos grupos</option>
          {groups.map((g) => <option key={g} value={g}>Grupo {g}</option>)}
        </select>
        <span className="text-xs text-[var(--faint)]">{filtered.length} jogos</span>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {filtered.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="pill bg-[var(--hover)] text-[var(--muted)]">{STAGE_LABELS[m.stage]}{m.group ? ` ${m.group}${m.round ? "-R" + m.round : ""}` : ""}</span>
            <Flag team={m.homeTeam} />
            <input className="input w-32" defaultValue={m.homeTeam} onChange={(e) => (m._home = e.target.value)} />
            <input type="number" className="input w-12 text-center" defaultValue={m.homeScore ?? ""} placeholder="-" onChange={(e) => (m._h = e.target.value)} />
            <span className="text-[var(--faint)]">×</span>
            <input type="number" className="input w-12 text-center" defaultValue={m.awayScore ?? ""} placeholder="-" onChange={(e) => (m._a = e.target.value)} />
            <input className="input w-32" defaultValue={m.awayTeam} onChange={(e) => (m._away = e.target.value)} />
            <Flag team={m.awayTeam} />
            <button className="btn-ghost ml-auto" onClick={() => save(m)}>Salvar</button>
            <button className="text-red-500 hover:underline" onClick={() => del(m.id)}>excluir</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchStats() {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState({});
  useEffect(() => { fetch("/api/admin/match-stats").then((r) => r.json()).then(setList); }, []);

  if (list === null) return <div className="card p-6"><p className="text-[var(--muted)]">Carregando…</p></div>;

  const Flag = ({ team }) => {
    const u = flagUrl(team);
    return <span className="inline-flex h-4 w-6 items-center justify-center overflow-hidden rounded-sm bg-[var(--hover)] align-middle">{u ? <img src={u} alt="" className="h-full w-full object-cover" /> : null}</span>;
  };
  const cols = [["minutes", "MIN"], ["goals", "G"], ["assists", "A"], ["shotsOnTarget", "FA"], ["tackles", "DES"], ["interceptions", "INT"], ["cleanSheet", "SG"], ["saves", "DD"], ["penaltiesSaved", "DP"], ["yellow", "CA"], ["red", "CV"], ["ownGoals", "GC"]];
  const EDIT = new Set(["tackles", "interceptions", "penaltiesSaved"]);
  async function editField(matchId, rowId, field, value) {
    const r = await fetch("/api/admin/match-stats", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: rowId, [field]: value }) });
    if (r.ok) {
      const d = await r.json();
      setList((prev) => prev.map((m) => m.id !== matchId ? m : { ...m, players: m.players.map((pl) => pl.id !== rowId ? pl : { ...pl, points: d.points, tackles: d.tackles, interceptions: d.interceptions, penaltiesSaved: d.penaltiesSaved }) }));
    }
  }

  return (
    <div className="card space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Stats dos jogos</h2>
        <span className="text-xs text-[var(--faint)]">{list.length} jogo(s) encerrado(s)</span>
      </div>
      <p className="text-sm text-[var(--muted)]">Resultado + desempenho de cada jogador por partida (automático, via ESPN). A coluna <b>Pts</b> é quanto o jogador rendeu de fantasy naquele jogo. As colunas <b>DES / INT / DP</b> são editáveis (clique e corrija à mão se a ESPN errar — o total recalcula sozinho). MIN=minutos, G=gol, A=assist, FA=finaliz. no alvo, DES=desarme, INT=interceptação, SG=sem sofrer gol, DD=defesa, DP=defesa de pênalti, CA/CV=cartões, GC=gol contra.</p>

      {list.length === 0 && <p className="rounded-xl bg-[var(--hover)] p-4 text-sm text-[var(--muted)]">Nenhum jogo encerrado ainda. Assim que os jogos acabarem e o sync rodar (com <code>--stats</code>), eles aparecem aqui.</p>}

      <ul className="space-y-2">
        {list.map((m) => {
          const isOpen = open[m.id];
          const totalPts = m.players.reduce((s, p) => s + p.points, 0);
          return (
            <li key={m.id} className="rounded-xl border border-[var(--border)]">
              <button className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm" onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))}>
                <span className="text-[var(--faint)]">{isOpen ? "▾" : "▸"}</span>
                <span className="pill bg-[var(--hover)] text-[var(--muted)]">{STAGE_LABELS[m.stage]}{m.group ? ` ${m.group}` : ""}</span>
                <Flag team={m.homeTeam} /> <span className="font-medium">{m.homeTeam}</span>
                <span className="font-bold">{m.homeScore} × {m.awayScore}</span>
                <span className="font-medium">{m.awayTeam}</span> <Flag team={m.awayTeam} />
                <span className="ml-auto text-xs text-[var(--faint)]">{m.hasStats ? `${m.players.length} jogadores · ${totalPts.toFixed(1)} pts` : "sem stats de jogador"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-[var(--border)] px-3 py-2">
                  {!m.hasStats ? (
                    <p className="py-2 text-sm text-[var(--muted)]">Placar lançado, mas sem scout por jogador. Rode <code>node scripts/sync.mjs --stats</code> pra puxar da API-Football.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[var(--muted)]">
                            <th className="text-left">Jogador</th><th>Pos</th>
                            {cols.map(([, l]) => <th key={l} className="px-1">{l}</th>)}
                            <th className="px-1 text-right">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.players.map((p, i) => (
                            <tr key={i} className="border-t border-[var(--border)]">
                              <td className="py-1"><span className="font-medium">{p.name}</span> <span className="text-[var(--faint)]">{p.team}</span></td>
                              <td className="px-1 text-center text-[var(--muted)]">{p.position}</td>
                              {cols.map(([k]) => EDIT.has(k)
                                ? <td key={k} className="px-1 text-center"><input type="number" min="0" defaultValue={p[k] || 0} onBlur={(e) => editField(m.id, p.id, k, Math.max(0, Number(e.target.value) || 0))} className="input w-12 text-center" title="editável (corrige à mão)" /></td>
                                : <td key={k} className={`px-1 text-center ${p[k] ? "" : "text-[var(--faint)]"}`}>{p[k] || 0}</td>)}
                              <td className={`px-1 text-right font-semibold ${p.points > 0 ? "text-brand-dark" : p.points < 0 ? "text-red-500" : "text-[var(--faint)]"}`}>{p.points.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Players() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", team: "", position: "MEI", price: 1 });
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [priceF, setPriceF] = useState("");
  const [posF, setPosF] = useState("");
  const [sortBy, setSortBy] = useState("team");
  const [saveMsg, setSaveMsg] = useState("");
  const dirty = useRef(new Set());
  const saveTimer = useRef(null);
  const load = () => fetch("/api/players").then((r) => r.json()).then(setList);
  useEffect(() => { load(); }, []);
  const byId = useMemo(() => Object.fromEntries(list.map((pl) => [pl.id, pl])), [list]);

  async function add() {
    await fetch("/api/players", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    setForm({ name: "", team: "", position: "MEI", price: 1 }); load();
  }
  async function savePlayer(p) {
    dirty.current.delete(p.id);
    await fetch("/api/players", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
    setSaveMsg("✓ salvo");
  }
  async function flush() {
    const ids = [...dirty.current]; if (!ids.length) { setSaveMsg("Nada para salvar"); return; }
    dirty.current.clear();
    const items = ids.map((id) => byId[id]).filter(Boolean);
    setSaveMsg("Salvando…");
    for (const p of items) await fetch("/api/players", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
    setSaveMsg(`✓ ${items.length} salvo(s)`);
  }
  function touch(p) { dirty.current.add(p.id); clearTimeout(saveTimer.current); saveTimer.current = setTimeout(flush, 1200); }
  async function del(id) { await fetch(`/api/players?id=${id}`, { method: "DELETE" }); load(); }

  const fields = [["goals", "G"], ["assists", "A"], ["cleanSheet", "SG"], ["saves", "DD"], ["yellow", "CA"], ["red", "CV"], ["ownGoals", "GC"]];
  const countries = [...new Set(list.map((p) => p.team))].sort();
  const ord = { GOL: 0, ZAG: 1, LAT: 2, MEI: 3, ATA: 4 };
  const filtered = list
    .filter((p) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!country || p.team === country) && (!priceF || p.price === Number(priceF)) && (!posF || p.position === posF))
    .sort((a, b) => {
      if (sortBy === "price-desc") return b.price - a.price || a.name.localeCompare(b.name);
      if (sortBy === "price-asc") return a.price - b.price || a.name.localeCompare(b.name);
      if (sortBy === "pos") return ord[a.position] - ord[b.position] || a.name.localeCompare(b.name);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return a.team.localeCompare(b.team) || a.name.localeCompare(b.name);
    })
    .slice(0, 120);

  return (
    <div className="card space-y-4 p-6">
      <h2 className="font-semibold">Jogadores & scout</h2>
      <p className="text-sm text-[var(--muted)]">Edições salvam automaticamente; use "Salvar tudo" para gravar pendências na hora. G=gols, A=assist, SG=jogos sem sofrer gol, DD=defesas, CA/CV=cartões, GC=gol contra.</p>

      <div className="flex flex-wrap items-end gap-2">
        <input className="input w-40" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input w-32" placeholder="Seleção" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} />
        <select className="input w-24" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input w-40" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}>
          {PRICE_TIERS.map(([v, l]) => <option key={v} value={v}>{v}¢ · {l}</option>)}
        </select>
        <button className="btn-primary" onClick={add} disabled={!form.name || !form.team}>Adicionar</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-48" placeholder="Buscar jogador..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-44" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Todos os países</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-32" value={priceF} onChange={(e) => setPriceF(e.target.value)}>
          <option value="">Todos preços</option>
          {[1, 2, 3, 5, 8].map((v) => <option key={v} value={v}>{v}¢</option>)}
        </select>
        <select className="input w-32" value={posF} onChange={(e) => setPosF(e.target.value)}>
          <option value="">Todas posições</option>
          {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
        </select>
        <select className="input w-44" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="team">Ordenar: seleção</option>
          <option value="price-desc">Ordenar: preço (maior)</option>
          <option value="price-asc">Ordenar: preço (menor)</option>
          <option value="pos">Ordenar: posição</option>
          <option value="name">Ordenar: nome</option>
        </select>
        <span className="text-xs text-[var(--faint)]">{filtered.length} mostrados (de {list.length})</span>
        <button className="btn-primary ml-auto" onClick={flush}>Salvar tudo</button>
        <span className="text-xs text-[var(--faint)]">{saveMsg || "auto-save ligado"}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-[var(--muted)]"><th className="text-left">Jogador</th><th>Pos</th><th className="px-1">Preço</th>{fields.map(([, l]) => <th key={l} className="px-1">{l}</th>)}<th></th></tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)]">
                <td className="py-1"><span className="font-medium">{p.name}</span> <span className="text-[var(--faint)]">{p.team}</span></td>
                <td className="px-1">
                  <select className="input w-20" defaultValue={p.position} onChange={(e) => { p.position = e.target.value; touch(p); }}>
                    {POSITIONS.map((pos) => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </td>
                <td className="px-1">
                  <select className="input w-28" defaultValue={p.price} onChange={(e) => { p.price = Number(e.target.value); touch(p); }}>
                    {PRICE_TIERS.map(([v, l]) => <option key={v} value={v}>{v}¢ · {l}</option>)}
                  </select>
                </td>
                {fields.map(([k]) => (
                  <td key={k} className="px-1"><input type="number" className="input w-12 text-center" defaultValue={p[k]} onChange={(e) => { p[k] = Number(e.target.value); touch(p); }} /></td>
                ))}
                <td className="whitespace-nowrap text-right">
                  <button className="btn-ghost mr-1" onClick={() => savePlayer(p)}>Salvar</button>
                  <button className="text-red-500 hover:underline" onClick={() => del(p.id)}>excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
