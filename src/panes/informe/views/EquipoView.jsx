import InfStatCard from '../components/InfStatCard.jsx';
import { BACKLOG_MAP } from '../../../data.js';
import { TEAM_MEMBERS, EQUIPO_LOGINS, STATUS_META } from '../../../constants.js';
import { GH_STATS_KEY } from '../../../hooks/useGitHubStats.js';

export default function EquipoView({ report, sprint }) {
  const STATUSES   = ["Backlog","Ready","In progress","In review","Done"];
  const TEAM_COLOR = { A:"#3b82f6", B:"#22c55e", C:"#f59e0b", D:"#a855f7" };

  const ghStatsE = (() => { try { const r = localStorage.getItem(GH_STATS_KEY); return r ? JSON.parse(r) : null; } catch(_) { return null; } })();
  const S1_WPR_IDX_E = [22, 23, 24, 25];
  const ghCombinedByLoginE = Object.fromEntries(
    TEAM_MEMBERS.map(m => {
      const ll = m.login.toLowerCase();
      const wpr = ghStatsE?.weeklyPRs?.[ll] || [];
      const totalMerged = ghStatsE?.prs?.[ll]?.merged || 0;
      const s1Prs = S1_WPR_IDX_E.reduce((s, i) => s + (wpr[i] || 0), 0);
      const sprintPrs = sprint === 1 ? s1Prs
        : sprint === 2 ? Math.max(0, totalMerged - s1Prs)
        : sprint === 0 ? totalMerged : 0;
      const reviews = ghStatsE?.reviews?.[ll] || 0;
      return [ll, sprintPrs + reviews];
    })
  );
  const ghValuesE = Object.values(ghCombinedByLoginE);
  const meanGhCombinedE = ghValuesE.length ? ghValuesE.reduce((s, v) => s + v, 0) / ghValuesE.length : 1;

  const relevantTasks = sprint === -1
    ? []
    : Object.values(BACKLOG_MAP).filter(t => sprint === 0 || t.sprint === sprint);

  const teamStats = ["A","B","C","D"].map(team => {
    const members = TEAM_MEMBERS.filter(m => m.team === team);
    const teamLogins = new Set(members.map(m => m.login.toLowerCase()));

    let totalH = 0, taggedH = 0;
    members.forEach(m => {
      const ue = report.byEmail[m.email?.toLowerCase()] || {};
      if (sprint === -1) {
        totalH  += ue.dp_h || 0;
      } else if (sprint === 0) {
        totalH  += (ue.dp_h||0) + (ue.s1_h||0) + (ue.s2_h||0) + (ue.s3_h||0);
        taggedH += (ue.s1_tagged_h||0) + (ue.s2_tagged_h||0) + (ue.s3_tagged_h||0);
      } else {
        totalH  += ue[`s${sprint}_h`]        || 0;
        taggedH += ue[`s${sprint}_tagged_h`] || 0;
      }
    });

    const statusCounts = Object.fromEntries(STATUSES.map(s => [s, 0]));
    const TALLA_PTS_T = { XS:1, S:2, M:3, L:5, XL:8 };
    let estimatedH = 0, doneEstimatedH = 0, totalPts = 0, effPts = 0;
    const seenTaskIds = new Set();
    members.forEach(m => {
      const loginLower = m.login.toLowerCase();
      relevantTasks.forEach(t => {
        const assignees   = t.assignees || [];
        const equipoLogins = EQUIPO_LOGINS[t.equipo] || [];
        const direct   = assignees.some(a => a.login.toLowerCase() === loginLower);
        const implied  = assignees.length === 0 && equipoLogins.includes(loginLower);
        if (direct || implied) {
          if (!seenTaskIds.has(t.id)) {
            seenTaskIds.add(t.id);
            statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
          }
          const perPersonH = (t.area === "Asistencia" && implied && equipoLogins.length > 0)
            ? t.estimated_h / equipoLogins.length
            : t.estimated_h;
          estimatedH += perPersonH || 0;
          if (t.status === "Done") doneEstimatedH += perPersonH || 0;
          const n = direct ? (assignees.length || 1) : (equipoLogins.length || 1);
          const perPersonPts = (TALLA_PTS_T[t.size] || 1) / n;
          totalPts += perPersonPts;
          const w = t.status === "Done" ? 1 : t.status === "In review" ? 0.8 : t.status === "In progress" ? 0.2 : 0;
          effPts += perPersonPts * w;
        }
      });
    });

    const totalTasks  = STATUSES.reduce((s, st) => s + statusCounts[st], 0);
    const doneCount   = statusCounts["Done"];
    const pctTasks    = totalTasks > 0 ? doneCount / totalTasks * 100   : null;
    const pctHours    = estimatedH > 0 ? totalH / estimatedH * 100      : null;
    const pctTagged   = totalH > 0     ? taggedH / totalH * 100         : null;
    const crT  = totalPts > 0 ? effPts / totalPts : null;
    const devT = estimatedH > 0 ? (taggedH - estimatedH) / estimatedH : 0;
    const efT  = estimatedH > 0 ? (devT > 0 ? 1 / (1 + 1.5 * devT) : 1 / (1 + 0.5 * Math.abs(devT))) : null;
    const teamGhNorm = members.length
      ? members.reduce((s, m) => s + (meanGhCombinedE > 0 ? (ghCombinedByLoginE[m.login.toLowerCase()] || 0) / meanGhCombinedE : 0), 0) / members.length
      : 0;
    const rendimiento = crT !== null && efT !== null ? (0.25 * crT + 0.50 * efT + 0.25 * teamGhNorm) * 100 : null;

    const memberEstHArr = members.map(m => {
      const ll = m.login.toLowerCase();
      let mH = 0;
      relevantTasks.forEach(t => {
        const ass = t.assignees || [];
        const eqL = EQUIPO_LOGINS[t.equipo] || [];
        if (ass.some(a => a.login.toLowerCase() === ll) || (ass.length === 0 && eqL.includes(ll)))
          mH += t.estimated_h || 0;
      });
      return mH;
    });
    const avgMemberEstH = memberEstHArr.reduce((s, h) => s + h, 0) / memberEstHArr.length;
    const intraCV = avgMemberEstH > 0 && members.length >= 2
      ? Math.sqrt(memberEstHArr.reduce((s, h) => s + (h - avgMemberEstH) ** 2, 0) / memberEstHArr.length) / avgMemberEstH * 100
      : null;

    return { team, members, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalPts, effPts, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento, memberEstHArr, avgMemberEstH, intraCV };
  });

  const withTasks = teamStats.filter(ts => ts.totalTasks > 0);
  const withHours = teamStats.filter(ts => ts.estimatedH > 0);
  const avgPctTasks = withTasks.length ? withTasks.reduce((s, ts) => s + ts.pctTasks, 0) / withTasks.length : null;
  const avgPctHours = withHours.length ? withHours.reduce((s, ts) => s + Math.min(ts.pctHours, 200), 0) / withHours.length : null;
  const best  = withTasks.length ? withTasks.reduce((a, b) => b.pctTasks > a.pctTasks ? b : a) : null;
  const withRend = teamStats.filter(ts => ts.rendimiento !== null);
  const avgRendimiento = withRend.length ? withRend.reduce((s, ts) => s + ts.rendimiento, 0) / withRend.length : null;
  const teamStatsScored = teamStats.map(ts => ({
    ...ts,
    score: ts.rendimiento !== null && avgRendimiento ? ts.rendimiento / avgRendimiento * 100 : null,
  }));

  const avgTeamEstH = withHours.length ? withHours.reduce((s, ts) => s + ts.estimatedH, 0) / withHours.length : null;
  const sigmaTeamEstH = avgTeamEstH && withHours.length >= 2
    ? Math.sqrt(withHours.reduce((s, ts) => s + (ts.estimatedH - avgTeamEstH) ** 2, 0) / withHours.length) : null;
  const cvTeamEstH = sigmaTeamEstH && avgTeamEstH ? sigmaTeamEstH / avgTeamEstH * 100 : null;

  const sigmaTasks = withTasks.length >= 2 && avgPctTasks !== null
    ? Math.sqrt(withTasks.reduce((s, ts) => s + (ts.pctTasks - avgPctTasks) ** 2, 0) / withTasks.length)
    : null;

  const globalMetrics = sprint !== -1 && withTasks.length > 0 ? (
    <div style={{ background:"var(--bg1)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px", marginBottom:4 }}>
      <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
        Comparativa de equipos — {withTasks.length} equipos con tareas
      </div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        {avgPctTasks !== null && (
          <InfStatCard label="Media completitud tareas"
            value={`${avgPctTasks.toFixed(1)}%`}
            sub={best ? `Lider: Equipo ${best.team} · ${best.pctTasks.toFixed(0)}%` : ""}
            color={avgPctTasks>=75?"#22c55e":avgPctTasks>=40?"#f59e0b":"#ef4444"} />
        )}
        {avgPctHours !== null && (
          <InfStatCard label="Media consumo estimado"
            value={`${avgPctHours.toFixed(1)}%`}
            sub="horas Clockify / horas estimadas (media)"
            color={avgPctHours>=100?"#ef4444":avgPctHours>=75?"#f59e0b":"#22c55e"} />
        )}
        {sigmaTasks !== null && (
          <InfStatCard label="Equilibrio entre equipos"
            value={`σ ${sigmaTasks.toFixed(1)}%`}
            sub="desv. tipica de completitud · ideal σ→0"
            color={sigmaTasks<=15?"#22c55e":sigmaTasks<=30?"#f59e0b":"#ef4444"} />
        )}
        {avgRendimiento !== null && (
          <InfStatCard label="Rendimiento medio"
            value={`${avgRendimiento.toFixed(1)}%`}
            sub="h estimadas Done / h Clockify · ideal >=100%"
            color={avgRendimiento>=100?"#22c55e":avgRendimiento>=50?"#f59e0b":"#ef4444"} />
        )}
        {cvTeamEstH !== null && (
          <InfStatCard label="Desbalance entre equipos"
            value={`CV ${cvTeamEstH.toFixed(0)}%`}
            sub={`σ ${sigmaTeamEstH.toFixed(0)}h · μ ${avgTeamEstH.toFixed(0)}h est. · ideal CV→0`}
            color={cvTeamEstH<=20?"#22c55e":cvTeamEstH<=40?"#f59e0b":"#ef4444"} />
        )}
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {globalMetrics}
      {teamStatsScored.map(({ team, members, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento, score, memberEstHArr, avgMemberEstH, intraCV }) => {
        const tc         = TEAM_COLOR[team];
        const hoursColor = pctHours===null?"var(--bdr2)":pctHours>=100?"#ef4444":pctHours>=75?"#f59e0b":"#22c55e";
        const tasksColor = pctTasks===null?"var(--bdr2)":pctTasks===100?"#22c55e":pctTasks>=50?"#f59e0b":"var(--tx2)";
        const taggedColor= pctTagged===null?"var(--bdr2)":pctTagged>=60?"#22c55e":pctTagged>=25?"#f59e0b":"#ef4444";
        const rendColor  = rendimiento===null?"var(--bdr2)":rendimiento>=100?"#22c55e":rendimiento>=50?"#f59e0b":"#ef4444";
        const interDelta    = avgTeamEstH ? estimatedH - avgTeamEstH : null;
        const interDeltaPct = avgTeamEstH ? interDelta / avgTeamEstH * 100 : null;
        const interColor    = interDeltaPct===null?"var(--tx4)":Math.abs(interDeltaPct)<=15?"var(--tx4)":interDeltaPct>0?"#f59e0b":"#818cf8";
        const intraColor = intraCV===null?"var(--bdr2)":intraCV<=25?"#22c55e":intraCV<=50?"#f59e0b":"#ef4444";
        return (
          <div key={team} style={{ background:"var(--bg2)", border:`1px solid ${tc}30`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <span style={{ background:`${tc}20`, color:tc, fontWeight:800, fontSize:13, textTransform:"uppercase", letterSpacing:2, padding:"4px 12px", borderRadius:6 }}>Equipo {team}</span>
                <span style={{ color:"var(--tx4)", fontSize:11 }}>{members.length} miembros · {totalTasks} tarea{totalTasks!==1?"s":""}</span>
                {interDeltaPct !== null && (
                  <span title={`${estimatedH.toFixed(0)}h est. vs media inter-equipos ${avgTeamEstH.toFixed(0)}h`}
                    style={{ fontSize:9, fontWeight:700, background:`${interColor}18`, color:interColor, padding:"2px 6px", borderRadius:4 }}>
                    {interDelta>=0?"+":""}{interDelta.toFixed(0)}h vs media
                  </span>
                )}
                {intraCV !== null && (
                  <span title="Coeficiente de variacion de horas estimadas entre miembros · ideal CV→0"
                    style={{ fontSize:9, fontWeight:700, background:`${intraColor}18`, color:intraColor, padding:"2px 6px", borderRadius:4 }}>
                    CV intra {intraCV.toFixed(0)}%
                  </span>
                )}
              </div>
              <div style={{ textAlign:"right", flexShrink:0, lineHeight:1.6 }}>
                <div style={{ color:"var(--tx0)", fontWeight:800, fontSize:16 }}>{totalH.toFixed(1)}h</div>
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
                        <span title="Score relativo: rendimiento / media de equipos × 100. Media = 100%"
                          style={{ fontSize:9, fontWeight:800, background:`${scColor}20`, color:scColor, padding:"1px 6px", borderRadius:4, border:`1px solid ${scColor}40` }}>
                          {sc.toFixed(0)}%
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display:"flex", gap:5, marginBottom:10, flexWrap:"wrap" }}>
              {members.sort((a,b) => a.name.localeCompare(b.name)).map(m => (
                <div key={m.login} style={{ display:"flex", alignItems:"center", gap:5, background:"var(--bg3)", borderRadius:6, padding:"3px 8px 3px 3px" }}>
                  <img
                    src={`https://github.com/${m.login}.png?size=24`}
                    alt={m.name}
                    style={{ width:22, height:22, borderRadius:"50%", border:`1.5px solid ${tc}50`, flexShrink:0 }}
                  />
                  <span style={{ color:"var(--tx2)", fontSize:10, whiteSpace:"nowrap" }}>{m.name.split(" ")[0]}</span>
                  {m.coord && <span style={{ fontSize:7, background:"#818cf820", color:"#818cf8", padding:"0 3px", borderRadius:2, fontWeight:700 }}>C</span>}
                </div>
              ))}
            </div>

            {sprint !== -1 && (
              <div style={{ display:"flex", gap:14, marginBottom:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Tareas done</span>
                    <span style={{ color:tasksColor, fontSize:9, fontWeight:700 }}>
                      {pctTasks!==null ? `${doneCount}/${totalTasks} · ${pctTasks.toFixed(0)}%` : "—"}
                    </span>
                  </div>
                  <div style={{ height:5, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
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
                  <div style={{ height:5, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${Math.min(pctHours||0,100)}%`, background:hoursColor, borderRadius:2 }}/>
                  </div>
                </div>
              </div>
            )}

            {sprint !== -1 && (
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
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
  );
}
