/**
 * GanttChart — SVG Gantt bars
 * Props:
 *   items: [{ id, label, start, end, color, sub }]  (start/end: ISO strings)
 *   rangeStart: ISO string
 *   rangeEnd: ISO string
 *   milestones: [{ date: ISO string, label: string, color: string }]
 *   rowH: number (default 18)
 */
export default function GanttChart({ items = [], rangeStart, rangeEnd, milestones = [], rowH = 18 }) {
  if (!items.length) return null;

  const PAD_L = 120, PAD_R = 10, PAD_T = 20, PAD_B = 10;
  const W = 520;
  const H = PAD_T + items.length * rowH + PAD_B;

  const t0 = new Date(rangeStart || items[0]?.start).getTime();
  const t1 = new Date(rangeEnd || items[items.length - 1]?.end || Date.now()).getTime();
  const range = t1 - t0 || 1;
  const toX = ts => PAD_L + ((ts - t0) / range) * (W - PAD_L - PAD_R);
  const nowX = toX(Date.now());

  return (
    <svg width={W} height={H} style={{ display: 'block', maxWidth: '100%', overflowX: 'auto' }}>
      {/* Today line */}
      {nowX >= PAD_L && nowX <= W - PAD_R && (
        <line x1={nowX} y1={PAD_T - 4} x2={nowX} y2={H - PAD_B}
          stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2" opacity={0.7} />
      )}
      {/* Milestones */}
      {milestones.map((ms, i) => {
        const x = toX(new Date(ms.date).getTime());
        if (x < PAD_L || x > W - PAD_R) return null;
        return (
          <g key={i}>
            <line x1={x} y1={PAD_T - 4} x2={x} y2={H - PAD_B}
              stroke={ms.color || '#94a3b8'} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
            <text x={x + 2} y={PAD_T - 6} fill={ms.color || '#94a3b8'} fontSize={7} fontWeight={600}>{ms.label}</text>
          </g>
        );
      })}
      {/* Items */}
      {items.map((item, i) => {
        const y = PAD_T + i * rowH;
        const x1 = Math.max(toX(new Date(item.start).getTime()), PAD_L);
        const x2 = Math.min(toX(new Date(item.end || Date.now()).getTime()), W - PAD_R);
        const barW = Math.max(x2 - x1, 4);
        return (
          <g key={item.id || i}>
            <title>{item.label}{item.sub ? ` · ${item.sub}` : ''}</title>
            <text x={PAD_L - 4} y={y + rowH / 2 + 4} fill="var(--tx3)" fontSize={9} textAnchor="end">
              {item.label.length > 16 ? item.label.slice(0, 15) + '…' : item.label}
            </text>
            <rect x={x1} y={y + 3} width={barW} height={rowH - 7} rx={3}
              fill={item.color || '#818cf8'} fillOpacity={0.7} />
          </g>
        );
      })}
    </svg>
  );
}
