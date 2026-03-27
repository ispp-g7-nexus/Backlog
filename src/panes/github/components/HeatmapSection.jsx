const DAYS = ["D","L","M","X","J","V","S"];
const MN = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function ActivityHeatmap({ weeks, maxDay, colorFn, title, note }) {
  if (!weeks || weeks.length === 0) return null;
  const cellSize=11, gap=2, step=cellSize+gap, W=52*step+28, H=7*step+22;
  const mnLbls = [];
  let prevM = -1;
  weeks.forEach((w, wi) => { if (!w.week) return; const m = new Date(w.week*1000).getUTCMonth(); if (m !== prevM) { mnLbls.push({wi, m}); prevM = m; } });
  return (
    <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px" }}>
      <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
        {title}
        {note && <span style={{color:"var(--tx4)",fontWeight:400,marginLeft:8,fontSize:8}}>{note}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
        {DAYS.map((d,i) => <text key={d} x={14} y={20+i*step+cellSize/2} textAnchor="middle" fontSize={5} fill="var(--tx4)">{d}</text>)}
        {mnLbls.length > 0
          ? mnLbls.map(({wi, m}) => <text key={`${wi}-${m}`} x={22+wi*step+cellSize/2} y={11} textAnchor="middle" fontSize={4.5} fill="var(--bdr2)">{MN[m]}</text>)
          : [0,4,8,13,17,21,26,30,34,39,43,47].map((wi,mi) => <text key={mi} x={22+wi*step+cellSize/2} y={11} textAnchor="middle" fontSize={4.5} fill="var(--bdr2)">{MN[mi]}</text>)
        }
        {weeks.map((w,wi) => w.days.map((count,di) => (
          <rect key={`${wi}-${di}`} x={22+wi*step} y={16+di*step} width={cellSize} height={cellSize} rx={2} fill={colorFn(count, maxDay)} opacity={0.95}>
            <title>{`Sem ${wi+1}, ${DAYS[di]}: ${count}`}</title>
          </rect>
        )))}
      </svg>
    </div>
  );
}

function PunchCard({ data, title, weekdayColor, weekendColor }) {
  if (!data || !data.some(([,,c]) => c > 0)) return null;
  const maxV = Math.max(...data.map(([,,c]) => c), 1);
  const DNAMES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const cellW=20, cellH=18, padL=30, padT=20;
  const W = padL+24*cellW+10, H = padT+7*cellH+10;
  return (
    <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px" }}>
      <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
        {DNAMES.map((d,i) => <text key={d} x={padL-3} y={padT+i*cellH+cellH/2+1.5} textAnchor="end" fontSize={5} fill="var(--tx4)">{d}</text>)}
        {Array.from({length:24},(_,h) => <text key={h} x={padL+h*cellW+cellW/2} y={padT-3} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{h%3===0?`${h}h`:""}</text>)}
        {data.map(([day,hour,count]) => {
          const r = count > 0 ? Math.sqrt(count/maxV)*(cellH/2-1.5) : 0;
          const cx = padL+hour*cellW+cellW/2, cy = padT+day*cellH+cellH/2;
          const c = day===0||day===6 ? weekendColor : weekdayColor;
          return r > 0
            ? <circle key={`${day}-${hour}`} cx={cx} cy={cy} r={r} fill={c} opacity={0.7}><title>{`${DNAMES[day]} ${hour}:00 — ${count}`}</title></circle>
            : <rect key={`${day}-${hour}`} x={cx-1} y={cy-1} width={2} height={2} fill="#1f2937"/>;
        })}
      </svg>
      <div style={{ display:"flex", gap:12, marginTop:4 }}>
        <span style={{ fontSize:8.5, color:"var(--tx4)" }}><span style={{ display:"inline-block",width:7,height:7,borderRadius:"50%",background:weekdayColor,marginRight:3 }}/>Días laborables</span>
        <span style={{ fontSize:8.5, color:"var(--tx4)" }}><span style={{ display:"inline-block",width:7,height:7,borderRadius:"50%",background:weekendColor,marginRight:3 }}/>Fines de semana</span>
      </div>
    </div>
  );
}

function TrendCard({ acts, title, fmt }) {
  if (!acts || acts.length < 8) return null;
  const tot = typeof acts[0]?.total === 'number' ? w => w.total : w => w.total;
  const last4 = acts.slice(-4).reduce((s,w) => s+tot(w), 0);
  const prev4 = acts.slice(-8,-4).reduce((s,w) => s+tot(w), 0);
  const prev8 = acts.length >= 12 ? acts.slice(-12,-4).reduce((s,w) => s+tot(w), 0)/2 : 0;
  const base = prev4 > 0 ? prev4 : prev8 > 0 ? prev8 : null;
  const pct = base !== null ? Math.round((last4-base)/base*100) : null;
  const up = pct !== null && pct >= 0;
  const color = pct === null ? "var(--tx2)" : pct > 10 ? "#22c55e" : pct < -10 ? "#ef4444" : "#f59e0b";
  const w8 = acts.slice(-8), mx = Math.max(...w8.map(tot), 1);
  const fmtV = fmt || (n => String(n));
  return (
    <div style={{ background:"var(--bg2)", border:`1px solid ${color}25`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
      <div>
        <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>{title}</div>
        <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
          <span style={{ color, fontSize:24, fontWeight:800, lineHeight:1 }}>{pct !== null ? `${up?"+":""}${pct}%` : "—"}</span>
          <span style={{ color, fontSize:16 }}>{pct !== null ? (up ? "↑" : "↓") : ""}</span>
        </div>
      </div>
      <div style={{ display:"flex", gap:20, alignItems:"center" }}>
        <div><div style={{ color:"var(--tx4)", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ult. 4 sem</div><div style={{ color:"var(--tx0)", fontWeight:800, fontSize:15 }}>{fmtV(last4)}</div></div>
        <div style={{ width:1, height:28, background:"var(--bdr)" }}/>
        <div><div style={{ color:"var(--tx4)", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ant. 4 sem</div><div style={{ color:"var(--tx4)", fontWeight:700, fontSize:15 }}>{fmtV(prev4)}</div></div>
      </div>
      <svg viewBox="0 0 88 28" style={{ width:88, height:28, flexShrink:0 }}>
        {w8.map((w,i) => { const bh = (tot(w)/mx)*24; return <rect key={i} x={i*11} y={28-bh} width={9} height={bh} rx={1.5} fill={i>=4?color:"var(--bdr)"} opacity={i>=4?0.9:0.6}/>; })}
      </svg>
    </div>
  );
}

export function CommitsHeatmap({ stats }) {
  if (!Array.isArray(stats?.commitActivity) || stats.commitActivity.length === 0) return null;
  const weeks = stats.commitActivity.slice(-52);
  const maxDay = Math.max(...weeks.flatMap(w => w.days), 1);
  const col = (v, mx) => {
    if (v === 0) return "#1a1a2e";
    return ["#1e3a5f","#2563eb","#3b82f6","#93c5fd"][Math.min(Math.floor(v/mx*4), 3)];
  };
  return (
    <>
      <ActivityHeatmap weeks={weeks} maxDay={maxDay} colorFn={col} title="📈 Actividad — últimas 52 semanas" />
      {Array.isArray(stats.punchCard) && stats.punchCard.length > 0 && (
        <PunchCard data={stats.punchCard} title="⏰ Patrón temporal — commits por hora y día" weekdayColor="#818cf8" weekendColor="#f59e0b" />
      )}
      <TrendCard acts={stats.commitActivity} title="📈 Tendencia — últimas 4 semanas" />
    </>
  );
}

export function PRsHeatmap({ stats }) {
  const weeks = Array.isArray(stats?.prActivity) && stats.prActivity[0]?.days
    ? stats.prActivity.slice(-52)
    : null;
  const hasPunch = Array.isArray(stats?.prPunch) && stats.prPunch.some(([,,c]) => c > 0);
  if (!weeks && !hasPunch) return null;
  const maxDay = weeks ? Math.max(...weeks.flatMap(w => w.days), 1) : 1;
  const col = (v, mx) => {
    if (v === 0) return "#1a1a2e";
    return ["#1e3a5f","#6d28d9","#7c3aed","#a78bfa"][Math.min(Math.floor(v/mx*4), 3)];
  };
  return (
    <>
      {weeks && <ActivityHeatmap weeks={weeks} maxDay={maxDay} colorFn={col}
        title="📊 Actividad PRs — últimas 52 semanas"
        note={!stats?.prActivity ? "(pulsa Actualizar para ver datos)" : undefined} />}
      {hasPunch && <PunchCard data={stats.prPunch} title="⏰ Patrón temporal — PRs por hora y día" weekdayColor="#7c3aed" weekendColor="#f59e0b" />}
      <TrendCard acts={stats?.prActivity} title="📈 Tendencia PRs — últimas 4 semanas" />
    </>
  );
}

export function LinesHeatmap({ stats }) {
  if (!Array.isArray(stats?.codeFreq) || stats.codeFreq.length === 0) return null;
  const addMap = {}, delMap = {};
  stats.codeFreq.forEach(([ts, a, d]) => { addMap[ts] = a; delMap[ts] = Math.abs(d); });
  const now = new Date(), dow = now.getUTCDay();
  const sun0 = new Date(now); sun0.setUTCDate(now.getUTCDate() - dow); sun0.setUTCHours(0,0,0,0);
  const wks52 = Array.from({length:52}, (_,i) => {
    const d = new Date(sun0); d.setUTCDate(sun0.getUTCDate()-(51-i)*7);
    const ts = Math.floor(d.getTime()/1000);
    return { ts, added: addMap[ts]||0, deleted: delMap[ts]||0 };
  });
  const maxA = Math.max(...wks52.map(w => w.added), 1);
  const maxD = Math.max(...wks52.map(w => w.deleted), 1);
  const cellS=11, gap=2, step=cellS+gap, W=52*step+28, H=cellS+24;
  const mnLbls = [];
  let prevM = -1;
  wks52.forEach((w, wi) => { const m = new Date(w.ts*1000).getUTCMonth(); if (m !== prevM) { mnLbls.push({wi,m}); prevM = m; } });

  const Row = ({ vals, col, label, palette, titleFmt }) => (
    <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px" }}>
      <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
        {mnLbls.map(({wi,m}) => <text key={`${wi}-${m}`} x={22+wi*step+cellS/2} y={11} textAnchor="middle" fontSize={4.5} fill="var(--bdr2)">{MN[m]}</text>)}
        {vals.map((v, wi) => (
          <rect key={wi} x={22+wi*step} y={16} width={cellS} height={cellS} rx={2} fill={col(v)} opacity={0.95}>
            <title>{titleFmt(v, wks52[wi].ts)}</title>
          </rect>
        ))}
      </svg>
      <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
        <span style={{ color:"var(--tx4)", fontSize:8 }}>Menos</span>
        {palette.map(c => <span key={c} style={{ width:8,height:8,borderRadius:1,background:c,display:"inline-block" }}/>)}
        <span style={{ color:"var(--tx4)", fontSize:8 }}>Más</span>
      </div>
    </div>
  );

  const colA = v => v === 0 ? "#1a1a2e" : ["#1e3a5f","#1d4ed8","#2563eb","#60a5fa"][Math.min(Math.floor(v/maxA*4),3)];
  const colD = v => v === 0 ? "#1a1a2e" : ["#1a1a2e","#7f1d1d","#b91c1c","#f87171"][Math.min(Math.floor(v/maxD*4),3)];

  const fmt = n => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);

  return (
    <>
      <Row vals={wks52.map(w => w.added)} col={colA} label="➕ Líneas añadidas — últimas 52 semanas"
        palette={["#1a1a2e","#1e3a5f","#1d4ed8","#2563eb","#60a5fa"]}
        titleFmt={(v,ts) => `${new Date(ts*1000).toLocaleDateString('es')}: +${v.toLocaleString()} líneas`} />
      <Row vals={wks52.map(w => w.deleted)} col={colD} label="➖ Líneas eliminadas — últimas 52 semanas"
        palette={["#1a1a2e","#7f1d1d","#b91c1c","#ef4444","#f87171"]}
        titleFmt={(v,ts) => `${new Date(ts*1000).toLocaleDateString('es')}: -${v.toLocaleString()} líneas`} />
      <TrendCard acts={stats?.linesActivity} title="📈 Tendencia líneas — últimas 4 semanas" fmt={fmt} />
    </>
  );
}
