// Onde cada jogo da Copa 2026 vai passar no Brasil (por confronto).
// Fonte: guia de transmissão Goal.com (fase de grupos). CazéTV (YouTube) tem TODOS os 104 jogos.
// Chave: par de seleções (ordem indiferente). Nomes internos = chaves de flags.js.

export const CHANNELS = {
  CAZE: { label: "CazéTV", type: "stream" },
  GLOBO: { label: "Globo", type: "aberta" },
  SBT: { label: "SBT", type: "aberta" },
  SPORTV: { label: "SporTV", type: "fechada" },
  GLOBOPLAY: { label: "Globoplay", type: "stream" },
  GETV: { label: "ge tv", type: "stream" },
  NSPORTS: { label: "N Sports", type: "stream" },
};

const ALL = ["GLOBO", "SBT", "GETV", "GLOBOPLAY", "NSPORTS", "SPORTV", "CAZE"]; // jogo "aberto" completo
const PKG = ["GLOBO", "GLOBOPLAY", "SPORTV", "CAZE"]; // pacote Globo
const PKGGE = ["GLOBO", "GETV", "GLOBOPLAY", "SPORTV", "CAZE"]; // pacote Globo + ge tv
const CAZE = ["CAZE"]; // só CazéTV

// [casa, fora, canais]
const RAW = [
  // 1ª rodada
  ["Mexico", "Africa do Sul", ALL], ["Coreia do Sul", "Republica Tcheca", CAZE],
  ["Canada", "Bosnia", CAZE], ["Estados Unidos", "Paraguai", ALL],
  ["Catar", "Suica", CAZE], ["Brasil", "Marrocos", ALL], ["Haiti", "Escocia", CAZE],
  ["Australia", "Turquia", PKGGE], ["Alemanha", "Curacao", PKGGE], ["Holanda", "Japao", ALL],
  ["Costa do Marfim", "Equador", PKG], ["Suecia", "Tunisia", PKG],
  ["Espanha", "Cabo Verde", CAZE], ["Belgica", "Egito", PKGGE],
  ["Arabia Saudita", "Uruguai", ["GLOBO", "GLOBOPLAY", "SPORTV", "CAZE", "SBT", "NSPORTS"]],
  ["Ira", "Nova Zelandia", CAZE], ["Franca", "Senegal", ALL], ["Iraque", "Noruega", CAZE],
  ["Argentina", "Argelia", CAZE], ["Austria", "Jordania", PKG],
  ["Portugal", "RD Congo", CAZE], ["Inglaterra", "Croacia", ALL],
  ["Gana", "Panama", CAZE], ["Uzbequistao", "Colombia", PKG],
  // 2ª rodada
  ["Republica Tcheca", "Africa do Sul", CAZE], ["Suica", "Bosnia", ALL],
  ["Canada", "Catar", CAZE], ["Mexico", "Coreia do Sul", PKG],
  ["Estados Unidos", "Australia", CAZE], ["Escocia", "Marrocos", CAZE],
  ["Brasil", "Haiti", ALL], ["Turquia", "Paraguai", PKG], ["Holanda", "Suecia", CAZE],
  ["Alemanha", "Costa do Marfim", ALL], ["Equador", "Curacao", CAZE], ["Tunisia", "Japao", PKG],
  ["Espanha", "Arabia Saudita", CAZE], ["Belgica", "Ira", CAZE], ["Uruguai", "Cabo Verde", ALL],
  ["Nova Zelandia", "Egito", PKG], ["Argentina", "Austria", ALL], ["Franca", "Iraque", CAZE],
  ["Noruega", "Senegal", PKG], ["Jordania", "Argelia", PKG], ["Portugal", "Uzbequistao", CAZE],
  ["Inglaterra", "Gana", ALL], ["Panama", "Croacia", CAZE], ["Colombia", "RD Congo", PKG],
  // 3ª rodada
  ["Suica", "Canada", CAZE], ["Bosnia", "Catar", CAZE], ["Escocia", "Brasil", ALL],
  ["Marrocos", "Haiti", CAZE], ["Republica Tcheca", "Mexico", CAZE], ["Africa do Sul", "Coreia do Sul", CAZE],
  ["Curacao", "Costa do Marfim", CAZE], ["Equador", "Alemanha", CAZE], ["Japao", "Suecia", CAZE],
  ["Tunisia", "Holanda", CAZE], ["Turquia", "Estados Unidos", CAZE], ["Paraguai", "Australia", CAZE],
  ["Noruega", "Franca", CAZE], ["Senegal", "Iraque", CAZE], ["Cabo Verde", "Arabia Saudita", CAZE],
  ["Uruguai", "Espanha", CAZE], ["Egito", "Ira", CAZE], ["Nova Zelandia", "Belgica", CAZE],
  ["Panama", "Inglaterra", CAZE], ["Croacia", "Gana", CAZE], ["Colombia", "Portugal", CAZE],
  ["RD Congo", "Uzbequistao", CAZE], ["Argelia", "Austria", CAZE], ["Jordania", "Argentina", CAZE],
];

const key = (a, b) => [a, b].map((x) => String(x || "").trim().toLowerCase()).sort().join("|");
const MAP = {};
for (const [h, a, ch] of RAW) MAP[key(h, a)] = ch;

// Retorna [{code,label,type}] para o confronto. Default: CazéTV (tem todos os jogos).
export function broadcastersFor(home, away) {
  const codes = MAP[key(home, away)] || ["CAZE"];
  return codes.map((c) => ({ code: c, ...CHANNELS[c] }));
}
