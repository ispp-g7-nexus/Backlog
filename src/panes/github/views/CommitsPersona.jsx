import HighlightCards from '../components/HighlightCards.jsx';
import HBar from '../components/HBar.jsx';
import WeeklyChart, { prepareWeeklyData } from '../components/WeeklyChart.jsx';
import Recommendations, { tip } from '../components/Recommendations.jsx';
import { TC } from '../hooks/useGitHubData.js';
import { SC as SPRINT_CONFIG } from '../../../constants.js';

export default function CommitsPersona({ data, stats }) {
  const { memberStats, byCommits, maxCommits, totalCommits } = data;

  // --- Highlight cards ---
  const active = byCommits.filter(ms => ms.commits > 0);
  const top = active[0];
  const bottom = active[active.length - 1];
  const avg = active.length > 0 ? Math.round(totalCommits / active.length) : 0;
  const wcLen = Math.max(...memberStats.map(ms => (ms.wc || []).length), 0);
  const projActive = Array.from({length: wcLen}, (_, i) => memberStats.some(ms => (ms.wc || [])[i] > 0));
  const nProjW = projActive.filter(Boolean).length || 1;
  const byReg = memberStats.filter(ms => ms.commits > 0)
    .map(ms => { const sum = projActive.reduce((s, a, i) => a ? s + ((ms.wc || [])[i] || 0) : s, 0); return { ms, avg: sum / nProjW }; })
    .sort((a, b) => b.avg - a.avg);
  const mostReg = byReg[0];
  const leastReg = byReg[byReg.length - 1];

  const highlightItems = [
    { label:"\u{1F947} M\u00e1s commits", name: top?.m.name.split(" ").slice(0,2).join(" "), val:`${top?.commits ?? 0}`, color:"#818cf8" },
    { label:"\u{1F53B} Menos commits", name: bottom?.m.name.split(" ").slice(0,2).join(" "), val:`${bottom?.commits ?? 0}`, color:"#f43f5e" },
    { label:"\u{1F4CA} Media / persona", name: null, val:`${avg}`, color:"var(--tx2)" },
    { label:"\u{1F3AF} M\u00e1s regular", name: mostReg?.ms.m.name.split(" ").slice(0,2).join(" "), val:`${mostReg?.avg.toFixed(1)} c/sem`, color:"#22c55e" },
    { label:"\u{1F4C9} Menos regular", name: leastReg?.ms.m.name.split(" ").slice(0,2).join(" "), val:`${leastReg?.avg.toFixed(1)} c/sem`, color:"#f97316" },
  ];

  // --- Weekly chart ---
  const actWeeks = stats.commitActivity;
  const weeklyDisplay = actWeeks ? prepareWeeklyData(actWeeks, (w, i) => {
    let total = 0;
    memberStats.forEach(({ wc }) => {
      if (!wc?.length) return;
      const wcIdx = i - (actWeeks.length - wc.length);
      if (wcIdx >= 0 && wcIdx < wc.length) total += wc[wcIdx] || 0;
    });
    return { total };
  }) : null;

  // --- Recommendations ---
  const tips = [];
  const avgRaw = active.length > 0 ? totalCommits / active.length : 0;

  const zero = memberStats.filter(ms => ms.commits === 0);
  if (zero.length) tips.push(tip("red","\u{1F6A8}","Sin commits registrados",
    `${zero.map(ms=>ms.m.name.split(" ")[0]).join(", ")} no ${zero.length>1?"tienen":"tiene"} commits. Verificar que el login de GitHub sea correcto o que hayan subido c\u00f3digo al repositorio.`));

  const veryLow = active.filter(ms => ms.commits < avgRaw * 0.4);
  if (veryLow.length) tips.push(tip("yellow","\u{1F4C9}","Deber\u00edan aumentar su cadencia",
    `${veryLow.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.commits})`).join(", ")} ${veryLow.length>1?"est\u00e1n":"est\u00e1"} por debajo del 40% de la media (${Math.round(avgRaw)} commits). Aumentar la frecuencia de commits o revisar si hay trabajo sin subir.`));

  const lowCons = active.filter(ms => {
    const aw = projActive.filter((a, i) => a && (ms.wc || [])[i] > 0).length;
    return aw < Math.ceil(nProjW / 2);
  });
  if (lowCons.length) tips.push(tip("yellow","\u{1F4C5}","Trabajo concentrado en pocas semanas",
    `${lowCons.map(ms=>ms.m.name.split(" ")[0]).join(", ")} solo ${lowCons.length>1?"han":"ha"} commiteado en menos de la mitad de semanas activas. Distribuir el trabajo de forma m\u00e1s continua evita cuellos de botella al final del sprint.`));

  const veryHigh = active.filter(ms => ms.commits > avgRaw * 2.5);
  if (veryHigh.length && avgRaw > 0) tips.push(tip("blue","\u26A0\uFE0F","Posible sobrecarga",
    `${veryHigh.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.commits})`).join(", ")} acumula${veryHigh.length>1?"n":""} m\u00e1s del doble de la media. Revisar si el reparto de tareas es equilibrado.`));

  if (active.length > 1 && active[0].commits > active[active.length - 1].commits * 8)
    tips.push(tip("blue","\u2194\uFE0F","Alta dispersi\u00f3n entre miembros",
      `El m\u00e1ximo (${active[0].commits}) es m\u00e1s de 8\u00d7 el m\u00ednimo activo (${active[active.length - 1].commits}). El equipo deber\u00eda nivelar la carga de trabajo.`));

  if (!zero.length && veryLow.length === 0)
    tips.push(tip("green","\u2705","Buena participaci\u00f3n general",
      `Todo el equipo tiene commits y nadie est\u00e1 por debajo del 40% de la media. Buen ritmo de trabajo.`));

  return (
    <>
      <HighlightCards items={highlightItems} />

      {weeklyDisplay && (
        <WeeklyChart display={weeklyDisplay} color="#818cf8" title="\u{1F4C5} Commits por semana" />
      )}

      <div style={{ background:"var(--bg2)", border:"1px solid #818cf820", borderRadius:10, padding:"12px 12px 8px" }}>
        <div style={{ color:"#818cf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>{"\u{1F4BB}"} Commits por persona</div>
        <HBar sorted={data.byCommits} getValue={ms => ms.commits} getLabel={ms => ms.commits} maxVal={data.maxCommits} color="#818cf8" showMax
          avgVal={data.memberStats.filter(ms => ms.commits > 0).length > 0 ? Math.round(data.totalCommits / data.memberStats.filter(ms => ms.commits > 0).length) : undefined} />
      </div>

      <Recommendations title={"\u{1F4A1} Recomendaciones \u2014 Persona"} color="#818cf8" tips={tips} />
    </>
  );
}
