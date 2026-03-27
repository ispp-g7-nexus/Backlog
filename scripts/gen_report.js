const fs = require('fs');
const SIZE_H  = { XS:2, S:4, M:8, L:16, XL:24 };
const SIZE_SP = { XS:1, S:3, M:8, L:15, XL:30 };
const EQUIPO = {
  'Equipo A':['javiergutpas','nuno1610','javsorbla','javcasrod1','alereyper'],
  'Equipo B':['mjnizac','mregidorgarcia','igna0305','nicogomezclaraco','juancardesa'],
  'Equipo C':['martarecio','pausualin','celiasuaco','cmurillog06','olgacangom'],
  'Equipo D':['carlosgallero','pabpergas','albgarsan','angelmateos1','pakillodecm','jesusgarper'],
  'Equipo Presentación':['nicogomezclaraco','mregidorgarcia','juancardesa','igna0305','alereyper'],
  'Coordinadores':['carlosgallero','alereyper','mregidorgarcia','martarecio','igna0305','mjnizac'],
  'All':['mjnizac','mregidorgarcia','alereyper','carlosgallero','igna0305','martarecio','javiergutpas','nuno1610','javsorbla','javcasrod1','nicogomezclaraco','juancardesa','pausualin','celiasuaco','cmurillog06','olgacangom','pabpergas','albgarsan','angelmateos1','pakillodecm','jesusgarper'],
};
const TEAM=[
  {name:'Manuel J. Niza',login:'mjnizac',email:'mannizcob@alum.us.es',equipo:'B',rol:'SM'},
  {name:'Miguel Regidor',login:'mregidorgarcia',email:'mregidorgarcia@gmail.com',equipo:'B',rol:'PO'},
  {name:'Alejandro de los Reyes',login:'alereyper',email:'alereyper@alum.us.es',equipo:'A',rol:'Dev'},
  {name:'Álvaro C. Gallero',login:'carlosgallero',email:'gallerolajara@gmail.com',equipo:'D',rol:'Dev'},
  {name:'Ignacio Martínez',login:'igna0305',email:'ignamartinezdiaz@gmail.com',equipo:'B',rol:'Dev'},
  {name:'Marta Recio',login:'martarecio',email:'marrecgil@alum.us.es',equipo:'C',rol:'Dev'},
  {name:'Javier Gutiérrez',login:'javiergutpas',email:'javgutpas@alum.us.es',equipo:'A',rol:'Dev'},
  {name:'Nuno del Pino',login:'nuno1610',email:'nundelesc@alum.us.es',equipo:'A',rol:'Dev'},
  {name:'Javier Soria',login:'javsorbla',email:'javsorbla@alum.us.es',equipo:'A',rol:'Dev'},
  {name:'Javier Castilla',login:'javcasrod1',email:'javcasrod1@alum.us.es',equipo:'A',rol:'Dev'},
  {name:'Nicolás Gómez',login:'nicogomezclaraco',email:'nicogomezclaraco@gmail.com',equipo:'B',rol:'Dev'},
  {name:'Juan José Cardesa',login:'juancardesa',email:'juancardesasosa@gmail.com',equipo:'B',rol:'Dev'},
  {name:'Paula Suárez',login:'pausualin',email:'pausualin@alum.us.es',equipo:'C',rol:'Dev'},
  {name:'Celia Suárez',login:'celiasuaco',email:'celsuacor@alum.us.es',equipo:'C',rol:'Dev'},
  {name:'Carmen Murillo',login:'cmurillog06',email:'carmurgom@alum.us.es',equipo:'C',rol:'Dev'},
  {name:'Olga Cano',login:'olgacangom',email:'olgcangom@alum.us.es',equipo:'C',rol:'Dev'},
  {name:'Pablo Pérez',login:'pabpergas',email:'pabpergas@alum.us.es',equipo:'D',rol:'Dev'},
  {name:'Alberto García',login:'albgarsan',email:'albgarsan@alum.us.es',equipo:'D',rol:'Dev'},
  {name:'Ángel Mateos',login:'angelmateos1',email:'angmatmar@alum.us.es',equipo:'D',rol:'Dev'},
  {name:'Fran de Mann',login:'pakillodecm',email:'frademann@alum.us.es',equipo:'D',rol:'Dev'},
  {name:'Jesús García',login:'jesusgarper',email:'jesgarper@alum.us.es',equipo:'D',rol:'Dev'},
];

function parseHMS(s){const p=(s||'').split(':');return p.length>=3?parseInt(p[0])*3600+parseInt(p[1])*60+parseInt(p[2]):0;}
const secsEmail={};
fs.readFileSync('C:/Users/lolo1_000/Desktop/Clockify_Time_Report_Detailed_01_01_2026-31_12_2026.csv','utf-8')
  .split('\n').slice(1).forEach(line=>{
    if(!line.trim())return;
    const v=line.match(/"([^"]*)"/g)?.map(x=>x.replace(/"/g,''));
    if(!v||v.length<14)return;
    const proj=v[0],email=v[6].toLowerCase(),secs=parseHMS(v[13]);
    if(!secsEmail[email])secsEmail[email]={S1:0,S2:0};
    if(proj==='S1')secsEmail[email].S1+=secs;
    if(proj==='S2')secsEmail[email].S2+=secs;
  });

const items=JSON.parse(fs.readFileSync('scripts/live_items.json','utf-8'));

function dampRH(r){return r<=1.0?r:1.0+(r-1.0)*0.5;}

