export function ProgressBar({ pct, color, label, spent, total, className = '' }) {
  return (
    <div className={className} style={{ marginBottom: 14 }}>
      {(label || spent != null) && (
        <div className="flex-between" style={{ marginBottom: 4 }}>
          {label && <span style={{ color: 'var(--tx1)', fontSize: 'var(--fs-base)', fontWeight: 600 }}>{label}</span>}
          {spent != null && <span style={{ color: 'var(--tx3)', fontSize: 'var(--fs-sm)' }}>{spent}h / {total}h ({pct.toFixed(0)}%)</span>}
        </div>
      )}
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}
