const DEFAULTS = { width: 600, height: 280, pad: { t: 20, r: 20, b: 40, l: 50 } };

export function BarChart({ data, width = DEFAULTS.width, height = DEFAULTS.height, pad = DEFAULTS.pad, barColor, yLabel, grouped, className = '' }) {
  if (!data?.length) return null;
  const cW = width - pad.l - pad.r;
  const cH = height - pad.t - pad.b;

  const maxVal = Math.max(...data.flatMap(d => grouped ? (d.values || []) : [d.value]), 1);
  const yTicks = 5;
  const groupSize = grouped ? Math.max(...data.map(d => d.values?.length || 0)) : 1;
  const barGap = cW / data.length;
  const barW = Math.min(barGap * 0.6 / groupSize, 40);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} style={{ width: '100%', maxWidth: width }}>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const f = i / yTicks;
        const y = pad.t + cH - cH * f;
        const val = maxVal * f;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={pad.l + cW} y2={y} stroke="var(--bdr)" strokeWidth={i === 0 ? 1 : 0.5} />
            <text x={pad.l - 6} y={y + 3.5} fill="var(--tx4)" fontSize="9" textAnchor="end">{Math.round(val)}{yLabel || ''}</text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const cx = pad.l + barGap * (i + 0.5);
        if (grouped && d.values) {
          return (
            <g key={i}>
              {d.values.map((v, vi) => {
                const h = (v / maxVal) * cH;
                const x = cx - (groupSize * barW) / 2 + vi * barW;
                return <rect key={vi} x={x} y={pad.t + cH - h} width={barW - 1} height={h} fill={d.colors?.[vi] || barColor || 'var(--accent)'} rx={2} />;
              })}
              <text x={cx} y={height - pad.b + 14} fill="var(--tx4)" fontSize="9" textAnchor="middle">{d.label}</text>
            </g>
          );
        }
        const h = ((d.value || 0) / maxVal) * cH;
        return (
          <g key={i}>
            <rect x={cx - barW / 2} y={pad.t + cH - h} width={barW} height={h} fill={d.color || barColor || 'var(--accent)'} rx={2} />
            {h > 12 && <text x={cx} y={pad.t + cH - h - 4} fill={d.color || barColor || 'var(--accent)'} fontSize="8" textAnchor="middle" fontWeight="700">{d.value}</text>}
            <text x={cx} y={height - pad.b + 14} fill="var(--tx4)" fontSize="9" textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