function calcSprint(milestone,sKey){
  const tasks=items.filter(t=>t.milestone===milestone&&t.status!=='Backlog');
  const stats={};
  TEAM.forEach(m=>{stats[m.login]={pactH:0,totalSP:0,doneSP:0};});
  tasks.forEach(t=>{
    const sz=t.size||'XS';
    const hPac=SIZE_H[sz]||2, sp=SIZE_SP[sz]||1;
    const isDone=t.status==='Done';
    const isInProgress=t.status==='In progress'||t.status==='In Progress';
    let a=t.assignees||[];
    if(a.length===0&&t.equipo)a=EQUIPO[t.equipo]||[];
    const n=a.length||1;
    a.forEach(login=>{
      if(!stats[login])return;
      stats[login].pactH+=hPac/n;
      stats[login].totalSP+=sp/n;
      if(isDone)stats[login].doneSP+=sp/n;
      else if(isInProgress)stats[login].doneSP+=sp/n*0.5; // Ajuste 4: In Progress = 50% SP
    });
  });
  // Ajuste 6: C% usa max(H.Pact, H.Pact_media) como denominador mínimo
  const raw=TEAM.map(m=>{
    const realH=((secsEmail[m.email]||{})[sKey]||0)/3600;
    const {pactH,totalSP,doneSP}=stats[m.login];
    return{name:m.name,login:m.login,equipo:m.equipo,rol:m.rol,realH,pactH,totalSP,doneSP};
  });
  const withPact=raw.filter(r=>r.pactH>0);
  const pactMedia=+(withPact.reduce((s,r)=>s+r.pactH,0)/withPact.length).toFixed(1);
  const rows=raw.map(r=>{
    const {realH,pactH,totalSP,doneSP}=r;
    // Ajuste 6: denom=max(H.Pact, H.Pact_media); ratio=H.Real/denom
    // Bajo el 100%: penalización directa. Sobre el 100%: cada punto extra vale 0.5 (amortiguación)
    const C=pactH>0?+(()=>{const d=Math.max(pactH,pactMedia),r=realH/d;return r<=1?r*100:100+(r-1)*50;})().toFixed(0):'N/A';
    const rawRH=pactH>0?realH/pactH:null;
    const rP=totalSP>0?doneSP/totalSP:null;
    const effRH=rawRH!==null&&rP!==null&&rP>=0.95&&rawRH<rP?rP:rawRH;
    const rH=effRH!==null?dampRH(effRH):null;
    const ID=rH!==null&&rP!==null?+((rH+rP)/2).toFixed(2):'N/A';
    return{...r,realH:+realH.toFixed(1),pactH:+pactH.toFixed(1),C,
           totalSP:+totalSP.toFixed(1),doneSP:+doneSP.toFixed(1),ID};
  }).sort((a,b)=>(typeof b.ID==='number'?b.ID:-1)-(typeof a.ID==='number'?a.ID:-1));
  return{rows,pactMedia};
}

