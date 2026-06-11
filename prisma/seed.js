// Popula o banco com as 48 selecoes convocadas para a Copa 2026 (fonte: CNN Brasil, jun/2026).
// Le prisma/squads-raw.txt. Posicao: GOL/ZAG/LAT/MEI/ATA. Preco (fibonacci): 1/2/3/5/8.
// Os precos e o ZAG x LAT sao um ponto de partida -> ajuste tudo no painel de Admin.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const prisma = new PrismaClient();

// Laterais conhecidos (o resto dos defensores vira zagueiro por padrao)
const LATERALS = new Set([
  "Danilo","Wesley","Douglas Santos","Alex Sandro",
  "Tagliafico","Montiel","Molina","Medina",
  "Theo Hernandez","Lucas Hernandez","Lucas Digne","Malo Gusto","Jules Kounde",
  "Reece James","Tino Livramento","Djed Spence","Nico O'Reilly",
  "Marc Cucurella","Alex Grimaldo","Pedro Porro","Pubill","Marcos Llorente",
  "Diogo Dalot","Joao Cancelo","Nuno Mendes","Nelson Semedo",
  "David Raum","Joshua Kimmich","Phillipp Mwene","Nathaniel Brown",
  "Dumfries","Hato","Denzel Dumfries",
  "Guillermo Varela","Mathias Olivera","Joaquin Piquerez","Matias Vina","Juan Manuel Sanabria",
  "Josip Stanisic",
  "Timothy Castagne","Maxim De Cuyper","Thomas Meunier","Joaquin Seys",
  "Jorge Sanchez","Jesus Gallardo","Mateo Chavez",
  "Sergino Dest","Antonee Robinson","Max Arfsten","Joe Scally","Alex Freeman","Richie Laryea",
  "Achraf Hakimi","Noussair Mazraoui","Zakaria El Ouahdi","Anass Salah-Eddine",
  "Antoine Mendy","El-Hadji Malick Diouf","Ismail Jakobs","Krepin Diatta",
  "Daniel Munoz","Santiago Arias","Johan Mojica","Deiver Machado",
  "Pervis Estupinan","Angelo Preciado",
  "Yuto Nagatomo","Yukinari Sugawara",
  "Aaron Wan-Bissaka","Arthur Masuaku","Gedoon Kalulu","Joris Kayembe",
  "Alphonso Davies","Alistair Johnston",
  "Kristoffer Ajer","Julian Ryerson","Marcus Holmgren Pedersen","David Moller Wolfe","Fredrik Bjorkan",
  "Andy Robertson","Aaron Hickey","Nathan Patterson","Anthony Ralston","Kieran Tierney",
  "Daniel Svensson","Emil Holm","Gabriel Gudmundsson",
  "Rayan Ait Nouri","Rafik Belghali","Jaouen Hadjam",
  "Ferdi Kadioglu","Mert Muldur","Zeki Celik","Eren Elmali",
  "Khuliso Mudau","Aubrey Modiba",
  "Saud Abdulhamid",
  "Achraf Abada",
  "Amir Murillo","Eric Davis","Cesar Blackman",
  "Sergio Rochet",
  "Wagner Pina","Steven Moreira",
  "Liberato Cacace","Tim Payne","Callan Elliot",
  "Manaf Younis","Hussein Ali",
  "Ramin Rezaeian","Ehsan Hajsafi",
  "Vladimir Coufal","David Jurasek",
  "Kim Moon-hwan","Seol Young-woo",
]);

