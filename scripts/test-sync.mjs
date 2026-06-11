// Teste OFFLINE: injeta respostas no formato da API-Football e roda contra o banco real (modo dry).
import { PrismaClient } from "@prisma/client";
import { planScoreUpdates, syncStats } from "./sync.mjs";
const prisma = new PrismaClient();

const fixtures = [
  { fixture: { id: 101, status: { short: "FT" } }, teams: { home: { name: "Brazil" }, away: { name: "Morocco" } }, goals: { home: 2, away: 1 } },
  { fixture: { id: 102, status: { short: "FT" } }, teams: { home: { name: "Mexico" }, away: { name: "South Africa" } }, goals: { home: 1, away: 1 } },
  { fixture: { id: 103, status: { short: "FT" } }, teams: { home: { name: "South Korea" }, away: { name: "Czech Republic" } }, goals: { home: 0, away: 1 } },
  { fixture: { id: 104, status: { short: "NS" } }, teams: { home: { name: "Italy" }, away: { name: "Spain" } }, goals: { home: null, away: null } }, // nao deve casar
];

const players = {
  101: [
    { team: { name: "Brazil" }, players: [
      { player: { name: "Vini Jr." }, statistics: [{ games: { minutes: 90 }, goals: { total: 1, assists: 1 }, shots: { total: 4, on: 2 }, cards: {} }] },
      { player: { name: "Raphinha" }, statistics: [{ games: { minutes: 90 }, goals: { total: 1, assists: 0 }, cards: { yellow: 1, red: 0 } }] },
      { player: { name: "Alisson" }, statistics: [{ games: { minutes: 90 }, goals: { total: 0, saves: 3 }, penalty: { saved: 1 }, cards: {} }] },
    ]},
    { team: { name: "Morocco" }, players: [
      { player: { name: "Achraf Hakimi" }, statistics: [{ games: { minutes: 90 }, goals: { total: 0 }, tackles: { total: 3, interceptions: 2 }, cards: { yellow: 1 } }] },
    ]},
  ],
  102: [
    { team: { name: "Mexico" }, players: [
      { player: { name: "Raul Jimenez" }, statistics: [{ games: { minutes: 90 }, goals: { total: 1 }, cards: {} }] },
    ]},
  ],
  103: [
    { team: { name: "Czech Republic" }, players: [
      { player: { name: "Patrik Schick" }, statistics: [{ games: { minutes: 90 }, goals: { total: 1 }, cards: {} }] },
      { player: { name: "Jindrich Stanek" }, statistics: [{ games: { minutes: 90 }, goals: { saves: 2 }, cards: {} }] },
    ]},
  ],
};
const events = { 101: [{ type: "Goal", detail: "Own Goal", team: { name: "Morocco" }, player: { name: "Nayef Aguerd" } }] };

async function fakeGet(path) {
  if (path.startsWith("/fixtures?")) return fixtures;
  const mp = path.match(/\/fixtures\/players\?fixture=(\d+)/); if (mp) return players[mp[1]] || [];
  const me = path.match(/\/fixtures\/events\?fixture=(\d+)/); if (me) return events[me[1]] || [];
  return [];
}

const main = async () => {
  const matches = await prisma.match.findMany();
  console.log("== PLACARES ==");
  const { updates, unmatched } = planScoreUpdates(matches, fixtures);
  for (const u of updates) console.log("  " + (u.finished ? "[FT] " : "[--] ") + u.label);
  console.log("  sem match:", unmatched.join(", ") || "(nenhum)");

  console.log("\n== SCOUT (dry) ==");
  const { acc, perMatch } = await syncStats({ httpGet: fakeGet, prisma, fixtures, dry: true, log: (...a) => console.log("  " + a.join(" ")) });
  const byId = Object.fromEntries((await prisma.player.findMany({ where: { id: { in: [...acc.keys()] } } })).map((p) => [p.id, p]));
  console.log("  --- agregado por jogador ---");
  for (const [id, s] of acc) { const p = byId[id]; console.log(`  ${p.name} (${p.team}/${p.position}):`, JSON.stringify(s)); }
  console.log("  --- por jogo (matchId|playerId) ---");
  const mById = Object.fromEntries((await prisma.match.findMany()).map((m) => [m.id, m]));
  for (const [k, r] of perMatch) {
    const m = mById[r.matchId]; const p = byId[r.playerId];
    const nz = Object.fromEntries(Object.entries(r).filter(([kk, vv]) => typeof vv === "number" && vv !== 0 && !["fixtureId"].includes(kk)));
    console.log(`  ${m ? m.homeTeam + " x " + m.awayTeam : r.matchId} | ${p ? p.name : r.playerId}:`, JSON.stringify(nz));
  }
};
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