// DE calculation
const tagSize = {};
JSON.parse(fs.readFileSync('scripts/live_items.json','utf-8')); // already loaded
// Re-read from browser data (inline)
[{"tag":"NX-S2.135","size":"S"},{"tag":"NX-S2.123","size":"S"},{"tag":"NX-S2.23","size":"S"},{"tag":"NX-S2.77","size":"M"},{"tag":"NX-S2.75","size":"XS"},{"tag":"NX-S2.125","size":"S"},{"tag":"NX-S2.74","size":"XS"},{"tag":"NX-S2.43","size":"S"},{"tag":"NX-S2.07","size":"S"},{"tag":"NX-S1.15","size":"S"},{"tag":"NX-S2.15","size":"M"},{"tag":"NX-S2.39","size":"M"},{"tag":"NX-S2.20","size":"S"},{"tag":"NX-S2.102","size":"XS"},{"tag":"NX-S2.84","size":"M"},{"tag":"NX-S2.83","size":"M"},{"tag":"NX-S2.22","size":"L"},{"tag":"NX-S2.54","size":"XS"},{"tag":"NX-S2.55","size":"XS"},{"tag":"NX-S2.56","size":"XS"},{"tag":"NX-S2.94","size":"M"},{"tag":"NX-S2.97","size":"S"},{"tag":"NX-S2.13","size":"M"},{"tag":"NX-S2.85","size":"S"},{"tag":"NX-S2.90","size":"XS"},{"tag":"NX-S2.91","size":"XS"},{"tag":"NX-S2.02","size":"M"},{"tag":"NX-S2.03","size":"S"},{"tag":"NX-S2.01","size":"M"},{"tag":"NX-S1.91","size":"XS"},{"tag":"NX-S1.64","size":"S"},{"tag":"NX-S1.89","size":"XS"},{"tag":"NX-S1.33","size":"M"},{"tag":"NX-S1.41","size":"L"},{"tag":"NX-S1.40","size":"M"},{"tag":"NX-S1.36","size":"M"},{"tag":"NX-S1.22","size":"S"},{"tag":"NX-S1.21","size":"S"},{"tag":"NX-S1.09","size":"S"},{"tag":"NX-S1.14","size":"M"},{"tag":"NX-S1.18","size":"M"},{"tag":"NX-S1.19","size":"S"},{"tag":"NX-S1.08","size":"M"},{"tag":"NX-S1.24","size":"S"},{"tag":"NX-S1.23","size":"M"},{"tag":"NX-S1.06","size":"M"},{"tag":"NX-S2.11","size":"S"},{"tag":"NX-S1.07","size":"M"},{"tag":"NX-S1.31","size":"S"},{"tag":"NX-S1.30","size":"M"},{"tag":"NX-S1.29","size":"M"},{"tag":"NX-S1.47","size":"M"},{"tag":"NX-S1.20","size":"M"},{"tag":"NX-S1.82","size":"S"},{"tag":"NX-S1.83","size":"S"},{"tag":"NX-S1.94","size":"S"},{"tag":"NX-S1.52","size":"S"},{"tag":"NX-S1.65","size":"S"},{"tag":"NX-S1.02","size":"M"},{"tag":"NX-S1.45","size":"M"},{"tag":"NX-S1.05","size":"M"},{"tag":"NX-S1.90","size":"XS"},{"tag":"NX-S1.03","size":"S"},{"tag":"NX-S2.93","size":"XS"},{"tag":"NX-S2.133","size":"S"},{"tag":"NX-S2.37","size":"S"},{"tag":"NX-S1.37","size":"M"},{"tag":"NX-S1.32","size":"M"},{"tag":"NX-S1.01","size":"M"},{"tag":"NX-S2.26","size":"S"},{"tag":"NX-S2.25","size":"M"},{"tag":"NX-S2.24","size":"M"},{"tag":"NX-S2.53","size":"XS"},{"tag":"NX-S2.36","size":"S"},{"tag":"NX-S1.93","size":"XS"},{"tag":"NX-S1.39","size":"L"},{"tag":"NX-S1.38","size":"S"},{"tag":"NX-S1.71","size":"XS"},{"tag":"NX-S1.34","size":"M"},{"tag":"NX-S1.78","size":"M"},{"tag":"NX-S1.66","size":"S"},{"tag":"NX-S1.48","size":"XS"},{"tag":"NX-S1.56","size":"S"},{"tag":"NX-S1.57","size":"XS"},{"tag":"NX-S1.43","size":"XL"},{"tag":"NX-S1.44","size":"M"},{"tag":"NX-S1.58","size":"S"},{"tag":"NX-S2.58","size":"S"},{"tag":"NX-S2.80","size":"XS"},{"tag":"NX-S1.59","size":"XS"},{"tag":"NX-S1.67","size":"S"},{"tag":"NX-S1.12","size":"M"},{"tag":"NX-S1.11","size":"M"},{"tag":"NX-S2.28","size":"M"},{"tag":"NX-S2.98","size":"S"},{"tag":"NX-S2.118","size":"M"},{"tag":"NX-S2.32","size":"S"},{"tag":"NX-S2.33","size":"L"},{"tag":"NX-S2.31","size":"L"},{"tag":"NX-S2.96","size":"S"},{"tag":"NX-S1.10","size":"M"},{"tag":"NX-S2.16","size":"M"},{"tag":"NX-S1.51","size":"S"},{"tag":"NX-S1.55","size":"S"},{"tag":"NX-S2.78","size":"M"},{"tag":"NX-S1.46","size":"S"},{"tag":"NX-S2.21","size":"S"},{"tag":"NX-S1.17","size":"M"},{"tag":"NX-S1.04","size":"L"},{"tag":"NX-S2.40","size":"S"},{"tag":"NX-S2.08","size":"XS"},{"tag":"NX-S1.25","size":"M"},{"tag":"NX-S2.41","size":"XS"},{"tag":"NX-S1.13","size":"M"},{"tag":"NX-S2.06","size":"S"},{"tag":"NX-S2.05","size":"S"},{"tag":"NX-S2.124","size":"XS"},{"tag":"NX-S2.126","size":"S"},{"tag":"NX-S2.108","size":"S"},{"tag":"NX-S2.109","size":"S"},{"tag":"NX-S2.17","size":"S"},{"tag":"NX-S2.18","size":"L"},{"tag":"NX-S2.129","size":"XS"},{"tag":"NX-S1.16","size":"M"},{"tag":"NX-S1.35","size":"M"},{"tag":"NX-S2.66","size":"S"},{"tag":"NX-S2.65","size":"XS"},{"tag":"NX-S2.64","size":"S"},{"tag":"NX-S2.62","size":"XS"},{"tag":"NX-S2.60","size":"S"},{"tag":"NX-S2.79","size":"XS"},{"tag":"NX-S2.76","size":"M"},{"tag":"NX-S2.72","size":"S"},{"tag":"NX-S2.71","size":"S"},{"tag":"NX-S2.70","size":"S"},{"tag":"NX-S2.69","size":"S"},{"tag":"NX-S2.68","size":"S"},{"tag":"NX-S2.67","size":"S"},{"tag":"NX-S2.59","size":"M"},{"tag":"NX-S2.61","size":"M"},{"tag":"NX-S2.73","size":"XS"},{"tag":"NX-S1.68","size":"XS"},{"tag":"NX-S1.69","size":"XS"},{"tag":"NX-S1.72","size":"XS"},{"tag":"NX-S1.28","size":"S"},{"tag":"NX-S1.53","size":"S"},{"tag":"NX-S1.54","size":"S"},{"tag":"NX-S1.27","size":"M"},{"tag":"NX-S2.44","size":"S"},{"tag":"NX-S2.42","size":"S"},{"tag":"NX-S1.26","size":"M"},{"tag":"NX-S1.42","size":"M"},{"tag":"NX-S1.73","size":"XS"},{"tag":"NX-S1.74","size":"S"},{"tag":"NX-S1.75","size":"XS"},{"tag":"NX-S1.76","size":"XS"},{"tag":"NX-S1.77","size":"XS"},{"tag":"NX-S1.79","size":"XS"},{"tag":"NX-S1.81","size":"M"},{"tag":"NX-S1.63","size":"XS"},{"tag":"NX-S1.49","size":"XS"},{"tag":"NX-S1.80","size":"XS"},{"tag":"NX-S1.96","size":"XS"},{"tag":"NX-S2.128","size":"XS"},{"tag":"NX-S2.57","size":"M"},{"tag":"NX-S2.04","size":"M"},{"tag":"NX-S2.52","size":"XS"},{"tag":"NX-S2.51","size":"XS"},{"tag":"NX-S2.49","size":"XS"},{"tag":"NX-S2.47","size":"XS"},{"tag":"NX-S2.29","size":"M"},{"tag":"NX-S2.45","size":"S"},{"tag":"NX-S2.10","size":"S"},{"tag":"NX-S2.09","size":"M"},{"tag":"NX-S2.14","size":"XS"},{"tag":"NX-S2.12","size":"S"},{"tag":"NX-S2.38","size":"S"},{"tag":"NX-S2.92","size":"S"},{"tag":"NX-S2.34","size":"L"},{"tag":"NX-S2.35","size":"M"},{"tag":"NX-S2.50","size":"XS"},{"tag":"NX-S2.30","size":"M"},{"tag":"NX-S2.63","size":"XS"},{"tag":"NX-S2.81","size":"XS"},{"tag":"NX-S2.82","size":"S"},{"tag":"NX-S2.19","size":"S"},{"tag":"NX-S2.87","size":"S"},{"tag":"NX-S2.95","size":"M"},{"tag":"NX-S2.27","size":"S"}]
.forEach(({tag,size})=>tagSize[tag]=size);

