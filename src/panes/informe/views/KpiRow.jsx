import InfStatCard from '../components/InfStatCard.jsx';

export default function KpiRow({ report, sprint, filtered }) {
  if (sprint === -1) {
    const dpUsers   = Object.values(report.byEmail || {});
    const totalDp   = dpUsers.reduce((s, e) => s + (e.dp_h || 0), 0);
    const activeDp  = dpUsers.filter(e => (e.dp_h || 0) > 0).length;
    return (
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
        <InfStatCard label="Entradas CSV"    value={report.totalEntries}  sub={`${report.matchedEntries} con tarea identificada`} color="#10b981" />
        <InfStatCard label="S0 — DP horas"  value={`${totalDp.toFixed(1)}h`} sub="Devising a Project"        color="#6366f1" />
        <InfStatCard label="Personas activas" value={`${activeDp}`}       sub="con horas S0 registradas"     color="#e879f9" />
        <InfStatCard label="Estado S0"       value="Completado"           sub="Sprint 0 finalizado"           color="#22c55e" />
      </div>
    );
  }
  const tasks   = filtered(report).map(([,t])=>t);
  const totalEst  = tasks.reduce((s,t)=>s+t.estimated_h, 0);
  const totalReal = tasks.reduce((s,t)=>s+t.real_h, 0);
  const active    = tasks.filter(t=>t.real_h>0).length;
  const alerts    = tasks.filter(t=>t.estimated_h>0 && t.real_h/t.estimated_h>=0.8).length;
  const pct       = totalEst ? totalReal/totalEst*100 : 0;
  return (
    <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
      <InfStatCard label="Entradas CSV"    value={report.totalEntries}             sub={`${report.matchedEntries} con tarea identificada`} color="#10b981" />
      <InfStatCard label="H. estimadas"   value={`${totalEst}h`}                  sub="según backlog"          color="#818cf8" />
      <InfStatCard label="H. registradas" value={`${totalReal.toFixed(1)}h`}       sub={`${active} tareas activas`} color="#34d399" />
      <InfStatCard label="% completado"   value={`${pct.toFixed(1)}%`}             sub="horas reales / estimadas" color={pct>=100?"#ef4444":pct>=80?"#f59e0b":"#22c55e"} />
      <InfStatCard label="En alerta"      value={alerts}                           sub=">=80% del estimado"      color="#f43f5e" />
      <InfStatCard label="Personas"       value={Object.keys(report.byUser).length} sub="con tiempo registrado"  color="#e879f9" />
    </div>
  );
}
