import { useMemo } from 'react';
import { BACKLOG, SPRINTS } from '../../data.js';
import { SC, SIZE_H_MAP, TEAM_MEMBERS } from '../../constants.js';

function loadItems() {
  try {
    const edits = JSON.parse(localStorage.getItem('nexus_edits_v1') || '{}');
    const deleted = new Set(JSON.parse(localStorage.getItem('nexus_deleted_v1') || '[]'));
    const created = JSON.parse(localStorage.getItem('nexus_created_v1') || '[]');
    const base = BACKLOG.filter(i => !deleted.has(i.id)).map(i => edits[i.id] ? { ...i, ...edits[i.id] } : i);
    const extra = created.filter(i => !deleted.has(i.id)).map(i => edits[i.id] ? { ...i, ...edits[i.id] } : i);
    return [...base, ...extra];
  } catch { return BACKLOG; }
}

function semaphore(value, green, yellow) {
  if (value <= green) return { color: '#34d399', bg: '#34d39915', label: 'OK' };
  if (value <= yellow) return { color: '#fbbf24', bg: '#fbbf2415', label: 'Atención' };
  return { color: '#ef4444', bg: '#ef444415', label: 'Riesgo' };
}

function semaphoreInverse(value, green, yellow) {
  if (value >= green) return { color: '#34d399', bg: '#34d39915', label: 'OK' };
  if (value >= yellow) return { color: '#fbbf24', bg: '#fbbf2415', label: 'Atención' };
  return { color: '#ef4444', bg: '#ef444415', label: 'Riesgo' };
}

