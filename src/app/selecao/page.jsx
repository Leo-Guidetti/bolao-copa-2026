"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FORMATIONS, RESERVES, POSITIONS, POSITION_LABELS, DEFAULT_FORMATION, SQUAD_SIZE } from "@/lib/defaults";
import { flagUrl, teamFull } from "@/lib/flags";
import PlayerAvatar from "@/components/PlayerAvatar";
import Pitch from "@/components/Pitch";
import { playerScore } from "@/lib/scoring";
import LeigoMaster from "@/components/LeigoMaster";
import PlayerStats from "@/components/PlayerStats";

const fmt = (iso) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

export default function SelecaoPage() {
  const [me, setMe] = useState(undefined);
  const [players, setPlayers] = useState([]);
  const [rules, setRules] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [prize, setPrize] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [lock, setLock] = useState(null);
  const [snapIds, setSnapIds] = useState(null);
  const [formation, setFormation] = useState(DEFAULT_FORMATION);
  const [pickedIds, setPickedIds] = useState([]);
  const [camisa10Id, setCamisa10Id] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState("campo");

  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [priceFilter, setPriceFilter] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [sortBy, setSortBy] = useState("price-desc");
  const [onlyPlayed, setOnlyPlayed] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then(setMe);
    fetch("/api/players").then((r) => r.json()).then(setPlayers);
    fetch("/api/settings").then((r) => r.json()).then((s) => { setRules(s.squadRules); setRanking(s.ranking); setPrize(s.prize); });
    fetch("/api/lock").then((r) => r.json()).then(setLock);
  }, []);

  useEffect(() => {
    if (!me) return;
    fetch("/api/squad").then((r) => r.json()).then((sq) => {
      if (sq) {
        setFormation(sq.formation && FORMATIONS[sq.formation] ? sq.formation : DEFAULT_FORMATION);
        setCamisa10Id(sq.captainId || "");
        setPickedIds(sq.players.map((p) => p.playerId));
        setSnapIds(sq.snapshotIds || null);
      }
    });
  }, [me]);

  const koMode = !!(lock?.locked && lock?.ko?.open); // janela de troca do mata-mata
  const readOnly = !!lock?.locked && !koMode;
  const maxSubs = lock?.ko?.maxSubs ?? 4;
  const snapSet = useMemo(() => new Set(snapIds || []), [snapIds]);
  const subsCount = useMemo(() => (snapIds ? pickedIds.filter((id) => !snapSet.has(id)).length : 0), [pickedIds, snapSet, snapIds]);
  // Mercado fechado (e fora da janela de troca): mostra só quem já jogou, ordenado pela pontuação.
  useEffect(() => { if (readOnly) { setOnlyPlayed(true); setSortBy("pts"); } }, [readOnly]);
  const playerById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const subbedInIds = useMemo(() => (snapIds ? pickedIds.filter((id) => !snapSet.has(id)) : []), [snapIds, pickedIds, snapSet]);
  const subbedOut = useMemo(() => (snapIds ? snapIds.filter((id) => !pickedIds.includes(id)).map((id) => playerById[id]).filter(Boolean) : []), [snapIds, pickedIds, playerById]);
  const shape = FORMATIONS[formation];
  const starterNeed = { GOL: 1, ZAG: shape.ZAG, LAT: shape.LAT, MEI: shape.MEI, ATA: shape.ATA };
  const capOf = (pos) => starterNeed[pos] + RESERVES[pos];

  // Titular = mais caro de cada posição; reserva = o(s) mais barato(s).
  const { starterPlayers, reservePlayers, starterIds, reserveIds } = useMemo(() => {
    const byPos = { GOL: [], ZAG: [], LAT: [], MEI: [], ATA: [] };
    for (const id of pickedIds) { const p = playerById[id]; if (p && byPos[p.position]) byPos[p.position].push(p); }
    const sp = [], rp = [];
    for (const pos of POSITIONS) {
      const arr = byPos[pos].slice().sort((a, b) => (b.price || 0) - (a.price || 0) || a.name.localeCompare(b.name));
      const ns = { GOL: 1, ZAG: shape.ZAG, LAT: shape.LAT, MEI: shape.MEI, ATA: shape.ATA }[pos];
      arr.forEach((pl, i) => (i < ns ? sp : rp).push(pl));
    }
    return { starterPlayers: sp, reservePlayers: rp, starterIds: sp.map((p) => p.id), reserveIds: rp.map((p) => p.id) };
  }, [pickedIds, playerById, formation]);

  const allPicked = starterPlayers.concat(reservePlayers);
  const cntStart = (pos) => starterPlayers.filter((p) => p.position === pos).length;
  const cntRes = (pos) => reservePlayers.filter((p) => p.position === pos).length;
  const totalCost = allPicked.reduce((s, p) => s + (p.price || 0), 0);
  const budgetCap = rules?.budgetCap ?? 50;
  const _wB = ranking?.weightBets ?? 0.6, _wS = ranking?.weightSquad ?? 0.4, _sumW = (_wB + _wS) || 1;
  const pctSquad = Math.round((_wS / _sumW) * 100), pctBets = Math.round((_wB / _sumW) * 100);
  const over = totalCost > budgetCap;
  const complete = POSITIONS.every((pos) => cntStart(pos) === starterNeed[pos]) && POSITIONS.every((pos) => cntRes(pos) === RESERVES[pos]) && !over;
  const scout = rules?.scout || {};
  const capMult = rules?.camisa10Multiplier ?? 2;
  const ptsOf = (pl) => playerScore(pl, scout);
  const teamPoints = allPicked.reduce((sum, pl) => sum + ptsOf(pl) * (pl.id === camisa10Id ? capMult : 1), 0);
  const LIST_ORDER = ["GOL", "LAT", "ZAG", "MEI", "ATA"];
  const ordByPos = (arr) => LIST_ORDER.flatMap((pos) => arr.filter((pl) => pl.position === pos));
  const listStarters = ordByPos(starterPlayers);
  const listReserves = ordByPos(reservePlayers);

  function changeFormation(nf) {
    if (readOnly) return;
    const sh = FORMATIONS[nf];
    const capN = { GOL: 1 + RESERVES.GOL, ZAG: sh.ZAG + RESERVES.ZAG, LAT: sh.LAT + RESERVES.LAT, MEI: sh.MEI + RESERVES.MEI, ATA: sh.ATA + RESERVES.ATA };
    const byPos = { GOL: [], ZAG: [], LAT: [], MEI: [], ATA: [] };
    for (const id of pickedIds) { const p = playerById[id]; if (p) byPos[p.position].push(p); }
    const kept = []; let dropped = false;
    for (const pos of POSITIONS) {
      const arr = byPos[pos].slice().sort((a, b) => (b.price || 0) - (a.price || 0));
      arr.forEach((pl, i) => (i < capN[pos] ? kept.push(pl.id) : (dropped = true)));
    }
    if (dropped) setMsg("Formação mudou: jogadores em excesso na posição foram removidos (mantidos os mais caros).");
    else setMsg("");
    if (camisa10Id && !kept.includes(camisa10Id)) setCamisa10Id("");
    setPickedIds(kept); setFormation(nf); scheduleSave();
  }
  function toggle(player) {
    if (readOnly) return;
    const id = player.id, pos = player.position;
    if (pickedIds.includes(id)) {
      setPickedIds((s) => s.filter((x) => x !== id));
      if (camisa10Id === id) setCamisa10Id("");
      setMsg(""); scheduleSave(); return;
    }
    if (totalCost + (player.price || 0) > budgetCap) return setMsg("Isso estoura o orçamento.");
    const posCount = allPicked.filter((p) => p.position === pos).length;
    if (posCount >= capOf(pos)) return setMsg(`Sem vaga para mais um ${POSITION_LABELS[pos].toLowerCase()} (titular ou reserva).`);
    if (koMode && snapIds && !snapSet.has(id) && subsCount >= maxSubs) return setMsg(`Você já fez ${maxSubs} trocas — o máximo para o mata-mata.`);
    setPickedIds((s) => [...s, id]); setMsg(""); scheduleSave();
  }
  const toggleCaptain = (id) => { if (readOnly || koMode) return; setCamisa10Id((c) => (c === id ? "" : id)); scheduleSave(); };
  function removePlayer(id) {
    if (readOnly) return;
    setPickedIds((s) => s.filter((x) => x !== id));
    if (camisa10Id === id) setCamisa10Id("");
    setMsg(""); scheduleSave();
  }

  const payloadRef = useRef(null);
  useEffect(() => { payloadRef.current = { formation, captainId: camisa10Id, starterIds, reserveIds, over, count: allPicked.length, complete }; });
  const saveTimer = useRef(null);
  async function doSave() {
    if (readOnly) return;
    const pl = payloadRef.current; if (!pl) return;
    if (pl.over) { setMsg("⚠ Acima do orçamento — ajuste para salvar."); return; }
    setSaving(true);
    const res = await fetch("/api/squad", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ formation: pl.formation, captainId: pl.captainId, starterIds: pl.starterIds, reserveIds: pl.reserveIds }) });
    setSaving(false);
    setMsg(res.ok ? (pl.complete ? "✓ Seleção salva" : `✓ Rascunho salvo (${pl.count}/${SQUAD_SIZE})`) : "Erro ao salvar (prazo pode ter encerrado).");
  }
  const scheduleSave = () => { if (readOnly) return; clearTimeout(saveTimer.current); saveTimer.current = setTimeout(doSave, 1000); };
  const save = doSave;

  const countries = useMemo(() => [...new Set(players.map((p) => p.team))].sort(), [players]);
  const list = useMemo(() => {
    let arr = players.slice();
    if (q) arr = arr.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    if (country) arr = arr.filter((p) => p.team === country);
    if (priceFilter) arr = arr.filter((p) => p.price === Number(priceFilter));
    if (posFilter) arr = arr.filter((p) => p.position === posFilter);
    if (onlyPlayed) arr = arr.filter((p) => (p.minutes || 0) > 0);
    const ord = { GOL: 0, ZAG: 1, LAT: 2, MEI: 3, ATA: 4 };
    arr.sort((a, b) => {
      if (sortBy === "pts") return ptsOf(b) - ptsOf(a) || b.price - a.price;
      if (sortBy === "price-desc") return b.price - a.price || a.name.localeCompare(b.name);
      if (sortBy === "price-asc") return a.price - b.price || a.name.localeCompare(b.name);
      if (sortBy === "pos") return ord[a.position] - ord[b.position] || b.price - a.price;
      return a.name.localeCompare(b.name);
    });
    return arr.slice(0, 120);
  }, [players, q, country, priceFilter, posFilter, sortBy, onlyPlayed, scout]);

  if (me === null) return (
    <div className="mx-auto mt-10 max-w-sm card space-y-3 p-6 text-center">
      <div className="text-3xl">🔒</div>
      <p className="text-[var(--muted)]">Faça login para montar sua seleção.</p>
      <a className="btn-primary" href="/login">Entrar</a>
    </div>
  );

  const SCOUT_INFO = [
    ["goal", "Gol", "Gol marcado pelo jogador."],
    ["assist", "Assistência", "Passe que resulta em gol."],
    ["shotOnTarget", "Finalização no alvo", "Chute em direção ao gol (defendido ou convertido)."],
    ["shot", "Finalização", "Qualquer finalização (no alvo ou não)."],
    ["tackleInterception", "Desarme / Interceptação", "Desarmes e interceptações somados."],
    ["cleanSheet", "Sem sofrer gol", "Jogo em que o time não levou gol."],
    ["save", "Defesa", "Defesa feita pelo goleiro."],
    ["penaltySaved", "Defesa de pênalti", "Pênalti defendido pelo goleiro."],
    ["yellow", "Cartão amarelo", "Desconta pontos."],
    ["red", "Cartão vermelho", "Desconta pontos."],
    ["ownGoal", "Gol contra", "Desconta pontos."],
    ["goalConceded", "Gol sofrido", "Cada gol que o time sofre com o goleiro em campo desconta pontos do goleiro."],
  ];

  function ListRow({ p }) {
    const isCap = camisa10Id === p.id;
    const isSubIn = snapIds && !snapSet.has(p.id);
    const shownPts = isSubIn ? 0 : ptsOf(p);
    return (
      <div onClick={() => setDetail(p)} className="flex cursor-pointer items-center gap-2 px-3 py-2">
        <span className="w-8 shrink-0 text-center text-[10px] font-bold text-[var(--muted)]">{p.position}</span>
        <PlayerAvatar player={p} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 truncate text-sm font-medium">{p.name}{isCap && <span className="pill bg-accent/20 text-[9px] font-bold text-yellow-700">C10</span>}{isSubIn && <span className="pill bg-amber-500/20 text-[9px] font-bold text-amber-700" title="Troca — só pontua no mata-mata">🔁</span>}</span>
          <span className="block truncate text-[11px] text-[var(--faint)]">{teamFull(p.team)}</span>
        </span>
        {(readOnly || shownPts !== 0) && <span className={`flex shrink-0 items-center gap-0.5 text-sm font-bold tabular-nums ${isCap ? "text-yellow-600" : shownPts < 0 ? "text-red-500" : ""}`}>{(shownPts * (isCap ? capMult : 1)).toFixed(1)}{isCap && <span className="rounded bg-accent/20 px-1 text-[9px] font-extrabold text-yellow-700">×{capMult}</span>}<span className="ml-0.5 text-[10px] font-normal text-[var(--faint)]">pts</span></span>}
        <span className="pill shrink-0 bg-accent/15 font-semibold text-yellow-700">{p.price}¢</span>
        {!readOnly && (
          <span className="flex shrink-0 items-center gap-1">
            {!koMode && <button onClick={(e) => { e.stopPropagation(); toggleCaptain(p.id); }} title="Camisa 10" className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${isCap ? "bg-accent text-ink" : "bg-[var(--hover)] text-[var(--faint)]"}`}>10</button>}
            <button onClick={(e) => { e.stopPropagation(); removePlayer(p.id); }} title="Remover do time" aria-label="Remover" className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">×</button>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {detail && <PlayerStats player={detail} scout={scout} capMult={capMult} isCaptain={detail.id === camisa10Id} onClose={() => setDetail(null)} />}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Minha seleção</h1>
          <button onClick={() => setShowInfo(true)} title="Como funciona o scout" aria-label="Como funciona o scout"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-xs font-semibold text-[var(--muted)] hover:bg-[var(--hover)]">i</button>
        </div>
        <p className="mt-1 text-[var(--muted)]">11 titulares (pela formação) + 5 reservas (1 de cada posição). Camisa 10 pontua em dobro. <span className="text-[var(--faint)]">A seleção vale {pctSquad}% do ranking final (apostas valem {pctBets}%).</span></p>
      </div>

      <LeigoMaster context="selecao" />

      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowInfo(false)}>
          <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Como funciona o scout</h3>
              <button onClick={() => setShowInfo(false)} aria-label="Fechar"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)]">✕</button>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">Cada jogador soma (ou perde) pontos por estes eventos, de acordo com a posição. O camisa 10 pontua em dobro ({rules?.camisa10Multiplier ?? 2}×). Orçamento máximo: {budgetCap}¢.</p>
            <div className="mt-3 space-y-2">
              {SCOUT_INFO.filter(([ev]) => rules?.scout?.[ev]).map(([ev, label, desc]) => (
                <div key={ev} className="rounded-xl bg-[var(--hover)] p-3">
                  <div className="font-medium">{label}</div>
                  <p className="text-xs text-[var(--muted)]">{desc}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {POSITIONS.map((pos) => (
                      <span key={pos} className="pill bg-[var(--surface)] text-[var(--muted)]">{pos} {rules.scout[ev]?.[pos] ?? 0}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--faint)]">Resultados e estatísticas são atualizados automaticamente a cada rodada.</p>
          </div>
        </div>
      )}

      {lock && (
        koMode ? (
          <div className="card border-l-4 border-l-accent p-3 text-sm">
            🔁 <b>Janela de troca do mata-mata aberta.</b> Você pode fazer até <b>{maxSubs} trocas</b> <span className="text-[var(--muted)]">({subsCount}/{maxSubs} usadas)</span>{lock.ko?.deadline ? <> até <b className="text-[var(--text)]">{fmt(lock.ko.deadline)}</b></> : ""}. As trocas só valem no <b>mata-mata</b> — seu time da fase de grupos continua pontuando normalmente até o fim dos grupos. O <b>camisa 10 fica fixo</b> (não pode ser trocado).
          </div>
        ) : readOnly ? (
          <div className="card border-l-4 border-l-red-500 p-3 text-sm">
            🔒 <b>Seleção travada.</b> O prazo encerrou em {fmt(lock.deadline)} (30 min antes da estreia). Não é mais possível editar.
          </div>
        ) : (
          <div className="card p-3 text-sm text-[var(--muted)]">
            ⏳ Você pode editar sua seleção até <b className="text-[var(--text)]">{fmt(lock.deadline)}</b> (30 min antes da estreia da Copa).
          </div>
        )
      )}

      {readOnly && (
        <div className="card flex items-center justify-between gap-3 p-4">
          <div>
            <div className="text-sm font-medium text-[var(--text)]">Pontuação parcial da sua seleção</div>
            <div className="text-xs text-[var(--faint)]">Mercado fechado — atualiza conforme os jogos (camisa 10 conta em dobro).</div>
          </div>
          <div className="text-3xl font-bold tabular-nums">{teamPoints.toFixed(1)}<span className="ml-1 text-sm font-normal text-[var(--muted)]">pts</span></div>
        </div>
      )}

      {over && (
        <div className="card border-l-4 border-l-red-500 bg-red-50 p-4 dark:bg-red-950/30">
          <h2 className="font-bold text-red-700 dark:text-red-300">🚨 Acima do orçamento — a seleção não vai contar!</h2>
          <p className="mt-1 text-sm text-[var(--text)]">Seu time custa <b>{totalCost}¢</b> e o teto é <b>{budgetCap}¢</b>. Remova jogadores até voltar ao limite: <b>não dá pra salvar</b> acima do orçamento, e enquanto estiver assim a seleção <b>não pontua</b> no ranking.</p>
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm text-[var(--muted)]">Time de <b className="text-[var(--text)]">{me?.name || "..."}</b></span>
        <select className="input max-w-[8rem]" value={formation} disabled={readOnly} onChange={(e) => changeFormation(e.target.value)}>
          {Object.keys(FORMATIONS).map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="flex rounded-full bg-[var(--hover)] p-0.5 text-xs">
          <button type="button" onClick={() => setViewMode("campo")} className={`rounded-full px-3 py-1 transition ${viewMode === "campo" ? "bg-[var(--surface)] font-semibold shadow" : "text-[var(--muted)]"}`}>Campo</button>
          <button type="button" onClick={() => setViewMode("lista")} className={`rounded-full px-3 py-1 transition ${viewMode === "lista" ? "bg-[var(--surface)] font-semibold shadow" : "text-[var(--muted)]"}`}>Lista</button>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {koMode && <span className={`pill ${subsCount >= maxSubs ? "bg-amber-500/20 text-amber-700" : "bg-accent/20 text-yellow-700"}`}>🔁 {subsCount}/{maxSubs} trocas</span>}
          <span className={`pill ${over ? "bg-red-100 text-red-700" : "bg-brand-light text-brand-dark"}`}>{totalCost}¢ / {budgetCap}¢</span>
          <span className="pill bg-[var(--hover)] text-[var(--muted)]">{allPicked.length}/{SQUAD_SIZE}</span>
          <button className="btn-primary" onClick={save} disabled={saving || readOnly}>{saving ? "Salvando…" : readOnly ? "Travada" : "Salvar agora"}</button>
        </div>
      </div>
      {msg && <p className="text-sm text-brand-dark">{msg}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div>
          {viewMode === "campo" ? (
            <Pitch formation={formation} starters={starterPlayers} reserves={reservePlayers} camisa10Id={camisa10Id} capMult={capMult} onToggleCaptain={(readOnly || koMode) ? undefined : toggleCaptain} onRemove={readOnly ? undefined : removePlayer} showPoints={readOnly} pointsOf={(pl) => (snapIds && !snapSet.has(pl.id) ? 0 : ptsOf(pl) * (pl.id === camisa10Id ? capMult : 1))} subbedInIds={subbedInIds} subbedOut={subbedOut} onPlayer={setDetail} />
          ) : (
            <div className="space-y-3">
              <div className="card overflow-hidden p-0">
                <div className="bg-[var(--hover)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">Titulares</div>
                <div className="divide-y divide-[var(--border)]">
                  {listStarters.map((pl) => <ListRow key={pl.id} p={pl} />)}
                  {listStarters.length === 0 && <div className="px-3 py-3 text-sm text-[var(--muted)]">Nenhum titular ainda.</div>}
                </div>
              </div>
              <div className="card overflow-hidden p-0">
                <div className="bg-[var(--hover)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">Reservas</div>
                <div className="divide-y divide-[var(--border)]">
                  {listReserves.map((pl) => <ListRow key={pl.id} p={pl} />)}
                  {listReserves.length === 0 && <div className="px-3 py-3 text-sm text-[var(--muted)]">Nenhum reserva ainda.</div>}
                </div>
              </div>
            </div>
          )}
          <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px]">
            {POSITIONS.map((pos) => (
              <div key={pos} className="rounded-lg bg-[var(--hover)] py-1">
                <div className="font-semibold text-[var(--muted)]">{pos}</div>
                <div className="text-[var(--faint)]">{cntStart(pos)}/{starterNeed[pos]} + {cntRes(pos)}/{RESERVES[pos]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="card grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
            <input className="input col-span-2 sm:col-span-3" placeholder="Buscar jogador..." value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">Todos os países</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input" value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
              <option value="">Todas posições</option>{POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABELS[p]}</option>)}
            </select>
            <select className="input" value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)}>
              <option value="">Todos preços</option>{[1, 2, 3, 5, 8].map((v) => <option key={v} value={v}>{v}¢</option>)}
            </select>
            <select className="input col-span-2 sm:col-span-3" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="pts">Ordenar: pontuação</option>
              <option value="price-desc">Ordenar: preço (maior)</option>
              <option value="price-asc">Ordenar: preço (menor)</option>
              <option value="pos">Ordenar: posição</option>
              <option value="name">Ordenar: nome</option>
            </select>
            <label className="col-span-2 flex items-center gap-2 text-sm text-[var(--muted)] sm:col-span-3">
              <input type="checkbox" checked={onlyPlayed} onChange={(e) => setOnlyPlayed(e.target.checked)} />
              Só quem já jogou
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {list.map((p) => {
              const inStart = starterIds.includes(p.id), inRes = reserveIds.includes(p.id);
              const isSel = inStart || inRes, isCap = camisa10Id === p.id, flag = flagUrl(p.team);
              return (
                <div key={p.id} className={`card flex items-center gap-2 p-2 transition ${isSel ? "ring-2 ring-brand" : ""}`}>
                  <button onClick={() => (readOnly ? setDetail(p) : toggle(p))} className="flex flex-1 items-center gap-2 text-left">
                    <PlayerAvatar player={p} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block text-[11px] text-[var(--faint)]">{p.position} - {teamFull(p.team)}</span>
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className={`flex items-center gap-0.5 text-sm font-bold tabular-nums ${isCap ? "text-yellow-600" : ptsOf(p) < 0 ? "text-red-500" : ""}`}>{(ptsOf(p) * (isCap ? capMult : 1)).toFixed(1)}{isCap && <span className="rounded bg-accent/20 px-1 text-[9px] font-extrabold text-yellow-700">×{capMult}</span>}<span className="text-[10px] font-normal text-[var(--faint)]"> pts</span></span>
                      {inStart && <span className="pill bg-brand-light text-brand-dark">T</span>}
                      {inRes && <span className="pill bg-[var(--hover)] text-[var(--muted)]">R</span>}
                      <span className="pill bg-accent/15 font-semibold text-yellow-700">{p.price}¢</span>
                    </span>
                  </button>
                  {isSel && !koMode && (
                    <button onClick={() => toggleCaptain(p.id)} title="Camisa 10"
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${isCap ? "bg-accent text-ink" : "bg-[var(--hover)] text-[var(--faint)]"}`}>10</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
