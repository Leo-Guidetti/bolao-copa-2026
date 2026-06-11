// Mapa nome da selecao -> codigo de bandeira (flagcdn).
export const TEAM_FLAGS = {
  "Brasil": "br", "Argentina": "ar", "Franca": "fr", "Inglaterra": "gb-eng",
  "Espanha": "es", "Portugal": "pt", "Alemanha": "de", "Holanda": "nl",
  "Uruguai": "uy", "Croacia": "hr", "Belgica": "be", "Mexico": "mx",
  "Estados Unidos": "us", "Canada": "ca", "Marrocos": "ma", "Senegal": "sn",
  "Colombia": "co", "Equador": "ec", "Japao": "jp", "Coreia do Sul": "kr",
  "Suica": "ch", "Dinamarca": "dk", "Austria": "at", "Noruega": "no",
  "Suecia": "se", "Polonia": "pl", "Servia": "rs", "Escocia": "gb-sct",
  "Italia": "it", "Gana": "gh", "Costa do Marfim": "ci", "Nigeria": "ng",
  "Egito": "eg", "Tunisia": "tn", "Argelia": "dz", "Africa do Sul": "za",
  "Catar": "qa", "Arabia Saudita": "sa", "Ira": "ir", "Australia": "au",
  "Nova Zelandia": "nz", "Paraguai": "py", "Panama": "pa", "Cabo Verde": "cv",
  "Curacao": "cw", "Haiti": "ht", "Bosnia": "ba", "Republica Tcheca": "cz",
  "Turquia": "tr",
  "Iraque": "iq", "RD Congo": "cd", "Uzbequistao": "uz", "Jordania": "jo",
};

export function flagUrl(team, size = "w40") {
  const code = TEAM_FLAGS[team];
  if (!code) return null;
  return `https://flagcdn.com/${size}/${code}.png`;
}

// Siglas (3 letras, padrão FIFA) para compactar no mobile.
export const TEAM_ABBR = {
  "Coreia do Sul": "KOR", "Mexico": "MEX", "Republica Tcheca": "CZE", "Africa do Sul": "RSA",
  "Bosnia": "BIH", "Canada": "CAN", "Catar": "QAT", "Suica": "SUI", "Brasil": "BRA",
  "Escocia": "SCO", "Haiti": "HAI", "Marrocos": "MAR", "Australia": "AUS", "Estados Unidos": "USA",
  "Paraguai": "PAR", "Turquia": "TUR", "Alemanha": "GER", "Costa do Marfim": "CIV", "Curacao": "CUW",
  "Equador": "ECU", "Holanda": "NED", "Japao": "JPN", "Suecia": "SWE", "Tunisia": "TUN",
  "Belgica": "BEL", "Egito": "EGY", "Ira": "IRN", "Nova Zelandia": "NZL", "Arabia Saudita": "KSA",
  "Cabo Verde": "CPV", "Espanha": "ESP", "Uruguai": "URU", "Franca": "FRA", "Iraque": "IRQ",
  "Noruega": "NOR", "Senegal": "SEN", "Argentina": "ARG", "Argelia": "ALG", "Austria": "AUT",
  "Jordania": "JOR", "Colombia": "COL", "Portugal": "POR", "RD Congo": "COD", "Uzbequistao": "UZB",
  "Croacia": "CRO", "Gana": "GHA", "Inglaterra": "ENG", "Panama": "PAN",
};

// Nomes completos acentuados (exibição).
export const TEAM_FULL = {
  "Mexico": "México", "Republica Tcheca": "República Tcheca", "Africa do Sul": "África do Sul",
  "Bosnia": "Bósnia", "Canada": "Canadá", "Suica": "Suíça", "Escocia": "Escócia",
  "Australia": "Austrália", "Curacao": "Curaçao", "Japao": "Japão", "Suecia": "Suécia",
  "Tunisia": "Tunísia", "Belgica": "Bélgica", "Ira": "Irã", "Nova Zelandia": "Nova Zelândia",
  "Arabia Saudita": "Arábia Saudita", "Franca": "França", "Argelia": "Argélia", "Austria": "Áustria",
  "Jordania": "Jordânia", "Colombia": "Colômbia", "Uzbequistao": "Uzbequistão", "Croacia": "Croácia",
  "Panama": "Panamá",
};

export function teamAbbr(team) {
  if (team === "A definir") return "—";
  return TEAM_ABBR[team] || team.slice(0, 3).toUpperCase();
}
export function teamFull(team) { return TEAM_FULL[team] || team; }