// Niveis de preco (1/2/3/5/8). Quem nao estiver aqui = 1 (comum).
const PRICES = {
  // 8 - craques
  "Vini Jr.":8,"Raphinha":8,"Neymar":8,"Lionel Messi":8,"Lautaro Martinez":8,"Julian Alvarez":8,
  "Kylian Mbappe":8,"Ousmane Dembele":8,"Jude Bellingham":8,"Harry Kane":8,"Bukayo Saka":8,
  "Lamine Yamal":8,"Rodri":8,"Pedri":8,"Cristiano Ronaldo":8,"Bruno Fernandes":8,"Kevin De Bruyne":8,
  "Florian Wirtz":8,"Jamal Musiala":8,"Erling Haaland":8,"Mohamed Salah":8,"Federico Valverde":8,
  "Virgil van Dijk":8,"Achraf Hakimi":8,"Thibaut Courtois":8,"Alisson":8,
  // 5 - estrelas
  "Matheus Cunha":5,"Gabriel Martinelli":5,"Bruno Guimaraes":5,"Marquinhos":5,"Gabriel Magalhaes":5,
  "Cuti Romero":5,"Cristian Romero":5,"Romero":5,"Enzo Fernandez":5,"Mac Allister":5,"De Paul":5,"Dibu Martinez":5,
  "Marcus Thuram":5,"Michael Olise":5,"Aurelien Tchouameni":5,"William Saliba":5,"Ibrahima Konate":5,"Mike Maignan":5,
  "Declan Rice":5,"Marcus Rashford":5,"Anthony Gordon":5,"John Stones":5,"Eberechi Eze":5,
  "Nico Williams":5,"Dani Olmo":5,"Mikel Merino":5,"Gavi":5,"Pedro Neto":5,"Rafael Leao":5,"Bernardo Silva":5,"Vitinha":5,"Joao Neves":5,"Ruben Dias":5,
  "Leroy Sane":5,"Kai Havertz":5,"Antonio Rudiger":5,"Joshua Kimmich":5,"Manuel Neuer":5,
  "Romelu Lukaku":5,"Jeremy Doku":5,"Leandro Trossard":5,
  "Memphis Depay":5,"Cody Gakpo":5,"Gakpo":5,"Frenkie de Jong":5,"Tijjani Reijnders":5,"Reijnders":5,"Ryan Gravenberch":5,"Gravenberch":5,
  "Darwin Nunez":5,"Ronald Araujo":5,"Giorgian de Arrascaeta":5,
  "Luis Diaz":5,"James Rodriguez":5,"Luis Suarez":5,"Jhon Arias":5,
  "Luka Modric":5,"Mateo Kovacic":5,"Josko Gvardiol":5,
  "Sadio Mane":5,"Ismaila Sarr":5,"Nicolas Jackson":5,"Pape Matar Sarr":5,
  "Riyad Mahrez":5,"Amine Gouiri":5,
  "Alexandre Isak":5,"Viktor Gyokeres":5,"Anthony Elanga":5,"Victor Nilsson Lindelof":5,
  "Martin Odegaard":5,"Alexander Sorloth":5,"Antonio Nusa":5,
  "Takefusa Kubo":5,"Wataru Endo":5,
  "Christian Pulisic":5,"Weston McKennie":5,"Folarin Balogun":5,
  "Son Heung-min":5,"Lee Kang-in":5,
  "Hakan Calhanoglu":5,"Arda Guler":5,"Kenan Yildiz":5,
  "Manuel Akanji":5,"Granit Xhaka":5,
  "Mehdi Taremi":5,
  // 3 - bons
  "Endrick":3,"Luiz Henrique":3,"Igor Thiago":3,"Casemiro":3,"Danilo":3,"Bremer":3,"Ederson":3,
  "Nico Gonzalez":3,"Thiago Almada":3,"Giuliano Simeone":3,"Nico Paz":3,"Flaco Lopez":3,"Lisandro Martinez":3,"Otamendi":3,"Tagliafico":3,"Molina":3,"Paredes":3,
  "Bradley Barcola":3,"Rayan Cherki":3,"Jean-Philippe Mateta":3,"Maghnes Akliouche":3,"Desire Doue":3,"Adrien Rabiot":3,"Manu Kone":3,"N'Golo Kante":3,"Dayot Upamecano":3,"Jules Kounde":3,"Theo Hernandez":3,
  "Ollie Watkins":3,"Ivan Toney":3,"Noni Madueke":3,"Morgan Rogers":3,"Kobbie Mainoo":3,"Marc Guehi":3,"Reece James":3,"Jordan Pickford":3,
  "Mikel Oyarzabal":3,"Oyarzabal":3,"Ferran Torres":3,"Yeremy Pino":3,"Fabian Ruiz":3,"Martin Zubimendi":3,"Zubimendi":3,"Marc Cucurella":3,"Pau Cubarsi":3,"Unai Simon":3,"David Raya":3,"Alex Grimaldo":3,
  "Goncalo Ramos":3,"Joao Felix":3,"Francisco Conceicao":3,"Goncalo Guedes":3,"Diogo Dalot":3,"Nuno Mendes":3,"Joao Cancelo":3,"Diogo Costa":3,"Ruben Neves":3,
  "Deniz Undav":3,"Maximilian Beier":3,"Leon Goretzka":3,"Nico Schlotterbeck":3,"Jonathan Tah":3,"David Raum":3,"Aleksandar Pavlovic":3,
  "Youri Tielemans":3,"Amadou Onana":3,"Charles De Ketelaere":3,"Dodi Lukebakio":3,"Timothy Castagne":3,
  "Donyell Malen":3,"Malen":3,"Xavi Simons":3,"Jurrien Timber":3,"Nathan Ake":3,"Ake":3,"Bart Verbruggen":3,"Verbruggen":3,"Cody":3,
  "Rodrigo Bentancur":3,"Manuel Ugarte":3,"Nicolas de la Cruz":3,"Jose Maria Gimenez":3,"Jose Gimenez":3,"Facundo Pellistri":3,"Mathias Olivera":3,
  "Jhon Lucumi":3,"Davinson Sanchez":3,"Daniel Munoz":3,"Richard Rios":3,"Jefferson Lerma":3,"Jhon Cordoba":3,"Camilo Vargas":3,
  "Ivan Perisic":3,"Andrej Kramaric":3,"Ante Budimir":3,"Petar Sucic":3,"Luka Sucic":3,"Mario Pasalic":3,"Dominik Livakovic":3,
  "Iliman Ndiaye":3,"Idrissa Gueye":3,"Kalidou Koulibaly":3,"Habib Diarra":3,"Lamine Camara":3,"Edouard Mendy":3,
  "Mohamed Amine Amoura":3,"Ramy Bensebaini":3,"Houssem Aouar":3,"Aissa Mandi":3,
  "Moises Caicedo":3,"Piero Hincapie":3,"Willian Pacho":3,"Enner Valencia":3,"Gonzalo Plata":3,"Kendry Paez":3,
  "Daichi Kamada":3,"Ritsu Doan":3,"Junya Ito":3,"Ko Itakura":3,"Zion Suzuki":3,"Ao Tanaka":3,
  "Brahim Diaz":3,"Ayoub El Kaabi":3,"Nayef Aguerd":3,"Sofyan Amrabat":3,"Bilal El Khannouss":3,"Noussair Mazraoui":3,"Yassine Bounou":3,
  "Inaki Williams":3,"Thomas Partey":3,"Mohammed Kudus":3,"Antoine Semenyo":3,"Jordan Ayew":3,
  "Marko Arnautovic":3,"Konrad Laimer":3,"David Alaba":3,"Marcel Sabitzer":3,"Christoph Baumgartner":3,"Kevin Danso":3,
  "Wilfried Singo":3,"Amad Diallo":3,"Franck Kessie":3,"Ibrahim Sangare":3,"Simon Adingra":3,"Evan Ndicka":3,"Nicolas Pepe":3,
  "Jonathan David":3,"Alphonso Davies":3,"Stephen Eustaquio":3,"Ismael Kone":3,"Alistair Johnston":3,
  "Hwang Hee-chan":3,"Kim Min-jae":3,"Lee Jae-sung":3,
  "Breel Embolo":3,"Dan Ndoye":3,"Gregor Kobel":3,"Remo Freuler":3,"Denis Zakaria":3,
  "Patrik Schick":3,"Adam Hlozek":3,"Tomas Soucek":3,
  "Omar Marmoush":3,"Mahmoud Trezeguet":3,
  "Santiago Gimenez":3,"Raul Jimenez":3,"Edson Alvarez":3,"Hirving Lozano":3,"Guillermo Ochoa":3,
  "Patrick Berg":3,"Sander Berge":3,"Jorgen Strand Larsen":3,
};

