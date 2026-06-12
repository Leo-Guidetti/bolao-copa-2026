"use client";

import { flagUrl } from "@/lib/flags";
import { FORMATIONS, POSITION_LABELS } from "@/lib/defaults";

const NAME_SUFFIX = new Set(["jr","jr.","junior","júnior","neto","filho","ii","iii"]);
function shortName(full) {
  const parts = String(full || "").trim().split(/\s+/);
  if (parts.length <= 1) return full;
  if (NAME_SUFFIX.has(parts[parts.length - 1].toLowerCase())) return full; // ex.: "Vini Jr."
  return parts[0][0] + ". " + parts.slice(1).join(" ");
}

// Distribui os laterais nas pontas e zagueiros no meio.
function defenseOrder(zag, lat) {
  const left = Math.ceil(lat / 2);
  const right = lat - left;
  return [...Array(left).fill("LAT"), ...Array(zag).fill("ZAG"), ...Array(right).fill("LAT")];
}

// Monta os slots de uma linha a partir das posições pedidas e do pool de jogadores.
function fillRow(types, pools) {
  return types.map((pos, i) => {
    const player = pools[pos] && pools[pos].length ? pools[pos].shift() : null;
    return { key: pos + i, pos, player };
  });
}

export default function Pitch({ formation, starters = [], reserves = [], camisa10Id, onToggleCaptain, onRemove, showPoints, pointsOf }) {
  const shape = FORMATIONS[formation] || FORMATIONS["4-3-3"];

  const pools = { GOL: [], ZAG: [], LAT: [], MEI: [], ATA: [] };
  for (const p of starters) (pools[p.position] || (pools[p.position] = [])).push(p);

  const rows = [
    fillRow(Array(shape.ATA).fill("ATA"), pools),
    fillRow(Array(shape.MEI).fill("MEI"), pools),
    fillRow(defenseOrder(shape.ZAG, shape.LAT), pools),
    fillRow(["GOL"], pools),
  ];

  const resPools = { GOL: [], ZAG: [], LAT: [], MEI: [], ATA: [] };
  for (const p of reserves) (resPools[p.position] || (resPools[p.position] = [])).push(p);
  const benchSlots = fillRow(["GOL", "ZAG", "LAT", "MEI", "ATA"], resPools);

  return (
    <div className="space-y-2">
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-emerald-900/20 shadow-card"
        style={{ aspectRatio: "3 / 4", background: "linear-gradient(180deg,#137a43,#0f6e3b)" }}
      >
        <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/25" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/25" />
        <div className="pointer-events-none absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t border-white/20" />

        <div className="relative flex h-full flex-col justify-around py-3">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center justify-evenly px-2">
              {row.map((slot) => (
                <Slot key={slot.key} slot={slot} camisa10Id={camisa10Id} onToggleCaptain={onToggleCaptain} onRemove={onRemove} showPoints={showPoints} pointsOf={pointsOf} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-2">
        <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">Reservas</div>
        <div className="flex items-start justify-between gap-1">
          {benchSlots.map((slot) => (
            <Slot key={slot.key} slot={slot} camisa10Id={camisa10Id} onToggleCaptain={onToggleCaptain} onRemove={onRemove} showPoints={showPoints} pointsOf={pointsOf} dark />
          ))}
        </div>
      </div>
    </div>
  );
}

function Slot({ slot, camisa10Id, onToggleCaptain, onRemove, showPoints, pointsOf, dark }) {
  const { pos, player } = slot;
  if (!player) {
    return (
      <div className="flex w-14 flex-col items-center gap-1 sm:w-16">
        <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed text-[10px] font-semibold ${dark ? "border-[var(--border)] text-[var(--faint)]" : "border-white/40 text-white/60"}`}>
          {pos}
        </span>
        <span className={`text-[10px] ${dark ? "text-[var(--faint)]" : "text-white/50"}`}>{POSITION_LABELS[pos]}</span>
      </div>
    );
  }
  const flag = flagUrl(player.team);
  const isCap = camisa10Id === player.id;
  return (
    <div className="flex w-14 flex-col items-center gap-1 sm:w-16">
      <span className="relative">
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[var(--surface)] shadow">
          {flag ? <img src={flag} alt={player.team} className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-[var(--muted)]">{pos}</span>}
        </span>

        {/* Botão camisa 10 (ou selo estático no modo leitura) */}
        {onToggleCaptain ? (
          <button type="button" onClick={() => onToggleCaptain(player.id)} title="Definir/remover camisa 10"
            className={`absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold shadow transition ${isCap ? "bg-accent text-[var(--text)]" : "bg-black/55 text-white/80 hover:bg-black/75"}`}>
            10
          </button>
        ) : (
          isCap && <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[9px] font-extrabold text-[var(--text)] shadow">10</span>
        )}

        {/* Botão remover do time */}
        {onRemove && (
          <button type="button" onClick={() => onRemove(player.id)} title="Remover do time" aria-label="Remover do time"
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold leading-none text-white shadow transition hover:bg-red-600">
            ×
          </button>
        )}

        {/* Pontuação parcial (mercado fechado) ou preço */}
        {showPoints && pointsOf ? (
          <span className={`absolute -bottom-1.5 -right-1.5 flex h-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white shadow ${pointsOf(player) < 0 ? "bg-red-500" : "bg-brand"}`} title="Pontuação parcial">{pointsOf(player).toFixed(1)}</span>
        ) : (
          <span className="absolute -bottom-1.5 -right-1.5 flex h-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-ink shadow">{player.price}¢</span>
        )}
      </span>
      <span className={`max-w-full truncate rounded px-1 text-[10px] font-medium ${dark ? "text-[var(--muted)]" : "bg-black/40 text-white"}`}>
        {shortName(player.name)}
      </span>
    </div>
  );
}
