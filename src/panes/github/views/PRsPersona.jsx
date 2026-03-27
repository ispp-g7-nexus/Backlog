import HighlightCards from '../components/HighlightCards.jsx';
import HBar from '../components/HBar.jsx';
import WeeklyChart, { prepareWeeklyData } from '../components/WeeklyChart.jsx';
import Recommendations, { tip } from '../components/Recommendations.jsx';

export default function PRsPersona({ data, stats }) {
  const { memberStats, byPRs, byMerge, byPRSize, maxPRs, maxPRSize, totalPRs } = data;

  // Highlight cards
  const topPR  = byPRs[0];
  const topEff = [...memberStats].filter(ms => ms.prEfficiency !== null).sort((a, b) => b.prEfficiency - a.prEfficiency)[0];
  const avgMerged = memberStats.filter(ms => ms.pr.merged > 0).length > 0
    ? Math.round(totalPRs / memberStats.filter(ms => ms.pr.merged > 0).length) : 0;

  const highlightItems = [
    { label:"🥇 Más PRs", name: topPR?.m.name.split(" ").slice(0,2).join(" "), val:`${topPR?.pr.merged??0}`, color:"#34d399" },
    { label:"⚡ Merge más rápido", name: byMerge[0]?.m.name.split(" ").slice(0,2).join(" "), val: byMerge[0] ? `${byMerge[0].amt}d`:"—", color:"#fbbf24" },
    { label:"📊 Media / persona", name: null, val:`${avgMerged} PRs`, color:"var(--tx2)" },
    ...(topEff ? [{ label:"🎯 Mayor tasa merge", name: topEff.m.name.split(" ").slice(0,2).join(" "), val:`${topEff.prEfficiency}%`, color:"#22c55e" }] : []),
    ...(byPRSize[0] ? [{ label:"📦 PRs más grandes", name: byPRSize[0].m.name.split(" ").slice(0,2).join(" "), val:`${byPRSize[0].avgPRSize>999?(byPRSize[0].avgPRSize/1000).toFixed(1)+"k":byPRSize[0].avgPRSize} l/PR`, color:"#f97316" }] : []),
  ];

  // Weekly PRs data
  const actWeeks = stats?.prActivity;
  const display = Array.isArray(actWeeks) && actWeeks.length > 0
    ? prepareWeeklyData(actWeeks, (w) => ({ total: w.total }))
    : null;

  // Recommendations
  const tips = [];
  const withPRs = memberStats.filter(ms => ms.pr.total > 0);
  const noPRs   = memberStats.filter(ms => ms.pr.total === 0);
  if (noPRs.length)
    tips.push(tip("yellow","📋","Sin PRs registradas",
      `${noPRs.map(ms=>ms.m.name.split(" ")[0]).join(", ")} no ${noPRs.length>1?"tienen":"tiene"} PRs. Verificar que estén contribuyendo vía pull requests.`));
  const lowEff = withPRs.filter(ms => ms.prEfficiency !== null && ms.prEfficiency < 60);
  if (lowEff.length)
    tips.push(tip("yellow","🔁","Alta tasa de PRs sin mergear",
      `${lowEff.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.prEfficiency}%)`).join(", ")} ${lowEff.length>1?"tienen":"tiene"} menos del 60% de PRs mergeadas. Revisar si hay PRs abandonadas.`));
  const slowMerge = byMerge.filter(ms => ms.amt > 3);
  if (slowMerge.length)
    tips.push(tip("blue","⏱️","PRs con merge lento",
      `${slowMerge.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.amt}d)`).join(", ")} tarda${slowMerge.length>1?"n":""} más de 3 días en mergear. Agilizar el proceso de revisión mejora el flujo.`));
  const bigPRs = byPRSize.filter(ms => ms.avgPRSize > 500);
  if (bigPRs.length)
    tips.push(tip("blue","📦","PRs muy grandes",
      `${bigPRs.map(ms=>`${ms.m.name.split(" ")[0]} (~${ms.avgPRSize>999?(ms.avgPRSize/1000).toFixed(1)+"k":ms.avgPRSize} l)`).join(", ")} envía${bigPRs.length>1?"n":""} PRs muy grandes. PRs más pequeñas facilitan la revisión.`));
  if (!noPRs.length && !lowEff.length && !slowMerge.length)
    tips.push(tip("green","✅","Buen ritmo de PRs",
      `Todo el equipo tiene PRs y las tasas de merge son aceptables. Buen flujo de integración.`));

  return (<>
    <HighlightCards items={highlightItems} />

    {display && (
      <WeeklyChart display={display} color="#34d399" title="📅 PRs por semana" />
    )}

    <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
      <div style={{ background:"var(--bg2)", border:"1px solid #34d39920", borderRadius:10, padding:"12px 12px 8px" }}>
        <div style={{ color:"#34d399", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>🔀 PRs mergeadas</div>
        <HBar sorted={byPRs} getValue={ms=>ms.pr.merged} getLabel={ms=>`${ms.pr.merged}/${ms.pr.total}`} maxVal={maxPRs} color="#34d399" showMax
          avgVal={memberStats.filter(ms=>ms.pr.merged>0).length>0 ? totalPRs/memberStats.filter(ms=>ms.pr.merged>0).length : undefined} />
      </div>
      <div style={{ background:"var(--bg2)", border:"1px solid #22c55e20", borderRadius:10, padding:"12px 12px 8px" }}>
        <div style={{ color:"#22c55e", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>🎯 Tasa de merge (%)</div>
        <HBar sorted={[...memberStats].filter(ms=>ms.prEfficiency!==null).sort((a,b)=>b.prEfficiency-a.prEfficiency)}
          getValue={ms=>ms.prEfficiency??0} getLabel={ms=>`${ms.prEfficiency}%`} maxVal={100} color="#22c55e" showMax />
      </div>
    </div>

    <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
      {byMerge.length > 0 && (
        <div style={{ background:"var(--bg2)", border:"1px solid #fbbf2420", borderRadius:10, padding:"12px 12px 8px" }}>
          <div style={{ color:"#fbbf24", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>⚡ Días hasta merge (↓ mejor)</div>
          <HBar sorted={byMerge} getValue={ms=>ms.amt??0} getLabel={ms=>`${ms.amt}d`}
            maxVal={Math.max(...byMerge.map(ms=>ms.amt),1)} color="#fbbf24" showMax />
        </div>
      )}
      {byPRSize.length > 0 && (
        <div style={{ background:"var(--bg2)", border:"1px solid #f9731620", borderRadius:10, padding:"12px 12px 8px" }}>
          <div style={{ color:"#f97316", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📦 Tamaño medio PR (líneas)</div>
          <HBar sorted={byPRSize} getValue={ms=>ms.avgPRSize??0}
            getLabel={ms=>ms.avgPRSize>999?`${(ms.avgPRSize/1000).toFixed(1)}k`:`${ms.avgPRSize}`}
            maxVal={maxPRSize} color="#f97316" showMax />
        </div>
      )}
    </div>

    <Recommendations title="💡 Recomendaciones — PRs" color="#34d399" tips={tips} />
  </>);
}