function parse(raw) {
  const teams = {};
  let cur = null, curTeam = null;
  for (let line of raw.split("\n")) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("=")) { curTeam = line.slice(1).trim(); teams[curTeam] = []; continue; }
    const m = line.match(/^(GOL|DEF|MEI|ATA):\s*(.*)$/);
    if (!m || !curTeam) continue;
    const bucket = m[1];
    const names = m[2].split(",").map((s) => s.trim()).filter(Boolean);
    for (const name of names) {
      let pos = bucket;
      if (bucket === "DEF") pos = LATERALS.has(name) ? "LAT" : "ZAG";
      const price = PRICES[name] || 1;
      teams[curTeam].push({ name, position: pos, price });
    }
  }
  return teams;
}

async function main() {
// Participantes sao criados via cadastro (login) - nao semeamos usuarios.

  // ----- Calendario OFICIAL (datas + horarios BRT da tabela oficial). -----
  // Confrontos: MD1 1x2,3x4 | MD2 1x3,4x2 | MD3 4x1,2x3. Posicao 1-4 = sorteio oficial.
  const GROUPS = {
    A: ["Mexico","Africa do Sul","Coreia do Sul","Republica Tcheca"],
    B: ["Canada","Bosnia","Catar","Suica"],
    C: ["Brasil","Marrocos","Haiti","Escocia"],
    D: ["Estados Unidos","Paraguai","Australia","Turquia"],
    E: ["Alemanha","Curacao","Costa do Marfim","Equador"],
    F: ["Holanda","Japao","Suecia","Tunisia"],
    G: ["Belgica","Egito","Ira","Nova Zelandia"],
    H: ["Espanha","Cabo Verde","Arabia Saudita","Uruguai"],
    I: ["Franca","Senegal","Iraque","Noruega"],
    J: ["Argentina","Argelia","Austria","Jordania"],
    K: ["Portugal","RD Congo","Uzbequistao","Colombia"],
    L: ["Inglaterra","Croacia","Gana","Panama"],
  };
  // Horarios exatos (BRT) na ordem dos confrontos [1x2,3x4,1x3,4x2,4x1,2x3]. Todos os 12 grupos (fonte: ESPN BR, horarios BRT).
  const SCHED = {
    A: [["06-11","16:00"],["06-11","23:00"],["06-18","22:00"],["06-18","13:00"],["06-24","22:00"],["06-24","22:00"]],
    B: [["06-12","16:00"],["06-13","16:00"],["06-18","19:00"],["06-18","16:00"],["06-24","16:00"],["06-24","16:00"]],
    C: [["06-13","19:00"],["06-13","22:00"],["06-19","21:30"],["06-19","19:00"],["06-24","19:00"],["06-24","19:00"]],
    D: [["06-12","22:00"],["06-14","01:00"],["06-19","16:00"],["06-20","00:00"],["06-25","23:00"],["06-25","23:00"]],
    E: [["06-14","14:00"],["06-14","20:00"],["06-20","17:00"],["06-20","21:00"],["06-25","17:00"],["06-25","17:00"]],
    F: [["06-14","17:00"],["06-14","23:00"],["06-20","14:00"],["06-21","01:00"],["06-25","20:00"],["06-25","20:00"]],
    G: [["06-15","16:00"],["06-15","22:00"],["06-21","16:00"],["06-21","22:00"],["06-27","00:00"],["06-27","00:00"]],
    H: [["06-15","13:00"],["06-15","19:00"],["06-21","13:00"],["06-21","19:00"],["06-26","21:00"],["06-26","21:00"]],
    I: [["06-16","16:00"],["06-16","19:00"],["06-22","18:00"],["06-22","21:00"],["06-26","16:00"],["06-26","16:00"]],
    J: [["06-16","22:00"],["06-17","01:00"],["06-22","14:00"],["06-23","00:00"],["06-27","23:00"],["06-27","23:00"]],
    K: [["06-17","14:00"],["06-17","23:00"],["06-23","14:00"],["06-23","23:00"],["06-27","20:30"],["06-27","20:30"]],
    L: [["06-17","17:00"],["06-17","20:00"],["06-23","17:00"],["06-23","20:00"],["06-27","18:00"],["06-27","18:00"]],
  };
  // Fallback p/ I-L (datas oficiais; horarios provisorios ate receber a tabela).
  const FB_DATES = { I:["06-16","06-22","06-26"], J:["06-16","06-22","06-27"], K:["06-17","06-23","06-27"], L:["06-17","06-23","06-27"] };
  const FB_TIME = ["16:00","19:00"];
  const ko = (mmdd, hhmm) => new Date("2026-" + mmdd + "T" + hhmm + ":00-03:00");

  await prisma.match.deleteMany({});
  let order = 0;
  const matchRows = [];
  const rounds = [1, 1, 2, 2, 3, 3];
  for (const [g, t] of Object.entries(GROUPS)) {
    const pairs = [[t[0], t[1]], [t[2], t[3]], [t[0], t[2]], [t[3], t[1]], [t[3], t[0]], [t[1], t[2]]];
    for (let k = 0; k < 6; k++) {
      let mmdd, hhmm;
      if (SCHED[g]) { [mmdd, hhmm] = SCHED[g][k]; }
      else { mmdd = FB_DATES[g][rounds[k] - 1]; hhmm = FB_TIME[k % 2]; }
      matchRows.push({ homeTeam: pairs[k][0], awayTeam: pairs[k][1], group: g, round: rounds[k], stage: "GROUP", kickoff: ko(mmdd, hhmm), finished: false, order: ++order });
    }
  }
  // Esqueleto do mata-mata (datas oficiais por fase; horario provisorio)
  const KO = [["R32", 16, "06-28"], ["R16", 8, "07-04"], ["QF", 4, "07-09"], ["SF", 2, "07-14"], ["THIRD", 1, "07-18"], ["FINAL", 1, "07-19"]];
  for (const [stage, n, mmdd] of KO) {
    for (let i = 0; i < n; i++) {
      const d = ko(mmdd, "16:00");
      d.setUTCDate(d.getUTCDate() + Math.floor(i / 4));
      matchRows.push({ homeTeam: "A definir", awayTeam: "A definir", group: null, round: null, stage, kickoff: d, finished: false, order: ++order });
    }
  }
  await prisma.match.createMany({ data: matchRows });

  await prisma.squadPlayer.deleteMany({});
  await prisma.player.deleteMany({});
  const raw = fs.readFileSync(path.join(__dirname, "squads-raw.txt"), "utf8");
  const teams = parse(raw);
  let total = 0;
  const rows = [];
  for (const [team, list] of Object.entries(teams)) {
    for (const p of list) { rows.push({ name: p.name, team, position: p.position, price: p.price }); total++; }
  }
  await prisma.player.createMany({ data: rows });

  const scouts = {
    "Vini Jr.": { goals: 1, assists: 1 }, "Raphinha": { goals: 2 }, "Neymar": { assists: 1 },
    "Lionel Messi": { goals: 1, assists: 1 }, "Kylian Mbappe": { goals: 2 }, "Alisson": { cleanSheet: 1, saves: 2 },
    "Marquinhos": { cleanSheet: 1 }, "Lautaro Martinez": { goals: 1 },
  };
  for (const [name, data] of Object.entries(scouts)) await prisma.player.updateMany({ where: { name }, data });

  const byPos = await prisma.player.groupBy({ by: ["position"], _count: true });
  console.log("Seed: " + total + " jogadores. " + byPos.map((b) => b.position + "=" + b._count).join(" "));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
