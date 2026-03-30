import { useMemo, useState } from 'react';
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

function semColor(val, greenMax, yellowMax) {
  if (val <= greenMax) return '#34d399';
  if (val <= yellowMax) return '#fbbf24';
  return '#ef4444';
}

function Recommendation({ text, severity }) {
  const colors = { info: '#38bdf8', warn: '#fbbf24', critical: '#ef4444' };
  const c = colors[severity] || colors.info;
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: `${c}08`, border: `1px solid ${c}25`, borderRadius: 8, marginBottom: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 5 }} />
      <span style={{ color: 'var(--tx2)', fontSize: 11, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

function SprintSummaryRow({ sprint, items }) {
  const sc = SC[sprint];
  const total = items.length;
  const done = items.filter(i => i.status === 'Done').length;
  const totalH = items.reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0);
  const doneH = items.filter(i => i.status === 'Done').reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0);
  const pct = total > 0 ? Math.round(done / total * 100) : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--bdr)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
      <div style={{ minWidth: 70 }}>
        <div style={{ color: sc.color, fontWeight: 700, fontSize: 12 }}>{sc.label}</div>
        <div style={{ color: 'var(--tx4)', fontSize: 9 }}>{sc.date}</div>
      </div>
      <div style={{ flex: 1, height: 8, background: 'var(--bg0)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ color: pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171', fontSize: 13, fontWeight: 800, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
      <span style={{ color: 'var(--tx4)', fontSize: 10, minWidth: 60 }}>{done}/{total} tareas</span>
      <span style={{ color: 'var(--tx4)', fontSize: 10, minWidth: 50 }}>{doneH}/{totalH}h</span>
    </div>
  );
}

