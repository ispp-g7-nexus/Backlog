/**
 * HeatMap — GitHub contribution-style heatmap
 * Props:
 *   data: [{week, days:[7]}]  (days: Sun=0…Sat=6)
 *   color: string (base hex like "#818cf8")
 *   maxOverride: number (optional)
 */
export default function HeatMap({ data = [], color = '#818cf8', maxOverride }) {
  if (!data.length) return null;
  const max = maxOverride ?? Math.max(...data.flatMap(w => w.days || []), 1);
  const DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const CELL = 11, GAP = 2, LABEL_W = 14, LABEL_H = 14;

  const weeks = data.slice(-26); // last 26 weeks
  const W = LABEL_W + weeks.length * (CELL + GAP);
  const H = LABEL_H + 7 * (CELL + GAP);

  function opacity(v) {
    if (!v || max === 0) return 0.06;
    return 0.15 + 0.85 * (v / max);
  }

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      {DAYS.map((d, i) => (
        <text key={d} x={LABEL_W - 2} y={LABEL_H + i * (CELL + GAP) + CELL - 2}
          fill="var(--tx4)" fontSize={7} textAnchor="end">{d}</text>
      ))}
      {weeks.map((w, wi) => {
        const x = LABEL_W + wi * (CELL + GAP);
        return (w.days || []).map((v, di) => (
          <rect key={di} x={x} y={LABEL_H + di * (CELL + GAP)} width={CELL} height={CELL} rx={2}
            fill={color} fillOpacity={opacity(v)}>
            <title>{v} el {new Date(w.week * 1000).toLocaleDateString('es-ES')} ({DAYS[di]})</title>
          </rect>
        ));
      })}
    </svg>
  );
}
