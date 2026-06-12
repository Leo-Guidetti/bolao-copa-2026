// Configuração padrão editavel pelo admin.

export const POSITIONS = ["GOL", "ZAG", "LAT", "MEI", "ATA"];
export const POSITION_LABELS = { GOL: "Goleiro", ZAG: "Zagueiro", LAT: "Lateral", MEI: "Meia", ATA: "Atacante" };

// 5 niveis de preço (fibonacci), em cents
export const PRICE_TIERS = [
  { value: 1, label: "Comum" },
  { value: 2, label: "Bom" },
  { value: 3, label: "Muito bom" },
  { value: 5, label: "Fundamental" },
  { value: 8, label: "Craque" },
];

// Formacoes: contagem de titulares por posição (+1 goleiro implicito = 11)
export const FORMATIONS = {
  "4-3-3": { ZAG: 2, LAT: 2, MEI: 3, ATA: 3 },
  "4-4-2": { ZAG: 2, LAT: 2, MEI: 4, ATA: 2 },
  "3-4-3": { ZAG: 3, LAT: 0, MEI: 4, ATA: 3 },
  "3-5-2": { ZAG: 3, LAT: 0, MEI: 5, ATA: 2 },
  "4-5-1": { ZAG: 2, LAT: 2, MEI: 5, ATA: 1 },
  "5-3-2": { ZAG: 3, LAT: 2, MEI: 3, ATA: 2 },
};
export const DEFAULT_FORMATION = "4-3-3";

// Reservas: 1 de cada posição (5 no banco). Titulares 11 + reservas 5 = 16.
export const RESERVES = { GOL: 1, ZAG: 1, LAT: 1, MEI: 1, ATA: 1 };
export const SQUAD_SIZE = 16;

export const DEFAULT_SETTINGS = {
  scoring: {
    exactScore: 10, winnerGoalDiff: 7, winnerOnly: 5, teamGoalsBonus: 2, miss: 0,
    phaseMultipliers: { GROUP: 1.0, R32: 1.25, R16: 1.5, QF: 2.0, SF: 2.5, THIRD: 3.0, FINAL: 3.0 },
    zebraBonus: 0,
  },
  squadRules: {
    budgetCap: 50,
    camisa10Multiplier: 2,
    scout: {
      goal: { GOL: 12, ZAG: 12, LAT: 11, MEI: 9, ATA: 8 },
      assist: { GOL: 5, ZAG: 5, LAT: 5, MEI: 5, ATA: 5 },
      shotOnTarget: { GOL: 0, ZAG: 1, LAT: 1, MEI: 1, ATA: 1 },
      shot: { GOL: 0, ZAG: 0, LAT: 0, MEI: 0, ATA: 0 },
      tackleInterception: { GOL: 0, ZAG: 1, LAT: 1, MEI: 1, ATA: 0 },
      cleanSheet: { GOL: 5, ZAG: 5, LAT: 5, MEI: 0, ATA: 0 },
      save: { GOL: 1.5, ZAG: 0, LAT: 0, MEI: 0, ATA: 0 },
      penaltySaved: { GOL: 8, ZAG: 0, LAT: 0, MEI: 0, ATA: 0 },
      yellow: { GOL: -1, ZAG: -1, LAT: -1, MEI: -1, ATA: -1 },
      red: { GOL: -3, ZAG: -3, LAT: -3, MEI: -3, ATA: -3 },
      ownGoal: { GOL: -5, ZAG: -5, LAT: -5, MEI: -5, ATA: -5 },
      goalConceded: { GOL: -1, ZAG: 0, LAT: 0, MEI: 0, ATA: 0 },
    },
  },
  entry: { amount: 50 },
  ranking: { weightBets: 0.6, weightSquad: 0.4 },
  prize: { distribution: [ { place: 1, pct: 60 }, { place: 2, pct: 25 }, { place: 3, pct: 15 } ] },
};

export const STAGE_LABELS = {
  GROUP: "Fase de grupos", R32: "16 avos de final", R16: "Oitavas de final", QF: "Quartas de final",
  SF: "Semifinal", THIRD: "Disputa de 3º lugar", FINAL: "Final",
};
