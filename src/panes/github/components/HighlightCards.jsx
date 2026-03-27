export default function HighlightCards({ items }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))", gap:8 }}>
      {items.map(({ label, name, val, color }) => (
        <div key={label} style={{ background:"var(--bg2)", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
          <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>{label}</div>
          {name && <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:11, marginBottom:2 }}>{name}</div>}
          <div style={{ color, fontSize:14, fontWeight:800 }}>{val}</div>
        </div>
      ))}
    </div>
  );
}
