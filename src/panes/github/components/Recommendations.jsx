const SEV_COLORS = { red:"#ef4444", yellow:"#f59e0b", green:"#22c55e", blue:"#38bdf8" };
const SEV_BG     = { red:"#ef444412", yellow:"#f59e0b12", green:"#22c55e12", blue:"#38bdf812" };

export function tip(sev, icon, title, msg) {
  return { sev, icon, title, msg };
}

export default function Recommendations({ title, color, tips }) {
  if (!tips || !tips.length) return null;
  return (
    <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px" }}>
      <div style={{ color, fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>{title}</div>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {tips.map(({ sev, icon, title: t, msg }) => (
          <div key={t} style={{ background:SEV_BG[sev], borderLeft:`3px solid ${SEV_COLORS[sev]}`, borderRadius:6, padding:"8px 12px", display:"flex", gap:9, alignItems:"flex-start" }}>
            <span style={{ fontSize:12, flexShrink:0, lineHeight:1.5 }}>{icon}</span>
            <div>
              <div style={{ color:SEV_COLORS[sev], fontWeight:700, fontSize:9.5, marginBottom:2 }}>{t}</div>
              <div style={{ color:"var(--tx2)", fontSize:9, lineHeight:1.55 }}>{msg}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
