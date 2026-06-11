import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const norm=(s)=>(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z\s-]/g," ").replace(/\s+/g," ").trim();
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
 Equador:{"moises caicedo":5,hincapie:3,"enner valencia":3,"kendry paez":3,estupinan:3},
 Egito:{salah:8,marmoush:5},
 Suecia:{"alexandre isak":5,gyokeres:5,kulusevski:3,elanga:3,lindelof:3},
 "Coreia do Sul":{heung:5,"kim min-jae":3,"kang-in":3,"hwang hee":3},
 Argelia:{mahrez:5,bennacer:3,gouiri:3},
 Gana:{kudus:5,partey:3,"inaki williams":3,ayew:3},
 "RD Congo":{wissa:3},Escocia:{robertson:3,mctominay:3},"Republica Tcheca":{schick:3},
 Ira:{taremi:3,azmoun:3},Catar:{afif:3},Canada:{davies:5,"jonathan david":5,buchanan:3},
 Paraguai:{almiron:3,enciso:3},Bosnia:{dzeko:3},
};
const PROMO = {
 Brasil:{marquinhos:5,"gabriel magalhaes":5,militao:5,ederson:5,"bruno guimaraes":5,"gabriel martinelli":5},
 Franca:{maignan:5,saliba:5,kounde:5,"theo hernandez":5,rabiot:5,konate:5,"aurelien tchouameni":5,camavinga:5},
 Espanha:{"unai simon":5,laporte:5,cucurella:5,"mikel merino":5,"dani olmo":5,"ferran torres":5},
 Inglaterra:{stones:5,pickford:5,guehi:5,"declan rice":5,foden:8},
 Portugal:{"ruben dias":5,"diogo costa":5,"joao cancelo":5,vitinha:5,"nuno mendes":5,"joao felix":5},
 Alemanha:{rudiger:5,neuer:5,"jonathan tah":5,havertz:5,goretzka:5,gnabry:5},
 Holanda:{"de ligt":5,dumfries:5,gravenberch:5,reijnders:5,depay:5},
 Argentina:{romero:5,"lisandro martinez":5,"de paul":5,"mac allister":5,"enzo fernandez":5,"julian alvarez":8},
 Belgica:{openda:5,trossard:5,tielemans:5},
 Uruguai:{bentancur:5,arrascaeta:5},
 Marrocos:{bono:5,ziyech:5},
 Croacia:{kovacic:5,perisic:5},
 Colombia:{cuadrado:5},
 Senegal:{koulibaly:5,"ismaila sarr":5},
 Japao:{kubo:5},
};
for(const t in PROMO){STARS[t]=Object.assign({},STARS[t]||{});for(const k in PROMO[t])STARS[t][k]=Math.max(STARS[t][k]||0,PROMO[t][k]);}
const starVal=(team,name)=>{const m=STARS[team];if(!m)return 0;const n=norm(name);let b=0;for(const[k,v]of Object.entries(m))if(n.includes(norm(k)))b=Math.max(b,v);return b;};
const hash=(s)=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;};

const SEQ={
 elite: [5,5,5,5,5,5,5,5,5,5,5,3,3,3,3,2,2,2,2,2,2],
 strong:[5,5,5,3,3,3,3,3,3,2,2,2,2,2,2,2,2],
 mid:   [5,3,3,3,2,2,2,2,2,2,2],
 weak:  [3,2,2,2,2,2],
};
const tierOf=(t)=>{const r=rankOf(t);return r<8?"elite":r<20?"strong":r<35?"mid":"weak";};

const all=await prisma.player.findMany({select:{id:true,name:true,team:true,position:true,price:true}});
const byTeam={};for(const pl of all){(byTeam[pl.team]??=[]).push(pl);}
const np=new Map();
for(const team in byTeam){
  const seq=SEQ[tierOf(team)];
  const arr=byTeam[team].map(pl=>({pl,sv:starVal(pl.team,pl.name)}));
  arr.sort((a,b)=> b.sv-a.sv || (hash(a.pl.id||a.pl.name)-hash(b.pl.id||b.pl.name)));
  arr.forEach((o,i)=>{ np.set(o.pl.id, Math.max(seq[i]??1, o.sv)); });
}
const oito=all.filter(pl=>np.get(pl.id)===8).sort((a,b)=>a.team.localeCompare(b.team));
console.log("=== 8¢ ("+oito.length+") ===");
for(const x of oito) console.log("  "+x.name+" — "+x.team+" ("+x.position+")");
const POS=["GOL","ZAG","LAT","MEI","ATA"];
const fmt=(h)=>[1,2,3,5,8].map(t=>`${t}¢:${String(h[t]).padStart(3)}`).join("  ");
const hist=(f)=>{const h={1:0,2:0,3:0,5:0,8:0};for(const pl of all)if(f(pl))h[np.get(pl.id)]++;return h;};
console.log("=== por posição ===");for(const pos of POS)console.log(pos.padEnd(4),fmt(hist(pl=>pl.position===pos)));
const tot=hist(()=>true);console.log("=== total ===\n",fmt(tot));
console.log("média:",([1,2,3,5,8].reduce((s,t)=>s+t*tot[t],0)/all.length).toFixed(2),"¢/jogador");
const teams={};for(const pl of all){(teams[pl.team]??={tot:0,t5:0,one:0});const v=np.get(pl.id);teams[pl.team].tot+=v;if(v>=5)teams[pl.team].t5++;if(v<=2)teams[pl.team].one++;}
const ta=Object.entries(teams).sort((a,b)=>b[1].tot-a[1].tot);
console.log("\nTop 8 (tot|≥5¢|pechinchas≤2¢):");for(const[t,v] of ta.slice(0,8))console.log("  "+t.padEnd(12),`tot:${String(v.tot).padStart(3)} ≥5:${v.t5} ≤2¢:${v.one}`);
console.log("Fracos:");for(const[t,v] of [ta[24],ta[40],ta[47]])console.log("  "+t.padEnd(12),`tot:${v.tot} ≤2¢:${v.one}`);
let chg=0;for(const pl of all)if(np.get(pl.id)!==pl.price)chg++;console.log("Mudanças:",chg);
if(APPLY){
  const byPrice={1:[],2:[],3:[],5:[],8:[]};
  for(const [id,price] of np) byPrice[price].push(id);
  for(const price of [1,2,3,5,8]) if(byPrice[price].length) await prisma.player.updateMany({where:{id:{in:byPrice[price]}},data:{price}});
  console.log("✅ aplicado via updateMany");
}
await prisma.$disconnect();