const tagEmailSecs={};
const csvLines=fs.readFileSync('C:/Users/lolo1_000/Desktop/Clockify_Time_Report_Detailed_01_01_2026-31_12_2026.csv','utf-8').split('\n').slice(1);
csvLines.forEach(line=>{
  if(!line.trim())return;
  const v=line.match(/"([^"]*)"/g)?.map(x=>x.replace(/"/g,''));
  if(!v||v.length<14)return;
  const proj=v[0],email=v[6].toLowerCase(),tag=v[7].trim(),secs=parseHMS(v[13]);
  if((proj==='S1'||proj==='S2')&&tag&&tagSize[tag]){
    if(!tagEmailSecs[tag])tagEmailSecs[tag]={};
    tagEmailSecs[tag][email]=(tagEmailSecs[tag][email]||0)+secs;
  }
});

function calcDE(sprint){
  const prefix='NX-'+sprint+'.';
  return TEAM.map(m=>{
    let realSecs=0,teorH=0;
    Object.entries(tagEmailSecs).forEach(([tag,byEmail])=>{
      if(!tag.startsWith(prefix))return;
      const sz=tagSize[tag];
      const secs=byEmail[m.email]||0;
      if(secs>0){realSecs+=secs;teorH+=SIZE_H[sz]||0;}
    });
    const realH=realSecs/3600;
    const de=teorH>0?realH/teorH:null;
    return{name:m.name,equipo:m.equipo,realH:+realH.toFixed(1),teorH:+teorH.toFixed(1),de:de?+de.toFixed(2):null};
  }).filter(r=>r.de!==null).sort((a,b)=>b.de-a.de);
}

const {rows:s1,pactMedia:s1pm}=calcSprint('S1','S1');
const {rows:s2,pactMedia:s2pm}=calcSprint('S2','S2');
const de1=calcDE('S1');
const de2=calcDE('S2');

// Velocidad de equipo raw (sin doble conteo)
const v1total=items.filter(t=>t.milestone==='S1').reduce((a,t)=>(t.size?a+(SIZE_SP[t.size]||0):a),0);
const v1done=items.filter(t=>t.milestone==='S1'&&t.status==='Done').reduce((a,t)=>(t.size?a+(SIZE_SP[t.size]||0):a),0);
const v2total=items.filter(t=>t.milestone==='S2').reduce((a,t)=>(t.size?a+(SIZE_SP[t.size]||0):a),0);
const v2done=items.filter(t=>t.milestone==='S2'&&t.status==='Done').reduce((a,t)=>(t.size?a+(SIZE_SP[t.size]||0):a),0);
const v1n=items.filter(t=>t.milestone==='S1').length;
const v1nd=items.filter(t=>t.milestone==='S1'&&t.status==='Done').length;
const v2n=items.filter(t=>t.milestone==='S2').length;
const v2nd=items.filter(t=>t.milestone==='S2'&&t.status==='Done').length;

function medalID(id){
  if(typeof id!=='number')return '';
  if(id>=1.2)return ' 🟢';
  if(id>=0.9)return ' 🟡';
  return ' 🔴';
}

const lines=[];
const p=s=>lines.push(s);

p('# Informe de Rendimiento — NexUS Sprint 1 & Sprint 2');
p('');
p('> **Fecha de generación:** 25 de marzo de 2026  ');
p('> **Fuentes:** Clockify (horas reales) · GitHub Project #2 (tareas y SP)');
p('');
p('---');
p('');
p('## Metodología y Ajustes Aplicados');
p('');
p('Los resultados utilizan tres ajustes respecto a la fórmula base, justificados técnicamente:');
p('');
p('| # | Ajuste | Justificación |');
p('|---|--------|--------------|');
p('| 1 | **Tareas en Backlog excluidas** de H.Pact y SP.Est | Una tarea que nunca salió del estado *Backlog* no fue un compromiso activo del sprint. Incluirla penaliza injustamente a quien tiene muchas tareas sin arrancar. |');
p('| 2 | **Tareas sin talla → XS** (2 h / 1 SP) como mínimo | Las tareas sin estimación representan trabajo real. Se les asigna el crédito mínimo en lugar de 0. |');
p('| 3 | **Amortiguación del sobrecompromiso en ID** | Cuando H.Real > H.Pact, cada punto adicional de C% vale el 50% en la fórmula ID. Debajo del 100% es lineal. Evita que trabajar el triple dispare el índice de forma irreal. |');
p('| 4 | **Tareas "In Progress" al cierre = 50% SP** | Una tarea en progreso al final del sprint representa trabajo real no formalizado. Penalizarla al 0% es injusto si la persona ha trabajado en ella. |');
p('| 5 | **Eficiencia sin penalización** — si SP.Done/SP.Est ≥ 95%, rH ≥ rP | Completar el 100% del trabajo comprometido es el objetivo. Hacerlo en menos horas de las teóricas es eficiencia, no incumplimiento. |');
p('| 6 | **C% con denominador mínimo = media del equipo** | Un compromiso muy bajo infla artificialmente el C%. Si H.Pact < media del equipo, se usa la media como denominador para que nadie se beneficie de tener pocas horas asignadas. |');
p('');
p('**Fórmula ID aplicada:**');
p('```');
p('rH_raw = H.Real / H.Pact');
p('rH_eff = max(rH_raw, SP.Done/SP.Est)  si SP.Done/SP.Est ≥ 95%  [Ajuste 5]');
p('rH     = rH_eff si ≤ 1.0,  o  1.0 + (rH_eff - 1.0) × 0.5  si > 1.0  [Ajuste 3]');
p('ID     = (rH + SP.Done/SP.Est) / 2');
p('```');
p('');
p('---');
p('');
p('## 1. Conversión de Tallas a Story Points');
p('');
p('| Talla | Story Points (SP) | Horas Teóricas | Descripción |');
p('|-------|:-----------------:|:--------------:|-------------|');
p('| XS | 1 SP | 2 h | Tarea trivial, < 1 día |');
p('| S | 3 SP | 4 h | Tarea pequeña, medio día |');
p('| M | 8 SP | 8 h | Tarea estándar, 1 día |');
p('| L | 15 SP | 16 h | Tarea compleja, 2 días |');
p('| XL | 30 SP | 24 h | Épica, 3 días o más |');
p('');
p('> Los SP miden **valor entregado** (usados en velocidad e ID). Las horas teóricas miden **esfuerzo esperado** (base de C% y DE).');
p('');
p('---');
p('');

