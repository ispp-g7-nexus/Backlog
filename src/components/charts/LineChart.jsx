const DEFAULTS = { width: 600, height: 260, pad: { t: 20, r: 20, b: 40, l: 50 } };

export function LineChart({ series, xLabels, width = DEFAULTS.width, height = DEFAULTS.height, pad = DEFAULTS.pad, yLabel, className = '' }) {
  if (!series?.length) return null;
  const cW = width - pad.l - pad.r;
  const cH = height - pad.t - pad.b;

  const allVals = series.flatMap(s => s.data);
  const maxVal = Math.max(...allVals, 1);
  const yTicks = 5;
  const xStep = xLabels ? cW / Math.max(xLabels.length - 1, 1) : cW / Math.max(series[0].data.length - 1, 1);

  function toY(v) { return pad.t + cH - (v / maxVal) * cH; }
  function toX(i) { return pad.l + i * xStep; }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} style={{ width: '100%', maxWidth: width }}>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const f = i / yTicks;
        const y = pad.t + cH - cH * f;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={pad.l + cW} y2={y} stroke="var(--bdr)" strokeWidth={i === 0 ? 1 : 0.5} />
            <text x={pad.l - 6} y={y + 3.5} fill="var(--tx4)" fontSize="9" textAnchor="end">{Math.round(maxVal * f)}{yLabel || ''}</text>
          </g>
        );
      })}

      {series.map((s, si) => {
        const pts = s.data.map((v, i) => `${toX(i)},${toY(v)}`);
        return (
          <g key={si}>
            <path d={`M${pts.join(' L')}`} fill="none" stroke={s.color || 'var(--accent)'} strokeWidth={s.width || 2} strokeDasharray={s.dashed ? '6,4' : undefined} />
            {s.dots !== false && s.data.map((v, i) => (
              <circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill={s.color || 'var(--accent)'} />
            ))}
          </g>
        );
      })}

      {xLabels?.map((label, i) => (
        <text key={i} x={toX(i)} y={height - pad.b + 14} fill="var(--tx4)" fontSize="9" textAnchor="middle">{label}</text>
      ))}
    </svg>
  );
}
