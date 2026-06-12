import { getAllSettings } from "@/lib/config";
import { STAGE_LABELS } from "@/lib/defaults";

export const dynamic = "force-dynamic";

const POS = ["GOL", "ZAG", "LAT", "MEI", "ATA"];
const POS_LABEL = { GOL: "Goleiro", ZAG: "Zagueiro", LAT: "Lateral", MEI: "Meia", ATA: "Atacante" };

// Eventos de scout na ordem em que aparecem na tabela.
const SCOUT_ROWS = [
  { key: "goal", label: "Gol" },
  { key: "assist", label: "Assistência" },
  { key: "shotOnTarget", label: "Finalização no alvo" },
  { key: "shot", label: "Finalização (pra fora)" },
  { key: "tackleInterception", label: "Desarme / interceptação" },
  { key: "cleanSheet", label: "Não sofrer gol (jogo inteiro)" },
  { key: "save", label: "Defesa (goleiro)" },
  { key: "penaltySaved", label: "Defesa de pênalti" },
  { key: "goalConceded", label: "Gol sofrido (goleiro)" },
  { key: "yellow", label: "Cartão amarelo" },
  { key: "red", label: "Cartão vermelho" },
  { key: "ownGoal", label: "Gol contra" },
];

function Pts({ n }) {
  const v = Number(n) || 0;
  const cls = v > 0 ? "text-brand-dark" : v < 0 ? "text-red-500" : "text-[var(--faint)]";
  return <span className={`tabular-nums font-semibold ${cls}`}>{v > 0 ? `+${v}` : v}</span>;
}

