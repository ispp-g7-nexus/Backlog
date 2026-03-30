import { SIZE_H_MAP } from '../../../constants.js';

/**
 * BurndownView — Burndown del sprint basado en estimaciones y fechas de cierre
 * Props: items[], sc (sprint config), sprint
 */
function getEstimate(item) {
  // Prioridad: estimate (GitHub Projects) → estimated_h (BACKLOG_MAP) → SIZE_H_MAP[size]
  if (item.estimate != null && item.estimate !== '') return Number(item.estimate);
  if (item.estimated_h != null) return Number(item.estimated_h);
  return SIZE_H_MAP[item.size] || 0;
}

export default function BurndownView({ items, sc, sprint }) {
  if (!sc) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--tx4)' }}>
        Selecciona un sprint concreto para ver el burndown.
      </div>
    );
  }

  const start = new Date(sc.start);
  const end = new Date(sc.end);
  const today = new Date();

  // Generar días del sprint (lunes a viernes incluidos, o todos)
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const totalEst = items.reduce((s, i) => s + getEstimate(i), 0);
  if (totalEst === 0 || days.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--tx4)' }}>
        No hay estimaciones en los ítems de este sprint.
      </div>
    );
  }

  // Para cada día: cuántas horas Done han sido completadas hasta ese día
  // Usamos targetDate de Done items; si no tiene, usamos hoy
  const doneItems = items.filter(i => i.status === 'Done');

  function doneByDay(day) {
    return doneItems.reduce((s, i) => {
      const closeDate = i.targetDate ? new Date(i.targetDate) : today;
      if (closeDate <= day) return s + getEstimate(i);
      return s;
    }, 0);
  }

  // Ideal: lineal de totalEst → 0 sobre los días del sprint
  const idealPoints = days.map((d, i) => ({
    d, ideal: totalEst * (1 - i / (days.length - 1))
  }));

  // Actual: totalEst - acumulado Done por día (solo hasta hoy)
  const actualPoints = days
    .filter(d => d <= today)
    .map(d => ({ d, actual: Math.max(0, totalEst - doneByDay(d)) }));

  // SVG layout
  const W = 560, H = 220, PL = 44, PB = 28, PT = 10, PR = 12;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;

  const xOf = (d) => PL + ((d - start) / (end - start)) * plotW;
  const yOf = (v) => PT + plotH - (v / totalEst) * plotH;

  // Y ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: Math.round(f * totalEst), y: yOf(f * totalEst) }));
  // X ticks: cada 3 días
  const xTicks = days.filter((_, i) => i % 3 === 0);

  // Path helpers
  const linePath = (pts, key) =>
    pts.length < 2 ? '' :
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.d).toFixed(1)},${yOf(p[key]).toFixed(1)}`).join(' ');

  const todayX = today >= start && today <= end ? xOf(today) : null;

  // Area under actual (fill)
  const areaPath = actualPoints.length > 1 ? [
    `M${xOf(actualPoints[0].d).toFixed(1)},${yOf(actualPoints[0].actual).toFixed(1)}`,
    ...actualPoints.slice(1).map(p => `L${xOf(p.d).toFixed(1)},${yOf(p.actual).toFixed(1)}`),
    `L${xOf(actualPoints[actualPoints.length - 1].d).toFixed(1)},${(PT + plotH).toFixed(1)}`,
    `L${xOf(actualPoints[0].d).toFixed(1)},${(PT + plotH).toFixed(1)}`,
    'Z'
  ].join(' ') : '';

  // Stats
  const remaining = Math.max(0, totalEst - doneByDay(today));
  const pctDone = totalEst > 0 ? Math.round((totalEst - remaining) / totalEst * 100) : 0;
  const daysLeft = Math.ceil((end - today) / 86400000);
  const velocityNeeded = daysLeft > 0 ? (remaining / daysLeft).toFixed(1) : '—';

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { l: 'Total estimado', v: `${totalEst}h`, c: 'var(--tx2)' },
          { l: 'Completado', v: `${totalEst - remaining}h (${pctDone}%)`, c: '#34d399' },
          { l: 'Pendiente', v: `${remaining}h`, c: '#f87171' },
          { l: 'Vel. necesaria', v: `${velocityNeeded}h/día`, c: '#fbbf24' },
        ].map(k => (
          <div key={k.l} className="card" style={{ padding: '8px 14px', flex: '1 0 120px', minWidth: 100 }}>
            <div style={{ color: k.c, fontSize: 16, fontWeight: 800 }}>{k.v}</div>
            <div style={{ color: 'var(--tx4)', fontSize: 10, marginTop: 2 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card" style={{ padding: '12px 8px', overflowX: 'auto' }}>
        <svg width={W} height={H} style={{ display: 'block', minWidth: W }}>
          {/* Grid */}
          {yTicks.map(t => (
            <g key={t.v}>
              <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="var(--bdr)" strokeWidth={1} />
              <text x={PL - 4} y={t.y + 4} fill="var(--tx4)" fontSize={8} textAnchor="end">{t.v}h</text>
            </g>
          ))}
          {xTicks.map((d, i) => {
            const x = xOf(d);
            return (
              <g key={i}>
                <line x1={x} y1={PT} x2={x} y2={H - PB} stroke="var(--bdr)" strokeWidth={1} strokeDasharray="3,3" />
                <text x={x} y={H - PB + 10} fill="var(--tx4)" fontSize={8} textAnchor="middle">
                  {d.getDate()}/{d.getMonth() + 1}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="var(--bdr2)" strokeWidth={1} />
          <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="var(--bdr2)" strokeWidth={1} />

          {/* Ideal line */}
          <path d={linePath(idealPoints, 'ideal')} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6,3" />

          {/* Actual area */}
          {areaPath && <path d={areaPath} fill="#818cf820" />}

          {/* Actual line */}
          {actualPoints.length > 1 && (
            <path d={linePath(actualPoints, 'actual')} fill="none" stroke={sc.color} strokeWidth={2.5} strokeLinejoin="round" />
          )}

          {/* Today line */}
          {todayX && (
            <g>
              <line x1={todayX} y1={PT} x2={todayX} y2={H - PB} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,2" />
              <text x={todayX + 3} y={PT + 10} fill="#f59e0b" fontSize={8}>hoy</text>
            </g>
          )}

          {/* Actual dots */}
          {actualPoints.map((p, i) => (
            <circle key={i} cx={xOf(p.d)} cy={yOf(p.actual)} r={3} fill={sc.color}>
              <title>{p.d.toLocaleDateString('es-ES')}: {p.actual.toFixed(1)}h restantes</title>
            </circle>
          ))}

          {/* Legend */}
          <g transform={`translate(${PL + 8}, ${PT + 4})`}>
            <line x1={0} y1={6} x2={20} y2={6} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4,2" />
            <text x={24} y={9} fill="var(--tx4)" fontSize={8}>Ideal</text>
            <line x1={60} y1={6} x2={80} y2={6} stroke={sc.color} strokeWidth={2} />
            <text x={84} y={9} fill="var(--tx4)" fontSize={8}>Real</text>
          </g>
        </svg>
        <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 4, paddingLeft: PL }}>
          * Burn basado en targetDate de ítems Done. Sin fecha de cierre → se asume hoy.
        </div>
      </div>
    </div>
  );
}
