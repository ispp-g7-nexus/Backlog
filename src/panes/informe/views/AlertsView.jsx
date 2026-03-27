export default function AlertsView({ report, sprint, filtered, sprintC }) {
  const alerts = filtered(report)
    .filter(([,t])=>t.estimated_h>0 && t.real_h>0 && t.real_h/t.estimated_h>=0.8)
    .sort((a,b)=>b[1].real_h/b[1].estimated_h - a[1].real_h/a[1].estimated_h);
  if (!alerts.length) return <div style={{ background:"var(--bg2)", borderRadius:10, padding:24, textAlign:"center", color:"#22c55e", fontWeight:700 }}>No hay tareas en riesgo ni excedidas</div>;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {alerts.map(([tid,t])=>{
        const pct=t.real_h/t.estimated_h*100, isExc=pct>=100;
        const bg=isExc?"#ef444415":"#f59e0b12", border=isExc?"#ef444435":"#f59e0b35", color=isExc?"#ef4444":"#f59e0b";
        const sc=sprintC[t.sprint]||"var(--tx4)";
        return (
          <div key={tid} style={{ background:bg, border:`1px solid ${border}`, borderRadius:10, padding:"12px 16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                  <span style={{ color:sc, fontWeight:800, fontSize:12 }}>{tid}</span>
                  <span style={{ color:"var(--tx4)", fontSize:11 }}>{t.area}</span>
                </div>
                <div style={{ color:"var(--tx0)", fontSize:12, marginBottom:8 }}>{t.title}</div>
                <div style={{ height:8, background:"var(--bdr)", borderRadius:4, overflow:"hidden", maxWidth:300 }}>
                  <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:color }} />
                </div>
                {Object.keys(t.byUser).length>0 && (
                  <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                    {Object.entries(t.byUser).map(([u,h])=>(
                      <span key={u} style={{ background:"var(--bg3)", color:"var(--tx2)", padding:"2px 8px", borderRadius:4, fontSize:10 }}>{u}: {h.toFixed(1)}h</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign:"right", minWidth:110 }}>
                <div style={{ color, fontWeight:800, fontSize:22 }}>{pct.toFixed(0)}%</div>
                <div style={{ color:"var(--tx3)", fontSize:11 }}>{t.real_h.toFixed(1)}h / {t.estimated_h}h</div>
                <div style={{ color:"var(--tx4)", fontSize:10, marginTop:4 }}>{isExc?"Excedida":"En riesgo"}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
