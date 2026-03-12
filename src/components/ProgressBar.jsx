export function ProgressBar({ pct, color, label, spent, total }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{label}</span>
        <span style={{ color: "#71717a", fontSize: 11 }}>{spent}h / {total}h ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ height: 8, background: "#27272a", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: "width .4s" }} />
      </div>
    </div>
  );
}
