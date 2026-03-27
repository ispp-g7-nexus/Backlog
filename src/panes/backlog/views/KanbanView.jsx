import { useState, useRef } from 'react';
import { SizeBadge } from '../../../components/badges.jsx';
import { STATUSES } from '../hooks/useBacklogItems.js';
import RiskBadge from '../components/RiskBadge.jsx';

const STATUS_COLORS = {
  "Backlog": "#52525b", "Ready": "#38bdf8", "In progress": "#fbbf24",
  "In review": "#c4b5fd", "Done": "#34d399",
};

const fmtDate = d => d ? `${d.slice(8,10)}/${d.slice(5,7)}` : null;

export default function KanbanView({ byStatus, areaColor, sf, setSf, ef, setEf, tf, setTf, pf, setPf, toggle, onStatusChange, onCardClick }) {
  const [dragItem, setDragItem] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragRef = useRef(null);

  const handleDragStart = (e, item) => {
    setDragItem(item);
    dragRef.current = item;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
    requestAnimationFrame(() => e.target.classList.add('dragging'));
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDragItem(null);
    setDragOver(null);
    dragRef.current = null;
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOver !== status) setDragOver(status);
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    const item = dragRef.current;
    if (item && item.status !== targetStatus && onStatusChange) {
      onStatusChange(item, targetStatus);
    }
    setDragItem(null);
    setDragOver(null);
    dragRef.current = null;
  };

  return (
    <div className="kanban-board">
      {STATUSES.map(status => {
        const col = byStatus[status] || [];
        const color = STATUS_COLORS[status];
        const isDropTarget = dragOver === status && dragItem?.status !== status;
        return (
          <div key={status}
            className="kanban-column"
            style={isDropTarget ? { background: `${color}10`, borderColor: `${color}50` } : undefined}
            onDragOver={e => handleDragOver(e, status)}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => handleDrop(e, status)}
          >
            <div className="kanban-column-header">
              <span style={{ color }}>{status}</span>
              <span style={{ background: `${color}20`, color, fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 7px" }}>{col.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 40 }}>
              {col.map(item => (
                <div key={item.id}
                  className="kanban-card"
                  draggable
                  onDragStart={e => handleDragStart(e, item)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onCardClick?.(item)}
                  style={{ opacity: dragItem?.id === item.id ? 0.4 : 1 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: areaColor[item.area] ?? "#52525b", flexShrink: 0 }} />
                    {item.url
                      ? <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "var(--tx4)", fontSize: 9, fontFamily: "monospace", textDecoration: "none" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#818cf8"} onMouseLeave={e => e.currentTarget.style.color = "var(--tx4)"}>{item.id}</a>
                      : <span style={{ color: "var(--tx4)", fontSize: 9, fontFamily: "monospace" }}>{item.id}</span>}
                    {item.size && <span style={{ marginLeft: "auto", cursor: "pointer" }} onClick={e => { e.stopPropagation(); toggle(sf, setSf, item.size); }}><SizeBadge s={item.size} /></span>}
                  </div>
                  <div style={{ color: "var(--tx0)", fontSize: 11, lineHeight: 1.4, marginBottom: 6 }}>{item.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {item.equipo && (
                      <span onClick={e => { e.stopPropagation(); toggle(ef, setEf, item.equipo); }} style={{ color: ef.includes(item.equipo) ? "#818cf8" : "var(--tx4)", fontSize: 9, background: ef.includes(item.equipo) ? "#6366f120" : "var(--bg0)", border: ef.includes(item.equipo) ? "1px solid #6366f140" : "1px solid var(--bdr)", borderRadius: 4, padding: "1px 6px", cursor: "pointer" }}>{item.equipo}</span>
                    )}
                    {item.tipo && (
                      <span onClick={e => { e.stopPropagation(); toggle(tf, setTf, item.tipo); }} style={{ color: tf.includes(item.tipo) ? "#fff7ed" : "var(--tx4)", fontSize: 9, background: tf.includes(item.tipo) ? "#f97316" : "var(--bg0)", border: "1px solid #f9731640", borderRadius: 4, padding: "1px 6px", cursor: "pointer" }}>{item.tipo}</span>
                    )}
                    {item.assignees?.length > 0 && (
                      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 2 }}>
                        {item.assignees.map(a => (
                          <img key={a.login} src={a.avatarUrl} title={a.name || a.login}
                            onClick={e => { e.stopPropagation(); toggle(pf, setPf, a.login); }}
                            style={{ width: 16, height: 16, borderRadius: "50%", border: pf.includes(a.login) ? "2px solid #818cf8" : "1px solid var(--bdr)", cursor: "pointer" }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                  <RiskBadge item={item} />
                  {(item.startDate || item.targetDate || item.estimate != null) && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                      {(item.startDate || item.targetDate) && (
                        <span style={{ fontSize: 9, color: "#60a5fa", background: "#0f2235", border: "1px solid #60a5fa30", borderRadius: 4, padding: "1px 5px" }}>
                          {fmtDate(item.startDate) ?? "?"}–{fmtDate(item.targetDate) ?? "?"}
                        </span>
                      )}
                      {item.estimate != null && (
                        <span style={{ fontSize: 9, color: "#a78bfa", background: "#2d1b69", border: "1px solid #a78bfa30", borderRadius: 4, padding: "1px 5px" }}>
                          ~{item.estimate}h
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {col.length === 0 && (
                <div style={{ border: "1px dashed var(--bdr)", borderRadius: 9, padding: "20px 12px", textAlign: "center", color: "var(--tx4)", fontSize: 10 }}>
                  Sin tareas
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
