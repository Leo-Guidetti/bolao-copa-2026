"use client";

import { useState } from "react";
import Pitch from "@/components/Pitch";
import PlayerStats from "@/components/PlayerStats";
import { playerScore } from "@/lib/scoring";

// Wrapper client do Pitch: mostra pontuação parcial (camisa 10 dobrado) e abre o
// detalhamento de pontos ao clicar no jogador. Usado em server components (ex.: Home).
export default function ScoredPitch({ formation, starters = [], reserves = [], captainId, scout = {}, capMult = 2 }) {
  const [detail, setDetail] = useState(null);
  const pointsOf = (pl) => playerScore(pl, scout) * (pl.id === captainId ? capMult : 1);
  return (
    <>
      <Pitch formation={formation} starters={starters} reserves={reserves} camisa10Id={captainId} capMult={capMult} showPoints pointsOf={pointsOf} onPlayer={setDetail} />
      {detail && <PlayerStats player={detail} scout={scout} capMult={capMult} isCaptain={detail.id === captainId} onClose={() => setDetail(null)} />}
    </>
  );
}
