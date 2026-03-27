import { useState } from 'react';
import { SizeBadge } from '../../../components/badges.jsx';
import { SC } from '../../../constants.js';
import { SPRINTS } from '../../../data.js';

const STATUS_COLORS = {
  "Backlog": "#52525b", "Ready": "#38bdf8", "In progress": "#fbbf24",
  "In review": "#c4b5fd", "Done": "#34d399",
};

const fmtDate = d => d ? `${d.slice(8,10)}/${d.slice(5,7)}` : '—';

const ganttPos = (item, s) => {
  const c = SC[s];
  if (!c || !item.startDate || !item.targetDate) return { left: 0, width: 100 };
  const tS = new Date(c.start).getTime(), tE = new Date(c.end).getTime(), dur = tE - tS;
  if (dur <= 0) return { left: 0, width: 100 };
  const l = Math.max(0, Math.min(100, (new Date(item.startDate).getTime() - tS) / dur * 100));
  const r = Math.max(0, Math.min(100, (new Date(item.targetDate).getTime() - tS) / dur * 100));
  return { left: l, width: Math.max(2, r - l) };
};

const todayPos = (s) => {
  const c = SC[s];
  if (!c) return null;
  const tS = new Date(c.start).getTime(), tE = new Date(c.end).getTime(), dur = tE - tS;
  if (dur <= 0) return null;
  const now = Date.now();
  if (now < tS || now > tE) return null;
  return (now - tS) / dur * 100;
};

export default function RoadmapView({ areaStats, areaColor, sprint, sc, onCardClick }) {
  const [tooltip, setTooltip] = useState(null);
  const visibleSprints = sprint === null ? SPRINTS.map(s => s.sprint) : [sprint];
  const cols = sprint === null ? "180px 1fr 1fr 1fr" : "180px 1fr";

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, marginBottom: 4, minWidth: sprint === null ? 640 : 400 }}>
        <div style={{ padding: "6px 0", color: "var(--tx4)", fontSize: 9, textTransform: "uppercase", letterSpacing: ".07em" }}>Etiqueta / Historia</div>
        {sprint === null
          ? SPRINTS.map(({ sprint: s }) => (
              <div key={s} style={{ background: `${SC[s].color}12`, border: `1px solid ${SC[s].color}30`, borderRadius: 6, padding: "5px 10px", textAlign: "center" }}>
                <div style={{ color: SC[s].color, fontWeight: 700, fontSize: 11 }}>{SC[s].label}</div>
                <div style={{ color: "var(--tx4)", fontSize: 9 }}>{SC[s].date}</div>
              </div>
            ))
          : (
              <div style={{ background: `${sc.color}12`, border: `1px solid ${sc.color}30`, borderRadius: 6, padding: "5px 10px", textAlign: "center" }}>
                <div style={{ color: sc.color, fontWeight: 700, fontSize: 11 }}>{sc.label}</div>
                <div style={{ color: "var(--tx4)", fontSize: 9 }}>{sc.date}</div>
              </div>
            )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: sprint === null ? 640 : 400 }}>
        {areaStats.map(({ area, items: its }) => {
          const color = areaColor[area];
          const byS = {};
          its.forEach(i => { (byS[i.sprint] ??= []).push(i); });

          return (
            <div key={area}>
              <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 2px" }}>
                  <div style={{ width: 3, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <span style={{ color, fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{area}</span>
                  <span style={{ color: "var(--tx4)", fontSize: 9, flexShrink: 0 }}>{its.length} HU</span>
                </div>
                {visibleSprints.map(s => {
                  const today = todayPos(s);
                  return (
                    <div key={s} style={{ background: "var(--bg1)", borderRadius: 5, padding: "4px 5px", minHeight: 24, borderLeft: `2px solid ${SC[s].color}40`, position: "relative" }}>
                      {/* Today line */}
                      {today !== null && (
                        <div className="gantt-today-line" style={{ left: `${today}%` }} />
                      )}
                      {(byS[s] || []).map(item => {
                        const c = STATUS_COLORS[item.status] || "#52525b";
                        const pos = ganttPos(item, s);
                        return (
                          <div key={item.id} style={{ position: "relative", height: 20, marginBottom: 2 }}
                            onMouseEnter={() => setTooltip(item.id)}
                            onMouseLeave={() => setTooltip(null)}
                            onClick={() => onCardClick?.(item)}>
                            <div className="gantt-bar" style={{
                              left: `${pos.left}%`, width: `${pos.width}%`,
                              background: `${c}28`, borderColor: `${c}55`,
                            }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: c, flexShrink: 0 }} />
                              {item.tipo && <span style={{ fontSize: 8, color: "#fff7ed", background: "#f97316", borderRadius: 3, padding: "0 3px", flexShrink: 0 }}>{item.tipo}</span>}
                              <span style={{ color: "var(--tx0)", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                {sprint === null
                                  ? item.title
                                  : <>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--tx4)", fontFamily: "monospace", fontSize: 8, textDecoration: "none", marginRight: 4 }}>{item.id}</a> : <span style={{ color: "var(--tx4)", fontFamily: "monospace", fontSize: 8, marginRight: 4 }}>{item.id}</span>}{item.title}</>}
                              </span>
                              {item.size && <span style={{ flexShrink: 0 }}><SizeBadge s={item.size} /></span>}
                            </div>
                            {/* Tooltip */}
                            {tooltip === item.id && (
                              <div className="gantt-tooltip">
                                <div style={{ fontWeight: 700, marginBottom: 2 }}>{item.id} — {item.title}</div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <span>Estado: {item.status}</span>
                                  {item.size && <span>Talla: {item.size}</span>}
                                  {item.equipo && <span>Equipo: {item.equipo}</span>}
                                </div>
                                <div style={{ marginTop: 2, color: 'var(--tx4)' }}>
                                  {fmtDate(item.startDate)} → {fmtDate(item.targetDate)}
                                  {item.estimate && ` · ${item.estimate}h`}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {!(byS[s] || []).length && (
                        <div style={{ color: "var(--tx4)", fontSize: 9, padding: "3px 4px", fontStyle: "italic" }}>—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "10px 2px 2px", alignItems: 'center' }}>
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
            <span style={{ color: "var(--tx4)", fontSize: 9 }}>{s}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
          <div style={{ width: 1, height: 10, background: '#f87171' }} />
          <span style={{ color: "var(--tx4)", fontSize: 9 }}>Hoy</span>
        </div>
      </div>
    </div>
  );
}
