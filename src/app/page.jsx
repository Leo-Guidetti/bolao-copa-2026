import { currentParticipant } from "@/lib/session";
import { computeStandings } from "@/lib/standings";
import { prisma } from "@/lib/prisma";
import { flagUrl, teamAbbr } from "@/lib/flags";
import { STAGE_LABELS } from "@/lib/defaults";
import { playerScore, scoreBreakdown } from "@/lib/scoring";
import MatchCalendar from "@/components/MatchCalendar";
import ScoredPitch from "@/components/ScoredPitch";
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

  // Craque do dia: melhor jogador (por pontos no jogo) dos jogos de ONTEM.
  // Dia "lógico" do jogo: madrugada até 4h (BRT) conta como o dia anterior.
  const dayOf = (d) => new Date(new Date(d).getTime() - 4 * 3600 * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const ydStr = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const allMatches = await prisma.match.findMany({ where: { finished: true } });
  const ydMatchIds = allMatches.filter((m) => dayOf(m.kickoff) === ydStr).map((m) => m.id);
  let craque = null;
  if (ydMatchIds.length) {
    const stats = await prisma.matchPlayerStat.findMany({ where: { matchId: { in: ydMatchIds } }, include: { player: true, match: true } });
    for (const s of stats) {
      const pts = playerScore({ ...s, position: s.player.position }, sq.scout);
      if (!craque || pts > craque.pts) craque = { s, pts, player: s.player, match: s.match };
    }
  }
  if (craque && craque.pts <= 0) craque = null;
  const craqueBreak = craque ? scoreBreakdown({ ...craque.s, position: craque.player.position }, sq.scout) : [];

  // Palpites faltando nos próximos 3 dias (jogos que ainda não começaram e sem aposta minha)
  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 86400000);
  const upcoming = await prisma.match.findMany({
    where: { kickoff: { gt: now, lte: in3d }, finished: false },
    orderBy: { kickoff: "asc" },
  });
  const myBets = upcoming.length
    ? await prisma.bet.findMany({ where: { participantId: me.id, matchId: { in: upcoming.map((m) => m.id) } }, select: { matchId: true } })
    : [];
  const betSet = new Set(myBets.map((b) => b.matchId));
  const missing = upcoming.filter((m) => !betSet.has(m.id));
  const spDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const todayStr = spDay(now), tmrwStr = spDay(new Date(now.getTime() + 86400000));
  const fmtMatch = (m) => {
    const ds = spDay(m.kickoff);
    const dl = ds === todayStr ? "hoje" : ds === tmrwStr ? "amanhã" : new Date(m.kickoff).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short" }).replace(".", "");
    const t = new Date(m.kickoff).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    return `${teamAbbr(m.homeTeam)} × ${teamAbbr(m.awayTeam)} (${dl} ${t})`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Olá, {me.name} 👋</h1>
        <p className="text-sm text-[var(--muted)]">Seu resumo no bolão.</p>
      </div>

      {/* 1. Atalho pro bolão + status dos palpites dos próximos 3 dias */}
      <a href="/apostas" className={`card block border-l-4 p-4 transition hover:bg-[var(--hover)] ${missing.length ? "border-l-amber-500" : "border-l-brand"}`}>
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-2xl">{missing.length ? "📝" : "✅"}</span>
          <div className="min-w-0 flex-1">
            {missing.length ? (
              <>
                <h2 className="font-semibold">Você tem {missing.length} palpite{missing.length > 1 ? "s" : ""} faltando</h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  Próximos 3 dias: {missing.slice(0, 4).map(fmtMatch).join(" · ")}{missing.length > 4 ? ` · +${missing.length - 4}` : ""}
                </p>
              </>
            ) : (
              <>
                <h2 className="font-semibold">Palpites em dia! 🎉</h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  {upcoming.length ? `Seus ${upcoming.length} jogo${upcoming.length > 1 ? "s" : ""} dos próximos 3 dias já estão palpitados.` : "Sem jogos nos próximos 3 dias — relaxa e aproveita."}
                </p>
              </>
            )}
          </div>
          <span className="shrink-0 self-center whitespace-nowrap font-semibold text-brand">Palpitar →</span>
        </div>
      </a>

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

      {/* 2. Big numbers — seus stats */}
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

      {/* 3. Craque do dia */}
      {craque && (
        <section className="card border-l-4 border-l-accent p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⭐</span>
            <h2 className="font-semibold">Craque do dia</h2>
            <span className="text-xs text-[var(--faint)]">melhor dos jogos de ontem</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hover)]">
              {flagUrl(craque.player.team) ? <img src={flagUrl(craque.player.team)} alt={craque.player.team} className="h-full w-full object-cover" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{craque.player.name}</div>
              <div className="truncate text-xs text-[var(--faint)]">{craque.player.position} · {craque.player.team} · {craque.match.homeTeam} {craque.match.homeScore}×{craque.match.awayScore} {craque.match.awayTeam}</div>
            </div>
            <div className="shrink-0 text-2xl font-bold text-brand-dark">{Number(craque.pts.toFixed(1))}<span className="text-sm font-normal text-[var(--muted)]"> pts</span></div>
          </div>
          {craqueBreak.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {craqueBreak.map((b) => (
                <span key={b.key} className={`pill text-xs ${b.points < 0 ? "bg-red-500/15 text-red-600" : "bg-brand-light text-brand-dark"}`}>{b.label}: {b.count}×{b.weight} = {Number(b.points.toFixed(1))}</span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4. Zona de premiação */}
      <section className="card p-5">
        <h2 className="font-semibold">Zona de premiação</h2>
        <div className={`mt-2 rounded-xl p-3 text-sm ${inPrize ? "bg-brand-light text-brand-dark" : "bg-[var(--hover)] text-[var(--text)]"}`}>
          {inPrize ? (
            <>Você está <b>premiado</b> em {myRow.place}º {prizeByPlace[myRow.place] ? `(${brl(prizeByPlace[myRow.place])})` : ""}! Segura aí. 🏅</>
          ) : cut ? (
            <>Faltam <b>{gapToCut.toFixed(1)} pts</b> para entrar na zona de premiação (passar o {N}º).</>
          ) : (
            <>Ainda sem premiação definida.</>
          )}
        </div>
        <div className="mt-3 divide-y divide-[var(--border)]">
          {prizes.map((pz) => {
            const r = ranked[pz.place - 1];
            const isMe = r && r.participantId === me.id;
            const above = pz.place > 1 ? ranked[pz.place - 2] : null;
            const gap = above && r ? above.final - r.final : null;
            return (
              <div key={pz.place} className={`flex items-center gap-2 py-2 ${isMe ? "font-semibold text-brand-dark" : ""}`}>
                <span className="w-7 text-lg">{medal[pz.place - 1] || `${pz.place}º`}</span>
                <span className="flex-1 truncate">{r ? r.name : "—"} {isMe && <span className="pill bg-brand-light text-brand-dark">você</span>}</span>
                <span className="tabular-nums text-[var(--muted)]">{r ? r.final.toFixed(1) : "—"} pts{gap != null && <span className="ml-1 text-[10px] font-normal text-[var(--faint)]">({gap === 0 ? "=" : `-${gap.toFixed(1)}`})</span>}</span>
                <span className="w-24 text-right tabular-nums text-brand-dark">{brl(pz.amount)}</span>
              </div>
            );
          })}
        </div>
        <a href="/ranking" className="mt-3 inline-block text-sm text-brand">Ver ranking completo →</a>
      </section>

      {/* 5. Leigo Master */}
      <LeigoMaster />

      {/* 6. Sua seleção */}
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
              <ScoredPitch formation={squad.formation || "4-3-3"} starters={starters} reserves={reserves} captainId={squad.captainId} scout={sq.scout} capMult={sq.camisa10Multiplier ?? 2} />
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-xl bg-[var(--hover)] p-4 text-center text-sm text-[var(--muted)]">
            Você ainda não montou sua seleção. <a href="/selecao" className="text-brand">Montar agora →</a>
          </div>
        )}
      </section>

      {/* 7. Calendário */}
      <MatchCalendar />
    </div>
  );
}
