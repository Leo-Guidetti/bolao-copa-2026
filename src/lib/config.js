import { prisma } from "./prisma";
import { DEFAULT_SETTINGS } from "./defaults";

// Migra scout legado (tackle + interception -> tackleInterception) e garante defaults.
function normalizeSquadRules(stored) {
  const merged = { ...DEFAULT_SETTINGS.squadRules, ...(stored || {}) };
  const def = DEFAULT_SETTINGS.squadRules.scout;
  const sc = { ...def, ...(merged.scout || {}) };
  if (sc.tackle || sc.interception) {
    sc.tackleInterception = sc.tackleInterception || sc.tackle || sc.interception || def.tackleInterception;
  }
  delete sc.tackle;
  delete sc.interception;
  merged.scout = sc;
  return merged;
}

// Lê uma chave de config, mesclando com o default.
export async function getSetting(key) {
  const row = await prisma.setting.findUnique({ where: { key } });
  const stored = row ? safeParse(row.value) : null;
  if (key === "squadRules") return normalizeSquadRules(stored);
  if (!stored) return DEFAULT_SETTINGS[key];
  return { ...DEFAULT_SETTINGS[key], ...stored };
}

// Lê toda a config de uma vez.
export async function getAllSettings() {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, safeParse(r.value)]));
  const out = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    out[key] = key === "squadRules" ? normalizeSquadRules(map[key]) : { ...DEFAULT_SETTINGS[key], ...(map[key] || {}) };
  }
  return out;
}

export async function setSetting(key, value) {
  const str = JSON.stringify(value);
  return prisma.setting.upsert({
    where: { key },
    update: { value: str },
    create: { key, value: str },
  });
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
