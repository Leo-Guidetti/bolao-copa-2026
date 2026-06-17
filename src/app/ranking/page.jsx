import { computeStandings } from "@/lib/standings";
import { currentParticipant } from "@/lib/session";
import LeigoMaster from "@/components/LeigoMaster";
import RankingTable from "@/components/RankingTable";

export const dynamic = "force-dynamic";

function brl(n) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const medal = ["🥇", "🥈", "🥉"];

export default async function RankingPage() {
  const { ranked, totalPot, prizes, settings } = await computeStandings();
  const me = await currentParticipant();
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
        <RankingTable ranked={ranked} prizeByPlace={prizeByPlace} wB={wB} wS={wS} pctBets={pctBets} pctSquad={pctSquad} meId={me?.id} />
      </section>

      <p className="text-center text-xs text-[var(--faint)]">
        Toque num participante para ver a composição dos pontos. Final = placar ({pctBets}%) + seleção ({pctSquad}%), pesos editáveis no Admin.
      </p>
    </div>
  );
}
