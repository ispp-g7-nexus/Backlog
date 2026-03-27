import { useMemo } from 'react';
import { SC } from '../../constants.js';
import { StatusBadge, SizeBadge } from '../../components/badges.jsx';

const STATUS_COLORS = {
  "Backlog": "#52525b", "Ready": "#38bdf8", "In progress": "#fbbf24",
  "In review": "#c4b5fd", "Done": "#34d399",
};

export default function SprintTimeline({ items, sc, sprint }) {
  const startMs = new Date(sc.start).getTime();
  const endMs = new Date(sc.end).getTime();
  const dur = endMs - startMs;
  const nowMs = Date.now();
  const todayPct = dur > 0 ? Math.max(0, Math.min(100, (nowMs - startMs) / dur * 100)) : 0;

  const days = useMemo(() => {
    const result = [];
    const d = new Date(sc.start);
    const end = new Date(sc.end);
    while (d <= end) {
      result.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [sc]);

  const sorted = useMemo(() =>
    [...items].filter(i => i.startDate || i.targetDate).sort((a, b) => {
      const da = a.startDate || a.targetDate || '';
      const db = b.startDate || b.targetDate || '';
      return da.localeCompare(db);
    })
  , [items]);

  const noDateItems = items.filter(i => !i.startDate && !i.targetDate);

  return (
    <div>
      {/* Day headers */}
      <div className="card card-flush" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: Math.max(600, days.length * 40), position: 'relative' }}>
          {/* Day labels */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--bdr)', padding: '6px 0' }}>
            <div style={{ width: 200, flexShrink: 0, padding: '0 10px', color: 'var(--tx4)', fontSize: 9, fontWeight: 700 }}>TAREA</div>
            {days.map((d, i) => {
              const isToday = d.toDateString() === new Date().toDateString();
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={i} style={{
                  flex: 1, textAlign: 'center', fontSize: 8, color: isToday ? '#f87171' : isWeekend ? 'var(--bdr2)' : 'var(--tx4)',
                  fontWeight: isToday ? 800 : 400, minWidth: 28,
                }}>
                  {d.getDate()}/{d.getMonth() + 1}
                </div>
              );
            })}
          </div>

          {/* Today line */}
          {todayPct > 0 && todayPct < 100 && (
            <div style={{ position: 'absolute', top: 30, bottom: 0, left: `calc(200px + ${todayPct}% * (100% - 200px) / 100)`, width: 1, background: '#f87171', zIndex: 5, pointerEvents: 'none' }} />
          )}

          {/* Items */}
          {sorted.map(item => {
            const c = STATUS_COLORS[item.status] || '#52525b';
            const iStart = item.startDate ? new Date(item.startDate).getTime() : startMs;
            const iEnd = item.targetDate ? new Date(item.targetDate).getTime() : endMs;
            const left = dur > 0 ? Math.max(0, Math.min(100, (iStart - startMs) / dur * 100)) : 0;
            const right = dur > 0 ? Math.max(0, Math.min(100, (iEnd - startMs) / dur * 100)) : 100;
            const width = Math.max(2, right - left);

            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', height: 26, borderBottom: '1px solid var(--bdr)' }}>
                <div style={{ width: 200, flexShrink: 0, padding: '0 10px', overflow: 'hidden' }}>
                  <span style={{ fontSize: 9, color: 'var(--tx4)', fontFamily: 'monospace', marginRight: 4 }}>{item.id}</span>
                  <span style={{ fontSize: 10, color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                </div>
                <div style={{ flex: 1, position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    position: 'absolute', left: `${left}%`, width: `${width}%`, height: 14,
                    background: `${c}30`, border: `1px solid ${c}60`, borderRadius: 3,
                    display: 'flex', alignItems: 'center', padding: '0 4px', gap: 3, overflow: 'hidden',
                  }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: c, flexShrink: 0 }} />
                    {item.size && <span style={{ fontSize: 7, flexShrink: 0 }}><SizeBadge s={item.size} /></span>}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Items without dates */}
          {noDateItems.length > 0 && (
            <div style={{ padding: '8px 10px', borderTop: '1px dashed var(--bdr)' }}>
              <div style={{ color: 'var(--tx4)', fontSize: 9, marginBottom: 4 }}>SIN FECHAS ({noDateItems.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {noDateItems.map(item => (
                  <span key={item.id} style={{ fontSize: 9, color: 'var(--tx4)', background: 'var(--bg0)', border: '1px solid var(--bdr)', borderRadius: 3, padding: '2px 6px' }}>
                    {item.id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
