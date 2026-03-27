import HighlightCards from '../components/HighlightCards.jsx';
import HBar from '../components/HBar.jsx';
import Recommendations, { tip } from '../components/Recommendations.jsx';

export default function LineasPersona({ data, stats }) {
  const { memberStats, byLines, byDeleted, byChurn, maxAdded, maxDeleted, totalAdded } = data;

  /* ---------- Highlight cards ---------- */
  const topAdd  = byLines[0];
  const topDel  = byDeleted[0];
  const topImp  = [...memberStats].sort((a,b)=>b.codeImpact-a.codeImpact)[0];
  const loChurn = byChurn[0];
  const avgAdded = memberStats.filter(ms=>ms.lns.added>0).length > 0
    ? Math.round(totalAdded / memberStats.filter(ms=>ms.lns.added>0).length) : 0;

  const highlightItems = [
    { label:"🥇 Más añadido",    name: topAdd?.m.name.split(" ").slice(0,2).join(" "),   val:`+${topAdd?.lns.added>999?(topAdd.lns.added/1000).toFixed(1)+"k":topAdd?.lns.added}`,    color:"#38bdf8" },
    { label:"🗑️ Más borrado",    name: topDel?.m.name.split(" ").slice(0,2).join(" "),   val:`-${topDel?.lns.deleted>999?(topDel.lns.deleted/1000).toFixed(1)+"k":topDel?.lns.deleted}`, color:"#f43f5e" },
    { label:"📊 Media / persona", name: null,                                              val: avgAdded>999?`${(avgAdded/1000).toFixed(1)}k l`:`${avgAdded} l`,                          color:"var(--tx2)" },
    { label:"💥 Mayor impacto",   name: topImp?.m.name.split(" ").slice(0,2).join(" "),   val:`${topImp?.codeImpact>999?(topImp.codeImpact/1000).toFixed(1)+"k":topImp?.codeImpact} total`, color:"#a855f7" },
    ...(loChurn ? [{ label:"⚖️ Menor churn", name: loChurn.m.name.split(" ").slice(0,2).join(" "), val:`${loChurn.codeChurn}% borrado`, color:"#22c55e" }] : []),
  ];

  /* ---------- Recommendations ---------- */
  const tips = [];
  const withLines = memberStats.filter(ms => ms.lns.added > 0);
  const noLines   = memberStats.filter(ms => ms.lns.added === 0);
  const avgAdded2 = withLines.length > 0 ? totalAdded / withLines.length : 0;
  if (noLines.length)
    tips.push(tip("yellow","📭","Sin líneas de código registradas",
      `${noLines.map(ms=>ms.m.name.split(" ")[0]).join(", ")} no ${noLines.length>1?"tienen":"tiene"} líneas añadidas. Verificar que sus commits estén en el repositorio correcto.`));
  const highChurn = byChurn.slice().reverse().filter(ms => (ms.codeChurn??0) > 60);
  if (highChurn.length)
    tips.push(tip("blue","♻️","Alto code churn",
      `${highChurn.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.codeChurn}%)`).join(", ")} tiene${highChurn.length>1?"n":""} más del 60% de sus líneas borradas. Puede indicar refactorización intensa.`));
  const veryLow = withLines.filter(ms => ms.lns.added < avgAdded2 * 0.3);
  if (veryLow.length && avgAdded2 > 0)
    tips.push(tip("yellow","📉","Pocas líneas aportadas",
      `${veryLow.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.lns.added.toLocaleString()})`).join(", ")} está${veryLow.length>1?"n":""} por debajo del 30% de la media (${Math.round(avgAdded2).toLocaleString()}).`));
  if (!noLines.length && !highChurn.length && !veryLow.length)
    tips.push(tip("green","✅","Buena distribución de código",
      `Todo el equipo tiene líneas de código y no hay casos de churn extremo. El código parece estable.`));

  /* ---------- codeFreq SVG ---------- */
  const renderCodeFreq = () => {
    if (!Array.isArray(stats?.codeFreq) || !stats.codeFreq.length) return null;
    const MN   = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const W=440, H=80, padL=32, padB=16, padT=8;
    const cfData = stats.codeFreq.filter(([,a,d]) => a > 0 || d < 0);
    if (!cfData.length) return null;
    const maxV = Math.max(...cfData.map(([,a,d]) => Math.max(a, Math.abs(d))), 1);
    const colW = (W - padL) / cfData.length;
    const barW = Math.max(1.2, colW * 0.38);
    const yMid = padT + (H - padT - padB) / 2;
    let prevM = -1;
    return (
      <div style={{ background:"var(--bg2)", border:"1px solid #38bdf820", borderRadius:10, padding:"12px 14px 8px" }}>
        <div style={{ color:"#38bdf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📈 Evolución semanal — añadidas vs borradas</div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
          <line x1={padL} y1={yMid} x2={W-2} y2={yMid} stroke="var(--bdr2)" strokeWidth={0.5}/>
          <text x={padL-3} y={yMid+1.5} textAnchor="end" fontSize={4} fill="var(--bdr2)">0</text>
          {cfData.map(([ts, a, d], i) => {
            const bx  = padL + i * colW + (colW - barW * 2 - 1) / 2;
            const ah  = (a / maxV) * (yMid - padT);
            const dh  = (Math.abs(d) / maxV) * (H - padB - yMid);
            const m   = new Date(ts * 1000).getMonth();
            const lbl = m !== prevM ? (prevM = m, MN[m]) : "";
            return (
              <g key={ts}>
                {a > 0 && <rect x={bx} y={yMid-ah} width={barW} height={ah} fill="#38bdf8" opacity={0.75}><title>{`+${a.toLocaleString()} líneas`}</title></rect>}
                {d < 0 && <rect x={bx+barW+1} y={yMid} width={barW} height={dh} fill="#f43f5e" opacity={0.65}><title>{`${d.toLocaleString()} líneas`}</title></rect>}
                {lbl && <text x={bx+barW} y={H-2} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{lbl}</text>}
              </g>
            );
          })}
        </svg>
        <div style={{ display:"flex", gap:12, marginTop:4 }}>
          <span style={{ fontSize:8.5, color:"var(--tx4)" }}><span style={{ display:"inline-block", width:8, height:7, background:"#38bdf8", marginRight:3, borderRadius:1 }}/>Añadidas</span>
          <span style={{ fontSize:8.5, color:"var(--tx4)" }}><span style={{ display:"inline-block", width:8, height:7, background:"#f43f5e", marginRight:3, borderRadius:1 }}/>Borradas</span>
        </div>
      </div>
    );
  };

  return (<>
    <HighlightCards items={highlightItems} />

    {renderCodeFreq()}

    {/* Bar charts */}
    <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
      <div style={{ background:"var(--bg2)", border:"1px solid #38bdf820", borderRadius:10, padding:"12px 12px 8px" }}>
        <div style={{ color:"#38bdf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📦 Líneas añadidas</div>
        <HBar sorted={byLines} getValue={ms=>ms.lns.added} getLabel={ms=>ms.lns.added>999?`${(ms.lns.added/1000).toFixed(1)}k`:ms.lns.added}
          maxVal={maxAdded} color="#38bdf8" showMax
          avgVal={memberStats.filter(ms=>ms.lns.added>0).length>0?totalAdded/memberStats.filter(ms=>ms.lns.added>0).length:undefined} />
      </div>
      <div style={{ background:"var(--bg2)", border:"1px solid #f43f5e20", borderRadius:10, padding:"12px 12px 8px" }}>
        <div style={{ color:"#f43f5e", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>🗑️ Líneas borradas</div>
        <HBar sorted={byDeleted} getValue={ms=>ms.lns.deleted} getLabel={ms=>ms.lns.deleted>999?`${(ms.lns.deleted/1000).toFixed(1)}k`:ms.lns.deleted}
          maxVal={maxDeleted} color="#f43f5e" showMax />
      </div>
    </div>
    {byChurn.length > 0 && (
      <div style={{ background:"var(--bg2)", border:"1px solid #a855f720", borderRadius:10, padding:"12px 12px 8px" }}>
        <div style={{ color:"#a855f7", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>♻️ Code churn — % líneas borradas (↓ mejor)</div>
        <div style={{ color:"var(--tx4)", fontSize:8, marginBottom:8 }}>Bajo churn = código estable. Alto churn = mucho refactor o reescritura.</div>
        <HBar sorted={byChurn} getValue={ms=>ms.codeChurn??0} getLabel={ms=>`${ms.codeChurn}%`} maxVal={100} color="#a855f7" showMax />
      </div>
    )}

    <Recommendations title="💡 Recomendaciones — Líneas" color="#38bdf8" tips={tips} />
  </>);
}
