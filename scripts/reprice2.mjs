import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const norm = (s)=>(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z\s-]/g," ").replace(/\s+/g," ").trim();

// 48 seleções ranqueadas por força (1 = mais forte)
const ORDER = ["Brasil","Franca","Espanha","Argentina","Inglaterra","Portugal","Holanda","Alemanha","Belgica","Uruguai","Croacia","Colombia","Marrocos","Senegal","Japao","Suica","Estados Unidos","Mexico","Noruega","Equador","Costa do Marfim","Coreia do Sul","Austria","Turquia","Suecia","Egito","Australia","Canada","Paraguai","Escocia","Argelia","Gana","Catar","Ira","Tunisia","Republica Tcheca","RD Congo","Bosnia","Iraque","Uzbequistao","Arabia Saudita","Africa do Sul","Panama","Nova Zelandia","Cabo Verde","Curacao","Haiti","Jordania"];
const rankOf=(t)=>{const i=ORDER.indexOf(t);return i<0?ORDER.length:i;};

const STARS={
 Argentina:{messi:8,lautaro:5,"julian alvarez":5,dibu:5,romero:3,"lisandro martinez":3,otamendi:3,tagliafico:3,"de paul":3,"mac allister":3,"enzo fernandez":3},
 Brasil:{"vini jr":8,neymar:8,raphinha:5,alisson:5,endrick:5,"matheus cunha":5,casemiro:3,marquinhos:3,bremer:3,"gabriel magalhaes":3,"bruno guimaraes":3,ederson:3,"lucas paqueta":3,"luiz henrique":3,"gabriel martinelli":3},
 Franca:{mbappe:8,dembele:5,"michael olise":5,"marcus thuram":5,saliba:3,kounde:3,konate:3,"theo hernandez":3,maignan:3,rabiot:3,"aurelien tchouameni":3,camavinga:3},
 Espanha:{rodri:8,yamal:8,pedri:5,gavi:5,"nico williams":5,"dani olmo":3,cucurella:3,laporte:3,"unai simon":3,"ferran torres":3,oyarzabal:3,"mikel merino":3},
 Inglaterra:{bellingham:8,kane:8,saka:5,"eberechi eze":5,rashford:5,stones:3,guehi:3,pickford:3,"reece james":3,watkins:3,"declan rice":3,foden:5},
 Portugal:{ronaldo:8,"bruno fernandes":5,"bernardo silva":5,"rafael leao":5,"pedro neto":5,vitinha:3,"ruben dias":3,"joao cancelo":3,"diogo costa":3,"nuno mendes":3,"joao felix":3},
 Alemanha:{musiala:8,wirtz:8,kimmich:5,"leroy sane":5,rudiger:3,neuer:3,"jonathan tah":3,goretzka:3,havertz:3,gnabry:3},
 Holanda:{"van dijk":8,"de jong":5,gakpo:5,memphis:5,dumfries:3,"jurrien timber":3,ake:3,gravenberch:3,"de ligt":3,reijnders:3},
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
 Equador:{caicedo:5,hincapie:3,"enner valencia":3,"kendry paez":3,estupinan:3},
 Egito:{salah:8,marmoush:5},
 Suecia:{"alexandre isak":5,gyokeres:5,kulusevski:3,elanga:3,lindelof:3},
 "Coreia do Sul":{heung:5,"kim min-jae":3,"kang-in":3,"hwang hee":3},
 Argelia:{mahrez:5,bennacer:3,gouiri:3},
 Gana:{kudus:5,partey:3,"inaki williams":3,ayew:3},
 "RD Congo":{wissa:3},Escocia:{robertson:3,mctominay:3},"Republica Tcheca":{schick:3},
 Ira:{taremi:3,azmoun:3},Catar:{afif:3},Canada:{davies:5,"jonathan david":5,buchanan:3},
 Paraguai:{almiron:3,enciso:3},Bosnia:{dzeko:3},
};
const starVal=(team,name)=>{const m=STARS[team];if(!m)return 0;const n=norm(name);let b=0;for(const[k,v]of Object.entries(m))if(n.includes(norm(k)))b=Math.max(b,v);return b;};

