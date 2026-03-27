import { SC as SPRINT_CONFIG } from '../../../constants.js';

const MN = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const WEEK_S = 7 * 24 * 3600;

function getMilestones(display, padL, colW) {
  return Object.values(SPRINT_CONFIG).map(s => {
    const ts = Math.floor(new Date(s.end).getTime() / 1000);
    let best = 0, bestD = Infinity;
    display.forEach(({ week }, i) => { const d = Math.abs(week - ts); if (d < bestD) { bestD = d; best = i; } });
    return { label: s.label.replace("Sprint ","S"), color: s.color, bx: padL + best * colW + colW / 2 };
  });
}

function getMonthLabels(display) {
  let prevM = -1;
  return display.map(({ week }) => {
    const m = new Date(week * 1000).getMonth();
    if (m !== prevM) { prevM = m; return MN[m]; }
    return "";
  });
}

export function prepareWeeklyData(actWeeks, getVals) {
  const lastSprintTs = Math.max(...Object.values(SPRINT_CONFIG).map(s => Math.floor(new Date(s.end).getTime() / 1000)));
  const futureTs = [];
  let fw = actWeeks[actWeeks.length - 1].week + WEEK_S;
  while (fw <= lastSprintTs + WEEK_S) { futureTs.push(fw); fw += WEEK_S; }
  const allData = [
    ...actWeeks.map((w, i) => ({ week: w.week, ...getVals(w, i) })),
    ...futureTs.map(week => ({ week, total: 0 })),
  ];
  const firstIdx = allData.findIndex(w => (w.total || 0) > 0 || (w.vals && Object.values(w.vals).some(v => v > 0)));
  if (firstIdx < 0) return null;
  return allData.slice(firstIdx);
}

export default function WeeklyChart({ display, color, title, getTotal, teamColors }) {
  if (!display || !display.length) return null;
  const W=440, H=96, padL=26, padB=16, padT=8;
  const isStacked = !!teamColors;
  const maxW = isStacked
    ? Math.max(...display.map(w => Object.values(w.vals || {}).reduce((s,v)=>s+v,0)), 1)
    : Math.max(...display.map(w => getTotal ? getTotal(w) : w.total), 1);
  const colW  = (W - padL) / display.length;
  const barW  = Math.max(1.5, colW * 0.7);
  const yOf   = v => H - padB - (v / maxW) * (H - padT - padB);
  const lbls  = getMonthLabels(display);
  const milestones = getMilestones(display, padL, colW);

  const nzW = display.filter(w => {
    if (isStacked) return Object.values(w.vals || {}).some(v => v > 0);
    return (getTotal ? getTotal(w) : w.total) > 0;
  });
  const avgW = nzW.length > 0
    ? nzW.reduce((s, w) => s + (isStacked ? Object.values(w.vals || {}).reduce((a,v)=>a+v,0) : (getTotal ? getTotal(w) : w.total)), 0) / nzW.length
    : 0;

  return (
    <div style={{ background:"var(--bg2)", border:`1px solid ${color}20`, borderRadius:10, padding:"12px 14px 8px" }}>
      <div style={{ color, fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
        {[maxW, Math.round(maxW/2), 0].map(v => {
          const y = yOf(v);
          return (
            <g key={v}>
              <line x1={padL - 2} y1={y} x2={padL} y2={y} stroke="var(--bdr2)" strokeWidth={0.5}/>
              <text x={padL - 4} y={y + 1.5} textAnchor="end" fontSize={4} fill="var(--tx4)">{v}</text>
            </g>
          );
        })}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--bdr2)" strokeWidth={0.5}/>
        {milestones.map(({ label, color: mc, bx }) => (
          <g key={label}>
            <line x1={bx} y1={padT} x2={bx} y2={H - padB} stroke={mc} strokeWidth={0.8} strokeDasharray="2,1.5" opacity={0.6}/>
            <text x={bx + 1} y={padT + 3.5} fontSize={3.5} fill={mc} opacity={0.85}>{label}</text>
          </g>
        ))}
        {display.map((w, i) => {
          const bx = padL + i * colW + (colW - barW) / 2;
          const d  = new Date(w.week * 1000);
          if (isStacked) {
            const teamsArr = Object.keys(teamColors);
            const stacks = teamsArr.reduce((acc, t) => {
              const v = (w.vals || {})[t] || 0;
              if (v > 0) {
                const bh = (v / maxW) * (H - padT - padB);
                acc.rects.push(<rect key={t} x={bx} y={acc.y - bh} width={barW} height={bh} fill={teamColors[t]} opacity={0.85}><title>{`Equipo ${t}: ${v}`}</title></rect>);
                acc.y -= bh;
              }
              return acc;
            }, { rects: [], y: H - padB }).rects;
            return (
              <g key={w.week}>
                {stacks}
                {lbls[i] && <text x={bx + barW/2} y={H - 2} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{lbls[i]}</text>}
              </g>
            );
          }
          const total = getTotal ? getTotal(w) : w.total;
          const bh = (total / maxW) * (H - padT - padB);
          return (
            <g key={w.week}>
              {total > 0 && (
                <rect x={bx} y={H - padB - bh} width={barW} height={bh} rx={1} fill={color} opacity={0.75}>
                  <title>{`${d.toLocaleDateString("es-ES",{day:"2-digit",month:"short"})}: ${total}`}</title>
                </rect>
              )}
              {lbls[i] && <text x={bx + barW/2} y={H - 2} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{lbls[i]}</text>}
            </g>
          );
        })}
        {avgW > 0 && (() => {
          const ly = yOf(avgW);
          return (
            <g>
              <line x1={padL} y1={ly} x2={W - 2} y2={ly} stroke="var(--tx2)" strokeWidth={0.7} strokeDasharray="3,2" opacity={0.5}/>
              <text x={W - 3} y={ly - 2} textAnchor="end" fontSize={4} fill="var(--tx2)" opacity={0.7}>ø {Math.round(avgW)}</text>
            </g>
          );
        })()}
      </svg>
      {isStacked && (
        <div style={{ display:"flex", gap:12, marginTop:4, flexWrap:"wrap" }}>
          {Object.entries(teamColors).map(([t, c]) => (
            <span key={t} style={{ display:"flex", alignItems:"center", gap:3, fontSize:8.5, color:"var(--tx2)" }}>
              <span style={{ width:8, height:8, background:c, display:"inline-block", borderRadius:1 }}/>Eq.{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
