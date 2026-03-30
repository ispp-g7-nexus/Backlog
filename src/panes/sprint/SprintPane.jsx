import { useState, useMemo } from 'react';
import { SC, SIZE_H_MAP } from '../../constants.js';
import { BACKLOG } from '../../data.js';
import { useApp } from '../../context/AppContext.jsx';
import { detectCurrentSprint } from '../../lib/utils.js';
import { StatusBadge, SizeBadge } from '../../components/badges.jsx';
import SprintCalendar from './SprintCalendar.jsx';
import SprintTimeline from './SprintTimeline.jsx';
import CapacityPlanner from './CapacityPlanner.jsx';
import ImpedimentTracker from './ImpedimentTracker.jsx';
import MeetingMinutes from './MeetingMinutes.jsx';

const STATUS_ORDER = ['Backlog', 'Ready', 'In progress', 'In review', 'Done'];


export default function SprintPane() {
  const { activeSprint: globalSprint } = useApp();
  const activeSprint = globalSprint || detectCurrentSprint();
  const [view, setView] = useState('resumen');
  const sc = SC[activeSprint];

  const items = useMemo(() => {
    try {
      const edits = JSON.parse(localStorage.getItem('nexus_edits_v1') || '{}');
      const deleted = new Set(JSON.parse(localStorage.getItem('nexus_deleted_v1') || '[]'));
      const created = JSON.parse(localStorage.getItem('nexus_created_v1') || '[]');
      const base = BACKLOG.filter(i => i.sprint === activeSprint && !deleted.has(i.id))
        .map(i => edits[i.id] ? { ...i, ...edits[i.id] } : i);
      const extra = created.filter(i => i.sprint === activeSprint && !deleted.has(i.id))
        .map(i => edits[i.id] ? { ...i, ...edits[i.id] } : i);
      return [...base, ...extra];
    } catch { return BACKLOG.filter(i => i.sprint === activeSprint); }
  }, [activeSprint]);

  const stats = useMemo(() => {
    const byStatus = {};
    STATUS_ORDER.forEach(s => { byStatus[s] = []; });
    items.forEach(i => { (byStatus[i.status] ??= []).push(i); });

    const totalH = items.reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0);
    const doneH = byStatus.Done.reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0);
    const progressH = byStatus['In progress'].reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0);
    const reviewH = byStatus['In review'].reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0);

    const now = Date.now();
    const start = new Date(sc.start).getTime();
    const end = new Date(sc.end).getTime();
    const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));

    const noSize = items.filter(i => !i.size).length;
    const noDates = items.filter(i => !i.startDate && !i.targetDate).length;
    const noAssignee = items.filter(i => !(i.assignees?.length > 0)).length;

    return { byStatus, totalH, doneH, progressH, reviewH, elapsed, total: items.length, noSize, noDates, noAssignee };
  }, [items, sc]);

  const completionPct = stats.totalH > 0 ? Math.round(stats.doneH / stats.totalH * 100) : 0;
  const burnPct = stats.totalH > 0 ? Math.round((stats.doneH + stats.progressH + stats.reviewH) / stats.totalH * 100) : 0;
  const elapsedPct = Math.round(stats.elapsed * 100);

  return (
    <div>
      {/* Sprint info */}
      <div className="card" style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, color: sc.color }}>{sc.label}</div>
        <div style={{ color: 'var(--tx4)', fontSize: 11 }}>{sc.date}</div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-4 gap-2 mb-3">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ color: sc.color, fontSize: 22, fontWeight: 800 }}>{stats.total}</div>
          <div className="text-dim text-xs">Tareas</div>
          <div className="text-dim text-xs" style={{ marginTop: 4 }}>~{stats.totalH}h estimadas</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ color: '#34d399', fontSize: 22, fontWeight: 800 }}>{completionPct}%</div>
          <div className="text-dim text-xs">Completado</div>
          <div style={{ marginTop: 6, height: 4, background: 'var(--bg0)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${completionPct}%`, height: '100%', background: '#34d399', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ color: '#fbbf24', fontSize: 22, fontWeight: 800 }}>{burnPct}%</div>
          <div className="text-dim text-xs">En progreso o hecho</div>
          <div style={{ marginTop: 6, height: 4, background: 'var(--bg0)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${burnPct}%`, height: '100%', background: '#fbbf24', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ color: elapsedPct > burnPct ? '#f87171' : '#818cf8', fontSize: 22, fontWeight: 800 }}>{elapsedPct}%</div>
          <div className="text-dim text-xs">Tiempo transcurrido</div>
          <div style={{ marginTop: 6, height: 4, background: 'var(--bg0)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${elapsedPct}%`, height: '100%', background: elapsedPct > burnPct ? '#f87171' : '#818cf8', borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Warnings */}
      {(stats.noSize > 0 || stats.noDates > 0 || stats.noAssignee > 0) && (
        <div className="card mb-3" style={{ borderColor: '#f59e0b30', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
          {stats.noSize > 0 && <span style={{ color: '#f59e0b' }}>{stats.noSize} sin talla</span>}
          {stats.noDates > 0 && <span style={{ color: '#f59e0b' }}>{stats.noDates} sin fechas</span>}
          {stats.noAssignee > 0 && <span style={{ color: '#fb923c' }}>{stats.noAssignee} sin asignar</span>}
        </div>
      )}

      {/* View tabs */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="tab-group w-fit">
          {[
            { id: 'resumen', label: 'Resumen' },
            { id: 'timeline', label: 'Timeline' },
            { id: 'calendario', label: 'Calendario' },
            { id: 'capacidad', label: '⚖ Capacidad' },
            { id: 'impedimentos', label: '🚧 Impedimentos' },
            { id: 'actas', label: '📝 Actas' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)} className={`tab-btn ${view === id ? 'active' : ''}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Views */}
      {view === 'resumen' && (
        <div className="grid grid-2 gap-2">
          {/* Status breakdown */}
          <div className="card">
            <div className="text-dim text-xs mb-3" style={{ textTransform: 'uppercase', letterSpacing: '.07em' }}>Distribución por estado</div>
            {STATUS_ORDER.map(status => {
              const count = stats.byStatus[status]?.length || 0;
              const pct = stats.total > 0 ? Math.round(count / stats.total * 100) : 0;
              return (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 80 }}><StatusBadge s={status} /></div>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg0)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: status === 'Done' ? '#34d399' : status === 'In progress' ? '#fbbf24' : status === 'In review' ? '#c4b5fd' : status === 'Ready' ? '#38bdf8' : '#52525b', borderRadius: 3 }} />
                  </div>
                  <span style={{ color: 'var(--tx3)', fontSize: 11, minWidth: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Items needing attention */}
          <div className="card">
            <div className="text-dim text-xs mb-3" style={{ textTransform: 'uppercase', letterSpacing: '.07em' }}>Tareas activas</div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {[...stats.byStatus['In progress'], ...stats.byStatus['In review']].map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--bdr)', fontSize: 11 }}>
                  <span style={{ color: 'var(--tx4)', fontFamily: 'monospace', fontSize: 9, minWidth: 60 }}>{item.id}</span>
                  <StatusBadge s={item.status} />
                  <span style={{ color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.title}</span>
                  {item.assignees?.length > 0 && (
                    <span style={{ display: 'flex', gap: 2 }}>
                      {item.assignees.slice(0, 2).map(a => (
                        <img key={a.login} src={a.avatarUrl} title={a.name || a.login} style={{ width: 16, height: 16, borderRadius: '50%' }} />
                      ))}
                    </span>
                  )}
                </div>
              ))}
              {stats.byStatus['In progress'].length === 0 && stats.byStatus['In review'].length === 0 && (
                <div className="text-muted text-xs">Sin tareas activas</div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'timeline' && (
        <SprintTimeline items={items} sc={sc} sprint={activeSprint} />
      )}

      {view === 'calendario' && (
        <SprintCalendar sprint={activeSprint} />
      )}

      {view === 'capacidad' && (
        <CapacityPlanner items={items} sc={sc} activeSprint={activeSprint} />
      )}

      {view === 'impedimentos' && (
        <ImpedimentTracker activeSprint={activeSprint} items={items} />
      )}

      {view === 'actas' && (
        <MeetingMinutes activeSprint={activeSprint} />
      )}
    </div>
  );
}
