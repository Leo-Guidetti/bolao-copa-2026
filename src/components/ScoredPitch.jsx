"use client";

import { useState } from "react";
import Pitch from "@/components/Pitch";
import PlayerStats from "@/components/PlayerStats";
import { playerScore } from "@/lib/scoring";

// Wrapper client do Pitch: mostra pontuação parcial (camisa 10 dobrado) e abre o
// detalhamento de pontos ao clicar no jogador. Usado em server components (ex.: Home).
// subbedInIds: jogadores que entraram na troca do mata-mata (só pontuam no mata-mata → 0 por enquanto).
// subbedOut: jogadores que saíram (mostrados numa camada à parte, com os pontos da fase de grupos).
export default function ScoredPitch({ formation, starters = [], reserves = [], captainId, scout = {}, capMult = 2, subbedInIds = [], subbedOut = [] }) {
  const [detail, setDetail] = useState(null);
  const subInSet = new Set(subbedInIds);
  // Pontos cientes da troca do mata-mata: entrou = só KO (koPts); saiu = só grupos (total−koPts); ficou = tudo.
  const pointsOf = (pl) => {
    const total = playerScore(pl, scout);
    const ko = pl.koPts || 0;
    const base = subInSet.has(pl.id) ? ko : subbedOut.some((x) => x.id === pl.id) ? total - ko : total;
    return base * (pl.id === captainId ? capMult : 1);
  };
  return (
    <>
      <Pitch formation={formation} starters={starters} reserves={reserves} camisa10Id={captainId} capMult={capMult} showPoints pointsOf={pointsOf} onPlayer={setDetail} subbedInIds={subbedInIds} subbedOut={subbedOut} />
      {detail && <PlayerStats player={detail} scout={scout} capMult={capMult} isCaptain={detail.id === captainId} onClose={() => setDetail(null)} />}
    </>
  );
}
