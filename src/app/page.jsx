import { currentParticipant } from "@/lib/session";
import { computeStandings } from "@/lib/standings";
import { prisma } from "@/lib/prisma";
import { flagUrl } from "@/lib/flags";
import { STAGE_LABELS } from "@/lib/defaults";
import Pitch from "@/components/Pitch";
import LeigoMaster from "@/components/LeigoMaster";

export const dynamic = "force-dynamic";

const brl = (n) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const medal = ["🥇", "🥈", "🥉"];

export default async function HomePage() {
  const me = await currentParticipant();
  if (!me) {
    return (
      <div className="mx-auto mt-10 max-w-sm card space-y-3 p-6 text-center">
        <div className="text-3xl">🏆</div>
        <h1 className="text-xl font-semibold">Leigos da Bola</h1>
        <p className="text-[var(--muted)]">Entre para ver seu painel.</p>
        <a className="btn-primary" href="/login">Entrar</a>
        <a className="text-sm text-brand" href="/ranking">Ver ranking geral</a>
      </div>
    );
  }

  const { ranked, prizes, totalPot, settings } = await computeStandings();
  const cashIn = settings.entry?.amount ?? 50;
  const sc = settings.scoring, sq = settings.squadRules;
  const paidCount = ranked.filter((r) => r.paid).length;
  const phaseList = ["GROUP", "R32", "R16", "QF", "SF", "FINAL"].map((k) => `${STAGE_LABELS[k]} ${sc.phaseMultipliers[k]}\u00d7`).join(" \u00b7 ");
  const wB = settings.ranking.weightBets, wS = settings.ranking.weightSquad, sumW = (wB + wS) || 1;
  const pctBets = Math.round((wB / sumW) * 100), pctSquad = Math.round((wS / sumW) * 100);
  const N = prizes.length;
  const myRow = ranked.find((r) => r.participantId === me.id) || { place: ranked.length || 1, betPts: 0, squadPts: 0, final: 0 };
  const total = ranked.length;
  const inPrize = myRow.place <= N;
  const cut = ranked[N - 1];
  const ahead = myRow.place > 1 ? ranked[myRow.place - 2] : null;
  const gapToCut = cut ? Math.max(0, cut.final - myRow.final) : 0;
  const gapToAhead = ahead ? Math.max(0, ahead.final - myRow.final) : 0;
  const prizeByPlace = Object.fromEntries(prizes.map((p) => [p.place, p.amount]));

  const squad = await prisma.squad.findUnique({
    where: { participantId: me.id },
    include: { players: { include: { player: true } } },
  });
  const starters = squad ? squad.players.filter((p) => p.isStarter).map((p) => p.player) : [];
  const reserves = squad ? squad.players.filter((p) => !p.isStarter).map((p) => p.player) : [];
  const cap = squad?.captainId ? (squad.players.find((p) => p.playerId === squad.captainId)?.player) : null;
  const budgetCap = settings.squadRules?.budgetCap ?? 50;
  const squadCost = squad ? squad.players.reduce((s, sp) => s + (sp.player?.price || 0), 0) : 0;
  const squadOver = !!squad && squadCost > budgetCap;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Olá, {me.name} 👋</h1>
        <p className="text-sm text-[var(--muted)]">Seu resumo no bolão.</p>
      </div>

      <LeigoMaster />

      {squadOver && (
        <div className="card border-l-4 border-l-red-500 bg-red-50 p-4 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <h2 className="font-bold text-red-700 dark:text-red-300">Sua seleção está acima do orçamento!</h2>
              <p className="mt-1 text-sm text-[var(--text)]">Ela custa <b>{squadCost}¢</b> e o teto é <b>{budgetCap}¢</b>. Enquanto estiver assim, <b>ela não pontua</b> no ranking. Edite o time e remova jogadores pra voltar ao limite.</p>
              <a href="/selecao" className="btn-primary mt-2 inline-block">Ajustar minha seleção →</a>
            </div>
          </div>
        </div>
      )}

      {!me.paid && (
        <div className="card border-l-4 border-l-amber-500 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💸</span>
            <div>
              <h2 className="font-semibold">Psiu, {me.name}… faltou combinar o PIX!</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Você ainda não consta como <b>pago</b>. Acerta os <b>{brl(cashIn)}</b> com o organizador pra garantir seu lugar no bolo de <b>{brl(totalPot)}</b>. Prometemos não te zoar no grupo… por enquanto. 😏</p>
            </div>
          </div>
        </div>
      )}

      {/* Cartões de resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs text-[var(--muted)]">Sua posição</div>
          <div className="mt-1 text-2xl font-bold">{medal[myRow.place - 1] || `${myRow.place}º`}</div>
          <div className="text-xs text-[var(--faint)]">de {total} {total === 1 ? "jogador" : "jogadores"}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--muted)]">Pontos (total)</div>
          <div className="mt-1 text-2xl font-bold">{myRow.final.toFixed(1)}</div>
          <div className="text-xs text-[var(--faint)]">{pctBets}% placar + {pctSquad}% seleção</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--muted)]">Apostas</div>
          <div className="mt-1 text-2xl font-bold">{myRow.betPts.toFixed(1)}</div>
          <div className="text-xs text-[var(--faint)]">vale {pctBets}% do ranking</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--muted)]">Seleção</div>
          <div className="mt-1 text-2xl font-bold">{myRow.squadPts.toFixed(1)}</div>
          <div className="text-xs text-[var(--faint)]">vale {pctSquad}% do ranking</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Premiação + distância */}
        <section className="card p-5">
          <h2 className="font-semibold">Zona de premiação</h2>
          <div className={`mt-2 rounded-xl p-3 text-sm ${inPrize ? "bg-brand-light text-brand-dark" : "bg-[var(--hover)] text-[var(--text)]"}`}>
            {inPrize ? (
              <>Você está <b>premiado</b> em {myRow.place}º {prizeByPlace[myRow.place] ? `(${brl(prizeByPlace[myRow.place])})` : ""}! Segura aí. 🏅</>
            ) : cut ? (
              <>Faltam <b>{gapToCut.toFixed(1)} pts</b> para entrar na zona de premiação (passar o {N}º).{ahead ? <> A {gapToAhead.toFixed(1)} pt(s) do {myRow.place - 1}º (<b>{ahead.name}</b>).</> : null}</>
            ) : (
              <>Ainda sem premiação definida.</>
            )}
          </div>
          <div className="mt-3 divide-y divide-[var(--border)]">
            {prizes.map((pz) => {
              const r = ranked[pz.place - 1];
              const isMe = r && r.participantId === me.id;
              return (
                <div key={pz.place} className={`flex items-center gap-2 py-2 ${isMe ? "font-semibold text-brand-dark" : ""}`}>
                  <span className="w-7 text-lg">{medal[pz.place - 1] || `${pz.place}º`}</span>
                  <span className="flex-1 truncate">{r ? r.name : "—"} {isMe && <span className="pill bg-brand-light text-brand-dark">você</span>}</span>
                  <span className="tabular-nums text-[var(--muted)]">{r ? r.final.toFixed(1) : "—"} pts</span>
                  <span className="w-24 text-right tabular-nums text-brand-dark">{brl(pz.amount)}</span>
                </div>
              );
            })}
          </div>
          <a href="/ranking" className="mt-3 inline-block text-sm text-brand">Ver ranking completo →</a>
        </section>

        {/* Seleção do jogador */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Sua seleção</h2>
            <span className="pill bg-[var(--hover)] text-[var(--muted)]">{myRow.squadPts.toFixed(1)} pts</span>
          </div>
          {squad ? (
            <>
              {cap && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-accent/15 p-2 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-ink">10</span>
                  {flagUrl(cap.team) && <img src={flagUrl(cap.team)} alt={cap.team} className="h-4 w-6 rounded-sm object-cover" />}
                  <span><b>{cap.name}</b> <span className="text-[var(--muted)]">— seu camisa 10 (dobra os pontos)</span></span>
                </div>
              )}
              <div className="mt-3 max-w-[320px]">
                <Pitch formation={squad.formation || "4-3-3"} starters={starters} reserves={reserves} camisa10Id={squad.captainId} />
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-xl bg-[var(--hover)] p-4 text-center text-sm text-[var(--muted)]">
              Você ainda não montou sua seleção. <a href="/selecao" className="text-brand">Montar agora →</a>
            </div>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Como funciona o bolão</h2>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[var(--hover)] p-3"><div className="text-xs text-[var(--muted)]">Cash-in</div><div className="text-lg font-bold">{brl(cashIn)}</div></div>
          <div className="rounded-xl bg-[var(--hover)] p-3"><div className="text-xs text-[var(--muted)]">Bolo total</div><div className="text-lg font-bold">{brl(totalPot)}</div></div>
          <div className="rounded-xl bg-[var(--hover)] p-3"><div className="text-xs text-[var(--muted)]">Participantes</div><div className="text-lg font-bold">{total}</div></div>
          <div className="rounded-xl bg-[var(--hover)] p-3"><div className="text-xs text-[var(--muted)]">Pagaram</div><div className="text-lg font-bold">{paidCount}/{total}</div></div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">⚽ Apostas de placar ({pctBets}%)</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Palpite o placar de cada jogo. Pontos: <b>{sc.exactScore}</b> no placar exato, <b>{sc.winnerGoalDiff}</b> acertando vencedor + saldo de gols, <b>{sc.winnerOnly}</b> só o vencedor (0 se errar), e <b>+{sc.teamGoalsBonus}</b> extra por cravar a quantidade de gols de um dos times — vale até errando o resultado, mas não soma no placar exato (que já é o máximo). Cada palpite trava quando a bola rola.</p>
            <p className="mt-1 text-xs text-[var(--faint)]">Multiplicador por fase: {phaseList}.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">🌟 Minha seleção ({pctSquad}%)</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Monte um time de 11 titulares + 5 reservas com até <b>{sq.budgetCap}¢</b> de orçamento (preços 1/2/3/5/8). Cada jogador pontua pelo desempenho real (gol, assistência, defesa, desarme/interceptação, cartões…). O <b>camisa 10</b> pontua em dobro ({sq.camisa10Multiplier}×). Editável até 30 min antes da estreia.</p>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-semibold">🏆 Ranking & premiação</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">O ranking final combina as duas partes: <b>{pctBets}%</b> das apostas + <b>{pctSquad}%</b> da seleção (cada etapa é normalizada pelo líder). Divisão do bolo:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {prizes.map((pz) => (
              <span key={pz.place} className="pill bg-brand-light text-brand-dark">{pz.place}º — {pz.pct}% ({brl(pz.amount)})</span>
            ))}
          </div>
        </div>

        <a href="/ranking" className="mt-3 inline-block text-sm text-brand">Ver ranking completo →</a>
      </section>
    </div>
  );
}