// cotas por posição: [fração acumulada do topo, preço]
const Q={
 GOL:[[0.01,8],[0.06,5],[0.20,3],[0.45,2],[1,1]],
 ZAG:[[0.012,8],[0.05,5],[0.19,3],[0.49,2],[1,1]],
 LAT:[[0.01,8],[0.05,5],[0.20,3],[0.55,2],[1,1]],
 MEI:[[0.02,8],[0.08,5],[0.27,3],[0.57,2],[1,1]],
 ATA:[[0.02,8],[0.08,5],[0.27,3],[0.57,2],[1,1]],
};
const priceByFrac=(pos,f)=>{for(const[c,p]of Q[pos])if(f<=c)return p;return 1;};

const all=await prisma.player.findMany({select:{id:true,name:true,team:true,position:true,price:true}});
const POS=["GOL","ZAG","LAT","MEI","ATA"];
const byPos=Object.fromEntries(POS.map(p=>[p,[]]));
for(const pl of all){pl._score=starVal(pl.team,pl.name)*100+(ORDER.length-rankOf(pl.team));byPos[pl.position].push(pl);}
const newPrice=new Map();
for(const pos of POS){
 const arr=byPos[pos].sort((a,b)=>b._score-a._score||a.name.localeCompare(b.name));
 const n=arr.length;
 arr.forEach((pl,i)=>{let p=priceByFrac(pos,(i+0.5)/n);p=Math.max(p,starVal(pl.team,pl.name));newPrice.set(pl.id,p);});
}
// piso por seleção: melhor jogador (maior score) >= 3
const teamsBest={};
for(const pl of all){const t=pl.team;if(!teamsBest[t]||pl._score>teamsBest[t]._score)teamsBest[t]=pl;}
for(const t in teamsBest){const b=teamsBest[t];if(newPrice.get(b.id)<3)newPrice.set(b.id,3);}

// relatório
const hist=(filter)=>{const h={1:0,2:0,3:0,5:0,8:0};for(const pl of all)if(filter(pl))h[newPrice.get(pl.id)]++;return h;};
const fmt=(h)=>[1,2,3,5,8].map(t=>`${t}¢:${String(h[t]).padStart(3)}`).join("  ");
console.log("=== NOVA distribuição por posição ===");
for(const pos of POS)console.log(pos.padEnd(4),fmt(hist(pl=>pl.position===pos)));
console.log("\n=== Total geral ===\n",fmt(hist(()=>true)));
const teams={};for(const pl of all){(teams[pl.team]??={tot:0,t3:0,t5:0});const np=newPrice.get(pl.id);teams[pl.team].tot+=np;if(np>=3)teams[pl.team].t3++;if(np>=5)teams[pl.team].t5++;}
const ta=Object.entries(teams).sort((a,b)=>b[1].tot-a[1].tot);
console.log("\nSeleções sem ≥3¢:",ta.filter(x=>x[1].t3===0).length,"| sem ≥5¢:",ta.filter(x=>x[1].t5===0).length);
console.log("Amostra (tot|≥3|≥5):");
for(const [t,v] of [ta[0],ta[8],ta[20],ta[34],ta[47]]) console.log("  "+t.padEnd(16),`tot:${v.tot} ≥3:${v.t3} ≥5:${v.t5}`);
let chg=0;for(const pl of all)if(newPrice.get(pl.id)!==pl.price)chg++;
console.log("\nMudanças:",chg,"de",all.length);
if(APPLY){const ups=[...newPrice.entries()].map(([id,price])=>({id,price}));for(let i=0;i<ups.length;i+=50)await prisma.$transaction(ups.slice(i,i+50).map(u=>prisma.player.update({where:{id:u.id},data:{price:u.price}})));console.log("✅ aplicado");}
await prisma.$disconnect();
