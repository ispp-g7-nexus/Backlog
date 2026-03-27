import InfStatCard from '../components/InfStatCard.jsx';
import { BACKLOG_MAP } from '../../../data.js';
import { TEAM_MEMBERS, EQUIPO_LOGINS, STATUS_META } from '../../../constants.js';

const SIZE_H_INF = { XS:2, S:4, M:8, L:16, XL:24 };

export default function TasksView({ report, sprint, filtered, sprintC }) {
  if (sprint === -1) return (
    <div style={{ padding:"32px 20px", textAlign:"center" }}>
      <div style={{ fontSize:28, marginBottom:10 }}>✓</div>
      <div style={{ color:"#22c55e", fontWeight:700, fontSize:14, marginBottom:6 }}>Sprint 0 — Devising a Project completado</div>
      <div style={{ color:"var(--tx3)", fontSize:12, marginBottom:10 }}>
        El Sprint 0 (DP) registra horas por proyecto "dp" en Clockify,<br/>no por tareas individuales del backlog.
      </div>
      <div style={{ color:"var(--tx4)", fontSize:11 }}>
        Consulta la pestaña <span style={{ color:"#10b981", fontWeight:700 }}>Equipo</span> para ver el desglose de horas por persona.
      </div>
    </div>
  );
  const nameToMember = Object.fromEntries(
    TEAM_MEMBERS.map(m => [m.name.toLowerCase().trim(), m])
  );
  const STATUS_EMOJI = {
    "Backlog":     "⚫",
    "Ready":       "🔵",
    "In progress": "🟢",
    "In review":   "🟣",
    "Done":        "✅",
  };

  const tasksWithWarns = filtered(report).map(([tid, t]) => {
    const taskTeamLetter = t.equipo?.match(/Equipo\s+([ABCD])$/i)?.[1]?.toUpperCase() || null;
    const warns = [];
    if (!t.estimated_h) warns.push({ icon:"📐", tip:"Sin estimación asignada" });
    if (t.real_h === 0)  warns.push({ icon:"⏱️", tip:"Sin horas registradas en Clockify" });
    if (taskTeamLetter) {
      Object.keys(t.byUser).forEach(userName => {
        const member = nameToMember[userName.toLowerCase().trim()];
        if (member && member.team !== taskTeamLetter) {
          warns.push({ icon:"👥", tip:`${userName} (Equipo ${member.team}) registra horas en tarea del ${t.equipo}` });
        }
      });
    }
    return { tid, t, warns };
  });

  const validTasks = tasksWithWarns.filter(({ warns }) => warns.length === 0).map(({ t }) => t);

  const metricsBlock = (() => {
    if (!validTasks.length) return null;
    const n       = validTasks.length;
    const sumEst  = validTasks.reduce((s, t) => s + t.estimated_h, 0);
    const sumReal = validTasks.reduce((s, t) => s + t.real_h, 0);
    const ratio   = sumReal / sumEst;
    const mape    = validTasks.reduce((s, t) => s + Math.abs(t.real_h - t.estimated_h) / t.estimated_h, 0) / n * 100;
    const mae     = validTasks.reduce((s, t) => s + Math.abs(t.real_h - t.estimated_h), 0) / n;
    const within50 = validTasks.filter(t => { const r = t.real_h / t.estimated_h; return r >= 0.5 && r <= 1.5; }).length / n * 100;

    const ratioColor  = ratio >= 0.7 && ratio <= 1.3 ? "#22c55e" : ratio >= 0.5 && ratio <= 1.5 ? "#f59e0b" : "#ef4444";
    const mapeColor   = mape  <= 25 ? "#22c55e" : mape  <= 50 ? "#f59e0b" : "#ef4444";
    const precColor   = within50 >= 70 ? "#22c55e" : within50 >= 50 ? "#f59e0b" : "#ef4444";
    const tendencia   = ratio <= 1 ? "sobreestima" : "infraestima";

    return (
      <div style={{ background:"var(--bg1)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px" }}>
        <div style={{ color:"var(--tx4)", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>
          Calidad de estimaciones — {n} tarea{n !== 1 ? "s" : ""} evaluadas (sin advertencias)
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <InfStatCard
            label="Consumo real/est"
            value={`${(ratio * 100).toFixed(0)}%`}
            sub={`Tiende a ${tendencia} · ideal 100%`}
            color={ratioColor}
          />
          <InfStatCard
            label="Error relativo (MAPE)"
            value={`${mape.toFixed(1)}%`}
            sub={mape <= 25 ? "Buena precisión" : mape <= 50 ? "Precisión aceptable" : "Revisar estimaciones"}
            color={mapeColor}
          />
          <InfStatCard
            label="Error absoluto (MAE)"
            value={`${mae.toFixed(1)}h`}
            sub="Desviación media por tarea"
            color="#818cf8"
          />
          <InfStatCard
            label="Precisión ±50%"
            value={`${within50.toFixed(0)}%`}
            sub={`${validTasks.filter(t=>{ const r=t.real_h/t.estimated_h; return r>=0.5&&r<=1.5; }).length} de ${n} tareas en margen`}
            color={precColor}
          />
        </div>
      </div>
    );
  })();

  const thS = { padding:"8px 10px", textAlign:"left", color:"var(--tx3)", fontWeight:700, whiteSpace:"nowrap", borderBottom:"1px solid var(--bdr)" };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {metricsBlock}
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ background:"var(--bg3)" }}>
              <th style={thS}>ID</th>
              <th style={thS}>Sp</th>
              <th style={thS}>Módulo</th>
              <th style={thS}>Tarea</th>
              <th style={thS}>Asignados</th>
              <th style={thS}>Equipo</th>
              <th style={thS}>Talla</th>
              <th style={{ ...thS, textAlign:"right" }}>Est.</th>
              <th style={{ ...thS, textAlign:"right" }}>Real</th>
              <th style={{ ...thS, textAlign:"right" }}>Dif.</th>
              <th style={thS}>% Uso</th>
              <th style={{ ...thS, textAlign:"center" }}>Estado</th>
              <th style={thS}>⚠️</th>
            </tr>
          </thead>
          <tbody>
            {tasksWithWarns.map(({ tid, t, warns }, i) => {
              const pct  = t.estimated_h ? t.real_h / t.estimated_h * 100 : 0;
              const diff = t.real_h - t.estimated_h;
              const sc   = sprintC[t.sprint] || "var(--tx4)";
              return (
                <tr key={tid} style={{ background:i%2===0?"var(--bg0)":"var(--bg2)" }}>
                  <td style={{ padding:"7px 10px", color:sc, fontWeight:700, whiteSpace:"nowrap" }}>{tid}</td>
                  <td style={{ padding:"7px 10px", textAlign:"center" }}>
                    <span style={{ background:`${sc}20`, color:sc, padding:"2px 6px", borderRadius:4, fontSize:10, fontWeight:700 }}>S{t.sprint}</span>
                  </td>
                  <td style={{ padding:"7px 10px", color:"var(--tx2)", whiteSpace:"nowrap", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis" }}>{t.area}</td>
                  <td style={{ padding:"7px 10px", color:"var(--tx0)", maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={t.title}>{t.title}</td>
                  <td style={{ padding:"7px 10px" }}>
                    <div style={{ display:"flex", gap:2, alignItems:"center" }}>
                      {(t.assignees||[]).map(a => (
                        <img key={a.login} src={a.avatarUrl} title={a.login}
                          style={{ width:18, height:18, borderRadius:"50%", border:"1px solid var(--bdr2)", flexShrink:0 }} />
                      ))}
                    </div>
                  </td>
                  <td style={{ padding:"7px 10px", whiteSpace:"nowrap" }}>
                    {t.equipo
                      ? <span style={{ background:"#ffffff08", border:"1px solid var(--bdr2)", borderRadius:4, padding:"1px 7px", color:"var(--tx2)", fontSize:10 }}>{t.equipo}</span>
                      : null}
                  </td>
                  <td style={{ padding:"7px 10px", textAlign:"center", color:"var(--tx3)" }}>{t.size}</td>
                  <td style={{ padding:"7px 10px", textAlign:"right", color:"var(--tx3)" }}>
                    {t.area === "Asistencia" && t.size && EQUIPO_LOGINS[t.equipo] ? (
                      <span title={`${SIZE_H_INF[t.size]}h × ${EQUIPO_LOGINS[t.equipo].length} miembros`} style={{ cursor:"help" }}>
                        {t.estimated_h}h
                      </span>
                    ) : `${t.estimated_h}h`}
                  </td>
                  <td style={{ padding:"7px 10px", textAlign:"right", color:t.real_h>0?"var(--tx0)":"var(--bdr2)" }}>{t.real_h.toFixed(1)}h</td>
                  <td style={{ padding:"7px 10px", textAlign:"right", color:diff>0?"#ef4444":diff<0?"#22c55e":"var(--tx4)", fontWeight:Math.abs(diff)>0?700:400 }}>{diff>0?"+":""}{diff.toFixed(1)}h</td>
                  <td style={{ padding:"7px 10px", minWidth:80 }}>
                    <div style={{ background:"var(--bdr)", borderRadius:4, height:6, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:pct>=100?"#ef4444":pct>=80?"#f59e0b":"#22c55e" }} />
                    </div>
                    <div style={{ color:"var(--tx3)", fontSize:10, textAlign:"right", marginTop:2 }}>{pct.toFixed(0)}%</div>
                  </td>
                  <td style={{ padding:"7px 8px", textAlign:"center", fontSize:15 }} title={t.status||"Backlog"}>
                    {STATUS_EMOJI[t.status] || "⬛"}
                  </td>
                  <td style={{ padding:"7px 8px" }}>
                    <div style={{ display:"flex", gap:3, flexWrap:"wrap", alignItems:"center" }}>
                      {warns.map((w, wi) => (
                        <span key={wi} title={w.tip} style={{ cursor:"help", fontSize:13, lineHeight:1 }}>{w.icon}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