export default function InsightsPane() {
  const allItems = useMemo(loadItems, []);
  const [exportOpen, setExportOpen] = useState(false);

  const analysis = useMemo(() => {
    const now = Date.now();
    const sprintData = SPRINTS.map(({ sprint: s }) => {
      const items = allItems.filter(i => i.sprint === s);
      const sc = SC[s];
      const total = items.length;
      const done = items.filter(i => i.status === 'Done').length;
      const inProg = items.filter(i => i.status === 'In progress').length;
      const inRev = items.filter(i => i.status === 'In review').length;
      const backlog = items.filter(i => i.status === 'Backlog').length;
      const totalH = items.reduce((acc, i) => acc + (SIZE_H_MAP[i.size] || 0), 0);
      const doneH = items.filter(i => i.status === 'Done').reduce((acc, i) => acc + (SIZE_H_MAP[i.size] || 0), 0);
      const elapsed = sc ? Math.max(0, Math.min(1, (now - new Date(sc.start).getTime()) / (new Date(sc.end).getTime() - new Date(sc.start).getTime()))) : 0;
      return { sprint: s, items, total, done, inProg, inRev, backlog, totalH, doneH, elapsed, sc };
    });

    // Velocity per sprint (done items count)
    const velocities = sprintData.map(d => d.done);
    const velocityTrend = velocities.length >= 2 ? velocities[velocities.length - 1] - velocities[velocities.length - 2] : 0;

    // Global stats
    const globalTotal = allItems.length;
    const globalDone = allItems.filter(i => i.status === 'Done').length;
    const globalPct = globalTotal > 0 ? Math.round(globalDone / globalTotal * 100) : 0;

    // Workload per person
    const personLoad = {};
    allItems.forEach(i => {
      const h = SIZE_H_MAP[i.size] || 0;
      (i.assignees || []).forEach(a => {
        if (!personLoad[a.login]) personLoad[a.login] = { login: a.login, name: a.name || a.login, totalH: 0, doneH: 0, tasks: 0, doneTasks: 0 };
        personLoad[a.login].totalH += h;
        personLoad[a.login].tasks += 1;
        if (i.status === 'Done') { personLoad[a.login].doneH += h; personLoad[a.login].doneTasks += 1; }
      });
    });
    const personStats = Object.values(personLoad).sort((a, b) => b.totalH - a.totalH);
    const avgLoad = personStats.length > 0 ? personStats.reduce((s, p) => s + p.totalH, 0) / personStats.length : 0;

    // Team load
    const teamLoad = {};
    TEAM_MEMBERS.forEach(m => {
      const t = m.team;
      if (!teamLoad[t]) teamLoad[t] = { team: t, totalH: 0, doneH: 0, members: 0 };
      teamLoad[t].members += 1;
      const p = personLoad[m.login];
      if (p) { teamLoad[t].totalH += p.totalH; teamLoad[t].doneH += p.doneH; }
    });
    const teamStats = Object.values(teamLoad).sort((a, b) => a.team.localeCompare(b.team));

    // Recommendations
    const recs = [];
    const lastSprint = sprintData[sprintData.length - 1];

    if (velocityTrend < -5) recs.push({ text: `La velocity ha caído ${Math.abs(velocityTrend)} tareas respecto al sprint anterior. Considerar reducir scope del sprint actual.`, severity: 'warn' });
    if (velocityTrend > 5) recs.push({ text: `La velocity ha subido ${velocityTrend} tareas. El equipo está ganando ritmo.`, severity: 'info' });

    const overloaded = personStats.filter(p => p.totalH > avgLoad * 1.5);
    if (overloaded.length > 0) recs.push({ text: `${overloaded.length} persona${overloaded.length > 1 ? 's' : ''} tiene${overloaded.length > 1 ? 'n' : ''} > 50% más carga que el promedio (${overloaded.map(p => p.login).join(', ')}). Redistribuir tareas.`, severity: 'warn' });

    if (lastSprint && lastSprint.elapsed > 0.5 && lastSprint.backlog > lastSprint.total * 0.5) recs.push({ text: `${lastSprint.backlog} tareas (${Math.round(lastSprint.backlog / lastSprint.total * 100)}%) siguen en Backlog con más del 50% del sprint transcurrido. Revisar impedimentos en daily.`, severity: 'critical' });

    const noAssignee = allItems.filter(i => !(i.assignees?.length > 0) && i.status !== 'Done');
    if (noAssignee.length > 10) recs.push({ text: `${noAssignee.length} tareas activas sin asignar. Asignar responsables para mejorar trazabilidad.`, severity: 'warn' });

    if (lastSprint && lastSprint.elapsed > 0 && lastSprint.doneH / Math.max(1, lastSprint.totalH) < lastSprint.elapsed * 0.5) recs.push({ text: `El progreso real está muy por debajo del tiempo transcurrido. Riesgo de no completar los objetivos del sprint.`, severity: 'critical' });

    const teamVelocities = teamStats.map(t => t.doneH / Math.max(1, t.members));
    const maxTV = Math.max(...teamVelocities);
    const minTV = Math.min(...teamVelocities);
    if (maxTV > 0 && maxTV > minTV * 2.5) recs.push({ text: `Desequilibrio entre equipos: el más productivo tiene ${Math.round(maxTV / Math.max(1, minTV))}× la velocity per cápita del más lento.`, severity: 'info' });

    if (globalPct >= 80) recs.push({ text: `El proyecto está al ${globalPct}% de completitud global. Buen ritmo general.`, severity: 'info' });

    return { sprintData, velocities, globalTotal, globalDone, globalPct, personStats, teamStats, avgLoad, recs };
  }, [allItems]);

  const generateMarkdown = () => {
    const lines = ['# Informe de Conclusiones — NexUS Product Backlog', ''];
    lines.push(`**Fecha:** ${new Date().toLocaleDateString('es-ES')}`, '');

    lines.push('## Estado general', '');
    lines.push(`- **Tareas totales:** ${analysis.globalTotal}`);
    lines.push(`- **Completadas:** ${analysis.globalDone} (${analysis.globalPct}%)`, '');

    lines.push('## Por sprint', '');
    lines.push('| Sprint | Tareas | Completadas | % | Horas est. | Horas done |');
    lines.push('|--------|--------|-------------|---|------------|------------|');
    analysis.sprintData.forEach(d => {
      const pct = d.total > 0 ? Math.round(d.done / d.total * 100) : 0;
      lines.push(`| ${d.sc.label} | ${d.total} | ${d.done} | ${pct}% | ${d.totalH}h | ${d.doneH}h |`);
    });
    lines.push('');

    lines.push('## Recomendaciones', '');
    analysis.recs.forEach(r => lines.push(`- ${r.text}`));
    lines.push('');

    lines.push('## Carga por persona', '');
    lines.push('| Persona | Horas asig. | Horas done | Tareas | Completadas |');
    lines.push('|---------|-------------|------------|--------|-------------|');
    analysis.personStats.forEach(p => {
      lines.push(`| ${p.login} | ${p.totalH}h | ${p.doneH}h | ${p.tasks} | ${p.doneTasks} |`);
    });

    return lines.join('\n');
  };

  const handleExport = () => {
    const md = generateMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conclusiones-nexus-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Overall semaphore
  const criticalRecs = analysis.recs.filter(r => r.severity === 'critical').length;
  const warnRecs = analysis.recs.filter(r => r.severity === 'warn').length;
  const overallColor = criticalRecs > 0 ? '#ef4444' : warnRecs > 0 ? '#fbbf24' : '#34d399';
  const overallLabel = criticalRecs > 0 ? 'Necesita atención' : warnRecs > 0 ? 'Aceptable' : 'Saludable';

  return (
    <div>
      {/* Header */}
      <div className="card mb-3" style={{ borderColor: `${overallColor}30`, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: overallColor, boxShadow: `0 0 10px ${overallColor}60` }} />
            <span style={{ color: overallColor, fontWeight: 800, fontSize: 16 }}>{overallLabel}</span>
          </div>
          <div style={{ color: 'var(--tx3)', fontSize: 11 }}>Análisis ejecutivo del proyecto · {analysis.globalDone}/{analysis.globalTotal} tareas completadas ({analysis.globalPct}%)</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9, color: 'var(--tx4)', background: 'var(--bg0)', border: '1px solid var(--bdr)', borderRadius: 4, padding: '2px 7px' }}>Todos los sprints</span>
          <button onClick={handleExport} className="btn btn-sm" style={{ color: '#818cf8', borderColor: '#818cf840' }}>
            Exportar Markdown
          </button>
        </div>
      </div>

      {/* Sprint progress */}
      <div className="card mb-3">
        <div className="text-dim text-xs mb-3" style={{ textTransform: 'uppercase', letterSpacing: '.07em' }}>Progreso por sprint</div>
        {analysis.sprintData.map(d => (
          <SprintSummaryRow key={d.sprint} sprint={d.sprint} items={d.items} />
        ))}
      </div>

      {/* Two-column: recommendations + team */}
      <div className="grid grid-2 gap-2 mb-3">
        {/* Recommendations */}
        <div className="card">
          <div className="text-dim text-xs mb-3" style={{ textTransform: 'uppercase', letterSpacing: '.07em' }}>Recomendaciones ({analysis.recs.length})</div>
          {analysis.recs.length === 0 && <div className="text-muted text-xs">Sin recomendaciones — todo parece correcto.</div>}
          {analysis.recs.map((r, i) => <Recommendation key={i} text={r.text} severity={r.severity} />)}
        </div>

        {/* Team comparison */}
        <div className="card">
          <div className="text-dim text-xs mb-3" style={{ textTransform: 'uppercase', letterSpacing: '.07em' }}>Comparativa por equipo</div>
          {analysis.teamStats.map(t => {
            const pct = t.totalH > 0 ? Math.round(t.doneH / t.totalH * 100) : 0;
            const perCapita = t.members > 0 ? Math.round(t.totalH / t.members) : 0;
            return (
              <div key={t.team} style={{ padding: '8px 0', borderBottom: '1px solid var(--bdr)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: 'var(--tx0)', fontWeight: 700, fontSize: 12 }}>Equipo {t.team}</span>
                  <span style={{ color: 'var(--tx4)', fontSize: 10 }}>{t.members} miembros</span>
                  <span style={{ marginLeft: 'auto', color: pct >= 60 ? '#34d399' : pct >= 30 ? '#fbbf24' : 'var(--tx4)', fontSize: 12, fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--tx4)' }}>
                  <span>{t.totalH}h asignadas</span>
                  <span>{t.doneH}h completadas</span>
                  <span>{perCapita}h/persona</span>
                </div>
                <div style={{ marginTop: 4, height: 4, background: 'var(--bg0)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pct >= 60 ? '#34d399' : pct >= 30 ? '#fbbf24' : '#52525b', borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top contributors */}
      <div className="card">
        <div className="text-dim text-xs mb-3" style={{ textTransform: 'uppercase', letterSpacing: '.07em' }}>Carga por persona (top 10)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bdr)' }}>
                {['Persona', 'Horas asig.', 'Horas done', 'Tareas', 'Completadas', 'Rendimiento'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--tx4)', fontWeight: 700, fontSize: 9, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.personStats.slice(0, 10).map(p => {
                const rendPct = p.totalH > 0 ? Math.round(p.doneH / p.totalH * 100) : 0;
                const isOver = p.totalH > analysis.avgLoad * 1.5;
                return (
                  <tr key={p.login} style={{ borderBottom: '1px solid var(--bdr)' }}>
                    <td style={{ padding: '6px 10px', color: isOver ? '#fbbf24' : 'var(--tx2)', fontWeight: isOver ? 700 : 400 }}>{p.login}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--tx3)' }}>{p.totalH}h</td>
                    <td style={{ padding: '6px 10px', color: 'var(--tx3)' }}>{p.doneH}h</td>
                    <td style={{ padding: '6px 10px', color: 'var(--tx3)' }}>{p.tasks}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--tx3)' }}>{p.doneTasks}</td>
                    <td style={{ padding: '6px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 50, height: 4, background: 'var(--bg0)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${rendPct}%`, height: '100%', background: rendPct >= 60 ? '#34d399' : rendPct >= 30 ? '#fbbf24' : '#52525b', borderRadius: 3 }} />
                        </div>
                        <span style={{ color: 'var(--tx4)', fontSize: 10 }}>{rendPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
