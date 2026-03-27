import InfStatCard from '../components/InfStatCard.jsx';
import { BACKLOG_MAP } from '../../../data.js';
import { TEAM_MEMBERS, EQUIPO_LOGINS, STATUS_META } from '../../../constants.js';
import { GH_STATS_KEY } from '../../../hooks/useGitHubStats.js';

export default function UsersView({ report, sprint, onSelectPerson }) {
  const STATUSES   = ["Backlog","Ready","In progress","In review","Done"];
  const TEAM_COLOR = { A:"#3b82f6", B:"#22c55e", C:"#f59e0b", D:"#a855f7" };

  const ghStats = (() => { try { const r = localStorage.getItem(GH_STATS_KEY); return r ? JSON.parse(r) : null; } catch(_) { return null; } })();
  const S1_WPR_IDX = [22, 23, 24, 25];
  const ghCombinedByLogin = Object.fromEntries(
    TEAM_MEMBERS.map(m => {
      const ll = m.login.toLowerCase();
      const wpr = ghStats?.weeklyPRs?.[ll] || [];
      const totalMerged = ghStats?.prs?.[ll]?.merged || 0;
      const s1Prs = S1_WPR_IDX.reduce((s, i) => s + (wpr[i] || 0), 0);
      const sprintPrs = sprint === 1 ? s1Prs
        : sprint === 2 ? Math.max(0, totalMerged - s1Prs)
        : sprint === 0 ? totalMerged : 0;
      const reviews = ghStats?.reviews?.[ll] || 0;
      return [ll, sprintPrs + reviews];
    })
  );
  const ghValues = Object.values(ghCombinedByLogin);
  const meanGhCombined = ghValues.length ? ghValues.reduce((s, v) => s + v, 0) / ghValues.length : 1;

  const relevantTasks = sprint === -1
    ? []
    : Object.values(BACKLOG_MAP).filter(t => sprint === 0 || t.sprint === sprint);

  const memberStats = TEAM_MEMBERS.map(member => {
    const loginLower = member.login.toLowerCase();
    const ue = report.byEmail[member.email?.toLowerCase()] || {};
    let totalH = 0, taggedH = 0;
    if (sprint === -1) {
      totalH  = ue.dp_h || 0;
      taggedH = 0;
    } else if (sprint === 0) {
      totalH  = (ue.dp_h||0) + (ue.s1_h||0) + (ue.s2_h||0) + (ue.s3_h||0);
      taggedH = (ue.s1_tagged_h||0) + (ue.s2_tagged_h||0) + (ue.s3_tagged_h||0);
    } else {
      totalH  = ue[`s${sprint}_h`]        || 0;
      taggedH = ue[`s${sprint}_tagged_h`] || 0;
    }
    const TALLA_PTS = { XS:1, S:2, M:3, L:5, XL:8 };
    const statusCounts = Object.fromEntries(STATUSES.map(s => [s, 0]));
    let estimatedH = 0, doneEstimatedH = 0, totalPts = 0, effPts = 0;
    relevantTasks.forEach(t => {
      const assignees = t.assignees || [];
      const directlyAssigned = assignees.some(a => a.login.toLowerCase() === loginLower);
      const equipoLogins     = EQUIPO_LOGINS[t.equipo] || [];
      const impliedByEquipo  = assignees.length === 0 && equipoLogins.includes(loginLower);
      if (directlyAssigned || impliedByEquipo) {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
        const n = directlyAssigned ? (assignees.length || 1) : (equipoLogins.length || 1);
        const perPersonH = (t.estimated_h || 0) / n;
        const perPersonPts = (TALLA_PTS[t.size] || 1) / n;
        estimatedH    += perPersonH;
        if (t.status === "Done") doneEstimatedH += perPersonH;
        totalPts      += perPersonPts;
        const w = t.status === "Done" ? 1 : t.status === "In review" ? 0.8 : t.status === "In progress" ? 0.2 : 0;
        effPts += perPersonPts * w;
      }
    });
    const totalTasks  = STATUSES.reduce((s, st) => s + statusCounts[st], 0);
    const doneCount   = statusCounts["Done"];
    const pctTasks    = totalTasks > 0 ? doneCount / totalTasks * 100   : null;
    const pctHours    = estimatedH > 0 ? totalH / estimatedH * 100      : null;
    const pctTagged   = totalH > 0     ? taggedH / totalH * 100         : null;
    const cr       = totalPts > 0 ? effPts / totalPts : null;
    const dev      = estimatedH > 0 ? (taggedH - estimatedH) / estimatedH : 0;
    const ef       = estimatedH > 0 ? (dev > 0 ? 1 / (1 + 1.5 * dev) : 1 / (1 + 0.5 * Math.abs(dev))) : null;
    const ghCombined = ghCombinedByLogin[loginLower] || 0;
    const ghNorm   = meanGhCombined > 0 ? ghCombined / meanGhCombined : 0;
    const rendimiento = cr !== null && ef !== null ? (0.25 * cr + 0.50 * ef + 0.25 * ghNorm) * 100 : null;
    return { member, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalPts, effPts, prMerged: ghCombined, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento };
  });

  const withTasks = memberStats.filter(ms => ms.totalTasks > 0);
  const withHours = memberStats.filter(ms => ms.estimatedH > 0);
  const avgPctTasks = withTasks.length
    ? withTasks.reduce((s, ms) => s + ms.pctTasks, 0) / withTasks.length : null;
  const avgPctHours = withHours.length
    ? withHours.reduce((s, ms) => s + Math.min(ms.pctHours, 200), 0) / withHours.length : null;
  const fullyDone   = withTasks.filter(ms => ms.pctTasks === 100).length;
  const noProgress  = withTasks.filter(ms => ms.doneCount === 0).length;
  const sigmaTasks = withTasks.length >= 2 && avgPctTasks !== null
    ? Math.sqrt(withTasks.reduce((s, ms) => s + (ms.pctTasks - avgPctTasks) ** 2, 0) / withTasks.length)
    : null;
  const withRendimiento = memberStats.filter(ms => ms.rendimiento !== null);
  const avgRendimiento  = withRendimiento.length
    ? withRendimiento.reduce((s, ms) => s + ms.rendimiento, 0) / withRendimiento.length : null;
  const memberStatsScored = memberStats.map(ms => ({
    ...ms,
    score: ms.rendimiento !== null && avgRendimiento ? ms.rendimiento / avgRendimiento * 100 : null,
  }));
  const avgMemberEstH = withHours.length ? withHours.reduce((s, ms) => s + ms.estimatedH, 0) / withHours.length : null;
  const sigmaMemberEstH = avgMemberEstH && withHours.length >= 2
    ? Math.sqrt(withHours.reduce((s, ms) => s + (ms.estimatedH - avgMemberEstH) ** 2, 0) / withHours.length) : null;
  const cvMemberEstH = sigmaMemberEstH && avgMemberEstH ? sigmaMemberEstH / avgMemberEstH * 100 : null;

  const bothValid = memberStats.filter(ms => ms.pctTasks !== null && ms.pctHours !== null);
  let correlation = null;
  if (bothValid.length >= 3) {
    const xs = bothValid.map(ms => ms.pctTasks);
    const ys = bothValid.map(ms => Math.min(ms.pctHours, 200));
    const mx = xs.reduce((s,x)=>s+x,0)/xs.length;
    const my = ys.reduce((s,y)=>s+y,0)/ys.length;
    const num = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0);
    const den = Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)*ys.reduce((s,y)=>s+(y-my)**2,0));
    correlation = den > 0 ? num/den : null;
  }

  const globalMetrics = sprint !== -1 && withTasks.length > 0 ? (
    <div style={{ background:"var(--bg1)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px", marginBottom:4 }}>
      <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
        Metricas globales — {withTasks.length} personas con tareas asignadas
      </div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        {avgPctTasks !== null && (
          <InfStatCard label="Media completitud tareas"
            value={`${avgPctTasks.toFixed(1)}%`}
            sub={`${fullyDone} al 100% · ${noProgress} sin avance`}
            color={avgPctTasks>=75?"#22c55e":avgPctTasks>=40?"#f59e0b":"#ef4444"} />
        )}
        {avgPctHours !== null && (
          <InfStatCard label="Media consumo estimado"
            value={`${avgPctHours.toFixed(1)}%`}
            sub="horas Clockify / horas estimadas (media)"
            color={avgPctHours>=100?"#ef4444":avgPctHours>=75?"#f59e0b":"#22c55e"} />
        )}
        {sigmaTasks !== null && (
          <InfStatCard label="Equilibrio del equipo"
            value={`σ ${sigmaTasks.toFixed(1)}%`}
            sub={`desv. tipica de completitud · ideal σ→0`}
            color={sigmaTasks<=15?"#22c55e":sigmaTasks<=30?"#f59e0b":"#ef4444"} />
        )}
        {avgRendimiento !== null && (
          <InfStatCard label="Rendimiento medio"
            value={`${avgRendimiento.toFixed(1)}%`}
            sub="h estimadas Done / h Clockify · ideal >=100%"
            color={avgRendimiento>=100?"#22c55e":avgRendimiento>=50?"#f59e0b":"#ef4444"} />
        )}
        {correlation !== null && (
          <InfStatCard label="Correlacion tareas<->horas"
            value={correlation.toFixed(2)}
            sub="Pearson: 1=perfecta, 0=sin relacion"
            color={Math.abs(correlation)>=0.7?"#22c55e":Math.abs(correlation)>=0.4?"#f59e0b":"var(--tx2)"} />
        )}
        {cvMemberEstH !== null && (
          <InfStatCard label="Desbalance de carga"
            value={`CV ${cvMemberEstH.toFixed(0)}%`}
            sub={`σ ${sigmaMemberEstH.toFixed(0)}h · μ ${avgMemberEstH.toFixed(0)}h est. · ideal CV→0`}
            color={cvMemberEstH<=30?"#22c55e":cvMemberEstH<=60?"#f59e0b":"#ef4444"} />
        )}
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {globalMetrics}
      {["A","B","C","D"].map(team => {
        const tc = TEAM_COLOR[team];
        const rows = memberStatsScored
          .filter(ms => ms.member.team === team)
          .sort((a, b) => a.member.name.localeCompare(b.member.name));
        return (
          <div key={team}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <span style={{ background:`${tc}20`, color:tc, fontWeight:800, fontSize:10, textTransform:"uppercase", letterSpacing:2, padding:"3px 10px", borderRadius:5, flexShrink:0 }}>Equipo {team}</span>
              <div style={{ flex:1, height:1, background:"var(--bdr)" }}/>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {rows.map(({ member, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento, score }) => {
                const hoursColor      = pctHours===null?"var(--bdr2)":pctHours>=100?"#ef4444":pctHours>=75?"#f59e0b":"#22c55e";
                const tasksColor      = pctTasks===null?"var(--bdr2)":pctTasks===100?"#22c55e":pctTasks>=50?"#f59e0b":"var(--tx2)";
                const taggedColor     = pctTagged===null?"var(--bdr2)":pctTagged>=60?"#22c55e":pctTagged>=25?"#f59e0b":"#ef4444";
                const rendColor       = rendimiento===null?"var(--bdr2)":rendimiento>=100?"#22c55e":rendimiento>=50?"#f59e0b":"#ef4444";
                return (
                  <div key={member.login} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"12px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                        <img
                          src={`https://github.com/${member.login}.png?size=40`}
                          alt={member.name}
                          style={{ width:36, height:36, borderRadius:"50%", border:`2px solid ${tc}50`, flexShrink:0 }}
                        />
                        <div style={{ minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span
                              onClick={() => onSelectPerson(member.login)}
                              style={{ color:"var(--tx0)", fontWeight:700, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", cursor:"pointer", textDecoration:"underline dotted", textUnderlineOffset:3 }}
                              title="Ver detalle de persona"
                            >{member.name}</span>
                            {avgMemberEstH !== null && estimatedH > 0 && (() => {
                              const delta    = estimatedH - avgMemberEstH;
                              const deltaPct = delta / avgMemberEstH * 100;
                              const col = Math.abs(deltaPct) <= 20 ? "var(--tx4)" : delta > 0 ? "#f59e0b" : "#818cf8";
                              return (
                                <span title={`${estimatedH.toFixed(0)}h estimadas vs media ${avgMemberEstH.toFixed(0)}h`}
                                  style={{ fontSize:9, fontWeight:700, background:`${col}18`, color:col, padding:"1px 5px", borderRadius:3, flexShrink:0 }}>
                                  {delta>=0?"+":""}{delta.toFixed(0)}h
                                </span>
                              );
                            })()}
                          </div>
                          <div style={{ color:"var(--tx4)", fontSize:10 }}>@{member.login} · {member.role}{member.coord?" · Coord":""} · {totalTasks} tarea{totalTasks!==1?"s":""} asignada{totalTasks!==1?"s":""}</div>
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0, lineHeight:1.6 }}>
                        <div style={{ color:"var(--tx0)", fontWeight:800, fontSize:15 }}>{totalH.toFixed(1)}h</div>
                        <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                          <span style={{ fontSize:10, color: taggedH>0?"#22c55e":"var(--bdr2)" }}>{taggedH.toFixed(1)}h etiq.</span>
                          {pctTagged !== null && (
                            <span style={{ fontSize:9, fontWeight:700, background:`${taggedColor}20`, color:taggedColor, padding:"1px 5px", borderRadius:3 }}>
                              {pctTagged.toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {rendimiento !== null && (
                          <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                            <span style={{ fontSize:9, color:rendColor, fontWeight:700 }} title="(tareas done / total) × (1 − |h_real − h_est| / h_est) · ideal 100%">
                              {rendimiento.toFixed(0)}% rendimiento
                            </span>
                            {score !== null && (() => {
                              const sc = score;
                              const sc100 = sc >= 95 && sc <= 105;
                              const scColor = sc100 ? "var(--tx4)" : sc > 100 ? "#22c55e" : "#ef4444";
                              return (
                                <span title={`Score relativo: rendimiento / media del grupo × 100. Media = 100%`}
                                  style={{ fontSize:9, fontWeight:800, background:`${scColor}20`, color:scColor, padding:"1px 6px", borderRadius:4, border:`1px solid ${scColor}40` }}>
                                  {sc.toFixed(0)}%
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                    {sprint !== -1 && (
                      <div style={{ display:"flex", gap:14, marginTop:10 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                            <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Tareas done</span>
                            <span style={{ color:tasksColor, fontSize:9, fontWeight:700 }}>
                              {pctTasks!==null ? `${doneCount}/${totalTasks} · ${pctTasks.toFixed(0)}%` : "—"}
                            </span>
                          </div>
                          <div style={{ height:4, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${Math.min(pctTasks||0,100)}%`, background:tasksColor, borderRadius:2 }}/>
                          </div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                            <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Horas consumidas</span>
                            <span style={{ color:hoursColor, fontSize:9, fontWeight:700 }}>
                              {pctHours!==null ? `${totalH.toFixed(1)}/${estimatedH.toFixed(0)}h · ${pctHours.toFixed(0)}%` : "—"}
                            </span>
                          </div>
                          <div style={{ height:4, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${Math.min(pctHours||0,100)}%`, background:hoursColor, borderRadius:2 }}/>
                          </div>
                        </div>
                      </div>
                    )}
                    {sprint !== -1 && (
                      <div style={{ display:"flex", gap:5, marginTop:8, flexWrap:"wrap" }}>
                        {STATUSES.map(st => {
                          const count = statusCounts[st] || 0;
                          const meta  = STATUS_META[st] || { bg:"var(--bdr)", text:"var(--tx3)" };
                          return (
                            <span key={st} style={{
                              background: count>0 ? meta.bg : "var(--bg3)",
                              color:      count>0 ? meta.text : "var(--bdr2)",
                              border:    `1px solid ${count>0 ? meta.bg+"aa" : "var(--bdr)"}`,
                              padding:"3px 9px", borderRadius:5, fontSize:10, fontWeight:count>0?700:400,
                            }}>
                              {count} {st}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
