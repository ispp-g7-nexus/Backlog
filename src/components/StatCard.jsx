export function StatCard({ label, value, sub, color, size = "md" }) {
  const styles = {
    sm: { padding: "14px 18px", fontSize: 10, valueFontSize: 24, minWidth: 130, flex: "1 1 150px", borderRadius: 10 },
    md: { padding: "18px 22px", fontSize: 11, valueFontSize: 28, minWidth: 140, flex: "1 1 180px", borderRadius: 12 },
  }[size];

  return (
    <div style={{ background: "#111113", border: `1px solid ${color}30`, borderRadius: styles.borderRadius, padding: styles.padding, flex: styles.flex, minWidth: styles.minWidth }}>
      <div style={{ color: "#52525b", fontSize: styles.fontSize, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ color, fontSize: styles.valueFontSize, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: "#71717a", fontSize: styles.fontSize, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
