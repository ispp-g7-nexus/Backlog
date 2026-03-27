const fs = require('fs');
const SIZE_H  = { XS:2, S:4, M:8, L:16, XL:24 };

function parseHMS(s) {
  const p=(s||'').split(':');
  return p.length>=3?parseInt(p[0])*3600+parseInt(p[1])*60+parseInt(p[2]):0;
}

const tagSize = {};
[{"tag":"NX-S2.135","size":"S"},{"tag":"NX-S2.123","size":"S"},{"tag":"NX-S2.23","size":"S"},{"tag":"NX-S2.77","size":"M"},{"tag":"NX-S2.75","size":"XS"},{"tag":"NX-S2.125","size":"S"},{"tag":"NX-S2.74","size":"XS"},{"tag":"NX-S2.43","size":"S"},{"tag":"NX-S2.07","size":"S"},{"tag":"NX-S1.15","size":"S"},{"tag":"NX-S2.15","size":"M"},{"tag":"NX-S2.39","size":"M"},{"tag":"NX-S2.20","size":"S"},{"tag":"NX-S2.102","size":"XS"},{"tag":"NX-S2.84","size":"M"},{"tag":"NX-S2.83","size":"M"},{"tag":"NX-S2.22","size":"L"},{"tag":"NX-S2.54","size":"XS"},{"tag":"NX-S2.55","size":"XS"},{"tag":"NX-S2.56","size":"XS"},{"tag":"NX-S2.94","size":"M"},{"tag":"NX-S2.97","size":"S"},{"tag":"NX-S2.13","size":"M"},{"tag":"NX-S2.85","size":"S"},{"tag":"NX-S2.90","size":"XS"},{"tag":"NX-S2.91","size":"XS"},{"tag":"NX-S2.02","size":"M"},{"tag":"NX-S2.03","size":"S"},{"tag":"NX-S2.01","size":"M"},{"tag":"NX-S1.91","size":"XS"},{"tag":"NX-S1.64","size":"S"},{"tag":"NX-S1.89","size":"XS"},{"tag":"NX-S1.33","size":"M"},{"tag":"NX-S1.41","size":"L"},{"tag":"NX-S1.40","size":"M"},{"tag":"NX-S1.36","size":"M"},{"tag":"NX-S1.22","size":"S"},{"tag":"NX-S1.21","size":"S"},{"tag":"NX-S1.09","size":"S"},{"tag":"NX-S1.14","size":"M"},{"tag":"NX-S1.18","size":"M"},{"tag":"NX-S1.19","size":"S"},{"tag":"NX-S1.08","size":"M"},{"tag":"NX-S1.24","size":"S"},{"tag":"NX-S1.23","size":"M"},{"tag":"NX-S1.06","size":"M"},{"tag":"NX-S2.11","size":"S"},{"tag":"NX-S1.07","size":"M"},{"tag":"NX-S1.31","size":"S"},{"tag":"NX-S1.30","size":"M"},{"tag":"NX-S1.29","size":"M"},{"tag":"NX-S1.47","size":"M"},{"tag":"NX-S1.20","size":"M"},{"tag":"NX-S1.82","size":"S"},{"tag":"NX-S1.83","size":"S"},{"tag":"NX-S1.94","size":"S"},{"tag":"NX-S1.52","size":"S"},{"tag":"NX-S1.65","size":"S"},{"tag":"NX-S1.02","size":"M"},{"tag":"NX-S1.45","size":"M"},{"tag":"NX-S1.05","size":"M"},{"tag":"NX-S1.90","size":"XS"},{"tag":"NX-S1.03","size":"S"},{"tag":"NX-S2.93","size":"XS"},{"tag":"NX-S2.133","size":"S"},{"tag":"NX-S2.37","size":"S"},{"tag":"NX-S1.37","size":"M"},{"tag":"NX-S1.32","size":"M"},{"tag":"NX-S1.01","size":"M"},{"tag":"NX-S2.26","size":"S"},{"tag":"NX-S2.25","size":"M"},{"tag":"NX-S2.24","size":"M"},{"tag":"NX-S2.53","size":"XS"},{"tag":"NX-S2.36","size":"S"},{"tag":"NX-S1.93","size":"XS"},{"tag":"NX-S1.39","size":"L"},{"tag":"NX-S1.38","size":"S"},{"tag":"NX-S1.71","size":"XS"},{"tag":"NX-S1.34","size":"M"},{"tag":"NX-S1.78","size":"M"},{"tag":"NX-S1.66","size":"S"},{"tag":"NX-S1.48","size":"XS"},{"tag":"NX-S1.56","size":"S"},{"tag":"NX-S1.57","size":"XS"},{"tag":"NX-S1.43","size":"XL"},{"tag":"NX-S1.44","size":"M"},{"tag":"NX-S1.58","size":"S"},{"tag":"NX-S2.58","size":"S"},{"tag":"NX-S2.80","size":"XS"},{"tag":"NX-S1.59","size":"XS"},{"tag":"NX-S1.67","size":"S"},{"tag":"NX-S1.12","size":"M"},{"tag":"NX-S1.11","size":"M"},{"tag":"NX-S2.28","size":"M"},{"tag":"NX-S2.98","size":"S"},{"tag":"NX-S2.118","size":"M"},{"tag":"NX-S2.32","size":"S"},{"tag":"NX-S2.33","size":"L"},{"tag":"NX-S2.31","size":"L"},{"tag":"NX-S2.96","size":"S"},{"tag":"NX-S1.10","size":"M"},{"tag":"NX-S2.16","size":"M"},{"tag":"NX-S1.51","size":"S"},{"tag":"NX-S1.55","size":"S"},{"tag":"NX-S2.78","size":"M"},{"tag":"NX-S1.46","size":"S"},{"tag":"NX-S2.21","size":"S"},{"tag":"NX-S1.17","size":"M"},{"tag":"NX-S1.04","size":"L"},{"tag":"NX-S2.40","size":"S"},{"tag":"NX-S2.08","size":"XS"},{"tag":"NX-S1.25","size":"M"},{"tag":"NX-S2.41","size":"XS"},{"tag":"NX-S1.13","size":"M"},{"tag":"NX-S2.06","size":"S"},{"tag":"NX-S2.05","size":"S"},{"tag":"NX-S2.124","size":"XS"},{"tag":"NX-S2.126","size":"S"},{"tag":"NX-S2.108","size":"S"},{"tag":"NX-S2.109","size":"S"},{"tag":"NX-S2.17","size":"S"},{"tag":"NX-S2.18","size":"L"},{"tag":"NX-S2.129","size":"XS"},{"tag":"NX-S1.16","size":"M"},{"tag":"NX-S1.35","size":"M"},{"tag":"NX-S2.66","size":"S"},{"tag":"NX-S2.65","size":"XS"},{"tag":"NX-S2.64","size":"S"},{"tag":"NX-S2.62","size":"XS"},{"tag":"NX-S2.60","size":"S"},{"tag":"NX-S2.79","size":"XS"},{"tag":"NX-S2.76","size":"M"},{"tag":"NX-S2.72","size":"S"},{"tag":"NX-S2.71","size":"S"},{"tag":"NX-S2.70","size":"S"},{"tag":"NX-S2.69","size":"S"},{"tag":"NX-S2.68","size":"S"},{"tag":"NX-S2.67","size":"S"},{"tag":"NX-S2.59","size":"M"},{"tag":"NX-S2.61","size":"M"},{"tag":"NX-S2.73","size":"XS"},{"tag":"NX-S1.68","size":"XS"},{"tag":"NX-S1.69","size":"XS"},{"tag":"NX-S1.72","size":"XS"},{"tag":"NX-S1.28","size":"S"},{"tag":"NX-S1.53","size":"S"},{"tag":"NX-S1.54","size":"S"},{"tag":"NX-S1.27","size":"M"},{"tag":"NX-S2.44","size":"S"},{"tag":"NX-S2.42","size":"S"},{"tag":"NX-S1.26","size":"M"},{"tag":"NX-S1.42","size":"M"},{"tag":"NX-S1.73","size":"XS"},{"tag":"NX-S1.74","size":"S"},{"tag":"NX-S1.75","size":"XS"},{"tag":"NX-S1.76","size":"XS"},{"tag":"NX-S1.77","size":"XS"},{"tag":"NX-S1.79","size":"XS"},{"tag":"NX-S1.81","size":"M"},{"tag":"NX-S1.63","size":"XS"},{"tag":"NX-S1.49","size":"XS"},{"tag":"NX-S1.80","size":"XS"},{"tag":"NX-S1.96","size":"XS"},{"tag":"NX-S2.128","size":"XS"},{"tag":"NX-S2.57","size":"M"},{"tag":"NX-S2.04","size":"M"},{"tag":"NX-S2.52","size":"XS"},{"tag":"NX-S2.51","size":"XS"},{"tag":"NX-S2.49","size":"XS"},{"tag":"NX-S2.47","size":"XS"},{"tag":"NX-S2.29","size":"M"},{"tag":"NX-S2.45","size":"S"},{"tag":"NX-S2.10","size":"S"},{"tag":"NX-S2.09","size":"M"},{"tag":"NX-S2.14","size":"XS"},{"tag":"NX-S2.12","size":"S"},{"tag":"NX-S2.38","size":"S"},{"tag":"NX-S2.92","size":"S"},{"tag":"NX-S2.34","size":"L"},{"tag":"NX-S2.35","size":"M"},{"tag":"NX-S2.50","size":"XS"},{"tag":"NX-S2.30","size":"M"},{"tag":"NX-S2.63","size":"XS"},{"tag":"NX-S2.81","size":"XS"},{"tag":"NX-S2.82","size":"S"},{"tag":"NX-S2.19","size":"S"},{"tag":"NX-S2.87","size":"S"},{"tag":"NX-S2.95","size":"M"},{"tag":"NX-S2.27","size":"S"}]
.forEach(({tag,size}) => tagSize[tag]=size);

