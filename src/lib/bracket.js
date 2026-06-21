// Estrutura oficial do mata-mata da Copa 2026 (48 seleções).
// As "ordens" 73..104 batem com o campo order dos jogos de mata-mata no banco.
import { THIRDS_ALLOC, THIRD_SLOT_COLS } from "./thirdsAllocation";

// R32 (jogos 73-88). Cada vaga:
//  {t:"W", g} vencedor do grupo g | {t:"R", g} vice do grupo g | {t:"3", col} 3º alocado ao slot do vencedor do grupo col.
export const R32 = [
  { no: 73, a: { t: "R", g: "A" }, b: { t: "R", g: "B" } },
  { no: 74, a: { t: "W", g: "E" }, b: { t: "3", col: "E" } },
  { no: 75, a: { t: "W", g: "F" }, b: { t: "R", g: "C" } },
  { no: 76, a: { t: "W", g: "C" }, b: { t: "R", g: "F" } },
  { no: 77, a: { t: "W", g: "I" }, b: { t: "3", col: "I" } },
  { no: 78, a: { t: "R", g: "E" }, b: { t: "R", g: "I" } },
  { no: 79, a: { t: "W", g: "A" }, b: { t: "3", col: "A" } },
  { no: 80, a: { t: "W", g: "L" }, b: { t: "3", col: "L" } },
  { no: 81, a: { t: "W", g: "D" }, b: { t: "3", col: "D" } },
  { no: 82, a: { t: "W", g: "G" }, b: { t: "3", col: "G" } },
  { no: 83, a: { t: "R", g: "K" }, b: { t: "R", g: "L" } },
  { no: 84, a: { t: "W", g: "H" }, b: { t: "R", g: "J" } },
  { no: 85, a: { t: "W", g: "B" }, b: { t: "3", col: "B" } },
  { no: 86, a: { t: "W", g: "J" }, b: { t: "R", g: "H" } },
  { no: 87, a: { t: "W", g: "K" }, b: { t: "3", col: "K" } },
  { no: 88, a: { t: "R", g: "D" }, b: { t: "R", g: "G" } },
];

// Fases seguintes: cada vaga puxa vencedor (w) ou perdedor (l) de um jogo anterior.
export const LATER = [
  { no: 89, stage: "R16", a: { w: 74 }, b: { w: 77 } },
  { no: 90, stage: "R16", a: { w: 73 }, b: { w: 75 } },
  { no: 91, stage: "R16", a: { w: 76 }, b: { w: 78 } },
  { no: 92, stage: "R16", a: { w: 79 }, b: { w: 80 } },
  { no: 93, stage: "R16", a: { w: 83 }, b: { w: 84 } },
  { no: 94, stage: "R16", a: { w: 81 }, b: { w: 82 } },
  { no: 95, stage: "R16", a: { w: 86 }, b: { w: 88 } },
  { no: 96, stage: "R16", a: { w: 85 }, b: { w: 87 } },
  { no: 97, stage: "QF", a: { w: 89 }, b: { w: 90 } },
  { no: 98, stage: "QF", a: { w: 93 }, b: { w: 94 } },
  { no: 99, stage: "QF", a: { w: 91 }, b: { w: 92 } },
  { no: 100, stage: "QF", a: { w: 95 }, b: { w: 96 } },
  { no: 101, stage: "SF", a: { w: 97 }, b: { w: 98 } },
  { no: 102, stage: "SF", a: { w: 99 }, b: { w: 100 } },
  { no: 103, stage: "THIRD", a: { l: 101 }, b: { l: 102 } },
  { no: 104, stage: "FINAL", a: { w: 101 }, b: { w: 102 } },
];

export const STAGE_NAME = { R32: "16-avos", R16: "Oitavas", QF: "Quartas", SF: "Semifinal", THIRD: "3º lugar", FINAL: "Final" };

// Recebe as letras dos 8 grupos cujos 3ºs avançaram → { col: letraDoGrupoDo3º } (Annex C).
export function thirdsByCol(groupLetters) {
  const key = [...groupLetters].sort().join("");
  const val = THIRDS_ALLOC[key];
  if (!val) return null;
  const out = {};
  THIRD_SLOT_COLS.forEach((c, i) => { out[c] = val[i]; });
  return out; // ex.: { A:"H", B:"G", ... } = no slot do 1ºA joga o 3º do grupo H
}
