export function Card({ children, size, flush, className = '', ...props }) {
  const cls = [
    'card',
    size === 'sm' && 'card-sm',
    flush && 'card-flush',
    className,
  ].filter(Boolean).join(' ');

  return <div className={cls} {...props}>{children}</div>;
}

export function StatCard({ label, value, sub, color, size = 'md', className = '' }) {
  const cls = `stat-card ${size === 'sm' ? 'stat-card-sm' : ''} ${className}`;
  return (
    <div className={cls} style={color ? { borderColor: `${color}30` } : undefined}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}