const tagEmailSecs = {};
const csvLines = fs.readFileSync('C:/Users/lolo1_000/Desktop/Clockify_Time_Report_Detailed_01_01_2026-31_12_2026.csv','utf-8').split('\n').slice(1);
csvLines.forEach(line => {
  if (!line.trim()) return;
  const v = line.match(/"([^"]*)"/g)?.map(x=>x.replace(/"/g,''));
  if (!v||v.length<14) return;
  const proj=v[0], email=v[6].toLowerCase(), tag=v[7].trim(), secs=parseHMS(v[13]);
  if ((proj==='S1'||proj==='S2') && tag && tagSize[tag]) {
    if (!tagEmailSecs[tag]) tagEmailSecs[tag]={};
    tagEmailSecs[tag][email]=(tagEmailSecs[tag][email]||0)+secs;
  }
});

const TEAM = [
  {name:'Manuel J. Niza',email:'mannizcob@alum.us.es'},
  {name:'Miguel Regidor',email:'mregidorgarcia@gmail.com'},
  {name:'Alejandro de los Reyes',email:'alereyper@alum.us.es'},
  {name:'Alvaro C. Gallero',email:'gallerolajara@gmail.com'},
  {name:'Ignacio Martinez',email:'ignamartinezdiaz@gmail.com'},
  {name:'Marta Recio',email:'marrecgil@alum.us.es'},
  {name:'Javier Gutierrez',email:'javgutpas@alum.us.es'},
  {name:'Nuno del Pino',email:'nundelesc@alum.us.es'},
  {name:'Javier Soria',email:'javsorbla@alum.us.es'},
  {name:'Javier Castilla',email:'javcasrod1@alum.us.es'},
  {name:'Nicolas Gomez',email:'nicogomezclaraco@gmail.com'},
  {name:'Juan Jose Cardesa',email:'juancardesasosa@gmail.com'},
  {name:'Paula Suarez',email:'pausualin@alum.us.es'},
  {name:'Celia Suarez',email:'celsuacor@alum.us.es'},
  {name:'Carmen Murillo',email:'carmurgom@alum.us.es'},
  {name:'Olga Cano',email:'olgcangom@alum.us.es'},
  {name:'Pablo Perez',email:'pabpergas@alum.us.es'},
  {name:'Alberto Garcia',email:'albgarsan@alum.us.es'},
  {name:'Angel Mateos',email:'angmatmar@alum.us.es'},
  {name:'Fran de Mann',email:'frademann@alum.us.es'},
  {name:'Jesus Garcia',email:'jesgarper@alum.us.es'},
];

