/**
 * ScatterPlot — SVG scatter plot
 * Props:
 *   points: [{ x, y, label, color, r }]
 *   xLabel: string
 *   yLabel: string
 *   xMax: number (optional, auto-detected)
 *   yMax: number (optional, auto-detected)
 */
export default function ScatterPlot({ points = [], xLabel = 'X', yLabel = 'Y', xMax, yMax }) {
  if (!points.length) return null;

  const W = 340, H = 200, PAD_L = 36, PAD_B = 28, PAD_T = 10, PAD_R = 10;
  const maxX = xMax ?? Math.max(...points.map(p => p.x), 1);
  const maxY = yMax ?? Math.max(...points.map(p => p.y), 1);
  const toSvgX = x => PAD_L + (x / maxX) * (W - PAD_L - PAD_R);
  const toSvgY = y => H - PAD_B - (y / maxY) * (H - PAD_T - PAD_B);

  // Axis ticks
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * maxX));
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(f * maxY));

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      {/* Grid */}
      {yTicks.map(v => {
        const y = toSvgY(v);
        return (
          <g key={v}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--bdr)" strokeWidth={1} />
            <text x={PAD_L - 3} y={y + 3} fill="var(--tx4)" fontSize={7} textAnchor="end">{v}</text>
          </g>
        );
      })}
      {xTicks.map(v => {
        const x = toSvgX(v);
        return (
          <g key={v}>
            <line x1={x} y1={PAD_T} x2={x} y2={H - PAD_B} stroke="var(--bdr)" strokeWidth={1} />
            <text x={x} y={H - PAD_B + 10} fill="var(--tx4)" fontSize={7} textAnchor="middle">{v}</text>
          </g>
        );
      })}
      {/* Axes */}
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="var(--bdr2)" strokeWidth={1} />
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--bdr2)" strokeWidth={1} />
      {/* Axis labels */}
      <text x={(W - PAD_L - PAD_R) / 2 + PAD_L} y={H} fill="var(--tx4)" fontSize={8} textAnchor="middle">{xLabel}</text>
      <text x={8} y={(H - PAD_T - PAD_B) / 2 + PAD_T} fill="var(--tx4)" fontSize={8} textAnchor="middle"
        transform={`rotate(-90, 8, ${(H - PAD_T - PAD_B) / 2 + PAD_T})`}>{yLabel}</text>
      {/* Points */}
      {points.map((p, i) => {
        const cx = toSvgX(p.x);
        const cy = toSvgY(p.y);
        const r = p.r || 5;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill={p.color || '#818cf8'} fillOpacity={0.7}>
              <title>{p.label}: ({p.x}, {p.y})</title>
            </circle>
            {p.label && (
              <text x={cx + r + 2} y={cy + 3} fill="var(--tx3)" fontSize={7}>{p.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
