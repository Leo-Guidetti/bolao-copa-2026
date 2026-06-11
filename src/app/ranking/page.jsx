import { computeStandings } from "@/lib/standings";
import LeigoMaster from "@/components/LeigoMaster";

export const dynamic = "force-dynamic";

function brl(n) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const medal = ["🥇", "🥈", "🥉"];

export default async function RankingPage() {
  const { ranked, totalPot, prizes, settings } = await computeStandings();
  const wB = settings.ranking.weightBets, wS = settings.ranking.weightSquad, sumW = (wB + wS) || 1;
  const pctBets = Math.round((wB / sumW) * 100), pctSquad = Math.round((wS / sumW) * 100);
  const prizeByPlace = Object.fromEntries(prizes.map((p) => [p.place, p.amount]));

  return (
    <div className="space-y-8">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Ranking Geral</h1>
        <p className="mt-2 text-[var(--muted)]">
          Combina apostas de placar (<b>{pctBets}%</b>) e Monte sua Seleção (<b>{pctSquad}%</b>).
        </p>
      </section>

      <LeigoMaster context="ranking" />

      {/* Premiação */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Premiação</h2>
          <span className="pill bg-brand-light text-brand-dark">
            Bolo total: {brl(totalPot)}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {prizes.map((p) => (
            <div key={p.place} className="rounded-xl bg-[var(--hover)] p-4">
              <div className="text-2xl">{medal[p.place - 1] || `${p.place}º`}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{p.place}º lugar · {p.pct}%</div>
              <div className="text-xl font-semibold">{brl(p.amount)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tabela de ranking */}
      <section className="card overflow-hidden">
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
            {ranked.map((r) => (
              <tr key={r.participantId} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-semibold">
                  {medal[r.place - 1] || r.place}
                </td>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{r.betPts.toFixed(1)}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{r.squadPts.toFixed(1)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {r.final.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-brand-dark">
                  {prizeByPlace[r.place] ? brl(prizeByPlace[r.place]) : "—"}
                </td>
              </tr>
            ))}
            {ranked.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--muted)]">
                  Nenhum participante ainda. Cadastre no painel de Admin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <p className="text-center text-xs text-[var(--faint)]">
        Pontuação final = % do líder em cada etapa: placar vale {pctBets}% e seleção {pctSquad}% (pesos editáveis no Admin).
      </p>
    </div>
  );
}
