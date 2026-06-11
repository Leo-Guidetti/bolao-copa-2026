import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const norm = (s) => (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z\s-]/g," ").replace(/\s+/g," ").trim();

// Tiers de seleção
const S = ["Argentina","Brasil","Franca","Espanha","Inglaterra","Portugal","Alemanha","Holanda"];
const A = ["Belgica","Croacia","Uruguai","Marrocos","Colombia","Suica","Senegal","Japao","Mexico","Estados Unidos","Noruega","Austria","Turquia","Costa do Marfim","Equador"];
const B = ["Coreia do Sul","Australia","Canada","Egito","Paraguai","Catar","Ira","Iraque","Argelia","Tunisia","Escocia","Republica Tcheca","RD Congo","Gana","Panama","Uzbequistao","Arabia Saudita","Africa do Sul","Bosnia","Suecia"];
const tierOf = (t) => S.includes(t)?"S":A.includes(t)?"A":B.includes(t)?"B":"C";
// baseline[tier][pos]
const BASE = {
  S:{GOL:2,ZAG:2,LAT:2,MEI:3,ATA:3},
  A:{GOL:1,ZAG:1,LAT:2,MEI:2,ATA:2},
  B:{GOL:1,ZAG:1,LAT:1,MEI:1,ATA:2},
  C:{GOL:1,ZAG:1,LAT:1,MEI:1,ATA:1},
};
// Craques: por seleção, { tokenNormalizado: preço }. Casa por substring no nome normalizado.
const STARS = {
  Argentina:{messi:8,lautaro:5,"julian alvarez":5,dibu:5,romero:3,"lisandro martinez":3,otamendi:3,tagliafico:3},
  Brasil:{"vini jr":8,neymar:8,raphinha:5,alisson:5,endrick:5,"matheus cunha":5,casemiro:3,marquinhos:3,bremer:3,"gabriel magalhaes":3,"bruno guimaraes":3,ederson:3,"lucas paqueta":3,"luiz henrique":3},
  Franca:{mbappe:8,dembele:5,"michael olise":5,"marcus thuram":5,saliba:3,kounde:3,konate:3,"theo hernandez":3,maignan:3,rabiot:3},
  Espanha:{rodri:8,yamal:8,pedri:5,gavi:5,"nico williams":5,"dani olmo":3,cucurella:3,laporte:3,"unai simon":3,"ferran torres":3,oyarzabal:3},
  Inglaterra:{bellingham:8,kane:8,saka:5,"eberechi eze":5,rashford:5,stones:3,guehi:3,pickford:3,"reece james":3,watkins:3},
  Portugal:{ronaldo:8,"bruno fernandes":5,"bernardo silva":5,"rafael leao":5,"pedro neto":5,vitinha:3,"ruben dias":3,"joao cancelo":3,"diogo costa":3,"nuno mendes":3,"joao felix":3},
  Alemanha:{musiala:8,wirtz:8,kimmich:5,"leroy sane":5,rudiger:3,neuer:3,"jonathan tah":3,goretzka:3},
  Holanda:{"van dijk":5,"de jong":5,gakpo:5,memphis:5,dumfries:3,"jurrien timber":3,ake:3,gravenberch:3},
  Belgica:{"de bruyne":8,lukaku:5,doku:5,courtois:5,openda:3,trossard:3,tielemans:3},
  Croacia:{modric:5,gvardiol:5,kovacic:3,perisic:3,kramaric:3,brozovic:3},
  Uruguai:{valverde:5,"darwin nunez":5,"ronald araujo":5,bentancur:3,arrascaeta:3,ugarte:3,"de la cruz":3},
  Marrocos:{hakimi:5,brahim:3,ziyech:3,amrabat:3,bono:3,"en nesyri":3,mazraoui:3},
  Colombia:{"luis diaz":5,james:5,"jhon duran":3,cuadrado:3,sinisterra:3,lerma:3},
  Suica:{xhaka:3,akanji:3,embolo:3,sommer:3,ndoye:3},
  Senegal:{mane:5,jackson:5,koulibaly:3,"ismaila sarr":3,"pape sarr":3,mendy:3},
  Japao:{mitoma:5,kubo:3,"wataru endo":3,doan:3,kamada:3,tomiyasu:3},
  Mexico:{"santiago gimenez":5,lozano:3,"raul jimenez":3,"edson alvarez":3},
  "Estados Unidos":{pulisic:5,mckennie:3,balogun:3,reyna:3,"antonee robinson":3},
  Noruega:{haaland:8,odegaard:5,sorloth:3,bobb:3,nusa:3},
  Austria:{alaba:3,sabitzer:3,arnautovic:3,laimer:3},
  Turquia:{"arda guler":5,calhanoglu:3,"kenan yildiz":3},
  "Costa do Marfim":{haller:3,kessie:3,pepe:3,amad:3,adingra:3},
  Equador:{"moises caicedo":5,hincapie:3,"enner valencia":3,"kendry paez":3,estupinan:3},
  Egito:{salah:8,marmoush:5},
  Suecia:{"alexandre isak":5,gyokeres:5,elanga:3,lindelof:3,svanberg:3},
  "Coreia do Sul":{heung:5,"kim min-jae":3,"kang-in":3,"hwang hee":3},
  Argelia:{mahrez:5,bennacer:3,gouiri:3},
  Gana:{kudus:5,partey:3,"inaki williams":3,ayew:3},
  "RD Congo":{wissa:3},
  Escocia:{robertson:3,mctominay:3},
  "Republica Tcheca":{schick:3},
  Ira:{taremi:3,azmoun:3},
  Catar:{afif:3},
  Canada:{davies:5,"jonathan david":5,buchanan:3},
  Paraguai:{almiron:3,enciso:3},
  Bosnia:{dzeko:3},
};
const allow = (v) => (v>=8?8:v>=5?5:v>=3?3:v>=2?2:1);

const all = await prisma.player.findMany({ select:{id:true,name:true,team:true,position:true,price:true} });
const updates = [];
const hist = {1:0,2:0,3:0,5:0,8:0};
const matched = [];
for (const p of all) {
  const tier = tierOf(p.team);
  let price = BASE[tier]?.[p.position] ?? 1;
  const stars = STARS[p.team];
  if (stars) {
    const n = norm(p.name);
    let best = 0;
    for (const [tok,val] of Object.entries(stars)) { if (n.includes(norm(tok))) best = Math.max(best,val); }
    if (best) { price = Math.max(price,best); matched.push([p.team,p.name,best]); }
  }
  price = allow(price);
  hist[price]++;
  if (price !== p.price) updates.push({ id:p.id, price });
}
console.log("Nova distribuição:", JSON.stringify(hist));
console.log("Mudanças a aplicar:", updates.length, "de", all.length);
console.log("\n=== Jogadores 8¢ ("+matched.filter(m=>m[2]===8).length+") ===");
console.log(matched.filter(m=>m[2]===8).map(m=>`${m[1]} (${m[0]})`).join(", "));
console.log("\n=== Jogadores 5¢ ("+matched.filter(m=>m[2]===5).length+") ===");
console.log(matched.filter(m=>m[2]===5).map(m=>`${m[1]} (${m[0]})`).join(", "));

if (APPLY) {
  console.log("\nAplicando...");
  for (let i=0;i<updates.length;i+=50) {
    await prisma.$transaction(updates.slice(i,i+50).map(u=>prisma.player.update({where:{id:u.id},data:{price:u.price}})));
  }
  console.log("✅ Aplicado:", updates.length, "preços atualizados.");
}
await prisma.$disconnect();