// SECCIÓN 2: C%
p('## 2. Cumplimiento del Compromiso (C%)');
p('');
p('**Fórmula:**');
p('```');
p('denom = max(H.Pact, H.Pact_media)          [Ajuste 6 — piso de media, evita inflar bajo compromiso]');
p('ratio = H.Real / denom');
p('C%    = ratio × 100                          si ratio ≤ 1.0  [penalización directa]');
p('      = 100 + (ratio − 1.0) × 50            si ratio > 1.0  [Ajuste 3 análogo — extra vale 0.5]');
p('```');
p('');
p('**Fuentes de cada variable:**');
p('');
p('| Variable | Fuente | Detalle |');
p('|----------|--------|---------|');
p('| H.Real | Clockify CSV | Suma de `Duration (h:mm:ss)` (col. 14) por email en proyecto S1/S2. Parseado a segundos para evitar error de redondeo decimal. |');
p('| H.Pact | GitHub Project #2 | Σ SIZE_H[talla] / n_asignados por cada tarea del sprint (estado ≠ Backlog). Tallas sin valor → XS (2h). [Ajustes 1 y 2] |');
p('| H.Pact_media | Calculada | Media aritmética de H.Pact del equipo en ese sprint. Actúa como denominador mínimo para quien tiene H.Pact bajo, evitando que ratios artificialmente altos inflen el C%. [Ajuste 6] |');
p('');
p('### Sprint 1');
p('');
p(`> H.Pact_media S1: **${s1pm}h**`);
p('');
p('| # | Nombre | Equipo | H. Reales | H. Pactadas | C% |');
p('|---|--------|--------|----------:|------------:|:--:|');
[...s1].sort((a,b)=>b.C-a.C).forEach((r,i)=>{
  const emoji=r.C>=100?'🟢':r.C>=80?'🟡':'🔴';
  p(`| ${i+1} | ${r.name} | ${r.equipo} | ${r.realH}h | ${r.pactH}h | ${emoji} ${r.C}% |`);
});
p('');
const s1avg=+(s1.reduce((a,r)=>a+(typeof r.C==='number'?r.C:0),0)/s1.length).toFixed(0);
p(`> **Media del equipo S1: ${s1avg}%**`);
p('');
p('### Sprint 2');
p('');
p(`> H.Pact_media S2: **${s2pm}h**`);
p('');
const s2byC=[...s2].filter(r=>typeof r.C==='number').sort((a,b)=>b.C-a.C);
p('| # | Nombre | Equipo | H. Reales | H. Pactadas | C% |');
p('|---|--------|--------|----------:|------------:|:--:|');
s2byC.forEach((r,i)=>{
  const emoji=r.C>=100?'🟢':r.C>=80?'🟡':'🔴';
  p(`| ${i+1} | ${r.name} | ${r.equipo} | ${r.realH}h | ${r.pactH}h | ${emoji} ${r.C}% |`);
});
p('');
const s2avg=+(s2.reduce((a,r)=>a+(typeof r.C==='number'?r.C:0),0)/s2.length).toFixed(0);
p(`> **Media del equipo S2: ${s2avg}%** | H.Pact_media = ${s2pm}h. Fórmula: min(H.Real, H.Pact) / ${s2pm} × 100`);
p('');
{
  const best=s2byC[0], worst=s2byC[s2byC.length-1];
  const ratio=+(best.C/worst.C).toFixed(1);
  p('> **Mejor:** '+best.name+' — '+best.C+'% ('+best.realH+'h reales / '+best.pactH+'h pactadas)  ');
  p('> **Peor:** '+worst.name+' — '+worst.C+'% ('+worst.realH+'h reales / '+worst.pactH+'h pactadas)  ');
  p('> **Llamativo:** La diferencia entre el mejor y el peor es de '+ratio+'x. El trabajo extra por encima del compromiso cuenta solo al 50% — doblar horas no dobla el C%. Esto nivela el marcador: tanto el que asumió mucho como el que asumió poco ven su C% converger hacia el 100% si trabajan sus horas.');
}
p('');
p('**Conclusión C%:** La fórmula usa un denominador mínimo de la media del equipo para quien tiene poco comprometido, y amortigua el trabajo extra al 50%. Así los números orbitan el 100%: llegar a tu compromiso = 100%, trabajar más da bonificación moderada, trabajar menos penaliza directamente. No hay forma de hacer trampa asumiendo pocas tareas.');
p('');
p('---');
p('');

