const fs = require('fs');
const SIZE_H  = { XS:2, S:4, M:8, L:16, XL:24 };
const SIZE_SP = { XS:1, S:3, M:8, L:15, XL:30 };
const TEAM = [
  { name:'Manuel J. Niza',        login:'mjnizac',          email:'mannizcob@alum.us.es'       },
  { name:'Miguel Regidor',        login:'mregidorgarcia',   email:'mregidorgarcia@gmail.com'   },
  { name:'Alejandro de los Reyes',login:'alereyper',        email:'alereyper@alum.us.es'       },
  { name:'Álvaro C. Gallero',     login:'carlosgallero',    email:'gallerolajara@gmail.com'    },
  { name:'Ignacio Martínez',      login:'igna0305',         email:'ignamartinezdiaz@gmail.com' },
  { name:'Marta Recio',           login:'martarecio',       email:'marrecgil@alum.us.es'       },
  { name:'Javier Gutiérrez',      login:'javiergutpas',     email:'javgutpas@alum.us.es'       },
  { name:'Nuno del Pino',         login:'nuno1610',         email:'nundelesc@alum.us.es'       },
  { name:'Javier Soria',          login:'javsorbla',        email:'javsorbla@alum.us.es'       },
  { name:'Javier Castilla',       login:'javcasrod1',       email:'javcasrod1@alum.us.es'      },
  { name:'Nicolás Gómez',         login:'nicogomezclaraco', email:'nicogomezclaraco@gmail.com' },
  { name:'Juan José Cardesa',     login:'juancardesa',      email:'juancardesasosa@gmail.com'  },
  { name:'Paula Suárez',          login:'pausualin',        email:'pausualin@alum.us.es'       },
  { name:'Celia Suárez',          login:'celiasuaco',       email:'celsuacor@alum.us.es'       },
  { name:'Carmen Murillo',        login:'cmurillog06',      email:'carmurgom@alum.us.es'       },
  { name:'Olga Cano',             login:'olgacangom',       email:'olgcangom@alum.us.es'       },
  { name:'Pablo Pérez',           login:'pabpergas',        email:'pabpergas@alum.us.es'       },
  { name:'Alberto García',        login:'albgarsan',        email:'albgarsan@alum.us.es'       },
  { name:'Ángel Mateos',          login:'angelmateos1',     email:'angmatmar@alum.us.es'       },
  { name:'Fran de Mann',          login:'pakillodecm',      email:'frademann@alum.us.es'       },
  { name:'Jesús García',          login:'jesusgarper',      email:'jesgarper@alum.us.es'       },
];
const EQUIPO = {
  'Equipo A':['javiergutpas','nuno1610','javsorbla','javcasrod1','alereyper'],
  'Equipo B':['mjnizac','mregidorgarcia','igna0305','nicogomezclaraco','juancardesa'],
  'Equipo C':['martarecio','pausualin','celiasuaco','cmurillog06','olgacangom'],
  'Equipo D':['carlosgallero','pabpergas','albgarsan','angelmateos1','pakillodecm','jesusgarper'],
  'Equipo Presentación':['nicogomezclaraco','mregidorgarcia','juancardesa','igna0305','alereyper'],
  'Coordinadores':['carlosgallero','alereyper','mregidorgarcia','martarecio','igna0305','mjnizac'],
  'All':['mjnizac','mregidorgarcia','alereyper','carlosgallero','igna0305','martarecio','javiergutpas','nuno1610','javsorbla','javcasrod1','nicogomezclaraco','juancardesa','pausualin','celiasuaco','cmurillog06','olgacangom','pabpergas','albgarsan','angelmateos1','pakillodecm','jesusgarper'],
};

// Horas del CSV — se parsea HH:MM:SS para evitar acumulación de error del decimal
function parseHMS(s) {
  const p = (s||'').split(':');
  return p.length >= 3 ? parseInt(p[0])*3600 + parseInt(p[1])*60 + parseInt(p[2]) : 0;
}
const secsEmail = {};
fs.readFileSync('C:/Users/lolo1_000/Desktop/Clockify_Time_Report_Detailed_01_01_2026-31_12_2026.csv','utf-8')
  .split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const v = line.match(/"([^"]*)"/g)?.map(x=>x.replace(/"/g,''));
    if (!v||v.length<14) return;
    const proj=v[0], email=v[6].toLowerCase(), secs=parseHMS(v[13]);
    if (!secsEmail[email]) secsEmail[email]={S1:0,S2:0};
    if(proj==='S1') secsEmail[email].S1+=secs;
    if(proj==='S2') secsEmail[email].S2+=secs;
  });
const horasEmail = {};
Object.entries(secsEmail).forEach(([email,{S1,S2}]) => {
  horasEmail[email] = { S1: S1/3600, S2: S2/3600 };
});

// Items del localStorage (datos actualizados)
const items = JSON.parse(fs.readFileSync('scripts/live_items.json','utf-8'));

function calcSprint(milestone, sKey) {
  const tasks = items.filter(t => t.milestone === milestone);
  const stats = {};
  TEAM.forEach(m => { stats[m.login] = {pactH:0, totalSP:0, doneSP:0}; });

  tasks.forEach(t => {
    const sz = t.size;
    const hPac = sz ? (SIZE_H[sz]||4) : 0;
    const sp   = sz ? (SIZE_SP[sz]||3) : 0;
    const isDone = t.status === 'Done';
    let assignees = t.assignees || [];
    if (assignees.length === 0 && t.equipo) assignees = EQUIPO[t.equipo] || [];
    const n = assignees.length || 1;
    assignees.forEach(login => {
      if (!stats[login]) return;
      stats[login].pactH   += hPac/n;
      stats[login].totalSP += sp/n;
      if (isDone) stats[login].doneSP += sp/n;
    });
  });

  return TEAM.map(m => {
    const realH = (horasEmail[m.email]||{})[sKey]||0;
    const {pactH, totalSP, doneSP} = stats[m.login];
    const C  = pactH>0 ? +(realH/pactH*100).toFixed(0) : 'N/A';
    const rH = pactH>0 ? realH/pactH : null;
    const rP = totalSP>0 ? doneSP/totalSP : null;
    const ID = rH!==null && rP!==null ? +((rH+rP)/2).toFixed(2) : 'N/A';
    return { name:m.name, realH:+realH.toFixed(1), pactH:+pactH.toFixed(1),
             C, totalSP:+totalSP.toFixed(1), doneSP:+doneSP.toFixed(1), ID };
  }).sort((a,b)=>(typeof b.ID==='number'?b.ID:-1)-(typeof a.ID==='number'?a.ID:-1));
}

function print(rows, label) {
  console.log('\n=== '+label+' ===');
  console.log('Nombre               | H.Real | H.Pact |  C%  | SP.Est | SP.Done |   ID');
  console.log('-'.repeat(78));
  rows.forEach((r,i) => {
    console.log(
      String(i+1).padStart(2)+'. '+r.name.padEnd(20)+
      '|'+String(r.realH).padStart(6)+'h |'+String(r.pactH).padStart(6)+'h |'+
      String(r.C+'%').padStart(5)+' |'+String(r.totalSP).padStart(7)+' |'+
      String(r.doneSP).padStart(8)+' |'+String(r.ID).padStart(5)
    );
  });
}

print(calcSprint('S1','S1'), 'SPRINT 1');
print(calcSprint('S2','S2'), 'SPRINT 2');