['S1','S2'].forEach(sprint => {
  const prefix = 'NX-'+sprint+'.';
  console.log('\n=== DE ' + sprint + ' ===');
  console.log('Nombre               | H.Real | H.Teor |   DE  | Interpretacion');
  console.log('-'.repeat(72));
  const rows = TEAM.map(m => {
    let realSecs=0, teorH=0;
    Object.entries(tagEmailSecs).forEach(([tag, byEmail]) => {
      if (!tag.startsWith(prefix)) return;
      const sz = tagSize[tag];
      const secs = byEmail[m.email]||0;
      if (secs>0) { realSecs+=secs; teorH+=SIZE_H[sz]||0; }
    });
    const realH = realSecs/3600;
    const de = teorH>0 ? realH/teorH : null;
    return {name:m.name, realH, teorH, de};
  }).filter(r=>r.de!==null).sort((a,b)=>b.de-a.de);
  rows.forEach(r => {
    const interp = r.de<0.8 ? 'Infraestimado' : r.de<=1.3 ? 'OK' : r.de<=2 ? 'Sobreestimado' : 'Muy sobreestimado';
    console.log(r.name.padEnd(21)+'| '+r.realH.toFixed(1).padStart(6)+'h | '+r.teorH.toFixed(1).padStart(6)+'h | '+r.de.toFixed(2).padStart(5)+' | '+interp);
  });
});