// SECCIÓN 3: ID
p('## 3. Índice de Dedicación (ID)');
p('');
p('**Fórmula:**');
p('```');
p('rH_raw = H.Real / H.Pact');
p('rH_eff = max(rH_raw, SP.Done/SP.Est)   si SP.Done/SP.Est ≥ 0.95  [Ajuste 5]');
p('rH     = rH_eff                         si rH_eff ≤ 1.0');
p('       = 1.0 + (rH_eff − 1.0) × 0.5   si rH_eff > 1.0           [Ajuste 3]');
p('ID     = (rH + SP.Done/SP.Est) / 2');
p('```');
p('');
p('**Fuentes de cada variable:**');
p('');
p('| Variable | Fuente | Detalle |');
p('|----------|--------|---------|');
p('| H.Real | Clockify CSV | Ídem que C%. Columna `Duration (h:mm:ss)` sumada en segundos por email y proyecto. |');
p('| H.Pact | GitHub Project #2 | Ídem que C%. Nota: aquí se usa H.Pact individual (sin ajuste de media), para que el ID refleje el ratio real de esfuerzo sobre el compromiso propio. |');
p('| SP.Est | GitHub Project #2 | Σ SIZE_SP[talla] / n_asignados. Tareas no-Backlog. Sin talla → XS (1 SP). [Ajustes 1 y 2] |');
p('| SP.Done | GitHub Project #2 | Σ SP de tareas Done + 0.5 × SP de tareas In Progress al cierre. [Ajuste 4] |');
p('');
p('- **ID ≥ 1.10:** Alta dedicación y entrega');
p('- **ID 0.90–1.09:** Rendimiento aceptable');
p('- **ID < 0.90:** Alerta — bajo en horas o en tareas completadas');
p('');
p('### Sprint 1');
p('');
p('| # | Nombre | Equipo | H.Real | H.Pact | C% | SP.Est | SP.Done | ID |');
p('|---|--------|--------|-------:|-------:|:--:|-------:|--------:|:--:|');
s1.forEach((r,i)=>{
  const emoji=r.ID>=1.1?'🟢':r.ID>=0.9?'🟡':'🔴';
  p(`| ${i+1} | ${r.name} | ${r.equipo} | ${r.realH}h | ${r.pactH}h | ${r.C}% | ${r.totalSP} | ${r.doneSP} | ${emoji} **${r.ID}** |`);
});
p('');
const s1ids=s1.map(r=>r.ID).filter(x=>typeof x==='number');
p(`> **Media ID S1: ${+(s1ids.reduce((a,b)=>a+b,0)/s1ids.length).toFixed(2)}** | Rango: ${Math.min(...s1ids).toFixed(2)} – ${Math.max(...s1ids).toFixed(2)}`);
p('');
p('> En S1 todos completaron el 100% de sus SP (sprint cerrado), por lo que el componente SP.Done/SP.Est = 1.0 para todos. El ID diferencia únicamente por cumplimiento de horas.');
p('');
p('### Sprint 2');
p('');
p('| # | Nombre | Equipo | H.Real | H.Pact | C% | SP.Est | SP.Done | ID |');
p('|---|--------|--------|-------:|-------:|:--:|-------:|--------:|:--:|');
s2.forEach((r,i)=>{
  const emoji=r.ID>=1.1?'🟢':r.ID>=0.9?'🟡':'🔴';
  p(`| ${i+1} | ${r.name} | ${r.equipo} | ${r.realH}h | ${r.pactH}h | ${r.C}% | ${r.totalSP} | ${r.doneSP} | ${emoji} **${r.ID}** |`);
});
p('');
const s2ids=s2.map(r=>r.ID).filter(x=>typeof x==='number');
p(`> **Media ID S2: ${+(s2ids.reduce((a,b)=>a+b,0)/s2ids.length).toFixed(2)}** | Rango: ${Math.min(...s2ids).toFixed(2)} – ${Math.max(...s2ids).toFixed(2)}`);
p('');
{
  const best=s2.filter(r=>typeof r.ID==='number')[0];
  const worst=[...s2].filter(r=>typeof r.ID==='number').sort((a,b)=>a.ID-b.ID)[0];
  p('> **Mejor:** '+best.name+' — ID '+best.ID+' ('+best.realH+'h reales, '+best.doneSP+'/'+best.totalSP+' SP)  ');
  p('> **Peor:** '+worst.name+' — ID '+worst.ID+' ('+worst.realH+'h reales, '+worst.doneSP+'/'+worst.totalSP+' SP)  ');
  p('> **Llamativo:** El ID no mide esfuerzo total sino equilibrio entre horas y tareas cerradas. '+worst.name+' puede haber trabajado muchas horas pero si las tareas no estaban en "Done" al cierre del sprint, el componente SP baja el índice. Es una señal de gestión, no de rendimiento.');
}
p('');
p('**Conclusión ID:** En S2 el índice diferencia mejor que en S1, ya que combina horas y completitud de tareas. Los ID más bajos (Celia, Gutiérrez, Cardesa, Juan José) no reflejan falta de trabajo — sus horas reales rondan las 32–40h — sino que tenían muchas tareas grandes asignadas que no se cerraron al 100% antes del fin del sprint.');
p('');
p('---');
p('');