function RiskCard({ title, value, unit, description, items, sem }) {
  return (
    <div className="card" style={{ borderColor: `${sem.color}30` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: sem.color, flexShrink: 0, boxShadow: `0 0 6px ${sem.color}60` }} />
        <span style={{ color: 'var(--tx2)', fontSize: 12, fontWeight: 700, flex: 1 }}>{title}</span>
        <span style={{ background: sem.bg, color: sem.color, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: `1px solid ${sem.color}30` }}>{sem.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span style={{ color: sem.color, fontSize: 24, fontWeight: 800 }}>{value}</span>
        {unit && <span style={{ color: 'var(--tx4)', fontSize: 11 }}>{unit}</span>}
      </div>
      <div style={{ color: 'var(--tx4)', fontSize: 10, marginBottom: items?.length > 0 ? 8 : 0 }}>{description}</div>
      {items?.length > 0 && (
        <div style={{ maxHeight: 80, overflowY: 'auto', marginTop: 4 }}>
          {items.slice(0, 8).map(i => (
            <div key={i.id || i} style={{ fontSize: 9, color: 'var(--tx3)', padding: '1px 0', borderBottom: '1px solid var(--bdr)' }}>
              {typeof i === 'string' ? i : `${i.id} — ${i.title}`}
            </div>
          ))}
          {items.length > 8 && <div style={{ fontSize: 9, color: 'var(--tx4)', padding: '2px 0' }}>+{items.length - 8} más</div>}
        </div>
      )}
    </div>
  );
}

export default function RisksPane() {
  const allItems = useMemo(loadItems, []);

  const risks = useMemo(() => {
    const now = Date.now();

    // Find current sprint
    let currentSprint = null;
    for (const { sprint: s } of SPRINTS) {
      const c = SC[s];
      if (c && new Date(c.start).getTime() <= now && now <= new Date(c.end).getTime() + 86400000) {
        currentSprint = s;
        break;
      }
    }
    if (!currentSprint) currentSprint = SPRINTS[SPRINTS.length - 1]?.sprint;

    const sprintItems = allItems.filter(i => i.sprint === currentSprint);
    const sc = SC[currentSprint];
    const sprintStart = new Date(sc.start).getTime();
    const sprintEnd = new Date(sc.end).getTime();
    const elapsed = Math.max(0, Math.min(1, (now - sprintStart) / (sprintEnd - sprintStart)));

    // 1. Items without size
    const noSize = sprintItems.filter(i => !i.size);

    // 2. Items without dates
    const noDates = sprintItems.filter(i => !i.startDate && !i.targetDate);

    // 3. Items without assignees
    const noAssignee = sprintItems.filter(i => !(i.assignees?.length > 0));

    // 4. Overdue items
    const overdue = sprintItems.filter(i => i.targetDate && i.status !== 'Done' && new Date(i.targetDate).getTime() < now);

    // 5. Stale items (>5 days in In progress)
    const stale = sprintItems.filter(i => {
      if (i.status !== 'In progress' || !i.startDate) return false;
      return (now - new Date(i.startDate).getTime()) > 5 * 86400000;
    });

    // 6. Completion rate vs elapsed time
    const totalH = sprintItems.reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0);
    const doneH = sprintItems.filter(i => i.status === 'Done').reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0);
    const completionPct = totalH > 0 ? doneH / totalH : 0;
    const completionGap = elapsed - completionPct;

    // 7. Workload distribution
    const loadByPerson = {};
    sprintItems.forEach(i => {
      const h = SIZE_H_MAP[i.size] || 0;
      (i.assignees || []).forEach(a => {
        loadByPerson[a.login] = (loadByPerson[a.login] || 0) + h;
      });
    });
    const loads = Object.values(loadByPerson);
    const avgLoad = loads.length > 0 ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
    const maxLoad = Math.max(...loads, 0);
    const overloaded = Object.entries(loadByPerson).filter(([, h]) => h > avgLoad * 1.5).map(([login, h]) => `${login}: ${h}h`);

    // 8. Backlog ratio (items still in Backlog)
    const backlogCount = sprintItems.filter(i => i.status === 'Backlog').length;
    const backlogPct = sprintItems.length > 0 ? Math.round(backlogCount / sprintItems.length * 100) : 0;

    return {
      currentSprint, elapsed, completionPct, completionGap,
      noSize, noDates, noAssignee, overdue, stale,
      backlogCount, backlogPct, overloaded, maxLoad, avgLoad,
      sprintItems,
    };
  }, [allItems]);

  const elapsedPct = Math.round(risks.elapsed * 100);
  const completionPct = Math.round(risks.completionPct * 100);
  const gapPct = Math.round(risks.completionGap * 100);

  // Count active risks
  const activeRisks = [
    risks.overdue.length > 0,
    risks.stale.length > 0,
    risks.completionGap > 0.15,
    risks.backlogPct > 50 && risks.elapsed > 0.3,
    risks.overloaded.length > 0,
    risks.noAssignee.length > risks.sprintItems.length * 0.3,
  ].filter(Boolean).length;

  const overallSem = activeRisks === 0
    ? { color: '#34d399', bg: '#34d39920', label: 'Saludable' }
    : activeRisks <= 2
    ? { color: '#fbbf24', bg: '#fbbf2420', label: 'Atención' }
    : { color: '#ef4444', bg: '#ef444420', label: 'En riesgo' };

  return (
    <div>
      {/* Header */}
      <div className="card mb-3" style={{ borderColor: `${overallSem.color}30`, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: overallSem.color, boxShadow: `0 0 10px ${overallSem.color}60` }} />
            <span style={{ color: overallSem.color, fontWeight: 800, fontSize: 16 }}>{overallSem.label}</span>
          </div>
          <div style={{ color: 'var(--tx3)', fontSize: 11 }}>Sprint {risks.currentSprint} · {activeRisks} riesgo{activeRisks !== 1 ? 's' : ''} activo{activeRisks !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--tx0)', fontSize: 18, fontWeight: 800 }}>{elapsedPct}%</div>
            <div className="text-dim text-xs">Tiempo</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: completionPct > 0 ? '#34d399' : 'var(--tx4)', fontSize: 18, fontWeight: 800 }}>{completionPct}%</div>
            <div className="text-dim text-xs">Completado</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: gapPct > 15 ? '#ef4444' : gapPct > 0 ? '#fbbf24' : '#34d399', fontSize: 18, fontWeight: 800 }}>{gapPct > 0 ? `+${gapPct}` : gapPct}%</div>
            <div className="text-dim text-xs">Gap</div>
          </div>
        </div>
      </div>

      {/* Risk cards grid */}
      <div className="grid grid-3 gap-2">
        <RiskCard
          title="Tareas vencidas"
          value={risks.overdue.length}
          description={risks.overdue.length > 0 ? 'Tareas con fecha límite pasada y no completadas' : 'Todas las tareas dentro de plazo'}
          items={risks.overdue}
          sem={semaphore(risks.overdue.length, 0, 3)}
        />

        <RiskCard
          title="Tareas estancadas"
          value={risks.stale.length}
          description={risks.stale.length > 0 ? 'Más de 5 días en "In progress"' : 'Sin tareas estancadas'}
          items={risks.stale}
          sem={semaphore(risks.stale.length, 0, 2)}
        />

        <RiskCard
          title="Brecha tiempo/progreso"
          value={gapPct > 0 ? `+${gapPct}` : gapPct}
          unit="%"
          description={`${elapsedPct}% del tiempo, ${completionPct}% completado`}
          sem={semaphore(gapPct, 10, 25)}
        />

        <RiskCard
          title="Tareas en Backlog"
          value={risks.backlogPct}
          unit="%"
          description={`${risks.backlogCount} de ${risks.sprintItems.length} tareas sin iniciar`}
          sem={risks.elapsed > 0.3 ? semaphore(risks.backlogPct, 30, 60) : { color: '#34d399', bg: '#34d39915', label: 'OK' }}
        />

        <RiskCard
          title="Sin asignar"
          value={risks.noAssignee.length}
          description={risks.noAssignee.length > 0 ? 'Tareas sin responsable asignado' : 'Todas asignadas'}
          items={risks.noAssignee}
          sem={semaphore(risks.noAssignee.length, 3, Math.round(risks.sprintItems.length * 0.2))}
        />

        <RiskCard
          title="Carga desbalanceada"
          value={risks.overloaded.length}
          unit={risks.overloaded.length > 0 ? 'personas' : ''}
          description={risks.overloaded.length > 0 ? `Carga > 1.5× promedio (avg: ${Math.round(risks.avgLoad)}h)` : `Carga equilibrada (avg: ${Math.round(risks.avgLoad)}h)`}
          items={risks.overloaded}
          sem={semaphore(risks.overloaded.length, 0, 2)}
        />

        <RiskCard
          title="Sin talla"
          value={risks.noSize.length}
          description={risks.noSize.length > 0 ? 'No se puede estimar esfuerzo' : 'Todas las tareas estimadas'}
          items={risks.noSize}
          sem={semaphore(risks.noSize.length, 2, 5)}
        />

        <RiskCard
          title="Sin fechas"
          value={risks.noDates.length}
          description={risks.noDates.length > 0 ? 'Sin inicio ni fin planificado' : 'Todas planificadas'}
          sem={semaphore(risks.noDates.length, 5, Math.round(risks.sprintItems.length * 0.3))}
        />
      </div>
    </div>
  );
}
