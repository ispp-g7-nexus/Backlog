import HighlightCards from '../components/HighlightCards.jsx';
import MemberCards from '../components/MemberCards.jsx';
import WeeklyChart, { prepareWeeklyData } from '../components/WeeklyChart.jsx';
import Recommendations, { tip } from '../components/Recommendations.jsx';
import { TC } from '../hooks/useGitHubData.js';

export default function CommitsEquipo({ data, stats }) {
  const { memberStats, teamTotals, totalCommits, maxTC, byCommits } = data;

  // — Highlight cards —
  const sorted = [...teamTotals].sort((a, b) => b.commits - a.commits);
  const top = sorted[0], bot = sorted[sorted.length - 1];
  const active = teamTotals.filter(t => t.commits > 0);
  const avg = active.length > 0 ? Math.round(totalCommits / active.length) : 0;
  const wcLen = Math.max(...memberStats.map(ms => (ms.wc || []).length), 0);
  const projActive = Array.from({length: wcLen}, (_, i) => memberStats.some(ms => (ms.wc || [])[i] > 0));
  const nProjW = projActive.filter(Boolean).length || 1;
  const byReg = ["A","B","C","D"].map(team => {
    const ms = memberStats.filter(r => r.m.team === team);
    const sum = projActive.reduce((s, a, i) => a ? s + ms.reduce((t, r) => t + ((r.wc || [])[i] || 0), 0) : s, 0);
    return { team, avg: sum / nProjW };
  }).sort((a, b) => b.avg - a.avg);
  const mostReg = byReg[0], leastReg = byReg[byReg.length - 1];

  const highlightItems = [
    { label:"🥇 Equipo líder",   name:`Equipo ${top?.team}`,      val:`${top?.commits}`,                   color: TC[top?.team] },
    { label:"🔻 Equipo menor",   name:`Equipo ${bot?.team}`,      val:`${bot?.commits}`,                   color:"#f43f5e" },
    { label:"📊 Media / equipo", name: null,                       val:`${avg}`,                            color:"var(--tx2)" },
    { label:"🎯 Más regular",    name:`Equipo ${mostReg?.team}`,  val:`${mostReg?.avg.toFixed(1)} c/sem`,  color:"#22c55e" },
    { label:"📉 Menos regular",  name:`Equipo ${leastReg?.team}`, val:`${leastReg?.avg.toFixed(1)} c/sem`, color:"#f97316" },
  ];

  // — Weekly stacked chart —
  const actWeeks = stats?.commitActivity;
  const hasWeekly = Array.isArray(actWeeks) && actWeeks.length > 0 && memberStats.length > 0;
  const weeklyDisplay = hasWeekly ? prepareWeeklyData(actWeeks, (w, i) => {
    const vals = { A:0, B:0, C:0, D:0 };
    memberStats.forEach(({ m, wc }) => {
      if (!wc?.length) return;
      const wcIdx = i - (actWeeks.length - wc.length);
      if (wcIdx >= 0 && wcIdx < wc.length) vals[m.team] += wc[wcIdx] || 0;
    });
    return { vals, total: Object.values(vals).reduce((s, v) => s + v, 0) };
  }) : null;

  // — Recommendations —
  const tips = [];
  const activeTeams = sorted.filter(t => t.commits > 0);
  const avgTeam = activeTeams.length > 0 ? totalCommits / activeTeams.length : 0;
  const lastWcIdx = wcLen - 1;

  const zeroTeams = sorted.filter(t => t.commits === 0);
  if (zeroTeams.length) tips.push(tip("red","🚨","Equipos sin commits",
    `Equipo${zeroTeams.length>1?"s":""} ${zeroTeams.map(t=>t.team).join(", ")} no ${zeroTeams.length>1?"tienen":"tiene"} commits. Revisar asignación de tareas.`));

  const lowTeams = activeTeams.filter(t => t.commits < avgTeam * 0.5);
  if (lowTeams.length) tips.push(tip("yellow","📉","Equipos por debajo de la media",
    `Equipo${lowTeams.length>1?"s":""} ${lowTeams.map(t=>`${t.team} (${t.commits})`).join(", ")} ${lowTeams.length>1?"están":"está"} por debajo del 50% de la media (${Math.round(avgTeam)}). Revisar si el volumen de tareas es proporcional.`));

  const silentNow = ["A","B","C","D"].filter(team =>
    memberStats.filter(r => r.m.team === team).every(r => !((r.wc||[])[lastWcIdx] > 0))
  );
  if (silentNow.length) tips.push(tip("yellow","💤","Sin actividad esta semana",
    `Equipo${silentNow.length>1?"s":""} ${silentNow.join(", ")} no ${silentNow.length>1?"han":"ha"} commiteado en la última semana. Verificar que el trabajo esté siendo subido regularmente.`));

  const teamCons = ["A","B","C","D"].map(team => {
    const ms = memberStats.filter(r => r.m.team === team);
    const aw = projActive.filter((a, i) => a && ms.some(r => (r.wc||[])[i] > 0)).length;
    return { team, aw };
  }).filter(t => t.aw < Math.ceil(nProjW / 2) && activeTeams.some(at => at.team === t.team));
  if (teamCons.length) tips.push(tip("blue","📅","Consistencia semanal mejorable",
    `Equipo${teamCons.length>1?"s":""} ${teamCons.map(t=>`${t.team} (${t.aw}/${nProjW} sem)`).join(", ")} solo ha${teamCons.length>1?"n":""} tenido actividad en menos de la mitad de semanas. Commit frecuente facilita la integración continua.`));

  if (activeTeams.length > 1) {
    const ratio = sorted[0].commits / (sorted.find(t => t.commits > 0)?.commits || 1);
    if (ratio > 2) tips.push(tip("blue","↔️","Desequilibrio entre equipos",
      `El equipo más activo (${sorted[0].team}: ${sorted[0].commits}) acumula el doble que otros. Revisar si la distribución de historias de usuario es equitativa.`));
  }

  if (!zeroTeams.length && !lowTeams.length)
    tips.push(tip("green","✅","Todos los equipos contribuyen",
      `Los 4 equipos tienen commits registrados y ninguno está muy por debajo de la media. Buen equilibrio de trabajo.`));

  return (
    <>
      <HighlightCards items={highlightItems} />

      {weeklyDisplay && (
        <WeeklyChart
          display={weeklyDisplay}
          teamColors={TC}
          title="📅 Commits por semana — por equipo"
          color="var(--tx2)"
        />
      )}

      {/* Team comparison bar */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px" }}>
        <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>📊 Comparativa — Commits</div>
        {teamTotals.map(({ team, color, commits }) => (
          <div key={team} style={{ marginBottom:12 }}>
            <div style={{ marginBottom:4 }}>
              <span style={{ background:`${color}20`, color, fontWeight:800, fontSize:9, textTransform:"uppercase", letterSpacing:2, padding:"2px 8px", borderRadius:4 }}>Equipo {team}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ color:"var(--tx4)", fontSize:7.5, width:38, flexShrink:0 }}>Commits</span>
              <div style={{ flex:1, height:5, background:"var(--bdr)", borderRadius:3, overflow:"hidden", position:"relative" }}>
                <div style={{ height:"100%", width:`${maxTC>0?commits/maxTC*100:0}%`, background:"#818cf8", borderRadius:3, opacity:0.9 }}/>
                {maxTC > 0 && <div style={{ position:"absolute", top:0, bottom:0, left:`${totalCommits/4/maxTC*100}%`, width:1, background:"var(--tx2)", opacity:0.55 }}/>}
              </div>
              <span style={{ color:"#818cf8", fontSize:8.5, fontWeight:700, width:30, textAlign:"right", flexShrink:0 }}>{commits}</span>
            </div>
          </div>
        ))}
      </div>

      <MemberCards
        memberStats={memberStats}
        teamTotals={teamTotals}
        ghTab="commits"
        maxCommits={data.maxCommits}
        maxPRs={data.maxPRs}
        maxRevs={data.maxRevs}
        maxAdded={data.maxAdded}
        totalCommits={totalCommits}
      />

      <Recommendations title="💡 Recomendaciones — Equipo" color="var(--tx2)" tips={tips} />
    </>
  );
}