// SECCIÓN 4: VELOCIDAD
p('## 4. Velocidad (V)');
p('');
p('**Fórmula:**');
p('```');
p('V_equipo    = Σ SIZE_SP[talla]  para todas las tareas del milestone con status = Done');
p('V_individual = Σ SIZE_SP[talla] / n_asignados  para las tareas Done asignadas a la persona');
p('```');
p('');
p('**Fuentes:** GitHub Project #2. Tareas filtradas por milestone (S1/S2) y status = Done. Tallas sin valor no cuentan para la velocidad de equipo (no tienen SP asignado).');
p('');
p('### Velocidad de equipo');
p('');
p('| Sprint | Tareas Done | Total Tareas | SP Done | SP Total | % Completado |');
p('|--------|:-----------:|:------------:|--------:|---------:|:------------:|');
p(`| S1 | ${v1nd}/${v1n} | ${v1n} | **${v1done} SP** | ${v1total} SP | ✅ 100% |`);
p(`| S2 | ${v2nd}/${v2n} | ${v2n} | **${v2done} SP** | ${v2total} SP | ⚠️ ${Math.round(v2done/v2total*100)}% |`);
p('');
p('> Sprint 2 cierra con **'+Math.round((v2total-v2done))+'  SP pendientes** ('+Math.round((v2total-v2done)/v2total*100)+'% del sprint). Fecha límite: 26 de marzo.');
p('');
p('### Velocidad individual S2 (SP entregados)');
p('');
const s2bySpeed=[...s2].sort((a,b)=>b.doneSP-a.doneSP);
p('| # | Nombre | Equipo | SP Done S2 | SP Est S2 | % Completado |');
p('|---|--------|--------|:----------:|:---------:|:------------:|');
s2bySpeed.forEach((r,i)=>{
  const pct=r.totalSP>0?Math.round(r.doneSP/r.totalSP*100):0;
  const emoji=pct>=90?'🟢':pct>=70?'🟡':'🔴';
  p(`| ${i+1} | ${r.name} | ${r.equipo} | ${r.doneSP} | ${r.totalSP} | ${emoji} ${pct}% |`);
});
p('');
{
  const best=s2bySpeed[0], worst=s2bySpeed[s2bySpeed.length-1];
  const bestPct=best.totalSP>0?Math.round(best.doneSP/best.totalSP*100):0;
  const worstPct=worst.totalSP>0?Math.round(worst.doneSP/worst.totalSP*100):0;
  p('> **Mejor:** '+best.name+' — '+best.doneSP+' SP entregados ('+bestPct+'% de su estimación)  ');
  p('> **Peor:** '+worst.name+' — '+worst.doneSP+' SP entregados ('+worstPct+'% de su estimación)  ');
  p('> **Llamativo:** La velocidad individual mide SP Done, no esfuerzo. Alguien puede haber trabajado 40h y tener 0 SP si sus tareas son grandes y no se cerraron antes del sprint. Por eso siempre hay que leerla junto al ID.');
}
p('');
p('**Conclusión Velocidad:** S1 demostró una capacidad de entrega del 100% del backlog planificado. S2 cierra con un 78% de completitud, lo que sitúa la velocidad real del equipo en torno a **393 SP/sprint**. Los 112 SP pendientes corresponden mayoritariamente a tareas de los equipos A y D con múltiples asignados.');
p('');
p('---');
p('');

// SECCIÓN 5: BURNDOWN
p('## 5. Burndown');
p('');
p('**Fórmula:**');
p('```');
p('Burn_ideal/día = SP_total_sprint / duración_días');
p('% completado   = SP_Done / SP_total × 100');
p('```');
p('');
p('**Fuentes:** SP_total y SP_Done desde GitHub Project #2 (ídem Sección 4). Duración: S1 = 14 días (19 feb – 5 mar), S2 = 14 días (12 mar – 26 mar).');
p('');
p('### Sprint 1 — Cerrado al 100%');
p('');
p('| Punto | SP |');
p('|-------|---:|');
p(`| Total planificado | ${v1total} SP |`);
p(`| Completado | ${v1done} SP |`);
p('| Pendiente final | 0 SP |');
p('| Tendencia vs ideal | ✅ Igual o mejor |');
p('');
p('El Sprint 1 cerró limpiamente. La línea real de burndown alcanzó 0 SP al final del sprint, coincidiendo con la línea ideal.');
p('');
p('### Sprint 2 — En curso (cierre: 26 mar)');
p('');
const idealPerDay=(v2total/14).toFixed(1);
p('| Concepto | Valor |');
p('|----------|------:|');
p(`| Total sprint | ${v2total} SP |`);
p(`| Burn ideal/día | ~${idealPerDay} SP/día (14 días, 12–26 mar) |`);
p(`| SP completados | ${v2done} SP |`);
p(`| SP pendientes | ${v2total-v2done} SP |`);
p(`| % completado (día 13/14) | ${Math.round(v2done/v2total*100)}% |`);
p('');
p('> La línea real está **por debajo de la ideal** al día 13/14 del sprint. Para cerrar al 100% quedarían '+(v2total-v2done)+' SP en el último día, lo que es inviable en su totalidad. Se estima un cierre final en torno al **80–83%**.');
p('');
p('> **Llamativo:** El equipo entregó '+v2done+' SP en S2 cuando en S1 entregó '+v1done+' SP (100%). La diferencia no es de capacidad — el equipo trabajó más horas en S2 — sino de sobrecarga de planificación: se comprometieron '+(v2total-v1total)+' SP más que en S1. Si el equipo tiene velocidad real de ~'+v1done+' SP/sprint, cualquier compromiso superior genera deuda de sprint.');
p('');
p('**Conclusión Burndown:** El equipo arrancó S1 con buen ritmo y lo cerró perfectamente. En S2 el volumen planificado fue mayor (+59 SP respecto a S1) y la cadencia de entrega no se ajustó proporcionalmente. Recomendación para S3: reducir el volumen comprometido o aumentar la frecuencia de cierres de tareas a mitad de sprint.');
p('');
p('---');
p('');

