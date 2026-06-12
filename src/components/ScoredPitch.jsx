"use client";

import Pitch from "@/components/Pitch";
import { playerScore } from "@/lib/scoring";

// Wrapper client do Pitch que já mostra a pontuação parcial (com camisa 10 dobrado).
// Usado em server components (ex.: Home), onde não dá pra passar a função pointsOf direto.
export default function ScoredPitch({ formation, starters = [], reserves = [], captainId, scout = {}, capMult = 2 }) {
  const pointsOf = (pl) => playerScore(pl, scout) * (pl.id === captainId ? capMult : 1);
  return (
    <Pitch formation={formation} starters={starters} reserves={reserves} camisa10Id={captainId} capMult={capMult} showPoints pointsOf={pointsOf} />
  );
}