export default async function RegulamentoPage() {
  const settings = await getAllSettings();
  const sc = settings.scoring;
  const sq = settings.squadRules;
  const scout = sq.scout || {};
  const cap = sq.camisa10Multiplier ?? 2;
  const budget = sq.budgetCap ?? 50;
  const wB = settings.ranking.weightBets, wS = settings.ranking.weightSquad, sum = (wB + wS) || 1;
  const pctBets = Math.round((wB / sum) * 100), pctSquad = Math.round((wS / sum) * 100);
  const phases = ["GROUP", "R32", "R16", "QF", "SF", "THIRD", "FINAL"]
    .filter((k) => sc.phaseMultipliers?.[k] != null)
    .map((k) => ({ label: STAGE_LABELS[k] || k, mult: sc.phaseMultipliers[k] }));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">📜 Regulamento</h1>
        <p className="text-sm text-[var(--muted)]">Tudo que conta ponto, com exemplos. Vale o que está aqui.</p>
      </div>

      {/* Visão geral */}
      <section className="card p-5">
        <h2 className="font-semibold">Como funciona, em 1 minuto</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          O bolão tem <b>duas disputas</b> que rolam ao mesmo tempo: você <b>palpita o placar</b> dos jogos e
          <b> monta uma seleção</b> de jogadores que pontua pelo desempenho real em campo. No fim, as duas viram um
          ranking único:
        </p>
        <div className="mt-3 rounded-xl bg-[var(--hover)] p-3 text-sm">
          <b>Pontos finais</b> = {pctBets}% dos seus pontos de placar + {pctSquad}% dos pontos da sua seleção.
          <div className="mt-1 text-xs text-[var(--faint)]">
            Ex.: 40 pts de placar e 30 pts de seleção → {(0.01 * pctBets).toFixed(2).replace(".", ",")}×40 + {(0.01 * pctSquad).toFixed(2).replace(".", ",")}×30 = <b>{(0.01 * pctBets * 40 + 0.01 * pctSquad * 30).toFixed(1).replace(".", ",")} pts</b>.
          </div>
        </div>
      </section>

      {/* Parte 1 - Apostas de placar */}
      <section className="card p-5">
        <h2 className="font-semibold">⚽ Parte 1 — Apostas de placar ({pctBets}%)</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Pra cada jogo você crava um placar (ex.: 2×1). Quando o jogo termina, você ganha:
        </p>

        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--border)]">
              <tr><td className="p-2.5">🎯 <b>Placar exato</b> (cravou os dois times)</td><td className="p-2.5 text-right"><Pts n={sc.exactScore} /></td></tr>
              <tr><td className="p-2.5">Acertou o <b>vencedor + o saldo de gols</b></td><td className="p-2.5 text-right"><Pts n={sc.winnerGoalDiff} /></td></tr>
              <tr><td className="p-2.5">Acertou <b>só o vencedor</b> (ou só que foi empate)</td><td className="p-2.5 text-right"><Pts n={sc.winnerOnly} /></td></tr>
              <tr><td className="p-2.5">Errou o resultado</td><td className="p-2.5 text-right"><Pts n={sc.miss} /></td></tr>
              <tr><td className="p-2.5">➕ <b>Bônus:</b> cravou os gols de <b>um</b> dos times (mesmo errando o resultado)</td><td className="p-2.5 text-right"><Pts n={sc.teamGoalsBonus} /></td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--faint)]">
          O bônus de cravar os gols de um time soma em cima das outras faixas, <b>menos</b> no placar exato (que já é o máximo).
          Previu empate e o jogo terminou empatado, mas com placar diferente? Vale como “só o vencedor” ({sc.winnerOnly} pts) —
          saldo de empate é sempre 0.
        </p>

        <h3 className="mt-4 text-sm font-semibold">Exemplos — jogo real: Brasil 2×1 Marrocos</h3>
        <div className="mt-2 space-y-1.5 text-sm">
          {[
            ["Você cravou 2×1", `Placar exato → ${sc.exactScore} pts`],
            ["Você palpitou 1×0", `Acertou vencedor e saldo (+1) → ${sc.winnerGoalDiff} pts`],
            ["Você palpitou 2×0", `Só o vencedor (${sc.winnerOnly}) + cravou os 2 gols do Brasil (+${sc.teamGoalsBonus}) → ${sc.winnerOnly + sc.teamGoalsBonus} pts`],
            ["Você palpitou 1×1", `Errou o resultado (${sc.miss}), mas cravou o 1 do Marrocos (+${sc.teamGoalsBonus}) → ${sc.miss + sc.teamGoalsBonus} pts`],
            ["Você palpitou 0×2", `Errou tudo → ${sc.miss} pts`],
          ].map(([a, b], i) => (
            <div key={i} className="flex gap-2 rounded-lg bg-[var(--hover)] p-2">
              <span className="shrink-0 font-medium">{a}:</span>
              <span className="text-[var(--muted)]">{b}</span>
            </div>
          ))}
        </div>

        <h3 className="mt-4 text-sm font-semibold">Multiplicador por fase</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">Quanto mais decisivo o jogo, mais valem os pontos de placar (o multiplicador incide sobre o total acima):</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {phases.map((p) => (
            <span key={p.label} className="pill bg-brand-light text-brand-dark">{p.label}: {String(p.mult).replace(".", ",")}×</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--faint)]">Ex.: placar exato na final = {sc.exactScore} × {String(sc.phaseMultipliers?.FINAL ?? 1).replace(".", ",")} = <b>{(sc.exactScore * (sc.phaseMultipliers?.FINAL ?? 1)).toFixed(0)} pts</b>. Cada palpite trava quando a bola rola — depois disso não dá mais pra editar.</p>
      </section>

      {/* Parte 2 - Minha seleção */}
      <section className="card p-5">
        <h2 className="font-semibold">🌟 Parte 2 — Minha seleção ({pctSquad}%)</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Monte um time de <b>11 titulares + 5 reservas</b> gastando no máximo <b>{budget}¢</b> (cada jogador custa de 1 a 8¢
          conforme o nível). Escolha a formação e marque seu <b>camisa 10</b>, que pontua <b>em dobro ({cap}×)</b>.
          Cada jogador soma (ou perde) pontos pelo que faz em campo, de acordo com a posição:
        </p>

        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="bg-[var(--hover)] text-xs text-[var(--muted)]">
                <th className="p-2 text-left font-semibold">O que conta</th>
                {POS.map((p) => <th key={p} className="p-2 text-center font-semibold" title={POS_LABEL[p]}>{p}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {SCOUT_ROWS.map((row) => {
                const vals = POS.map((p) => scout[row.key]?.[p] ?? 0);
                if (vals.every((v) => v === 0)) return null;
                return (
                  <tr key={row.key}>
                    <td className="p-2">{row.label}</td>
                    {vals.map((v, i) => (
                      <td key={i} className="p-2 text-center">{v === 0 ? <span className="text-[var(--faint)]">—</span> : <Pts n={v} />}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--faint)]">GOL = goleiro · ZAG = zagueiro · LAT = lateral · MEI = meia · ATA = atacante. “—” quer dizer que aquela jogada não pontua pra essa posição.</p>

        <h3 className="mt-4 text-sm font-semibold">Exemplos de pontuação no jogo</h3>
        <div className="mt-2 space-y-1.5 text-sm">
          {[
            ["Atacante", `1 gol + 2 finalizações no alvo = 1×${scout.goal?.ATA ?? 0} + 2×${scout.shotOnTarget?.ATA ?? 0} = ${(scout.goal?.ATA ?? 0) + 2 * (scout.shotOnTarget?.ATA ?? 0)} pts`],
            ["…se for seu camisa 10", `dobra: ${((scout.goal?.ATA ?? 0) + 2 * (scout.shotOnTarget?.ATA ?? 0)) * cap} pts`],
            ["Zagueiro", `não sofreu gol + 3 desarmes/interceptações + 1 amarelo = ${scout.cleanSheet?.ZAG ?? 0} + 3×${scout.tackleInterception?.ZAG ?? 0} + (${scout.yellow?.ZAG ?? 0}) = ${(scout.cleanSheet?.ZAG ?? 0) + 3 * (scout.tackleInterception?.ZAG ?? 0) + (scout.yellow?.ZAG ?? 0)} pts`],
            ["Goleiro (clean sheet)", `não sofreu gol + 4 defesas + 1 pênalti defendido = ${scout.cleanSheet?.GOL ?? 0} + 4×${scout.save?.GOL ?? 0} + ${scout.penaltySaved?.GOL ?? 0} = ${(scout.cleanSheet?.GOL ?? 0) + 4 * (scout.save?.GOL ?? 0) + (scout.penaltySaved?.GOL ?? 0)} pts`],
            ["Goleiro (levou gols)", `5 defesas, sofreu 2 gols = 5×${scout.save?.GOL ?? 0} + 2×(${scout.goalConceded?.GOL ?? 0}) = ${5 * (scout.save?.GOL ?? 0) + 2 * (scout.goalConceded?.GOL ?? 0)} pts`],
          ].map(([a, b], i) => (
            <div key={i} className="flex gap-2 rounded-lg bg-[var(--hover)] p-2">
              <span className="shrink-0 font-medium">{a}:</span>
              <span className="text-[var(--muted)]">{b}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--faint)]">
          Só pontuam os jogadores que <b>entraram em campo</b>. A seleção é editável até <b>30 min antes</b> da primeira partida da rodada.
          Se o time passar do orçamento de {budget}¢, ele <b>não pontua</b> até você ajustar.
        </p>
      </section>

      {/* Ranking & premiação */}
      <section className="card p-5">
        <h2 className="font-semibold">🏆 Ranking & premiação</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          O ranking soma as duas partes ({pctBets}% placar + {pctSquad}% seleção). O bolo de prêmios é dividido assim:
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(settings.prize?.distribution || []).slice().sort((a, b) => a.place - b.place).map((d) => (
            <span key={d.place} className="pill bg-brand-light text-brand-dark">{d.place}º lugar — {d.pct}% do bolo</span>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--faint)]">
          O valor da entrada (cash-in) é de {(settings.entry?.amount ?? 50).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} por participante e todo mundo entra no bolo.
          Em caso de empate de pontos, vale o resultado mais recente atualizado no app.
        </p>
        <a href="/apostas" className="btn-primary mt-4 inline-block">Bora palpitar →</a>
      </section>
    </div>
  );
}