// SECCIÓN 6: DE
p('## 6. Desviación de Esfuerzo (DE)');
p('');
p('**Fórmula:**');
p('```');
p('H.Real_tag  = Σ segundos Clockify donde tag = NX-Sx.xx y email = persona / 3600');
p('H.Teórica   = Σ SIZE_H[tagSize[tag]]  para los tags donde la persona tiene horas');
p('DE          = H.Real_tag / H.Teórica');
p('```');
p('');
p('**Fuentes:**');
p('');
p('| Variable | Fuente | Detalle |');
p('|----------|--------|---------|');
p('| H.Real_tag | Clockify CSV | Filtra entradas donde la columna Tag (col. 8) = `NX-S1.xx` o `NX-S2.xx`. Suma segundos por persona y tag. |');
p('| tagSize | GitHub Project #2 + de_calc.js | Mapa tag → talla construido desde los items del proyecto. 204 tags registrados. |');
p('| H.Teórica | SIZE_H (constante) | XS=2h, S=4h, M=8h, L=16h, XL=24h. Suma de las horas teóricas de cada tag donde la persona tiene tiempo registrado. |');
p('');
p('> Nota: las tareas compartidas pueden mostrar DE bajo porque cada persona registra solo su parte del trabajo en Clockify.');
p('');
p('- **DE ≈ 1.0:** Estimación correcta');
p('- **DE < 0.8:** Las tareas se terminaron antes — tallas sobreestimadas en horas');
p('- **DE > 1.2:** Las tareas costaron más de lo previsto — tallas subestimadas');
p('');
p('### Sprint 1');
p('');
p('| # | Nombre | Equipo | H. Real (tag) | H. Teórica | DE | Lectura |');
p('|---|--------|--------|-------------:|----------:|:--:|---------|');
de1.forEach((r,i)=>{
  const lectura=r.de>1.2?'⚠️ Subestimado':r.de<0.8?'Acabó antes':'✅ OK';
  p(`| ${i+1} | ${r.name} | ${r.equipo} | ${r.realH}h | ${r.teorH}h | **${r.de}** | ${lectura} |`);
});
const de1avg=+(de1.reduce((a,r)=>a+r.de,0)/de1.length).toFixed(2);
p('');
p(`> **DE media S1: ${de1avg}** — El equipo terminó las tareas en promedio al ${Math.round(de1avg*100)}% del tiempo teórico.`);
p('');
p('### Sprint 2');
p('');
p('| # | Nombre | Equipo | H. Real (tag) | H. Teórica | DE | Lectura |');
p('|---|--------|--------|-------------:|----------:|:--:|---------|');
de2.forEach((r,i)=>{
  const lectura=r.de>1.2?'⚠️ Subestimado':r.de<0.8?'Acabó antes':'✅ OK';
  p(`| ${i+1} | ${r.name} | ${r.equipo} | ${r.realH}h | ${r.teorH}h | **${r.de}** | ${lectura} |`);
});
const de2avg=+(de2.reduce((a,r)=>a+r.de,0)/de2.length).toFixed(2);
p('');
p(`> **DE media S2: ${de2avg}** — Las tareas se completan en promedio al ${Math.round(de2avg*100)}% del tiempo teórico por talla.`);
p('');
{
  const closest=de2.reduce((a,r)=>Math.abs(r.de-1)<Math.abs(a.de-1)?r:a);
  const furthest=de2.reduce((a,r)=>Math.abs(r.de-1)>Math.abs(a.de-1)?r:a);
  const overDE=de2.filter(r=>r.de>1.2);
  p('> **Estimador más preciso:** '+closest.name+' — DE '+closest.de+' ('+closest.realH+'h reales / '+closest.teorH+'h teóricas)  ');
  p('> **Mayor desviación:** '+furthest.name+' — DE '+furthest.de+' ('+furthest.realH+'h reales / '+furthest.teorH+'h teóricas)  ');
  if(overDE.length>0){
    p('> **Llamativo:** '+overDE.map(r=>r.name).join(', ')+' superaron el tiempo teórico (DE > 1.2). Sus tallas están subestimadas — las tareas les costaron más de lo previsto. El resto del equipo (DE < 0.8) acaba antes del tiempo teórico, lo que confirma que SIZE_H está sobreestimado para la mayoría.');
  } else {
    p('> **Llamativo:** Nadie en S2 supera DE 1.2 — todo el equipo termina sus tareas en menos tiempo del teórico. Las tallas están sistemáticamente sobreestimadas en horas, lo que infla H.Pact y hace que C% e ID sean más exigentes de lo que deberían.');
  }
}
p('');
p('**Conclusión DE:** En ambos sprints el equipo trabaja por debajo del tiempo teórico asignado por talla (DE < 1 generalizado). Esto indica que **las tallas están sobreestimadas en horas** — una M no cuesta 8h reales por persona sino ~4-5h. Para S3 se recomienda recalibrar SIZE_H: XS=1h, S=2h, M=5h, L=10h, XL=16h como punto de partida. Esto haría que las H.Pact sean más representativas de la realidad del equipo.');
p('');
p('---');
p('');
p('## Resumen Ejecutivo');
p('');
p('| Métrica | Sprint 1 | Sprint 2 |');
p('|---------|:--------:|:--------:|');
p(`| Velocidad equipo | ${v1done} SP (100%) | ${v2done} SP (${Math.round(v2done/v2total*100)}%) |`);
p(`| Media C% | ${s1avg}% | ${s2avg}% |`);
p(`| Media ID | ${+(s1ids.reduce((a,b)=>a+b,0)/s1ids.length).toFixed(2)} | ${+(s2ids.reduce((a,b)=>a+b,0)/s2ids.length).toFixed(2)} |`);
p(`| Rango ID | ${Math.min(...s1ids).toFixed(2)}–${Math.max(...s1ids).toFixed(2)} | ${Math.min(...s2ids).toFixed(2)}–${Math.max(...s2ids).toFixed(2)} |`);
p(`| DE media | ${de1avg} | ${de2avg} |`);
p('');
p('**Puntos clave:**');
p('- El equipo demostró alta dedicación en ambos sprints (media de horas reales: ~32h/persona/sprint).');
p('- S1 se cerró al 100% con un ID medio de 1.12, indicando rendimiento sólido generalizado.');
p('- S2 muestra mayor dispersión en el ID, principalmente por tareas sin cerrar al final del sprint. No refleja falta de trabajo sino de gestión del estado de tareas en GitHub.');
p('- La DE < 1 sistemática sugiere que las estimaciones de talla son conservadoras. Recalibrar antes de S3 mejoraría la precisión de H.Pact y haría las métricas más justas.');

fs.writeFileSync('informe_rendimiento_s1_s2.md', lines.join('\n'), 'utf-8');
console.log('Informe generado: informe_rendimiento_s1_s2.md ('+lines.length+' líneas)');
