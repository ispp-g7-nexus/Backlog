// ── INF STAT CARD ─────────────────────────────────────────────
export default function InfStatCard({ label, value, sub, color }) {
  return (
    <div style={{ background:"#111113", border:`1px solid ${color}30`, borderRadius:10, padding:"14px 18px", flex:"1 1 150px", minWidth:130 }}>
      <div style={{ color:"#52525b", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
      <div style={{ color, fontSize:24, fontWeight:800, lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ color:"#71717a", fontSize:10, marginTop:4 }}>{sub}</div>}
    </div>
  );
}
