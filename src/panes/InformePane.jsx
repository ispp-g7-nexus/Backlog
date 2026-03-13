import { useState, useMemo, Fragment } from 'react';
import { BACKLOG, BACKLOG_MAP } from '../data.js';
import { loadClockify, saveClockify } from '../lib/cache.js';
import { parseClockifyCSV, buildReport, DEFAULT_CLOCKIFY } from '../clockify/parser.js';
import { SC } from '../constants.js';

function InfStatCard({ label, value, sub, color }) {
  return (
    <div style={{ background:"var(--bg2)", border:`1px solid ${color}30`, borderRadius:10, padding:"14px 18px", flex:"1 1 150px", minWidth:130 }}>
      <div style={{ color:"var(--tx4)", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
      <div style={{ color, fontSize:24, fontWeight:800, lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ color:"var(--tx3)", fontSize:10, marginTop:4 }}>{sub}</div>}
    </div>
  );
}

// ── EXPORT MD MODAL ──────────────────────────────────────────
function ExportMdModal({ report, sprint, onClose }) {
  const [docType, setDocType] = useState("burndown");
  const [copied,  setCopied]  = useState(false);

  const fDD   = d => d ? d.slice(8,10)+'/'+d.slice(5,7) : '—';
  const fFull = d => d ? d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4) : '—';

  function genBurndown() {
    if (!report || sprint <= 0)
      return '> Selecciona Sprint 1, 2 o 3 para exportar el Burndown.';
    const spTasks    = Object.values(BACKLOG_MAP).filter(t => t.sprint === sprint);
    const doneTasks  = spTasks.filter(t => t.status === 'Done');
    const totalEstH  = spTasks.reduce((s,t) => s+(t.estimated_h||0), 0);
    const doneEstH   = doneTasks.reduce((s,t) => s+(t.estimated_h||0), 0);
    const pendingH   = totalEstH - doneEstH;
    const proj       = 's' + sprint;
    const dailyProj  = report.dailyHoursByProject?.[proj] || {};
    const clockifyH  = Object.values(dailyProj).reduce((s,h) => s+h, 0);
    const days       = Object.keys(dailyProj).sort();
    const taggedH    = Object.values(report.byEmail||{}).reduce((s,u) => s+(u[`s${sprint}_tagged_h`]||0), 0);
    const consumoPct     = totalEstH > 0 ? clockifyH/totalEstH*100 : 0;
    const completitudPct = totalEstH > 0 ? doneEstH/totalEstH*100 : 0;
    const rendimiento    = clockifyH > 0 ? doneEstH/clockifyH*100 : 0;
    const coveragePct    = clockifyH > 0 ? taggedH/clockifyH*100 : 0;
    const spInfo   = SC[sprint];
    const burnRate = days.length > 0 ? clockifyH / days.length : 0;
    const nDays    = days.length || 1;
    let tableRows = `| 0 | ${fDD(spInfo?.start)} | ${totalEstH.toFixed(0)} | 0.0 | ${totalEstH.toFixed(0)} |\n`;
    let cum = 0;
    days.forEach((day, i) => {
      cum += dailyProj[day] || 0;
      const idealRem = Math.max(0, totalEstH * (1 - (i+1)/nDays));
      const realRem  = Math.max(0, totalEstH - cum);
      tableRows += `| ${i+1} | ${fDD(day)} | ${idealRem.toFixed(0)} | ${cum.toFixed(1)} | ${realRem.toFixed(0)} |\n`;
    });
    let closeDateStr = '—', closeDeltaStr = '—';
    if (burnRate > 0 && pendingH > 0) {
      const lastMs   = new Date(days[days.length-1]).getTime();
      const daysNeed = Math.ceil(pendingH / burnRate);
      const closeMs  = lastMs + daysNeed * 86400000;
      closeDateStr   = fFull(new Date(closeMs).toISOString().slice(0,10));
      const endMs    = spInfo?.end ? new Date(spInfo.end).getTime() : 0;
      if (endMs) {
        const diff = Math.round((closeMs - endMs) / 86400000);
        closeDeltaStr = diff <= 0
          ? `✓ En plazo (${Math.abs(diff)} días de margen)`
          : `✗ ${diff} días de retraso`;
      }
    } else if (pendingH <= 0) {
      closeDateStr = '✅ Completado'; closeDeltaStr = '✓ En plazo';
    }
    return [
      `## 4. Seguimiento de Horas Clockify`, ``,
      `> Datos exportados de NexUS Backlog — ${new Date().toLocaleDateString('es-ES')}.`, ``,
      `### Resumen de horas`, ``,
      `| Métrica | Valor |`, `|---------|-------|`,
      `| H. estimadas totales del sprint | ${totalEstH.toFixed(0)} h |`,
      `| H. registradas en Clockify (proyecto s${sprint}) | ${clockifyH.toFixed(0)} h |`,
      `| H. estimadas de tareas Done | ${doneEstH.toFixed(0)} h |`,
      `| H. pendientes (estimadas – Done) | ${pendingH.toFixed(0)} h |`,
      `| % Consumo (Clockify / Estimadas) | ${consumoPct.toFixed(1)} % |`,
      `| % Completitud (h Done / h Estimadas) | ${completitudPct.toFixed(1)} % |`,
      `| Rendimiento (h Done estimadas / h Clockify) | ${rendimiento.toFixed(1)} % |`,
      `| % Cobertura de etiquetado Clockify | ${coveragePct.toFixed(1)} % |`, ``,
      `### Tabla de burndown en horas (acumulado diario)`, ``,
      `| Día | Fecha | H. Est. Restantes (ideal) | H. Clockify Acumuladas | H. Pendientes (real) |`,
      `|-----|-------|--------------------------|------------------------|----------------------|`,
      tableRows.trimEnd(), ``,
      `---`, ``,
      `## 5. Estimación de Cierre`, ``,
      `| Métrica | Valor |`, `|---------|-------|`,
      `| Días con actividad registrada | ${days.length} días |`,
      `| H. registradas hasta hoy | ${clockifyH.toFixed(0)} h |`,
      `| Ritmo medio diario (burn rate) | ${burnRate.toFixed(1)} h/día |`,
      `| H. pendientes estimadas | ${pendingH.toFixed(0)} h |`,
      `| Días adicionales necesarios | ${burnRate > 0 && pendingH > 0 ? Math.ceil(pendingH/burnRate) : '—'} días |`,
      `| **Fecha estimada de cierre** | **${closeDateStr}** |`,
      `| Fecha límite del sprint | ${fFull(spInfo?.end)} |`,
      `| **¿Dentro del milestone?** | ${closeDeltaStr} |`,
    ].join('\n');
  }

  function genVelocity() {
    if (!report) return '> Carga un CSV de Clockify para generar la tabla de velocidad.';
    let rows = '';
    [[1,'Sprint 1','s1'],[2,'Sprint 2','s2'],[3,'Sprint 3','s3']].forEach(([sn,label,proj]) => {
      const spT    = Object.values(BACKLOG_MAP).filter(t => t.sprint === sn);
      const done   = spT.filter(t => t.status === 'Done');
      const totalH = spT.reduce((s,t) => s+(t.estimated_h||0), 0);
      const doneH  = done.reduce((s,t) => s+(t.estimated_h||0), 0);
      const clkH   = Object.values(report.dailyHoursByProject?.[proj]||{}).reduce((s,h)=>s+h, 0);
      const rend   = clkH > 0 ? doneH/clkH*100 : null;
      const tagH   = Object.values(report.byEmail||{}).reduce((s,u)=>s+(u[`s${sn}_tagged_h`]||0), 0);
      const cov    = clkH > 0 ? tagH/clkH*100 : null;
      const hasD   = clkH > 0 || doneH > 0;
      rows += `| ${label} | ${hasD?totalH.toFixed(0)+' h':'—'} | ${hasD?doneH.toFixed(0)+' h':'—'} | ${clkH>0?clkH.toFixed(0)+' h':'—'} | ${rend!=null?rend.toFixed(1)+' %':'—'} | ${cov!=null?cov.toFixed(1)+' %':'—'} |\n`;
    });
    return [
      `## 3. Tabla de Velocidad por Sprint — Horas`, ``,
      `> Datos exportados de NexUS Backlog — ${new Date().toLocaleDateString('es-ES')}.`, ``,
      `| Sprint | H. Estimadas Totales | H. Estimadas Done | H. Clockify | Rendimiento | % Cobertura Etiquetado |`,
      `|--------|---------------------|-------------------|-------------|-------------|------------------------|`,
      rows.trimEnd(), ``,
      `> **Rendimiento:** \`(H. Estimadas Done / H. Clockify) × 100\``,
    ].join('\n');
  }

  function genRetro() {
    if (!report || sprint <= 0) return '> Selecciona Sprint 1, 2 o 3 para exportar las métricas de retrospectiva.';
    const spTasks   = Object.values(BACKLOG_MAP).filter(t => t.sprint === sprint);
    const doneTasks = spTasks.filter(t => t.status === 'Done');
    const totalEstH = spTasks.reduce((s,t) => s+(t.estimated_h||0), 0);
    const doneEstH  = doneTasks.reduce((s,t) => s+(t.estimated_h||0), 0);
    const proj      = 's' + sprint;
    const clkH      = Object.values(report.dailyHoursByProject?.[proj]||{}).reduce((s,h)=>s+h, 0);
    const taggedH   = Object.values(report.byEmail||{}).reduce((s,u)=>s+(u[`s${sprint}_tagged_h`]||0), 0);
    const rend      = clkH > 0 ? doneEstH/clkH*100 : 0;
    const cov       = clkH > 0 ? taggedH/clkH*100 : 0;
    let teamRows = '';
    ['A','B','C','D'].forEach(team => {
      const members = TEAM_MEMBERS.filter(m => m.team === team);
      const tClk = members.reduce((s,m) => {
        const em = report.byEmail[m.email?.toLowerCase()] || {};
        return s + (em[`s${sprint}_h`]||0);
      }, 0);
      const tDoneH = Object.values(BACKLOG_MAP)
        .filter(t => t.sprint===sprint && t.equipo===`Equipo ${team}` && t.status==='Done')
        .reduce((s,t) => s+(t.estimated_h||0), 0);
      const tTotal = Object.values(BACKLOG_MAP).filter(t => t.sprint===sprint && t.equipo===`Equipo ${team}`).length;
      const tDone  = Object.values(BACKLOG_MAP).filter(t => t.sprint===sprint && t.equipo===`Equipo ${team}` && t.status==='Done').length;
      const tRend  = tClk > 0 ? tDoneH/tClk*100 : null;
      const tPct   = tTotal > 0 ? tDone/tTotal*100 : null;
      teamRows += `| Equipo ${team} | ${tClk.toFixed(0)} h | ${tDoneH.toFixed(0)} h | ${tRend!=null?tRend.toFixed(1)+' %':'—'} | ${tPct!=null?tPct.toFixed(0)+'%':'—'} (${tDone}/${tTotal}) |\n`;
    });
    return [
      `## 1. Métricas del Sprint ${sprint}`, ``,
      `> Datos exportados de NexUS Backlog — ${new Date().toLocaleDateString('es-ES')}.`, ``,
      `### Tareas`, ``,
      `| Métrica | Valor |`, `|---------|-------|`,
      `| Tareas planificadas | ${spTasks.length} |`,
      `| Tareas completadas (Done) | ${doneTasks.length} |`,
      `| Tareas pendientes | ${spTasks.length - doneTasks.length} |`,
      `| % Completitud tareas | ${spTasks.length > 0 ? (doneTasks.length/spTasks.length*100).toFixed(1) : '—'} % |`, ``,
      `### Horas (Clockify)`, ``,
      `| Métrica | Valor |`, `|---------|-------|`,
      `| H. estimadas totales del sprint | ${totalEstH.toFixed(0)} h |`,
      `| H. estimadas de tareas Done | ${doneEstH.toFixed(0)} h |`,
      `| H. registradas en Clockify | ${clkH.toFixed(0)} h |`,
      `| H. pendientes estimadas | ${(totalEstH-doneEstH).toFixed(0)} h |`,
      `| % Consumo (Clockify / Estimadas) | ${totalEstH > 0 ? (clkH/totalEstH*100).toFixed(1) : '—'} % |`,
      `| Rendimiento (h Done / h Clockify) | ${rend.toFixed(1)} % |`,
      `| % Cobertura etiquetado Clockify | ${cov.toFixed(1)} % |`, ``,
      `### Por Equipo`, ``,
      `| Equipo | H. Clockify | H. Done est. | Rendimiento | % Tareas Done |`,
      `|--------|-------------|--------------|-------------|---------------|`,
      teamRows.trimEnd(),
    ].join('\n');
  }

  function genDedication() {
    if (!report || sprint <= 0)
      return '> Selecciona Sprint 1, 2 o 3 para exportar el Dedication Template.';

    const spTasks = Object.values(BACKLOG_MAP).filter(t => t.sprint === sprint);
    const spInfo  = SC[sprint];
    const today   = new Date().toLocaleDateString('es-ES');

    // Per-person hours: split task effort among all participants
    // direct assignees share the task equally; implied (no assignee) split across team
    const personH = (t, ll2) => {
      const ass = t.assignees || [];
      const eqL = EQUIPO_LOGINS[t.equipo] || [];
      const directlyAssigned = ass.some(a => a.login.toLowerCase() === ll2);
      const impliedByEquipo  = ass.length === 0 && eqL.includes(ll2);
      if (!directlyAssigned && !impliedByEquipo) return 0;
      const base = t.estimated_h || 0;
      return directlyAssigned
        ? base / (ass.length || 1)     // share among direct assignees
        : base / (eqL.length || 1);    // share across implied team
    };

    const memberData = TEAM_MEMBERS.map(m => {
      const ll   = m.email?.toLowerCase();
      const ue   = report.byEmail?.[ll] || {};
      const clkH = ue[`s${sprint}_h`] || 0;
      const ll2  = m.login.toLowerCase();
      const myTasks = spTasks.filter(t => {
        const ass = t.assignees || [];
        const eqL = EQUIPO_LOGINS[t.equipo] || [];
        return ass.some(a => a.login.toLowerCase() === ll2) ||
               (ass.length === 0 && eqL.includes(ll2));
      });
      const doneTasks = myTasks.filter(t => t.status === 'Done');
      const planH     = myTasks.reduce((s, t) => s + personH(t, ll2), 0);
      const doneH     = doneTasks.reduce((s, t) => s + personH(t, ll2), 0);
      const pctDone   = myTasks.length > 0 ? doneTasks.length / myTasks.length * 100 : 0;
      const rend      = clkH > 0 ? doneH / clkH * 100 : 0;
      const desv      = doneH - clkH;
      return { m, clkH, myTasks, doneTasks, planH, doneH, pctDone, rend, desv };
    });

    const active  = memberData.filter(d => d.clkH > 0 || d.myTasks.length > 0);
    const withClk = active.filter(d => d.clkH > 0);
    const avgDone = active.length  ? active.reduce((s, d) => s + d.pctDone, 0) / active.length : 0;
    const avgRend = withClk.length ? withClk.reduce((s, d) => s + d.rend, 0) / withClk.length  : 0;

    const estHArr   = memberData.map(d => d.planH).filter(h => h > 0);
    const avgEstH   = estHArr.length ? estHArr.reduce((s, h) => s + h, 0) / estHArr.length : 0;
    const sigmaEstH = estHArr.length >= 2
      ? Math.sqrt(estHArr.reduce((s, h) => s + (h - avgEstH) ** 2, 0) / estHArr.length) : 0;
    const cvEstH    = avgEstH > 0 ? sigmaEstH / avgEstH * 100 : 0;

    const sigmaDone = active.length >= 2
      ? Math.sqrt(active.reduce((s, d) => s + (d.pctDone - avgDone) ** 2, 0) / active.length) : 0;

    // Pearson correlation: pctDone vs pctHours (same variables as UsersView)
    const corrSample = active.filter(d => d.myTasks.length > 0 && d.clkH > 0);
    const xs = corrSample.map(d => d.pctDone);
    const ys = corrSample.map(d => Math.min(d.doneH / d.clkH * 100, 200)); // rendimiento capped
    const nc = corrSample.length;
    const mx = nc ? xs.reduce((s, v) => s + v, 0) / nc : 0;
    const my = nc ? ys.reduce((s, v) => s + v, 0) / nc : 0;
    const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
    const corr = den > 0 ? num / den : 0;

    const cvInterp   = cvEstH <= 20 ? 'Distribución equilibrada de carga'
      : cvEstH <= 35 ? '⚠️ Desequilibrio en el reparto de tareas'
      : '❌ Desequilibrio severo — revisar asignación';
    const rendInterp = avgRend >= 150 ? 'Alta eficiencia técnica del equipo'
      : avgRend >= 100 ? 'Rendimiento dentro de lo esperado'
      : 'Rendimiento bajo — revisar estimaciones';
    const corrInterp = Math.abs(corr) >= 0.7 ? 'Relación lógica entre esfuerzo y resultado'
      : Math.abs(corr) >= 0.4 ? 'Correlación moderada entre tareas y horas'
      : 'Baja correlación tareas–horas';

    const TEAM_NAMES = { A:'Infraestructura y coordinación', B:'Producto y gestión', C:'Desarrollo e incidencias', D:'Backend e IA' };
    const teamSections = ['A','B','C','D'].flatMap(team => {
      const rows = active.filter(d => d.m.team === team);
      if (!rows.length) return [];
      const tr   = rows.filter(d => d.clkH > 0);
      const tavg = tr.length ? tr.reduce((s, d) => s + d.rend, 0) / tr.length : 0;
      const top  = [...rows].sort((a, b) => b.myTasks.length - a.myTasks.length)[0];
      const estado = tavg >= 150 ? 'Alta eficiencia. Han superado ampliamente las estimaciones.'
        : tavg >= 100 ? 'Rendimiento dentro de lo esperado. Progreso estable.'
        : 'Por debajo del rendimiento esperado. Revisar posibles bloqueos.';
      return [
        `### **Equipo ${team} — ${TEAM_NAMES[team]}**`,
        `* **Rendimiento:** ~${Math.round(tavg / 5) * 5}% (Media).`,
        `* **Estado:** ${estado}`,
        `* **Carga:** ${top ? `${top.m.name} lidera con ${top.myTasks.length} tareas asignadas.` : '—'}`,
        ``,
      ];
    });

    const tableRows = ['A','B','C','D'].flatMap(team =>
      active.filter(d => d.m.team === team).map(({ m, clkH, myTasks, doneTasks, pctDone, rend, desv }) =>
        `| **${team}** | ${m.name} | ${doneTasks.length}/${myTasks.length} | ${pctDone.toFixed(0)}% | ${clkH > 0 ? clkH.toFixed(1)+'h' : '—'} | ${clkH > 0 ? rend.toFixed(0)+'%' : '—'} | ${clkH > 0 ? (desv >= 0 ? '+' : '')+desv.toFixed(0)+'h' : '—'} |`
      )
    ).join('\n');

    const nextSp  = sprint < 3 ? ` para el Sprint ${sprint + 1}` : '';
    const lowPerf = active.filter(d => d.clkH > 0 && d.rend < 80);

    return [
      `# Informe de rendimiento y métricas final — Sprint ${sprint} – NexUS`, ``,
      `<p align="center">`,
      `  <img src="../../images/logo-app.png" alt="Logo NexUS" width="500">`,
      `</p>`, ``,
      `<div align="center">`, ``,
      `<p>`,
      `  <img src="https://img.shields.io/badge/Versión-1.0.0-blue?style=flat-square" alt="Versión">`,
      `  <img src="https://img.shields.io/badge/Estado-Finalizado-green?style=flat-square" alt="Estado">`,
      `  <img src="https://img.shields.io/badge/Grupo-7--NexUS-green?style=flat-square" alt="Grupo">`,
      `  <img src="https://img.shields.io/badge/Asignatura-ISPP-red?style=flat-square" alt="Asignatura">`,
      `</p>`, ``,
      `</div>`, ``,
      `---`, ``,
      `**Proyecto:** NexUS  `,
      `**Grupo:** 7 - NexUS  `,
      `**Asignatura:** Ingeniería del Software y Práctica Profesional (ISPP)  `,
      `**Institución:** ETSII – Universidad de Sevilla  `,
      `**Curso académico:** 2025/2026  `,
      `**Sprint:** S${sprint} — ${fFull(spInfo?.start)} al ${fFull(spInfo?.end)}  `, ``,
      `<p align="center">`,
      `  <img src="../../images/logo-etsii.jpe" alt="Logo ETSII" width="400">`,
      `</p>`, ``,
      `---`, ``,
      `## Historial de versiones`, ``,
      `| Versión | Fecha | Cambio principal |`,
      `|---------|-------|------------------|`,
      `| 1.0.0 | ${today} | Creación del documento |`, ``,
      `---`, ``,
      `| Métrica Global | Valor | Interpretación |`,
      `| :--- | :---: | :--- |`,
      `| **Media completitud tareas** | **${avgDone.toFixed(1)}%** | ${avgDone >= 70 ? 'Progreso sólido (0 tareas sin avance)' : avgDone >= 50 ? 'Progreso moderado' : 'Progreso bajo — revisar bloqueos'} |`,
      `| **Rendimiento medio** | **${avgRend.toFixed(1)}%** | ${rendInterp} |`,
      `| **Desbalance de carga (CV)** | **${cvEstH.toFixed(0)}%** | ${cvInterp} |`,
      `| **Equilibrio del equipo (σ)** | **${sigmaDone.toFixed(1)}%** | ${sigmaDone <= 15 ? 'Ritmo de entrega sincronizado' : 'Alta dispersión en el ritmo de entrega'} |`,
      `| **Correlación tareas ↔ horas** | **${corr.toFixed(2)}** | ${corrInterp} |`, ``,
      `---`, ``,
      `## 1. Análisis por células de trabajo`, ``,
      ...teamSections,
      `---`, ``,
      `## 2. Registro detallado de rendimiento (${active.length} Integrantes)`, ``,
      `| Equipo | Usuario | Tareas (D/Total) | % Done | Horas Real | Rendimiento | Desviación |`,
      `| :--- | :--- | :---: | :---: | :---: | :---: | :---: |`,
      tableRows, ``,
      `---`, ``,
      `## 3. Conclusiones y Plan de Acción${nextSp}`, ``,
      `1.  **Redistribución de carga:** El **CV del ${cvEstH.toFixed(0)}%** ${cvEstH > 30 ? 'confirma un desequilibrio. Se debe nivelar la carga en el siguiente Sprint Planning.' : 'muestra una distribución aceptable. Mantener el criterio de asignación actual.'}`,
      `2.  **Gestión de cuellos de botella:** Revisar tareas en *In Review* y priorizarlas antes de iniciar nuevas funcionalidades para evitar acumulación de deuda técnica.`,
      `3.  **Ajuste de velocidad:** Con un rendimiento medio del **${avgRend.toFixed(1)}%**, ${avgRend > 130 ? 'el equipo ha demostrado mayor eficiencia que lo estimado. Se propone aumentar el compromiso del Backlog en el siguiente sprint en un **15%**.' : 'las estimaciones se ajustan bien a la velocidad real. Mantener la cadencia actual.'}`,
      `4.  **Optimización individual:** ${lowPerf.length > 0 ? `${lowPerf.length} miembro(s) con rendimiento por debajo del 80% (${lowPerf.map(d => d.m.name.split(' ')[0]).join(', ')}). Revisar posibles bloqueos.` : 'Todos los miembros mantienen un rendimiento aceptable.'}`, ``,
      `---`,
      `*Este informe ha sido generado automáticamente integrando datos de Clockify y el estado del Backlog en GitHub al cierre del ${fFull(spInfo?.end) !== '—' ? fFull(spInfo?.end) : today}.*`,
    ].join('\n');
  }

  const spLabel = sprint > 0 ? sprint : 'X';
  const docs = [
    { id:'burndown',   label:'📈 Burndown §4–5',     file:`7-DP-S${spLabel}-Burndown-Chart.md`,      gen:genBurndown   },
    { id:'velocity',   label:'⚡ Velocity §3',         file:`7-DP-S1-Velocity-Chart.md`,               gen:genVelocity   },
    { id:'retro',      label:'🔄 Retro §1',            file:`7-DP-S${spLabel}-Retrospectiva.md`,       gen:genRetro      },
    { id:'dedication', label:'🏅 Dedication Template', file:`7-DP-S${spLabel}-Dedication-Template.md`, gen:genDedication },
  ];
  const active  = docs.find(d => d.id === docType);
  const content = active.gen();

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  function handleDownload() {
    const blob = new Blob([content], { type:'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = active.file; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"#000000bb", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"var(--bg3)", border:"1px solid var(--bdr2)", borderRadius:12, padding:24, width:700, maxWidth:"95vw", maxHeight:"90vh", display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight:700, fontSize:14, color:"var(--tx0)" }}>📄 Exportar Markdown con datos reales</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--tx3)", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {docs.map(d => (
            <button key={d.id} onClick={() => setDocType(d.id)}
              style={{ padding:"5px 12px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                background: docType===d.id ? "#10b98120" : "transparent",
                border:     docType===d.id ? "1px solid #10b98145" : "1px solid var(--bdr)",
                color:      docType===d.id ? "#10b981" : "var(--tx3)" }}>
              {d.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize:10, color:"var(--tx4)" }}>
          Archivo: <code style={{ background:"var(--bg0)", padding:"1px 5px", borderRadius:3, color:"#818cf8" }}>{active.file}</code>
          {' — '}Descarga la sección generada y reemplázala en tu repositorio, o cópiala directamente.
        </div>
        <pre style={{ flex:1, overflowY:"auto", background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:8, padding:14, fontSize:11, color:"var(--tx0)", margin:0, whiteSpace:"pre-wrap", fontFamily:"'Fira Code','Consolas','Courier New',monospace", lineHeight:1.5, maxHeight:"45vh" }}>
          {content}
        </pre>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleCopy}
            style={{ flex:1, padding:"8px", borderRadius:6, fontWeight:700, fontSize:12, cursor:"pointer",
              background: copied ? "#22c55e20" : "#6366f115",
              border:     copied ? "1px solid #22c55e55" : "1px solid #6366f140",
              color:      copied ? "#22c55e" : "#818cf8" }}>
            {copied ? "✓ Copiado!" : "📋 Copiar sección"}
          </button>
          <button onClick={handleDownload}
            style={{ flex:1, padding:"8px", borderRadius:6, fontWeight:700, fontSize:12, cursor:"pointer",
              background:"#34d39915", border:"1px solid #34d39940", color:"#34d399" }}>
            💾 Descargar {active.file}
          </button>
        </div>
      </div>
    </div>
  );
}

// saveClockify, loadClockify moved to lib/cache.js

export default function InformePane() {
  // Lazy-init: localStorage > DEFAULT_CLOCKIFY > vacío (runs once per mount)
  const [[initReport, initFileName, initStatus]] = useState(() => {
    const s = loadClockify();
    if (s) {
      const d = new Date(s.t).toLocaleDateString("es-ES", { day:"2-digit", month:"2-digit", year:"2-digit" });
      return [s.r, `${s.f}  ·  ${d}`, "ok"];
    }
    if (DEFAULT_CLOCKIFY) return [
      DEFAULT_CLOCKIFY,
      `${DEFAULT_CLOCKIFY.sourceFile || "clockify-entries.json"}  ·  ${new Date(DEFAULT_CLOCKIFY.fetchedAt).toLocaleDateString("es-ES")}`,
      "ok"
    ];
    return [null, "", "idle"];
  });

  const [drag,     setDrag]     = useState(false);
  const [status,   setStatus]   = useState(initStatus);
  const [errMsg,   setErrMsg]   = useState("");
  const [report,   setReport]   = useState(initReport);
  const [fileName, setFileName] = useState(initFileName);
  const [view,     setView]     = useState("equipo"); // open on team tab by default
  const [sprint,   setSprint]   = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null); // login string, drives persona tab

  const sprintC = { 1:"#818cf8", 2:"#34d399", 3:"#fbbf24" };

  function processFile(file) {
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setErrMsg("El archivo debe ser un CSV exportado desde Clockify."); setStatus("error"); return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const entries = parseClockifyCSV(e.target.result);
        if (!entries.length) throw new Error("No se encontraron entradas de tiempo en el CSV. Asegúrate de exportar el informe Detallado.");
        const rpt = buildReport(entries);
        const matched = entries.filter(e => e.taskId).length;
        rpt.totalEntries = entries.length;
        rpt.matchedEntries = matched;
        setReport(rpt);
        setStatus("ok");
        setErrMsg("");
        saveClockify(rpt, file.name);
      } catch(ex) {
        setErrMsg(ex.message); setStatus("error");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function onDrop(e) {
    e.preventDefault(); setDrag(false);
    processFile(e.dataTransfer.files[0]);
  }

  const filtered = (rpt) => Object.entries(rpt.byTask)
    .filter(([,t]) => sprint === 0 || t.sprint === sprint)
    .sort((a,b) => a[1].sprint - b[1].sprint || a[0].localeCompare(b[0]));

  // ── Sub-views ──────────────────────────────────────────────
  function KpiRow() {
    if (sprint === -1) {
      // Sprint 0 (DP): no hay tareas en backlog, mostrar horas del proyecto "dp"
      const dpUsers   = Object.values(report.byEmail || {});
      const totalDp   = dpUsers.reduce((s, e) => s + (e.dp_h || 0), 0);
      const activeDp  = dpUsers.filter(e => (e.dp_h || 0) > 0).length;
      return (
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
          <InfStatCard label="Entradas CSV"    value={report.totalEntries}  sub={`${report.matchedEntries} con tarea identificada`} color="#10b981" />
          <InfStatCard label="S0 — DP horas"  value={`${totalDp.toFixed(1)}h`} sub="Devising a Project"        color="#6366f1" />
          <InfStatCard label="Personas activas" value={`${activeDp}`}       sub="con horas S0 registradas"     color="#e879f9" />
          <InfStatCard label="Estado S0"       value="✓ Completado"         sub="Sprint 0 finalizado"           color="#22c55e" />
        </div>
      );
    }
    const tasks   = filtered(report).map(([,t])=>t);
    const totalEst  = tasks.reduce((s,t)=>s+t.estimated_h, 0);
    const totalReal = tasks.reduce((s,t)=>s+t.real_h, 0);
    const active    = tasks.filter(t=>t.real_h>0).length;
    const alerts    = tasks.filter(t=>t.estimated_h>0 && t.real_h/t.estimated_h>=0.8).length;
    const pct       = totalEst ? totalReal/totalEst*100 : 0;
    return (
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
        <InfStatCard label="Entradas CSV"    value={report.totalEntries}             sub={`${report.matchedEntries} con tarea identificada`} color="#10b981" />
        <InfStatCard label="H. estimadas"   value={`${totalEst}h`}                  sub="según backlog"          color="#818cf8" />
        <InfStatCard label="H. registradas" value={`${totalReal.toFixed(1)}h`}       sub={`${active} tareas activas`} color="#34d399" />
        <InfStatCard label="% completado"   value={`${pct.toFixed(1)}%`}             sub="horas reales / estimadas" color={pct>=100?"#ef4444":pct>=80?"#f59e0b":"#22c55e"} />
        <InfStatCard label="En alerta"      value={alerts}                           sub="≥80% del estimado"      color="#f43f5e" />
        <InfStatCard label="Personas"       value={Object.keys(report.byUser).length} sub="con tiempo registrado"  color="#e879f9" />
      </div>
    );
  }

  function TasksView() {
    if (sprint === -1) return (
      <div style={{ padding:"32px 20px", textAlign:"center" }}>
        <div style={{ fontSize:28, marginBottom:10 }}>✓</div>
        <div style={{ color:"#22c55e", fontWeight:700, fontSize:14, marginBottom:6 }}>Sprint 0 — Devising a Project completado</div>
        <div style={{ color:"var(--tx3)", fontSize:12, marginBottom:10 }}>
          El Sprint 0 (DP) registra horas por proyecto "dp" en Clockify,<br/>no por tareas individuales del backlog.
        </div>
        <div style={{ color:"var(--tx4)", fontSize:11 }}>
          Consulta la pestaña <span style={{ color:"#10b981", fontWeight:700 }}>Equipo</span> para ver el desglose de horas por persona.
        </div>
      </div>
    );
    // Map Clockify display name (lowercase) → TEAM_MEMBERS entry for team-mismatch check
    const nameToMember = Object.fromEntries(
      TEAM_MEMBERS.map(m => [m.name.toLowerCase().trim(), m])
    );
    // GitHub status → colored emoji matching STATUS_META colors
    const STATUS_EMOJI = {
      "Backlog":     "⚫",
      "Ready":       "🔵",
      "In progress": "🟢",
      "In review":   "🟣",
      "Done":        "✅",
    };

    // Pre-compute warnings per task (reused in both metrics and table rows)
    const tasksWithWarns = filtered(report).map(([tid, t]) => {
      const taskTeamLetter = t.equipo?.match(/Equipo\s+([ABCD])$/i)?.[1]?.toUpperCase() || null;
      const warns = [];
      if (!t.estimated_h) warns.push({ icon:"📐", tip:"Sin estimación asignada" });
      if (t.real_h === 0)  warns.push({ icon:"⏱️", tip:"Sin horas registradas en Clockify" });
      if (taskTeamLetter) {
        Object.keys(t.byUser).forEach(userName => {
          const member = nameToMember[userName.toLowerCase().trim()];
          if (member && member.team !== taskTeamLetter) {
            warns.push({ icon:"👥", tip:`${userName} (Equipo ${member.team}) registra horas en tarea del ${t.equipo}` });
          }
        });
      }
      return { tid, t, warns };
    });

    // Tasks with zero warnings → estimation quality input
    const validTasks = tasksWithWarns.filter(({ warns }) => warns.length === 0).map(({ t }) => t);

    // ── Estimation quality metrics block ──────────────────────
    const metricsBlock = (() => {
      if (!validTasks.length) return null;
      const n       = validTasks.length;
      const sumEst  = validTasks.reduce((s, t) => s + t.estimated_h, 0);
      const sumReal = validTasks.reduce((s, t) => s + t.real_h, 0);
      // Ratio: real / estimated — ideal = 1.0
      const ratio   = sumReal / sumEst;
      // MAPE: mean absolute percentage error — lower is better
      const mape    = validTasks.reduce((s, t) => s + Math.abs(t.real_h - t.estimated_h) / t.estimated_h, 0) / n * 100;
      // MAE: mean absolute error in hours
      const mae     = validTasks.reduce((s, t) => s + Math.abs(t.real_h - t.estimated_h), 0) / n;
      // Precision: % of tasks where real ∈ [50%, 150%] of estimated
      const within50 = validTasks.filter(t => { const r = t.real_h / t.estimated_h; return r >= 0.5 && r <= 1.5; }).length / n * 100;

      const ratioColor  = ratio >= 0.7 && ratio <= 1.3 ? "#22c55e" : ratio >= 0.5 && ratio <= 1.5 ? "#f59e0b" : "#ef4444";
      const mapeColor   = mape  <= 25 ? "#22c55e" : mape  <= 50 ? "#f59e0b" : "#ef4444";
      const precColor   = within50 >= 70 ? "#22c55e" : within50 >= 50 ? "#f59e0b" : "#ef4444";
      const tendencia   = ratio <= 1 ? "sobreestima" : "infraestima";

      return (
        <div style={{ background:"var(--bg1)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ color:"var(--tx4)", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>
            📏 Calidad de estimaciones — {n} tarea{n !== 1 ? "s" : ""} evaluadas (sin advertencias)
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            <InfStatCard
              label="Consumo real/est"
              value={`${(ratio * 100).toFixed(0)}%`}
              sub={`Tiende a ${tendencia} · ideal 100%`}
              color={ratioColor}
            />
            <InfStatCard
              label="Error relativo (MAPE)"
              value={`${mape.toFixed(1)}%`}
              sub={mape <= 25 ? "Buena precisión" : mape <= 50 ? "Precisión aceptable" : "Revisar estimaciones"}
              color={mapeColor}
            />
            <InfStatCard
              label="Error absoluto (MAE)"
              value={`${mae.toFixed(1)}h`}
              sub="Desviación media por tarea"
              color="#818cf8"
            />
            <InfStatCard
              label="Precisión ±50%"
              value={`${within50.toFixed(0)}%`}
              sub={`${validTasks.filter(t=>{ const r=t.real_h/t.estimated_h; return r>=0.5&&r<=1.5; }).length} de ${n} tareas en margen`}
              color={precColor}
            />
          </div>
        </div>
      );
    })();

    const thS = { padding:"8px 10px", textAlign:"left", color:"var(--tx3)", fontWeight:700, whiteSpace:"nowrap", borderBottom:"1px solid var(--bdr)" };
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {metricsBlock}
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ background:"var(--bg3)" }}>
                <th style={thS}>ID</th>
                <th style={thS}>Sp</th>
                <th style={thS}>Módulo</th>
                <th style={thS}>Tarea</th>
                <th style={thS}>Asignados</th>
                <th style={thS}>Equipo</th>
                <th style={thS}>Talla</th>
                <th style={{ ...thS, textAlign:"right" }}>Est.</th>
                <th style={{ ...thS, textAlign:"right" }}>Real</th>
                <th style={{ ...thS, textAlign:"right" }}>Dif.</th>
                <th style={thS}>% Uso</th>
                <th style={{ ...thS, textAlign:"center" }}>Estado</th>
                <th style={thS}>⚠️</th>
              </tr>
            </thead>
            <tbody>
              {tasksWithWarns.map(({ tid, t, warns }, i) => {
                const pct  = t.estimated_h ? t.real_h / t.estimated_h * 100 : 0;
                const diff = t.real_h - t.estimated_h;
                const sc   = sprintC[t.sprint] || "var(--tx4)";
                return (
                  <tr key={tid} style={{ background:i%2===0?"var(--bg0)":"var(--bg2)" }}>
                    <td style={{ padding:"7px 10px", color:sc, fontWeight:700, whiteSpace:"nowrap" }}>{tid}</td>
                    <td style={{ padding:"7px 10px", textAlign:"center" }}>
                      <span style={{ background:`${sc}20`, color:sc, padding:"2px 6px", borderRadius:4, fontSize:10, fontWeight:700 }}>S{t.sprint}</span>
                    </td>
                    <td style={{ padding:"7px 10px", color:"var(--tx2)", whiteSpace:"nowrap", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis" }}>{t.area}</td>
                    <td style={{ padding:"7px 10px", color:"var(--tx0)", maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={t.title}>{t.title}</td>
                    <td style={{ padding:"7px 10px" }}>
                      <div style={{ display:"flex", gap:2, alignItems:"center" }}>
                        {(t.assignees||[]).map(a => (
                          <img key={a.login} src={a.avatarUrl} title={a.login}
                            style={{ width:18, height:18, borderRadius:"50%", border:"1px solid var(--bdr2)", flexShrink:0 }} />
                        ))}
                      </div>
                    </td>
                    <td style={{ padding:"7px 10px", whiteSpace:"nowrap" }}>
                      {t.equipo
                        ? <span style={{ background:"#ffffff08", border:"1px solid var(--bdr2)", borderRadius:4, padding:"1px 7px", color:"var(--tx2)", fontSize:10 }}>{t.equipo}</span>
                        : null}
                    </td>
                    <td style={{ padding:"7px 10px", textAlign:"center", color:"var(--tx3)" }}>{t.size}</td>
                    <td style={{ padding:"7px 10px", textAlign:"right", color:"var(--tx3)" }}>
                      {t.area === "Asistencia" && t.size && EQUIPO_LOGINS[t.equipo] ? (
                        <span title={`${SIZE_H_INF[t.size]}h × ${EQUIPO_LOGINS[t.equipo].length} miembros`} style={{ cursor:"help" }}>
                          {t.estimated_h}h
                        </span>
                      ) : `${t.estimated_h}h`}
                    </td>
                    <td style={{ padding:"7px 10px", textAlign:"right", color:t.real_h>0?"var(--tx0)":"var(--bdr2)" }}>{t.real_h.toFixed(1)}h</td>
                    <td style={{ padding:"7px 10px", textAlign:"right", color:diff>0?"#ef4444":diff<0?"#22c55e":"var(--tx4)", fontWeight:Math.abs(diff)>0?700:400 }}>{diff>0?"+":""}{diff.toFixed(1)}h</td>
                    <td style={{ padding:"7px 10px", minWidth:80 }}>
                      <div style={{ background:"var(--bdr)", borderRadius:4, height:6, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:pct>=100?"#ef4444":pct>=80?"#f59e0b":"#22c55e" }} />
                      </div>
                      <div style={{ color:"var(--tx3)", fontSize:10, textAlign:"right", marginTop:2 }}>{pct.toFixed(0)}%</div>
                    </td>
                    <td style={{ padding:"7px 8px", textAlign:"center", fontSize:15 }} title={t.status||"Backlog"}>
                      {STATUS_EMOJI[t.status] || "⬛"}
                    </td>
                    <td style={{ padding:"7px 8px" }}>
                      <div style={{ display:"flex", gap:3, flexWrap:"wrap", alignItems:"center" }}>
                        {warns.map((w, wi) => (
                          <span key={wi} title={w.tip} style={{ cursor:"help", fontSize:13, lineHeight:1 }}>{w.icon}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function UsersView() {
    const STATUSES   = ["Backlog","Ready","In progress","In review","Done"];
    const TEAM_COLOR = { A:"#3b82f6", B:"#22c55e", C:"#f59e0b", D:"#a855f7" };

    // GitHub stats — PRs sprint-filtradas + reviews (hard to manipulate: peer-validated)
    const ghStats = (() => { try { const r = localStorage.getItem(GH_STATS_KEY); return r ? JSON.parse(r) : null; } catch(_) { return null; } })();
    const S1_WPR_IDX = [22, 23, 24, 25]; // weeklyPRs indices → semanas 2026-02-15..2026-03-08
    const ghCombinedByLogin = Object.fromEntries(
      TEAM_MEMBERS.map(m => {
        const ll = m.login.toLowerCase();
        const wpr = ghStats?.weeklyPRs?.[ll] || [];
        const totalMerged = ghStats?.prs?.[ll]?.merged || 0;
        const s1Prs = S1_WPR_IDX.reduce((s, i) => s + (wpr[i] || 0), 0);
        const sprintPrs = sprint === 1 ? s1Prs
          : sprint === 2 ? Math.max(0, totalMerged - s1Prs)
          : sprint === 0 ? totalMerged : 0;
        const reviews = ghStats?.reviews?.[ll] || 0;
        return [ll, sprintPrs + reviews];
      })
    );
    const ghValues = Object.values(ghCombinedByLogin);
    const meanGhCombined = ghValues.length ? ghValues.reduce((s, v) => s + v, 0) / ghValues.length : 1;

    // Tasks in scope for this sprint filter
    const relevantTasks = sprint === -1
      ? []
      : Object.values(BACKLOG_MAP).filter(t => sprint === 0 || t.sprint === sprint);

    // Per-member stats
    const memberStats = TEAM_MEMBERS.map(member => {
      const loginLower = member.login.toLowerCase();
      const ue = report.byEmail[member.email?.toLowerCase()] || {};
      let totalH = 0, taggedH = 0;
      if (sprint === -1) {
        totalH  = ue.dp_h || 0;
        taggedH = 0;
      } else if (sprint === 0) {
        totalH  = (ue.dp_h||0) + (ue.s1_h||0) + (ue.s2_h||0) + (ue.s3_h||0);
        taggedH = (ue.s1_tagged_h||0) + (ue.s2_tagged_h||0) + (ue.s3_tagged_h||0);
      } else {
        totalH  = ue[`s${sprint}_h`]        || 0;
        taggedH = ue[`s${sprint}_tagged_h`] || 0;
      }
      const TALLA_PTS = { XS:1, S:2, M:3, L:5, XL:8 };
      const statusCounts = Object.fromEntries(STATUSES.map(s => [s, 0]));
      let estimatedH = 0, doneEstimatedH = 0, totalPts = 0, effPts = 0;
      relevantTasks.forEach(t => {
        const assignees = t.assignees || [];
        // Direct assignee, OR (no assignees + person belongs to task's equipo group)
        const directlyAssigned = assignees.some(a => a.login.toLowerCase() === loginLower);
        const equipoLogins     = EQUIPO_LOGINS[t.equipo] || [];
        const impliedByEquipo  = assignees.length === 0 && equipoLogins.includes(loginLower);
        if (directlyAssigned || impliedByEquipo) {
          statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
          const n = directlyAssigned ? (assignees.length || 1) : (equipoLogins.length || 1);
          const perPersonH = (t.estimated_h || 0) / n;
          // Story points repartidos entre asignados
          const perPersonPts = (TALLA_PTS[t.size] || 1) / n;
          estimatedH    += perPersonH;
          if (t.status === "Done") doneEstimatedH += perPersonH;
          totalPts      += perPersonPts;
          // Crédito parcial por estado: Done×1, In review×0.8, In progress×0.2
          const w = t.status === "Done" ? 1 : t.status === "In review" ? 0.8 : t.status === "In progress" ? 0.2 : 0;
          effPts += perPersonPts * w;
        }
      });
      const totalTasks  = STATUSES.reduce((s, st) => s + statusCounts[st], 0);
      const doneCount   = statusCounts["Done"];
      const pctTasks    = totalTasks > 0 ? doneCount / totalTasks * 100   : null;
      const pctHours    = estimatedH > 0 ? totalH / estimatedH * 100      : null;
      const pctTagged   = totalH > 0     ? taggedH / totalH * 100         : null;
      // Rendimiento = 0.30×CR + 0.70×EF
      // CR = pts_efectivos / pts_totales (ponderado por talla, con crédito parcial por estado)
      // EF asimétrico suave: sobreimputar penaliza 1.5× más que infraimputar (0.5×)
      const cr       = totalPts > 0 ? effPts / totalPts : null;
      const dev      = estimatedH > 0 ? (taggedH - estimatedH) / estimatedH : 0;
      const ef       = estimatedH > 0 ? (dev > 0 ? 1 / (1 + 1.5 * dev) : 1 / (1 + 0.5 * Math.abs(dev))) : null;
      const ghCombined = ghCombinedByLogin[loginLower] || 0;
      const ghNorm   = meanGhCombined > 0 ? ghCombined / meanGhCombined : 0;
      // 0.25×CR(tallas+crédito parcial) + 0.50×EF(horas etiq. asimétrico) + 0.25×GH(PRs sprint + reviews)
      const rendimiento = cr !== null && ef !== null ? (0.25 * cr + 0.50 * ef + 0.25 * ghNorm) * 100 : null;
      return { member, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalPts, effPts, prMerged: ghCombined, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento };
    });

    // ── Global metrics ────────────────────────────────────────────
    const withTasks = memberStats.filter(ms => ms.totalTasks > 0);
    const withHours = memberStats.filter(ms => ms.estimatedH > 0);
    const avgPctTasks = withTasks.length
      ? withTasks.reduce((s, ms) => s + ms.pctTasks, 0) / withTasks.length : null;
    const avgPctHours = withHours.length
      ? withHours.reduce((s, ms) => s + Math.min(ms.pctHours, 200), 0) / withHours.length : null;
    const fullyDone   = withTasks.filter(ms => ms.pctTasks === 100).length;
    const noProgress  = withTasks.filter(ms => ms.doneCount === 0).length;
    // Equilibrio del equipo: desviación típica de pctTasks (σ bajo = equipo uniforme)
    const sigmaTasks = withTasks.length >= 2 && avgPctTasks !== null
      ? Math.sqrt(withTasks.reduce((s, ms) => s + (ms.pctTasks - avgPctTasks) ** 2, 0) / withTasks.length)
      : null;
    // Rendimiento medio y score normalizado (suma siempre = N×100%)
    const withRendimiento = memberStats.filter(ms => ms.rendimiento !== null);
    const avgRendimiento  = withRendimiento.length
      ? withRendimiento.reduce((s, ms) => s + ms.rendimiento, 0) / withRendimiento.length : null;
    const memberStatsScored = memberStats.map(ms => ({
      ...ms,
      score: ms.rendimiento !== null && avgRendimiento ? ms.rendimiento / avgRendimiento * 100 : null,
    }));
    // Workload balance: CV of estimatedH across all members with tasks
    const avgMemberEstH = withHours.length ? withHours.reduce((s, ms) => s + ms.estimatedH, 0) / withHours.length : null;
    const sigmaMemberEstH = avgMemberEstH && withHours.length >= 2
      ? Math.sqrt(withHours.reduce((s, ms) => s + (ms.estimatedH - avgMemberEstH) ** 2, 0) / withHours.length) : null;
    const cvMemberEstH = sigmaMemberEstH && avgMemberEstH ? sigmaMemberEstH / avgMemberEstH * 100 : null;

    // Pearson correlation between task completion % and hours consumption %
    const bothValid = memberStats.filter(ms => ms.pctTasks !== null && ms.pctHours !== null);
    let correlation = null;
    if (bothValid.length >= 3) {
      const xs = bothValid.map(ms => ms.pctTasks);
      const ys = bothValid.map(ms => Math.min(ms.pctHours, 200));
      const mx = xs.reduce((s,x)=>s+x,0)/xs.length;
      const my = ys.reduce((s,y)=>s+y,0)/ys.length;
      const num = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0);
      const den = Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)*ys.reduce((s,y)=>s+(y-my)**2,0));
      correlation = den > 0 ? num/den : null;
    }

    const globalMetrics = sprint !== -1 && withTasks.length > 0 ? (
      <div style={{ background:"var(--bg1)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px", marginBottom:4 }}>
        <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
          📊 Métricas globales — {withTasks.length} personas con tareas asignadas
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {avgPctTasks !== null && (
            <InfStatCard label="Media completitud tareas"
              value={`${avgPctTasks.toFixed(1)}%`}
              sub={`${fullyDone} al 100% · ${noProgress} sin avance`}
              color={avgPctTasks>=75?"#22c55e":avgPctTasks>=40?"#f59e0b":"#ef4444"} />
          )}
          {avgPctHours !== null && (
            <InfStatCard label="Media consumo estimado"
              value={`${avgPctHours.toFixed(1)}%`}
              sub="horas Clockify / horas estimadas (media)"
              color={avgPctHours>=100?"#ef4444":avgPctHours>=75?"#f59e0b":"#22c55e"} />
          )}
          {sigmaTasks !== null && (
            <InfStatCard label="Equilibrio del equipo"
              value={`σ ${sigmaTasks.toFixed(1)}%`}
              sub={`desv. típica de completitud · ideal σ→0`}
              color={sigmaTasks<=15?"#22c55e":sigmaTasks<=30?"#f59e0b":"#ef4444"} />
          )}
          {avgRendimiento !== null && (
            <InfStatCard label="Rendimiento medio"
              value={`${avgRendimiento.toFixed(1)}%`}
              sub="h estimadas Done / h Clockify · ideal ≥100%"
              color={avgRendimiento>=100?"#22c55e":avgRendimiento>=50?"#f59e0b":"#ef4444"} />
          )}
          {correlation !== null && (
            <InfStatCard label="Correlación tareas↔horas"
              value={correlation.toFixed(2)}
              sub="Pearson: 1=perfecta, 0=sin relación"
              color={Math.abs(correlation)>=0.7?"#22c55e":Math.abs(correlation)>=0.4?"#f59e0b":"var(--tx2)"} />
          )}
          {cvMemberEstH !== null && (
            <InfStatCard label="Desbalance de carga"
              value={`CV ${cvMemberEstH.toFixed(0)}%`}
              sub={`σ ${sigmaMemberEstH.toFixed(0)}h · μ ${avgMemberEstH.toFixed(0)}h est. · ideal CV→0`}
              color={cvMemberEstH<=30?"#22c55e":cvMemberEstH<=60?"#f59e0b":"#ef4444"} />
          )}
        </div>
      </div>
    ) : null;

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        {globalMetrics}
        {["A","B","C","D"].map(team => {
          const tc = TEAM_COLOR[team];
          const rows = memberStatsScored
            .filter(ms => ms.member.team === team)
            .sort((a, b) => a.member.name.localeCompare(b.member.name));
          return (
            <div key={team}>
              {/* Team header */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ background:`${tc}20`, color:tc, fontWeight:800, fontSize:10, textTransform:"uppercase", letterSpacing:2, padding:"3px 10px", borderRadius:5, flexShrink:0 }}>Equipo {team}</span>
                <div style={{ flex:1, height:1, background:"var(--bdr)" }}/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {rows.map(({ member, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento, score }) => {
                  const hoursColor      = pctHours===null?"var(--bdr2)":pctHours>=100?"#ef4444":pctHours>=75?"#f59e0b":"#22c55e";
                  const tasksColor      = pctTasks===null?"var(--bdr2)":pctTasks===100?"#22c55e":pctTasks>=50?"#f59e0b":"var(--tx2)";
                  const taggedColor     = pctTagged===null?"var(--bdr2)":pctTagged>=60?"#22c55e":pctTagged>=25?"#f59e0b":"#ef4444";
                  const rendColor       = rendimiento===null?"var(--bdr2)":rendimiento>=100?"#22c55e":rendimiento>=50?"#f59e0b":"#ef4444";
                  return (
                    <div key={member.login} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"12px 16px" }}>
                      {/* Header: avatar + name + hours */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                          <img
                            src={`https://github.com/${member.login}.png?size=40`}
                            alt={member.name}
                            style={{ width:36, height:36, borderRadius:"50%", border:`2px solid ${tc}50`, flexShrink:0 }}
                          />
                          <div style={{ minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <span
                                onClick={() => { setSelectedPerson(member.login); setView("persona"); }}
                                style={{ color:"var(--tx0)", fontWeight:700, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", cursor:"pointer", textDecoration:"underline dotted", textUnderlineOffset:3 }}
                                title="Ver detalle de persona"
                              >{member.name}</span>
                              {avgMemberEstH !== null && estimatedH > 0 && (() => {
                                const delta    = estimatedH - avgMemberEstH;
                                const deltaPct = delta / avgMemberEstH * 100;
                                const col = Math.abs(deltaPct) <= 20 ? "var(--tx4)" : delta > 0 ? "#f59e0b" : "#818cf8";
                                return (
                                  <span title={`${estimatedH.toFixed(0)}h estimadas vs media ${avgMemberEstH.toFixed(0)}h`}
                                    style={{ fontSize:9, fontWeight:700, background:`${col}18`, color:col, padding:"1px 5px", borderRadius:3, flexShrink:0 }}>
                                    {delta>=0?"+":""}{delta.toFixed(0)}h
                                  </span>
                                );
                              })()}
                            </div>
                            <div style={{ color:"var(--tx4)", fontSize:10 }}>@{member.login} · {member.role}{member.coord?" · Coord":""} · {totalTasks} tarea{totalTasks!==1?"s":""} asignada{totalTasks!==1?"s":""}</div>
                          </div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0, lineHeight:1.6 }}>
                          <div style={{ color:"var(--tx0)", fontWeight:800, fontSize:15 }}>{totalH.toFixed(1)}h</div>
                          <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                            <span style={{ fontSize:10, color: taggedH>0?"#22c55e":"var(--bdr2)" }}>{taggedH.toFixed(1)}h etiq.</span>
                            {pctTagged !== null && (
                              <span style={{ fontSize:9, fontWeight:700, background:`${taggedColor}20`, color:taggedColor, padding:"1px 5px", borderRadius:3 }}>
                                {pctTagged.toFixed(0)}%
                              </span>
                            )}
                          </div>
                          {rendimiento !== null && (
                            <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                              <span style={{ fontSize:9, color:rendColor, fontWeight:700 }} title="(tareas done / total) × (1 − |h_real − h_est| / h_est) · ideal 100%">
                                ⚡ {rendimiento.toFixed(0)}% rendimiento
                              </span>
                              {score !== null && (() => {
                                const sc = score;
                                const sc100 = sc >= 95 && sc <= 105;
                                const scColor = sc100 ? "var(--tx4)" : sc > 100 ? "#22c55e" : "#ef4444";
                                return (
                                  <span title={`Score relativo: rendimiento / media del grupo × 100. Media = 100%`}
                                    style={{ fontSize:9, fontWeight:800, background:`${scColor}20`, color:scColor, padding:"1px 6px", borderRadius:4, border:`1px solid ${scColor}40` }}>
                                    {sc.toFixed(0)}%
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Progress bars */}
                      {sprint !== -1 && (
                        <div style={{ display:"flex", gap:14, marginTop:10 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                              <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Tareas done</span>
                              <span style={{ color:tasksColor, fontSize:9, fontWeight:700 }}>
                                {pctTasks!==null ? `${doneCount}/${totalTasks} · ${pctTasks.toFixed(0)}%` : "—"}
                              </span>
                            </div>
                            <div style={{ height:4, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${Math.min(pctTasks||0,100)}%`, background:tasksColor, borderRadius:2 }}/>
                            </div>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                              <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Horas consumidas</span>
                              <span style={{ color:hoursColor, fontSize:9, fontWeight:700 }}>
                                {pctHours!==null ? `${totalH.toFixed(1)}/${estimatedH.toFixed(0)}h · ${pctHours.toFixed(0)}%` : "—"}
                              </span>
                            </div>
                            <div style={{ height:4, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${Math.min(pctHours||0,100)}%`, background:hoursColor, borderRadius:2 }}/>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Status distribution pills */}
                      {sprint !== -1 && (
                        <div style={{ display:"flex", gap:5, marginTop:8, flexWrap:"wrap" }}>
                          {STATUSES.map(st => {
                            const count = statusCounts[st] || 0;
                            const meta  = STATUS_META[st] || { bg:"var(--bdr)", text:"var(--tx3)" };
                            return (
                              <span key={st} style={{
                                background: count>0 ? meta.bg : "var(--bg3)",
                                color:      count>0 ? meta.text : "var(--bdr2)",
                                border:    `1px solid ${count>0 ? meta.bg+"aa" : "var(--bdr)"}`,
                                padding:"3px 9px", borderRadius:5, fontSize:10, fontWeight:count>0?700:400,
                              }}>
                                {count} {st}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function BurndownView() {
    if (sprint === -1) return (
      <div style={{ background:"#22c55e10", border:"1px solid #22c55e30", borderRadius:10, padding:24, textAlign:"center" }}>
        <div style={{ color:"#22c55e", fontWeight:700, fontSize:15, marginBottom:6 }}>✓ S0 — Devising a Project completado</div>
        <div style={{ color:"var(--tx3)", fontSize:12 }}>757h registradas · sprint finalizado</div>
      </div>
    );

    const tasks    = filtered(report).map(([,t])=>t);
    const totalEst = tasks.reduce((s,t)=>s+t.estimated_h,0);
    const sprintInfo = sprint > 0 ? SC[sprint] : null;

    // Daily Clockify hours for this sprint scope (excluding DP)
    const dailyH = (() => {
      const projs = sprint > 0 ? ['s'+sprint] : ['s1','s2','s3'];
      const merged = {};
      projs.forEach(p => {
        Object.entries(report.dailyHoursByProject?.[p] || {}).forEach(([d,h]) => {
          merged[d] = (merged[d] || 0) + h;
        });
      });
      return merged;
    })();
    const days = Object.keys(dailyH).sort();
    if (!days.length) return <div style={{ color:"var(--tx4)", padding:20, textAlign:"center" }}>Sin entradas de tiempo registradas para este sprint.</div>;

    // Build points: prepend sprint-start anchor at totalEst so both lines share origin
    let rem = totalEst;
    const rawPoints = days.map(d => { rem = Math.max(0, rem - (dailyH[d]||0)); return { day:d, remaining:rem }; });
    const remaining = rem; // final remaining for legend

    const points = sprintInfo
      ? [{ day: sprintInfo.start, remaining: totalEst }, ...rawPoints]
      : rawPoints;

    const svgW=620, svgH=220, pad={t:20,r:20,b:36,l:58};
    const cW=svgW-pad.l-pad.r, cH=svgH-pad.t-pad.b;
    const xS = points.length>1 ? cW/(points.length-1) : cW;
    const yS = totalEst ? cH/totalEst : 1;
    const pathA = points.map((p,i)=>`${i===0?"M":"L"} ${pad.l+i*xS},${pad.t+cH-(p.remaining*yS)}`).join(" ");
    const step  = Math.max(1, Math.ceil(points.length/8));

    // Date → X mapper (linear calendar interpolation across index-spaced axis)
    // Use min/max so the range is correct even when the sprint-start anchor is
    // chronologically after some Clockify entries (e.g. sprint not started yet).
    const allDayMs = points.map(p => new Date(p.day).getTime());
    const t0ms = Math.min(...allDayMs);
    const t1ms = Math.max(...allDayMs);
    const dateToX = (dateStr) => {
      if (t1ms <= t0ms) return pad.l + cW;
      const t = new Date(dateStr).getTime();
      return pad.l + ((t - t0ms) / (t1ms - t0ms)) * (points.length - 1) * xS;
    };

    // Ideal line: from origin to sprint end
    const idealX2 = (() => {
      if (!sprintInfo) return pad.l + cW;
      const x = dateToX(sprintInfo.end);
      return Math.min(pad.l + cW, Math.max(pad.l + 1, x));
    })();

    // ── Completion estimate ────────────────────────────────────
    const firstDay = new Date(points[0].day), lastDay = new Date(points[points.length-1].day);
    const elapsedDays = Math.max(1, (lastDay - firstDay) / 86400000);
    const burnedH     = totalEst - remaining;
    const avgDailyBurn = burnedH / elapsedDays;

    let estimatedDateStr = null, isOnTrack = null, daysDiff = null;
    if (avgDailyBurn > 0 && remaining > 0) {
      const daysNeeded = remaining / avgDailyBurn;
      const estMs = lastDay.getTime() + daysNeeded * 86400000;
      estimatedDateStr = new Date(estMs).toISOString().slice(0, 10);
      if (sprintInfo) {
        const sprintEndMs = new Date(sprintInfo.end).getTime();
        daysDiff  = Math.round((estMs - sprintEndMs) / 86400000);
        isOnTrack = estMs <= sprintEndMs;
      }
    }

    // Projection line (dashed, from last real point to estimated completion, capped at chart edge)
    const projLine = (() => {
      if (!estimatedDateStr || remaining <= 0) return null;
      const lastX  = pad.l + (points.length - 1) * xS;
      const lastY  = pad.t + cH - remaining * yS;
      const projX  = dateToX(estimatedDateStr); // uncapped
      const projY  = pad.t + cH; // remaining = 0
      const maxX   = pad.l + cW;
      if (projX <= lastX) return null;
      if (projX <= maxX) return { x1:lastX, y1:lastY, x2:projX, y2:projY };
      // Clip to right edge
      const tParam = (maxX - lastX) / (projX - lastX);
      return { x1:lastX, y1:lastY, x2:maxX, y2:lastY + tParam * (projY - lastY) };
    })();

    // Sprint-end vertical marker
    const sprintEndX = sprintInfo ? Math.min(pad.l + cW, Math.max(pad.l, dateToX(sprintInfo.end))) : null;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
      y: pad.t + cH * (1 - f), label: Math.round(totalEst * f) + "h", major: f === 0 || f === 1,
    }));
    const sprintColor = sprint > 0 ? SC[sprint].color : "#10b981";
    const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'short' });

    return (
      <div>
        <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:10, flexWrap:"wrap" }}>
          <span style={{ color:"var(--tx3)", fontSize:11 }}>Burndown — horas restantes de {totalEst}h estimadas</span>
          {sprintInfo && <span style={{ background:`${sprintColor}20`, color:sprintColor, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:4 }}>{sprintInfo.label} · {sprintInfo.date}</span>}
          <span style={{ color:"var(--tx4)", fontSize:10 }}>La línea baja al registrar horas en Clockify</span>
        </div>
        <div style={{ background:"var(--bg1)", borderRadius:10, padding:16, overflowX:"auto" }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width:"100%", maxWidth:svgW }}>
            {yTicks.map(({y, label, major}) => (
              <g key={label}>
                <line x1={pad.l} y1={y} x2={pad.l+cW} y2={y} stroke={major?"var(--bdr)":"#1c1c1e"} strokeWidth={major?1:0.5} />
                <text x={pad.l-6} y={y+3.5} fill={major?"var(--tx3)":"var(--bdr2)"} fontSize="9" textAnchor="end">{label}</text>
              </g>
            ))}
            {/* Sprint-end vertical marker */}
            {sprintEndX !== null && (
              <line x1={sprintEndX} y1={pad.t} x2={sprintEndX} y2={pad.t+cH}
                stroke="var(--tx4)" strokeWidth={1} strokeDasharray="3,3" opacity={0.7} />
            )}
            {/* Ideal line */}
            <line x1={pad.l} y1={pad.t} x2={idealX2} y2={pad.t+cH} stroke="var(--tx4)" strokeWidth={1.5} strokeDasharray="6,4" />
            {/* Real burndown */}
            <path d={pathA} fill="none" stroke={sprintColor} strokeWidth={2.5} />
            {points.map((p,i)=>(
              <circle key={i} cx={pad.l+i*xS} cy={pad.t+cH-(p.remaining*yS)} r={3} fill={sprintColor} />
            ))}
            {/* Projection dashed line */}
            {projLine && (
              <line x1={projLine.x1} y1={projLine.y1} x2={projLine.x2} y2={projLine.y2}
                stroke={sprintColor} strokeWidth={1.5} strokeDasharray="4,4" opacity={0.45} />
            )}
            {/* Sprint-end label */}
            {sprintEndX !== null && (
              <text x={sprintEndX+3} y={pad.t+9} fill="var(--tx4)" fontSize="8">{sprintInfo.end.slice(5)}</text>
            )}
            {/* X-axis date labels */}
            {points.map((p,i)=> i%step===0 && (
              <text key={i} x={pad.l+i*xS} y={svgH-pad.b+14} fill="var(--tx4)" fontSize="9" textAnchor="middle">
                {p.day.slice(5)}
              </text>
            ))}
          </svg>
        </div>
        {/* Legend + estimates */}
        <div style={{ display:"flex", gap:16, marginTop:8, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:18, height:2, borderTop:"2px dashed var(--bdr2)" }}/><span style={{ color:"var(--tx4)", fontSize:11 }}>Ideal</span></div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:18, height:2, background:sprintColor }}/><span style={{ color:"var(--tx4)", fontSize:11 }}>Real</span></div>
          {projLine && <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:18, height:2, borderTop:`2px dashed ${sprintColor}70` }}/><span style={{ color:"var(--tx4)", fontSize:11 }}>Proyección</span></div>}
          {totalEst > 0 && remaining > 0 && <span style={{ color:"#f59e0b", fontSize:10 }}>⚠ Pendiente: {remaining.toFixed(0)}h ({(remaining/totalEst*100).toFixed(0)}%)</span>}
          {totalEst > 0 && remaining <= 0 && <span style={{ color:"#22c55e", fontSize:10 }}>✓ Sprint completado</span>}
        </div>
        {/* Completion estimate banner */}
        {estimatedDateStr && remaining > 0 && (
          <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10, background: isOnTrack===null?"var(--bg3)":isOnTrack?"#22c55e12":"#ef444412", border:`1px solid ${isOnTrack===null?"var(--bdr)":isOnTrack?"#22c55e30":"#ef444430"}`, borderRadius:8, padding:"8px 14px", flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:"var(--tx2)" }}>📅 Estimación de cierre (ritmo actual):</span>
            <span style={{ fontSize:13, fontWeight:800, color: isOnTrack===null?"var(--tx0)":isOnTrack?"#22c55e":"#ef4444" }}>
              {fmtDate(estimatedDateStr)}
            </span>
            {sprintInfo && daysDiff !== null && (
              <span style={{ fontSize:10, fontWeight:700, color: isOnTrack?"#22c55e":"#ef4444" }}>
                {isOnTrack
                  ? `✓ Dentro del plazo · ${Math.abs(daysDiff)} día${Math.abs(daysDiff)!==1?"s":""} antes del cierre (${fmtDate(sprintInfo.end)})`
                  : `✗ Fuera de plazo · ${daysDiff} día${daysDiff!==1?"s":""} después del cierre (${fmtDate(sprintInfo.end)})`
                }
              </span>
            )}
            <span style={{ fontSize:10, color:"var(--tx4)", marginLeft:"auto" }}>
              ritmo: {avgDailyBurn.toFixed(1)}h/día
            </span>
          </div>
        )}
      </div>
    );
  }

  function AlertsView() {
    const alerts = filtered(report)
      .filter(([,t])=>t.estimated_h>0 && t.real_h>0 && t.real_h/t.estimated_h>=0.8)
      .sort((a,b)=>b[1].real_h/b[1].estimated_h - a[1].real_h/a[1].estimated_h);
    if (!alerts.length) return <div style={{ background:"var(--bg2)", borderRadius:10, padding:24, textAlign:"center", color:"#22c55e", fontWeight:700 }}>✅ No hay tareas en riesgo ni excedidas</div>;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {alerts.map(([tid,t])=>{
          const pct=t.real_h/t.estimated_h*100, isExc=pct>=100;
          const bg=isExc?"#ef444415":"#f59e0b12", border=isExc?"#ef444435":"#f59e0b35", color=isExc?"#ef4444":"#f59e0b";
          const sc=sprintC[t.sprint]||"var(--tx4)";
          return (
            <div key={tid} style={{ background:bg, border:`1px solid ${border}`, borderRadius:10, padding:"12px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                    <span style={{ color:sc, fontWeight:800, fontSize:12 }}>{tid}</span>
                    <span style={{ color:"var(--tx4)", fontSize:11 }}>{t.area}</span>
                  </div>
                  <div style={{ color:"var(--tx0)", fontSize:12, marginBottom:8 }}>{t.title}</div>
                  <div style={{ height:8, background:"var(--bdr)", borderRadius:4, overflow:"hidden", maxWidth:300 }}>
                    <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:color }} />
                  </div>
                  {Object.keys(t.byUser).length>0 && (
                    <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                      {Object.entries(t.byUser).map(([u,h])=>(
                        <span key={u} style={{ background:"var(--bg3)", color:"var(--tx2)", padding:"2px 8px", borderRadius:4, fontSize:10 }}>{u}: {h.toFixed(1)}h</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"right", minWidth:110 }}>
                  <div style={{ color, fontWeight:800, fontSize:22 }}>{pct.toFixed(0)}%</div>
                  <div style={{ color:"var(--tx3)", fontSize:11 }}>{t.real_h.toFixed(1)}h / {t.estimated_h}h</div>
                  <div style={{ color:"var(--tx4)", fontSize:10, marginTop:4 }}>{isExc?"⛔ Excedida":"⚠️ En riesgo"}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Equipo view ──────────────────────────────────────────────
  function EquipoView() {
    const STATUSES   = ["Backlog","Ready","In progress","In review","Done"];
    const TEAM_COLOR = { A:"#3b82f6", B:"#22c55e", C:"#f59e0b", D:"#a855f7" };

    // GitHub stats para gh_norm por equipo — PRs sprint-filtradas + reviews
    const ghStatsE = (() => { try { const r = localStorage.getItem(GH_STATS_KEY); return r ? JSON.parse(r) : null; } catch(_) { return null; } })();
    const S1_WPR_IDX_E = [22, 23, 24, 25];
    const ghCombinedByLoginE = Object.fromEntries(
      TEAM_MEMBERS.map(m => {
        const ll = m.login.toLowerCase();
        const wpr = ghStatsE?.weeklyPRs?.[ll] || [];
        const totalMerged = ghStatsE?.prs?.[ll]?.merged || 0;
        const s1Prs = S1_WPR_IDX_E.reduce((s, i) => s + (wpr[i] || 0), 0);
        const sprintPrs = sprint === 1 ? s1Prs
          : sprint === 2 ? Math.max(0, totalMerged - s1Prs)
          : sprint === 0 ? totalMerged : 0;
        const reviews = ghStatsE?.reviews?.[ll] || 0;
        return [ll, sprintPrs + reviews];
      })
    );
    const ghValuesE = Object.values(ghCombinedByLoginE);
    const meanGhCombinedE = ghValuesE.length ? ghValuesE.reduce((s, v) => s + v, 0) / ghValuesE.length : 1;

    const relevantTasks = sprint === -1
      ? []
      : Object.values(BACKLOG_MAP).filter(t => sprint === 0 || t.sprint === sprint);

    // Per-team aggregated stats
    const teamStats = ["A","B","C","D"].map(team => {
      const members = TEAM_MEMBERS.filter(m => m.team === team);
      const teamLogins = new Set(members.map(m => m.login.toLowerCase()));

      // Aggregate Clockify hours for all team members
      let totalH = 0, taggedH = 0;
      members.forEach(m => {
        const ue = report.byEmail[m.email?.toLowerCase()] || {};
        if (sprint === -1) {
          totalH  += ue.dp_h || 0;
        } else if (sprint === 0) {
          totalH  += (ue.dp_h||0) + (ue.s1_h||0) + (ue.s2_h||0) + (ue.s3_h||0);
          taggedH += (ue.s1_tagged_h||0) + (ue.s2_tagged_h||0) + (ue.s3_tagged_h||0);
        } else {
          totalH  += ue[`s${sprint}_h`]        || 0;
          taggedH += ue[`s${sprint}_tagged_h`] || 0;
        }
      });

      // Count tasks and estimated hours using same per-member logic as UsersView
      // so that sum of member estimates equals team total
      const statusCounts = Object.fromEntries(STATUSES.map(s => [s, 0]));
      const TALLA_PTS_T = { XS:1, S:2, M:3, L:5, XL:8 };
      let estimatedH = 0, doneEstimatedH = 0, totalPts = 0, effPts = 0;
      const seenTaskIds = new Set();
      members.forEach(m => {
        const loginLower = m.login.toLowerCase();
        relevantTasks.forEach(t => {
          const assignees   = t.assignees || [];
          const equipoLogins = EQUIPO_LOGINS[t.equipo] || [];
          const direct   = assignees.some(a => a.login.toLowerCase() === loginLower);
          const implied  = assignees.length === 0 && equipoLogins.includes(loginLower);
          if (direct || implied) {
            if (!seenTaskIds.has(t.id)) {
              seenTaskIds.add(t.id);
              statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
            }
            const perPersonH = (t.area === "Asistencia" && implied && equipoLogins.length > 0)
              ? t.estimated_h / equipoLogins.length
              : t.estimated_h;
            estimatedH += perPersonH || 0;
            if (t.status === "Done") doneEstimatedH += perPersonH || 0;
            const n = direct ? (assignees.length || 1) : (equipoLogins.length || 1);
            const perPersonPts = (TALLA_PTS_T[t.size] || 1) / n;
            totalPts += perPersonPts;
            const w = t.status === "Done" ? 1 : t.status === "In review" ? 0.8 : t.status === "In progress" ? 0.2 : 0;
            effPts += perPersonPts * w;
          }
        });
      });

      const totalTasks  = STATUSES.reduce((s, st) => s + statusCounts[st], 0);
      const doneCount   = statusCounts["Done"];
      const pctTasks    = totalTasks > 0 ? doneCount / totalTasks * 100   : null;
      const pctHours    = estimatedH > 0 ? totalH / estimatedH * 100      : null;
      const pctTagged   = totalH > 0     ? taggedH / totalH * 100         : null;
      const crT  = totalPts > 0 ? effPts / totalPts : null;
      const devT = estimatedH > 0 ? (taggedH - estimatedH) / estimatedH : 0;
      const efT  = estimatedH > 0 ? (devT > 0 ? 1 / (1 + 1.5 * devT) : 1 / (1 + 0.5 * Math.abs(devT))) : null;
      // ghNorm por equipo = media de los ghNorm individuales de sus miembros
      const teamGhNorm = members.length
        ? members.reduce((s, m) => s + (meanGhCombinedE > 0 ? (ghCombinedByLoginE[m.login.toLowerCase()] || 0) / meanGhCombinedE : 0), 0) / members.length
        : 0;
      const rendimiento = crT !== null && efT !== null ? (0.25 * crT + 0.50 * efT + 0.25 * teamGhNorm) * 100 : null;

      // Intra-team workload balance: CV of per-member estimated hours
      const memberEstHArr = members.map(m => {
        const ll = m.login.toLowerCase();
        let mH = 0;
        relevantTasks.forEach(t => {
          const ass = t.assignees || [];
          const eqL = EQUIPO_LOGINS[t.equipo] || [];
          if (ass.some(a => a.login.toLowerCase() === ll) || (ass.length === 0 && eqL.includes(ll)))
            mH += t.estimated_h || 0;
        });
        return mH;
      });
      const avgMemberEstH = memberEstHArr.reduce((s, h) => s + h, 0) / memberEstHArr.length;
      const intraCV = avgMemberEstH > 0 && members.length >= 2
        ? Math.sqrt(memberEstHArr.reduce((s, h) => s + (h - avgMemberEstH) ** 2, 0) / memberEstHArr.length) / avgMemberEstH * 100
        : null;

      return { team, members, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalPts, effPts, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento, memberEstHArr, avgMemberEstH, intraCV };
    });

    // Global comparison metrics across teams
    const withTasks = teamStats.filter(ts => ts.totalTasks > 0);
    const withHours = teamStats.filter(ts => ts.estimatedH > 0);
    const avgPctTasks = withTasks.length ? withTasks.reduce((s, ts) => s + ts.pctTasks, 0) / withTasks.length : null;
    const avgPctHours = withHours.length ? withHours.reduce((s, ts) => s + Math.min(ts.pctHours, 200), 0) / withHours.length : null;
    const best  = withTasks.length ? withTasks.reduce((a, b) => b.pctTasks > a.pctTasks ? b : a) : null;
    const withRend = teamStats.filter(ts => ts.rendimiento !== null);
    const avgRendimiento = withRend.length ? withRend.reduce((s, ts) => s + ts.rendimiento, 0) / withRend.length : null;
    const teamStatsScored = teamStats.map(ts => ({
      ...ts,
      score: ts.rendimiento !== null && avgRendimiento ? ts.rendimiento / avgRendimiento * 100 : null,
    }));

    // Inter-team workload balance: CV of estimatedH across teams
    const avgTeamEstH = withHours.length ? withHours.reduce((s, ts) => s + ts.estimatedH, 0) / withHours.length : null;
    const sigmaTeamEstH = avgTeamEstH && withHours.length >= 2
      ? Math.sqrt(withHours.reduce((s, ts) => s + (ts.estimatedH - avgTeamEstH) ** 2, 0) / withHours.length) : null;
    const cvTeamEstH = sigmaTeamEstH && avgTeamEstH ? sigmaTeamEstH / avgTeamEstH * 100 : null;

    const sigmaTasks = withTasks.length >= 2 && avgPctTasks !== null
      ? Math.sqrt(withTasks.reduce((s, ts) => s + (ts.pctTasks - avgPctTasks) ** 2, 0) / withTasks.length)
      : null;

    const globalMetrics = sprint !== -1 && withTasks.length > 0 ? (
      <div style={{ background:"var(--bg1)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px", marginBottom:4 }}>
        <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
          📊 Comparativa de equipos — {withTasks.length} equipos con tareas
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {avgPctTasks !== null && (
            <InfStatCard label="Media completitud tareas"
              value={`${avgPctTasks.toFixed(1)}%`}
              sub={best ? `Líder: Equipo ${best.team} · ${best.pctTasks.toFixed(0)}%` : ""}
              color={avgPctTasks>=75?"#22c55e":avgPctTasks>=40?"#f59e0b":"#ef4444"} />
          )}
          {avgPctHours !== null && (
            <InfStatCard label="Media consumo estimado"
              value={`${avgPctHours.toFixed(1)}%`}
              sub="horas Clockify / horas estimadas (media)"
              color={avgPctHours>=100?"#ef4444":avgPctHours>=75?"#f59e0b":"#22c55e"} />
          )}
          {sigmaTasks !== null && (
            <InfStatCard label="Equilibrio entre equipos"
              value={`σ ${sigmaTasks.toFixed(1)}%`}
              sub="desv. típica de completitud · ideal σ→0"
              color={sigmaTasks<=15?"#22c55e":sigmaTasks<=30?"#f59e0b":"#ef4444"} />
          )}
          {avgRendimiento !== null && (
            <InfStatCard label="Rendimiento medio"
              value={`${avgRendimiento.toFixed(1)}%`}
              sub="h estimadas Done / h Clockify · ideal ≥100%"
              color={avgRendimiento>=100?"#22c55e":avgRendimiento>=50?"#f59e0b":"#ef4444"} />
          )}
          {cvTeamEstH !== null && (
            <InfStatCard label="Desbalance entre equipos"
              value={`CV ${cvTeamEstH.toFixed(0)}%`}
              sub={`σ ${sigmaTeamEstH.toFixed(0)}h · μ ${avgTeamEstH.toFixed(0)}h est. · ideal CV→0`}
              color={cvTeamEstH<=20?"#22c55e":cvTeamEstH<=40?"#f59e0b":"#ef4444"} />
          )}
        </div>
      </div>
    ) : null;

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {globalMetrics}
        {teamStatsScored.map(({ team, members, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento, score, memberEstHArr, avgMemberEstH, intraCV }) => {
          const tc         = TEAM_COLOR[team];
          const hoursColor = pctHours===null?"var(--bdr2)":pctHours>=100?"#ef4444":pctHours>=75?"#f59e0b":"#22c55e";
          const tasksColor = pctTasks===null?"var(--bdr2)":pctTasks===100?"#22c55e":pctTasks>=50?"#f59e0b":"var(--tx2)";
          const taggedColor= pctTagged===null?"var(--bdr2)":pctTagged>=60?"#22c55e":pctTagged>=25?"#f59e0b":"#ef4444";
          const rendColor  = rendimiento===null?"var(--bdr2)":rendimiento>=100?"#22c55e":rendimiento>=50?"#f59e0b":"#ef4444";
          // Inter-team deviation badge
          const interDelta    = avgTeamEstH ? estimatedH - avgTeamEstH : null;
          const interDeltaPct = avgTeamEstH ? interDelta / avgTeamEstH * 100 : null;
          const interColor    = interDeltaPct===null?"var(--tx4)":Math.abs(interDeltaPct)<=15?"var(--tx4)":interDeltaPct>0?"#f59e0b":"#818cf8";
          // Intra-team color
          const intraColor = intraCV===null?"var(--bdr2)":intraCV<=25?"#22c55e":intraCV<=50?"#f59e0b":"#ef4444";
          return (
            <div key={team} style={{ background:"var(--bg2)", border:`1px solid ${tc}30`, borderRadius:12, padding:"14px 16px" }}>
              {/* Team header + aggregated hours */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <span style={{ background:`${tc}20`, color:tc, fontWeight:800, fontSize:13, textTransform:"uppercase", letterSpacing:2, padding:"4px 12px", borderRadius:6 }}>Equipo {team}</span>
                  <span style={{ color:"var(--tx4)", fontSize:11 }}>{members.length} miembros · {totalTasks} tarea{totalTasks!==1?"s":""}</span>
                  {interDeltaPct !== null && (
                    <span title={`${estimatedH.toFixed(0)}h est. vs media inter-equipos ${avgTeamEstH.toFixed(0)}h`}
                      style={{ fontSize:9, fontWeight:700, background:`${interColor}18`, color:interColor, padding:"2px 6px", borderRadius:4 }}>
                      {interDelta>=0?"+":""}{interDelta.toFixed(0)}h vs media
                    </span>
                  )}
                  {intraCV !== null && (
                    <span title="Coeficiente de variación de horas estimadas entre miembros · ideal CV→0"
                      style={{ fontSize:9, fontWeight:700, background:`${intraColor}18`, color:intraColor, padding:"2px 6px", borderRadius:4 }}>
                      ⚖ CV intra {intraCV.toFixed(0)}%
                    </span>
                  )}
                </div>
                <div style={{ textAlign:"right", flexShrink:0, lineHeight:1.6 }}>
                  <div style={{ color:"var(--tx0)", fontWeight:800, fontSize:16 }}>{totalH.toFixed(1)}h</div>
                  <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                    <span style={{ fontSize:10, color: taggedH>0?"#22c55e":"var(--bdr2)" }}>{taggedH.toFixed(1)}h etiq.</span>
                    {pctTagged !== null && (
                      <span style={{ fontSize:9, fontWeight:700, background:`${taggedColor}20`, color:taggedColor, padding:"1px 5px", borderRadius:3 }}>
                        {pctTagged.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {rendimiento !== null && (
                    <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                      <span style={{ fontSize:9, color:rendColor, fontWeight:700 }} title="(tareas done / total) × (1 − |h_real − h_est| / h_est) · ideal 100%">
                        ⚡ {rendimiento.toFixed(0)}% rendimiento
                      </span>
                      {score !== null && (() => {
                        const sc = score;
                        const sc100 = sc >= 95 && sc <= 105;
                        const scColor = sc100 ? "var(--tx4)" : sc > 100 ? "#22c55e" : "#ef4444";
                        return (
                          <span title="Score relativo: rendimiento / media de equipos × 100. Media = 100%"
                            style={{ fontSize:9, fontWeight:800, background:`${scColor}20`, color:scColor, padding:"1px 6px", borderRadius:4, border:`1px solid ${scColor}40` }}>
                            {sc.toFixed(0)}%
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Member avatars row */}
              <div style={{ display:"flex", gap:5, marginBottom:10, flexWrap:"wrap" }}>
                {members.sort((a,b) => a.name.localeCompare(b.name)).map(m => (
                  <div key={m.login} style={{ display:"flex", alignItems:"center", gap:5, background:"var(--bg3)", borderRadius:6, padding:"3px 8px 3px 3px" }}>
                    <img
                      src={`https://github.com/${m.login}.png?size=24`}
                      alt={m.name}
                      style={{ width:22, height:22, borderRadius:"50%", border:`1.5px solid ${tc}50`, flexShrink:0 }}
                    />
                    <span style={{ color:"var(--tx2)", fontSize:10, whiteSpace:"nowrap" }}>{m.name.split(" ")[0]}</span>
                    {m.coord && <span style={{ fontSize:7, background:"#818cf820", color:"#818cf8", padding:"0 3px", borderRadius:2, fontWeight:700 }}>C</span>}
                  </div>
                ))}
              </div>

              {/* Progress bars */}
              {sprint !== -1 && (
                <div style={{ display:"flex", gap:14, marginBottom:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Tareas done</span>
                      <span style={{ color:tasksColor, fontSize:9, fontWeight:700 }}>
                        {pctTasks!==null ? `${doneCount}/${totalTasks} · ${pctTasks.toFixed(0)}%` : "—"}
                      </span>
                    </div>
                    <div style={{ height:5, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(pctTasks||0,100)}%`, background:tasksColor, borderRadius:2 }}/>
                    </div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Horas consumidas</span>
                      <span style={{ color:hoursColor, fontSize:9, fontWeight:700 }}>
                        {pctHours!==null ? `${totalH.toFixed(1)}/${estimatedH.toFixed(0)}h · ${pctHours.toFixed(0)}%` : "—"}
                      </span>
                    </div>
                    <div style={{ height:5, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(pctHours||0,100)}%`, background:hoursColor, borderRadius:2 }}/>
                    </div>
                  </div>
                </div>
              )}

              {/* Status distribution pills */}
              {sprint !== -1 && (
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {STATUSES.map(st => {
                    const count = statusCounts[st] || 0;
                    const meta  = STATUS_META[st] || { bg:"var(--bdr)", text:"var(--tx3)" };
                    return (
                      <span key={st} style={{
                        background: count>0 ? meta.bg : "var(--bg3)",
                        color:      count>0 ? meta.text : "var(--bdr2)",
                        border:    `1px solid ${count>0 ? meta.bg+"aa" : "var(--bdr)"}`,
                        padding:"3px 9px", borderRadius:5, fontSize:10, fontWeight:count>0?700:400,
                      }}>
                        {count} {st}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Velocity view ─────────────────────────────────────────────
  function VelocityView() {
    const sprintDefs = [
      { key:-1, label:"S0 · DP", project:"dp", color:"#6366f1" },
      { key:1,  label:"Sprint 1", project:"s1", color:"#818cf8" },
      { key:2,  label:"Sprint 2", project:"s2", color:"#34d399" },
      { key:3,  label:"Sprint 3", project:"s3", color:"#fbbf24" },
    ];
    const data = sprintDefs.map(({ key, label, project, color }) => {
      const spTasks = key === -1 ? [] : Object.values(BACKLOG_MAP).filter(t => t.sprint === key);
      const done = spTasks.filter(t => t.status === "Done");
      const doneEstH  = done.reduce((s, t) => s + (t.estimated_h || 0), 0);
      const totalEstH = spTasks.reduce((s, t) => s + (t.estimated_h || 0), 0);
      const clockifyH = Object.values(report.dailyHoursByProject?.[project] || {}).reduce((s, h) => s + h, 0);
      return { key, label, color, doneEstH, totalEstH, clockifyH, doneCount:done.length, totalCount:spTasks.length };
    });

    const maxH = Math.max(...data.map(d => Math.max(d.clockifyH, d.totalEstH)), 1);
    const svgW=560, svgH=220, pad={t:20,r:20,b:46,l:58};
    const cW=svgW-pad.l-pad.r, cH=svgH-pad.t-pad.b;
    const groupW = cW / data.length;
    const barW   = groupW * 0.28;
    const yS     = cH / maxH;

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {/* Summary cards — sprints 1–3 only */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {data.filter(d => d.key > 0).map(d => (
            <InfStatCard key={d.key} label={d.label}
              value={`${d.doneEstH.toFixed(0)}h entregadas`}
              sub={`${d.doneCount}/${d.totalCount} tareas Done · ${d.clockifyH.toFixed(0)}h Clockify`}
              color={d.color} />
          ))}
        </div>
        {/* Bar chart */}
        <div style={{ background:"var(--bg1)", borderRadius:10, padding:16, overflowX:"auto" }}>
          <div style={{ color:"var(--tx3)", fontSize:10, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>
            Velocidad por sprint — h estimadas entregadas (Done) vs h Clockify invertidas
          </div>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width:"100%", maxWidth:svgW }}>
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = pad.t + cH * (1 - f);
              const maj = f===0||f===1;
              return (
                <g key={f}>
                  <line x1={pad.l} y1={y} x2={pad.l+cW} y2={y} stroke={maj?"var(--bdr)":"#1c1c1e"} strokeWidth={maj?1:0.5} />
                  <text x={pad.l-6} y={y+3.5} fill={maj?"var(--tx3)":"var(--bdr2)"} fontSize="9" textAnchor="end">{Math.round(maxH*f)}h</text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const cx = pad.l + groupW * i + groupW / 2;
              const h1 = d.totalEstH * yS, h2 = d.doneEstH * yS, h3 = d.clockifyH * yS;
              return (
                <g key={i}>
                  {/* Ghost: total estimated */}
                  <rect x={cx-barW*1.15} y={pad.t+cH-h1} width={barW} height={h1} fill={d.color+"1a"} stroke={d.color+"44"} strokeWidth={1} rx={2} />
                  {/* Solid: done estimated (velocity) */}
                  <rect x={cx-barW*1.15} y={pad.t+cH-h2} width={barW} height={h2} fill={d.color} rx={2} />
                  {/* Muted: clockify invested */}
                  <rect x={cx+barW*0.15} y={pad.t+cH-h3} width={barW} height={h3} fill={d.color+"70"} rx={2} />
                  {h2>12 && <text x={cx-barW*0.65} y={pad.t+cH-h2-4} fill={d.color} fontSize="8" textAnchor="middle" fontWeight="700">{d.doneEstH.toFixed(0)}</text>}
                  {h3>12 && <text x={cx+barW*0.65} y={pad.t+cH-h3-4} fill={d.color+"aa"} fontSize="8" textAnchor="middle">{d.clockifyH.toFixed(0)}</text>}
                  <text x={cx} y={svgH-pad.b+14} fill={d.color} fontSize="9" textAnchor="middle" fontWeight="700">{d.label}</text>
                  <text x={cx} y={svgH-pad.b+24} fill="var(--tx4)" fontSize="8" textAnchor="middle">{d.doneCount}/{d.totalCount} Done</text>
                </g>
              );
            })}
            {/* Trend line connecting doneEstH for sprints 1–3 */}
            {(() => {
              const pts = data.filter(d => d.key > 0).map((d, i) => {
                const cx = pad.l + groupW * (i+1) + groupW/2 - barW*0.65;
                return `${i===0?"M":"L"} ${cx},${pad.t+cH-d.doneEstH*yS}`;
              });
              return pts.length >= 2
                ? <path d={pts.join(" ")} fill="none" stroke="#ffffff25" strokeWidth={1.5} strokeDasharray="4,3" />
                : null;
            })()}
          </svg>
          <div style={{ display:"flex", gap:16, marginTop:6, flexWrap:"wrap" }}>
            {[["#818cf8","H estimadas entregadas (Done)"],["#818cf870","H Clockify invertidas"],["#818cf81a","H estimadas totales"]].map(([bg,lbl])=>(
              <div key={lbl} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:12, height:8, background:bg, borderRadius:2, border:bg.endsWith("1a")?`1px solid #818cf844`:"none" }} />
                <span style={{ color:"var(--tx3)", fontSize:10 }}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Activity view ──────────────────────────────────────────────
  function ActivityView() {
    const projectDefs = [
      { key:"dp", color:"#6366f1", label:"S0·DP" },
      { key:"s1", color:"#818cf8", label:"S1" },
      { key:"s2", color:"#34d399", label:"S2" },
      { key:"s3", color:"#fbbf24", label:"S3" },
    ];

    const allDatesSet = new Set();
    projectDefs.forEach(({ key }) =>
      Object.keys(report.dailyHoursByProject?.[key] || {}).forEach(d => allDatesSet.add(d))
    );
    const dates = [...allDatesSet].sort();
    if (!dates.length) return <div style={{ color:"var(--tx4)", padding:20, textAlign:"center" }}>Sin datos Clockify.</div>;

    const bars = dates.map(d => {
      const segments = projectDefs
        .map(({ key, color, label }) => ({ key, color, label, h: report.dailyHoursByProject?.[key]?.[d] || 0 }))
        .filter(s => s.h > 0);
      return { date:d, segments, total: segments.reduce((s, sg) => s + sg.h, 0) };
    });

    const maxH = Math.max(...bars.map(b => b.total), 1);
    const svgW = Math.max(600, dates.length * 20);
    const svgH = 200, pad = { t:20, r:20, b:40, l:50 };
    const cW = svgW-pad.l-pad.r, cH = svgH-pad.t-pad.b;
    const barW = Math.max(6, cW / dates.length * 0.72);
    const step = Math.max(1, Math.ceil(dates.length / 14));

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {projectDefs.map(({ key, color, label }) => {
            const total = Object.values(report.dailyHoursByProject?.[key] || {}).reduce((s, h) => s + h, 0);
            const nDays = Object.keys(report.dailyHoursByProject?.[key] || {}).length;
            if (!total) return null;
            return <InfStatCard key={key} label={label} value={`${total.toFixed(1)}h`} sub={`en ${nDays} días · media ${(total/nDays).toFixed(1)}h/día`} color={color} />;
          })}
        </div>
        <div style={{ background:"var(--bg1)", borderRadius:10, padding:16, overflowX:"auto" }}>
          <div style={{ color:"var(--tx3)", fontSize:10, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>
            Actividad diaria — horas Clockify registradas por día
          </div>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width:"100%", minWidth:Math.min(svgW,380) }}>
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = pad.t + cH * (1-f), maj = f===0||f===1;
              return (
                <g key={f}>
                  <line x1={pad.l} y1={y} x2={pad.l+cW} y2={y} stroke={maj?"var(--bdr)":"#1c1c1e"} strokeWidth={maj?1:0.5} />
                  <text x={pad.l-5} y={y+3.5} fill="var(--tx4)" fontSize="8" textAnchor="end">{(maxH*f).toFixed(0)}h</text>
                </g>
              );
            })}
            {bars.map((bar, i) => {
              const cx = pad.l + (i+0.5) * (cW/dates.length);
              let yOff = 0;
              return (
                <g key={bar.date}>
                  {bar.segments.map(seg => {
                    const h = seg.h * (cH/maxH);
                    const y = pad.t + cH - yOff - h;
                    yOff += h;
                    return <rect key={seg.key} x={cx-barW/2} y={y} width={barW} height={h} fill={seg.color} rx={1} />;
                  })}
                  {i%step===0 && (
                    <text x={cx} y={svgH-pad.b+12} fill="var(--tx4)" fontSize="8" textAnchor="middle">{bar.date.slice(5)}</text>
                  )}
                </g>
              );
            })}
          </svg>
          <div style={{ display:"flex", gap:14, marginTop:4, flexWrap:"wrap" }}>
            {projectDefs.map(({ key, color, label }) => (
              <div key={key} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:color }} />
                <span style={{ color:"var(--tx3)", fontSize:10 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Areas view ────────────────────────────────────────────────
  function AreasView() {
    const relevantTasks = sprint === -1
      ? []
      : Object.values(BACKLOG_MAP).filter(t => sprint === 0 || t.sprint === sprint);

    if (sprint === -1) return <div style={{ color:"var(--tx4)", padding:20, textAlign:"center" }}>S0/DP no tiene tareas en el backlog.</div>;
    if (!relevantTasks.length) return <div style={{ color:"var(--tx4)", padding:20, textAlign:"center" }}>Sin tareas para este filtro.</div>;

    const areaMap = {};
    relevantTasks.forEach(t => {
      if (!areaMap[t.area]) areaMap[t.area] = { estimatedH:0, doneH:0, clockifyH:0, total:0, done:0 };
      areaMap[t.area].estimatedH += t.estimated_h || 0;
      areaMap[t.area].total += 1;
      if (t.status === "Done") { areaMap[t.area].doneH += t.estimated_h || 0; areaMap[t.area].done += 1; }
      const tr = report.byTask[t.id];
      if (tr) areaMap[t.area].clockifyH += tr.real_h || 0;
    });

    const areas = Object.entries(areaMap)
      .map(([area, d]) => ({ area, ...d, pctDone: d.total > 0 ? d.done/d.total*100 : 0 }))
      .sort((a, b) => b.estimatedH - a.estimatedH);

    const totalClockify = areas.reduce((s, a) => s + a.clockifyH, 0);
    const totalEst      = areas.reduce((s, a) => s + a.estimatedH, 0);
    const totalDone     = areas.reduce((s, a) => s + a.done, 0);
    const totalTasks    = areas.reduce((s, a) => s + a.total, 0);

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <InfStatCard label="Áreas" value={`${areas.length}`} sub={`${totalTasks} tareas · ${totalEst.toFixed(0)}h estimadas`} color="var(--tx2)" />
          <InfStatCard label="Tareas Done" value={`${totalDone}/${totalTasks}`} sub={`${(totalDone/totalTasks*100).toFixed(0)}% completitud global`} color={totalDone/totalTasks>=0.75?"#22c55e":totalDone/totalTasks>=0.4?"#f59e0b":"#ef4444"} />
          {totalClockify > 0 && <InfStatCard label="H Clockify" value={`${totalClockify.toFixed(1)}h`} sub={`de ${totalEst.toFixed(0)}h estimadas · ${(totalClockify/totalEst*100).toFixed(0)}%`} color={totalClockify/totalEst>=1?"#ef4444":totalClockify/totalEst>=0.75?"#f59e0b":"#22c55e"} />}
        </div>
        {areas.map(({ area, estimatedH, doneH, clockifyH, total, done, pctDone }) => {
          const pctClockify = estimatedH > 0 ? clockifyH / estimatedH * 100 : null;
          const doneColor   = pctDone>=80?"#22c55e":pctDone>=40?"#f59e0b":"var(--tx2)";
          const clockColor  = pctClockify===null?"var(--bdr2)":pctClockify>=100?"#ef4444":pctClockify>=75?"#f59e0b":"#22c55e";
          return (
            <div key={area} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:8, padding:"10px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                <span style={{ flex:1, color:"var(--tx0)", fontWeight:700, fontSize:12 }}>{area}</span>
                <span style={{ color:"var(--tx4)", fontSize:10 }}>{done}/{total}</span>
                <span style={{ color:doneColor, fontSize:10, fontWeight:700, minWidth:34, textAlign:"right" }}>{pctDone.toFixed(0)}%</span>
                <span style={{ color:"var(--tx3)", fontSize:10, minWidth:58, textAlign:"right" }}>{estimatedH.toFixed(0)}h est.</span>
                {clockifyH > 0 && <span style={{ color:clockColor, fontSize:10, minWidth:58, textAlign:"right" }}>{clockifyH.toFixed(1)}h reg.</span>}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ color:"var(--bdr2)", fontSize:8, textTransform:"uppercase", letterSpacing:1 }}>Done</span>
                    <span style={{ color:doneColor, fontSize:8, fontWeight:700 }}>{pctDone.toFixed(0)}%</span>
                  </div>
                  <div style={{ height:3, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${Math.min(pctDone,100)}%`, background:doneColor, borderRadius:2 }} />
                  </div>
                </div>
                {pctClockify !== null && (
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                      <span style={{ color:"var(--bdr2)", fontSize:8, textTransform:"uppercase", letterSpacing:1 }}>Consumo</span>
                      <span style={{ color:clockColor, fontSize:8, fontWeight:700 }}>{pctClockify.toFixed(0)}%</span>
                    </div>
                    <div style={{ height:3, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(pctClockify,100)}%`, background:clockColor, borderRadius:2 }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Coverage view ─────────────────────────────────────────────
  function CoverageView() {
    const relevantTasks = sprint === -1
      ? []
      : Object.values(BACKLOG_MAP).filter(t => sprint === 0 || t.sprint === sprint);

    if (sprint === -1) return <div style={{ color:"var(--tx4)", padding:20, textAlign:"center" }}>S0/DP no tiene tareas en el backlog.</div>;
    if (!relevantTasks.length) return <div style={{ color:"var(--tx4)", padding:20, textAlign:"center" }}>Sin tareas para este filtro.</div>;

    const tagged   = relevantTasks.filter(t => (report.byTask[t.id]?.real_h || 0) > 0);
    const untagged = relevantTasks.filter(t => (report.byTask[t.id]?.real_h || 0) === 0);
    const pctTagged = relevantTasks.length > 0 ? tagged.length / relevantTasks.length * 100 : 0;

    const byArea = {};
    relevantTasks.forEach(t => {
      if (!byArea[t.area]) byArea[t.area] = { tagged:[], untagged:[] };
      if ((report.byTask[t.id]?.real_h || 0) > 0) byArea[t.area].tagged.push(t);
      else byArea[t.area].untagged.push(t);
    });

    const areas = Object.entries(byArea)
      .map(([area, { tagged:tg, untagged:ut }]) => ({
        area, taggedCount:tg.length, untaggedCount:ut.length,
        total:tg.length+ut.length,
        pct: (tg.length+ut.length)>0 ? tg.length/(tg.length+ut.length)*100 : 0,
        untaggedTasks: ut,
      }))
      .sort((a, b) => a.pct - b.pct); // worst coverage first

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <InfStatCard label="Cobertura total"
            value={`${pctTagged.toFixed(1)}%`}
            sub={`${tagged.length} de ${relevantTasks.length} tareas con horas Clockify`}
            color={pctTagged>=75?"#22c55e":pctTagged>=40?"#f59e0b":"#ef4444"} />
          <InfStatCard label="Sin cobertura"
            value={`${untagged.length}`}
            sub="tareas sin ninguna entrada Clockify"
            color={untagged.length===0?"#22c55e":"#ef4444"} />
        </div>
        <div style={{ color:"var(--tx4)", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>
          Por área — peor cobertura primero
        </div>
        {areas.map(({ area, taggedCount, total, pct, untaggedTasks }) => {
          const c = pct>=80?"#22c55e":pct>=40?"#f59e0b":"#ef4444";
          return (
            <div key={area} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:8, padding:"10px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: untaggedTasks.length>0?6:0 }}>
                <span style={{ flex:1, color:"var(--tx0)", fontWeight:600, fontSize:12 }}>{area}</span>
                <span style={{ color:"var(--tx4)", fontSize:10 }}>{taggedCount}/{total}</span>
                <span style={{ color:c, fontWeight:700, fontSize:10, minWidth:38, textAlign:"right" }}>{pct.toFixed(0)}%</span>
                <div style={{ width:80, height:4, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:c, borderRadius:2 }} />
                </div>
              </div>
              {untaggedTasks.length > 0 && (
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {untaggedTasks.map(t => (
                    <span key={t.id} style={{ background:"var(--bg3)", color:"var(--tx3)", fontSize:9, padding:"2px 6px", borderRadius:3, border:"1px solid var(--bdr)" }}>
                      {t.id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── PersonPane ────────────────────────────────────────────────
  function PersonPane({ login, onChangePerson }) {
    const TC_P     = { A:"#3b82f6", B:"#22c55e", C:"#f59e0b", D:"#a855f7" };
    const STATUSES = ["Backlog","Ready","In progress","In review","Done"];
    const TALLA_PTS = { XS:1, S:2, M:3, L:5, XL:8 };
    const SC_P     = { 1:"#818cf8", 2:"#34d399", 3:"#fbbf24" };

    const member = TEAM_MEMBERS.find(m => m.login === login);
    if (!member) return <div style={{ color:"#ef4444", padding:20 }}>Persona no encontrada: {login}</div>;
    const tc = TC_P[member.team] || "#10b981";
    const loginLower = login.toLowerCase();

    // ── GitHub stats ─────────────────────────────────────────────
    const ghStats  = (() => { try { const r = localStorage.getItem(GH_STATS_KEY); return r ? JSON.parse(r) : null; } catch(_){return null;} })();
    const commits  = ghStats?.commits?.[loginLower] || 0;
    const pr       = ghStats?.prs?.[loginLower] || { total:0, merged:0, open:0, additions:0, deletions:0 };
    const revs     = ghStats?.reviews?.[loginLower] || 0;
    const lns      = ghStats?.lines?.[loginLower] || { added:0, deleted:0 };
    const cons     = ghStats?.consistency?.[loginLower] ?? null;
    const amt      = ghStats?.avgMergeTime?.[loginLower] ?? null;
    const prEff    = pr.total > 0 ? Math.round(pr.merged / pr.total * 100) : null;
    const collab   = Math.min(Math.round(revs / (commits + 1) * 50), 100);
    const cImpact  = lns.added + lns.deleted;
    const cChurn   = cImpact > 0 ? Math.round(lns.deleted / cImpact * 100) : null;
    const avgPRS   = pr.merged > 0 ? Math.round((pr.additions + pr.deletions) / pr.merged) : null;

    // ── Clockify data ────────────────────────────────────────────
    const ue           = report?.byEmail?.[member.email?.toLowerCase()] || {};
    const clockifyName = ue.name || member.name;
    const rawEntries   = (report?.rawEntriesByUser?.[clockifyName] || [])
      .slice().sort((a,b) => (b.date||"").localeCompare(a.date||""));

    let totalH = 0, taggedH = 0;
    if (sprint === -1) {
      totalH = ue.dp_h || 0;
    } else if (sprint === 0) {
      totalH  = (ue.dp_h||0)+(ue.s1_h||0)+(ue.s2_h||0)+(ue.s3_h||0);
      taggedH = (ue.s1_tagged_h||0)+(ue.s2_tagged_h||0)+(ue.s3_tagged_h||0);
    } else {
      totalH  = ue[`s${sprint}_h`]       || 0;
      taggedH = ue[`s${sprint}_tagged_h`] || 0;
    }

    // ── Tasks ───────────────────────────────────────────────────
    const teamEquipo   = `Equipo ${member.team}`;
    const relevantTasks = sprint === -1 ? []
      : Object.entries(BACKLOG_MAP)
          .filter(([,t]) => sprint === 0 || t.sprint === sprint)
          .sort((a,b) => a[1].sprint - b[1].sprint || a[0].localeCompare(b[0]));

    const taskRows = relevantTasks.map(([tid, t]) => {
      const assignees  = t.assignees || [];
      const isDirecta  = assignees.some(a => a.login.toLowerCase() === loginLower);
      const isTeamTask = t.equipo === teamEquipo;
      const isDelegada = isTeamTask && assignees.length === 0 && !isDirecta;
      const teamLogins = EQUIPO_LOGINS[t.equipo] || [];
      const n          = assignees.length || 1;
      const nTeam      = teamLogins.length || 1;
      const hDirectas  = isDirecta  ? (t.estimated_h||0) / n    : 0;
      const hDelegadas = isDelegada ? (t.estimated_h||0) / nTeam : 0;
      const hEquipo    = isTeamTask ? (t.estimated_h||0)         : 0;
      const hReal      = report?.byTask?.[tid]?.byUser?.[clockifyName] || 0;
      const hasImputed = hReal > 0 && !isDirecta;
      return { tid, t, isDirecta, isDelegada, isTeamTask, hDirectas, hDelegadas, hEquipo, hReal, hasImputed };
    }).filter(r => r.isDirecta || r.isDelegada || r.hReal > 0);

    const equipoTasks     = relevantTasks.filter(([,t]) => t.equipo === teamEquipo);
    const totalHDirectas  = taskRows.reduce((s,r) => s+r.hDirectas,  0);
    const totalHDelegadas = taskRows.reduce((s,r) => s+r.hDelegadas, 0);
    const totalHEquipo    = equipoTasks.reduce((s,[,t]) => s+(t.estimated_h||0), 0);

    // ── Score (misma fórmula que UsersView) ──────────────────────
    const S1_WPR_IDX = [22,23,24,25];
    const wpr         = ghStats?.weeklyPRs?.[loginLower] || [];
    const totalMerged = ghStats?.prs?.[loginLower]?.merged || 0;
    const s1Prs       = S1_WPR_IDX.reduce((s,i)=>s+(wpr[i]||0), 0);
    const ghCombined  = (sprint===1?s1Prs:sprint===2?Math.max(0,totalMerged-s1Prs):sprint===0?totalMerged:0)+revs;
    const allGhVals   = TEAM_MEMBERS.map(m2 => {
      const ll2=m2.login.toLowerCase(), wpr2=ghStats?.weeklyPRs?.[ll2]||[], mer2=ghStats?.prs?.[ll2]?.merged||0;
      const s1p2=S1_WPR_IDX.reduce((s,i)=>s+(wpr2[i]||0),0), rv2=ghStats?.reviews?.[ll2]||0;
      return (sprint===1?s1p2:sprint===2?Math.max(0,mer2-s1p2):sprint===0?mer2:0)+rv2;
    });
    const meanGh = allGhVals.length ? allGhVals.reduce((s,v)=>s+v,0)/allGhVals.length : 1;
    const ghNorm = meanGh > 0 ? ghCombined/meanGh : 0;

    const statusCounts = Object.fromEntries(STATUSES.map(s=>[s,0]));
    let estimatedH=0, effPts=0, totalPts=0;
    taskRows.forEach(({ t, isDirecta, isDelegada }) => {
      if (!isDirecta && !isDelegada) return;
      const teamLogsT = EQUIPO_LOGINS[t.equipo]||[];
      const n = isDirecta ? ((t.assignees||[]).length||1) : (teamLogsT.length||1);
      const perH = (t.estimated_h||0)/n, perPt = (TALLA_PTS[t.size]||1)/n;
      estimatedH += perH; totalPts += perPt;
      const w = t.status==="Done"?1:t.status==="In review"?0.8:t.status==="In progress"?0.2:0;
      effPts += perPt*w;
      statusCounts[t.status]=(statusCounts[t.status]||0)+1;
    });
    const totalTasks = Object.values(statusCounts).reduce((s,v)=>s+v,0);
    const doneCount  = statusCounts["Done"];
    const cr   = totalPts>0 ? effPts/totalPts : null;
    const dev  = estimatedH>0 ? (taggedH-estimatedH)/estimatedH : 0;
    const ef   = estimatedH>0 ? (dev>0?1/(1+1.5*dev):1/(1+0.5*Math.abs(dev))) : null;
    const rendimiento = cr!==null&&ef!==null ? (0.25*cr+0.50*ef+0.25*ghNorm)*100 : null;
    const rendColor   = rendimiento===null?"var(--tx4)":rendimiento>=80?"#22c55e":rendimiento>=50?"#f59e0b":"#ef4444";

    const ghCard = (label, val, sub, col="var(--tx2)") => (
      <div style={{ background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:8, padding:"8px 12px", minWidth:80 }}>
        <div style={{ color:col, fontWeight:800, fontSize:15 }}>{val??<span style={{color:"var(--bdr2)"}}>—</span>}</div>
        <div style={{ color:"var(--tx3)", fontSize:9, textTransform:"uppercase", letterSpacing:1, marginTop:2 }}>{label}</div>
        {sub && <div style={{ color:"var(--tx4)", fontSize:9, marginTop:1 }}>{sub}</div>}
      </div>
    );

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <img src={`https://github.com/${login}.png?size=64`} alt={member.name}
              style={{ width:52, height:52, borderRadius:"50%", border:`3px solid ${tc}` }}/>
            <div>
              <div style={{ color:"var(--tx0)", fontWeight:800, fontSize:16 }}>{member.name}</div>
              <div style={{ color:"var(--tx4)", fontSize:11, marginBottom:4 }}>@{login} · {member.role}{member.coord?" · Coord":""}</div>
              <span style={{ background:`${tc}20`, color:tc, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:4 }}>Equipo {member.team}</span>
            </div>
          </div>
          <select value={login} onChange={e=>onChangePerson(e.target.value)}
            style={{ background:"var(--bg0)", border:"1px solid var(--bdr)", color:"var(--tx0)", padding:"6px 10px", borderRadius:6, fontSize:11, cursor:"pointer" }}>
            {TEAM_MEMBERS.map(m2=>(
              <option key={m2.login} value={m2.login}>{m2.name} · Eq.{m2.team}</option>
            ))}
          </select>
        </div>

        {/* ── GitHub metrics ── */}
        <div>
          <div style={{ color:"var(--tx4)", fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:8, fontWeight:700 }}>Métricas GitHub</div>
          {ghStats ? (
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {ghCard("Commits",       commits,                              null,              "#818cf8")}
              {ghCard("PRs merged",    `${pr.merged}/${pr.total}`,           pr.open>0?`${pr.open} open`:null, "#34d399")}
              {ghCard("Reviews",       revs,                                 null,              "#38bdf8")}
              {ghCard("Líneas +",      `+${lns.added.toLocaleString()}`,     `-${lns.deleted.toLocaleString()}`, "#4ade80")}
              {ghCard("Consistency",   cons!==null?`${cons}%`:null,          "sem. activas",    "#a78bfa")}
              {ghCard("PR Efficiency", prEff!==null?`${prEff}%`:null,        "merged/total",    "#fbbf24")}
              {ghCard("Collab Score",  collab,                               "revs/commits×50", "#fb923c")}
              {ghCard("Merge Time",    amt!==null?`${amt.toFixed(1)}d`:null, "días promedio",   "#e879f9")}
              {ghCard("Avg PR Size",   avgPRS!==null?`${avgPRS} lns`:null,   "lines/merged PR", "var(--tx2)")}
              {ghCard("Code Churn",    cChurn!==null?`${cChurn}%`:null,      "deleted/total",   "#f87171")}
            </div>
          ) : (
            <div style={{ color:"var(--tx4)", fontSize:11, background:"var(--bg0)", borderRadius:8, padding:"10px 14px" }}>
              Sin datos de GitHub — sincroniza desde el tab GitHub con tu token.
            </div>
          )}
        </div>

        {/* ── Tasks table ── */}
        {sprint !== -1 && taskRows.length > 0 && (
          <div>
            <div style={{ color:"var(--tx4)", fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:8, fontWeight:700 }}>
              Tareas — {totalTasks} en scope · {doneCount} done
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid var(--bdr)" }}>
                    {["ID","Tarea","S","Estado","Talla","H.Directas","H.Delegadas","H.Equipo","H.Real","⚠️"].map(h=>(
                      <th key={h} style={{ padding:"4px 8px", color:"var(--tx4)", fontWeight:700, textAlign:h==="Tarea"?"left":"center", whiteSpace:"nowrap", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {taskRows.map(({ tid, t, isDirecta, isDelegada, hDirectas, hDelegadas, hEquipo, hReal, hasImputed })=>{
                    const sm = STATUS_META[t.status] || { bg:"var(--bdr)", text:"var(--tx3)" };
                    const bg = isDirecta?"#818cf808":isDelegada?"#fbbf2408":"transparent";
                    return (
                      <tr key={tid} style={{ borderBottom:"1px solid var(--bg4)", background:bg }}>
                        <td style={{ padding:"5px 8px", whiteSpace:"nowrap" }}>
                          <a href={`https://github.com/ispp-g7-nexus/7-NexUS/issues/${tid.replace(/[^\d]/g,"")}`}
                            target="_blank" rel="noopener"
                            style={{ color:"#818cf8", textDecoration:"none", fontSize:10 }}>{tid}</a>
                        </td>
                        <td style={{ padding:"5px 8px", color:"var(--tx1)", maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={t.title}>{t.title}</td>
                        <td style={{ padding:"5px 8px", textAlign:"center" }}>
                          <span style={{ background:`${SC_P[t.sprint]||"var(--tx4)"}20`, color:SC_P[t.sprint]||"var(--tx4)", fontSize:9, padding:"1px 5px", borderRadius:3 }}>S{t.sprint}</span>
                        </td>
                        <td style={{ padding:"5px 8px", textAlign:"center" }}>
                          <span style={{ background:sm.bg, color:sm.text, fontSize:9, padding:"2px 6px", borderRadius:4, whiteSpace:"nowrap" }}>{t.status}</span>
                        </td>
                        <td style={{ padding:"5px 8px", textAlign:"center", color:"var(--tx2)", fontSize:10 }}>{t.size}</td>
                        <td style={{ padding:"5px 8px", textAlign:"center", color:hDirectas>0?"#818cf8":"var(--bdr2)", fontWeight:hDirectas>0?700:400 }}>
                          {hDirectas>0?`${hDirectas.toFixed(1)}h`:"—"}
                        </td>
                        <td style={{ padding:"5px 8px", textAlign:"center", color:hDelegadas>0?"#fbbf24":"var(--bdr2)", fontWeight:hDelegadas>0?700:400 }}>
                          {hDelegadas>0?`${hDelegadas.toFixed(1)}h`:"—"}
                        </td>
                        <td style={{ padding:"5px 8px", textAlign:"center", color:hEquipo>0?"#34d399":"var(--bdr2)" }}>
                          {hEquipo>0?`${hEquipo.toFixed(1)}h`:"—"}
                        </td>
                        <td style={{ padding:"5px 8px", textAlign:"center", color:hReal>0?"#10b981":"var(--bdr2)", fontWeight:hReal>0?700:400 }}>
                          {hReal>0?`${hReal.toFixed(1)}h`:"—"}
                        </td>
                        <td style={{ padding:"5px 8px", textAlign:"center" }}>
                          {hasImputed&&<span title="Horas en tarea no asignada" style={{ color:"#f59e0b" }}>⚠️</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop:"2px solid var(--bdr)" }}>
                    <td colSpan={5} style={{ padding:"5px 8px", color:"var(--tx4)", fontSize:10, fontWeight:700 }}>TOTAL</td>
                    <td style={{ padding:"5px 8px", textAlign:"center", color:"#818cf8", fontWeight:800 }}>{totalHDirectas.toFixed(1)}h</td>
                    <td style={{ padding:"5px 8px", textAlign:"center", color:"#fbbf24", fontWeight:800 }}>{totalHDelegadas.toFixed(1)}h</td>
                    <td style={{ padding:"5px 8px", textAlign:"center", color:"#34d399", fontWeight:800 }}>{totalHEquipo.toFixed(1)}h</td>
                    <td colSpan={2} style={{ padding:"5px 8px", textAlign:"center", color:"#10b981", fontWeight:800 }}>{totalH.toFixed(1)}h real</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── Clockify entries ── */}
        {report && (
          <div>
            <div style={{ color:"var(--tx4)", fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:8, fontWeight:700 }}>
              Entradas Clockify{rawEntries.length>0?` (${rawEntries.length}) · ${rawEntries.filter(e=>e.taskId).length} etiquetadas`:""}
            </div>
            {rawEntries.length === 0 ? (
              <div style={{ color:"var(--tx4)", fontSize:11, background:"var(--bg0)", borderRadius:8, padding:"10px 14px" }}>
                Sin entradas para {member.name}. El nombre en Clockify debe coincidir exactamente.
              </div>
            ) : (<>
              <div style={{ overflowX:"auto", maxHeight:320, overflowY:"auto", borderRadius:8, border:"1px solid var(--bdr)" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead style={{ position:"sticky", top:0, background:"var(--bg1)" }}>
                    <tr style={{ borderBottom:"1px solid var(--bdr)" }}>
                      {["Fecha","Proy","Task ID","Horas","Etiquetada","Asignada"].map(h=>(
                        <th key={h} style={{ padding:"4px 8px", color:"var(--tx4)", fontWeight:700, textAlign:"center", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawEntries.map((e,i)=>{
                      const hasTag      = !!e.taskId;
                      const task        = e.taskId ? BACKLOG_MAP[e.taskId] : null;
                      const assignees2  = task?.assignees || [];
                      const isAssigned2 = assignees2.some(a=>a.login.toLowerCase()===loginLower);
                      const isTeamEntry = task ? task.equipo===teamEquipo : false;
                      const projC = { s1:"#818cf8", s2:"#34d399", s3:"#fbbf24", dp:"#6366f1" };
                      const rowBg  = !hasTag?"#ef444408":isAssigned2?"#22c55e06":isTeamEntry?"#fbbf2406":"#f59e0b08";
                      const tagCol = hasTag?"#22c55e":"#ef4444";
                      const assCol = !hasTag?"var(--tx4)":isAssigned2?"#22c55e":isTeamEntry?"#fbbf24":"#ef4444";
                      return (
                        <tr key={i} style={{ borderBottom:"1px solid var(--bg3)", background:rowBg }}>
                          <td style={{ padding:"4px 8px", color:"var(--tx2)", textAlign:"center", whiteSpace:"nowrap" }}>{e.date||"—"}</td>
                          <td style={{ padding:"4px 8px", textAlign:"center" }}>
                            <span style={{ background:`${projC[e.project]||"var(--tx4)"}25`, color:projC[e.project]||"var(--tx4)", fontSize:9, padding:"1px 5px", borderRadius:3, fontWeight:700 }}>{e.project||"—"}</span>
                          </td>
                          <td style={{ padding:"4px 8px", color:"#818cf8", textAlign:"center", fontSize:10 }}>
                            {e.taskId||<span style={{color:"var(--bdr2)",fontStyle:"italic"}}>sin tag</span>}
                          </td>
                          <td style={{ padding:"4px 8px", color:"var(--tx0)", textAlign:"center", fontWeight:700 }}>{e.hours.toFixed(2)}h</td>
                          <td style={{ padding:"4px 8px", textAlign:"center", color:tagCol, fontWeight:800 }}>{hasTag?"✓":"✗"}</td>
                          <td style={{ padding:"4px 8px", textAlign:"center", color:assCol, fontWeight:700 }}>
                            {!hasTag?"—":isAssigned2?"✓ directa":isTeamEntry?"equipo":"⚠️ ajena"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display:"flex", gap:12, marginTop:8, flexWrap:"wrap", fontSize:10 }}>
                <span style={{ color:"#22c55e" }}>✓ {rawEntries.filter(e=>e.taskId).length} etiquetadas</span>
                <span style={{ color:"#ef4444" }}>✗ {rawEntries.filter(e=>!e.taskId).length} sin tag ({rawEntries.filter(e=>!e.taskId).reduce((s,e)=>s+e.hours,0).toFixed(1)}h)</span>
                <span style={{ color:"#f59e0b" }}>
                  ⚠️ {rawEntries.filter(e=>e.taskId&&BACKLOG_MAP[e.taskId]&&!(BACKLOG_MAP[e.taskId].assignees||[]).some(a=>a.login.toLowerCase()===loginLower)).length} en tareas no asignadas
                </span>
              </div>
            </>)}
          </div>
        )}

        {/* ── Score breakdown ── */}
        {rendimiento !== null && (
          <div>
            <div style={{ color:"var(--tx4)", fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:8, fontWeight:700 }}>Score de Rendimiento</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <div style={{ background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:8, padding:"10px 14px", flex:1, minWidth:130 }}>
                <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>CR — Ejecución (25%)</div>
                <div style={{ color:"#818cf8", fontWeight:800, fontSize:20 }}>{cr!==null?`${(cr*100).toFixed(0)}%`:"—"}</div>
                <div style={{ color:"var(--tx4)", fontSize:9, marginTop:3 }}>effPts / totalPts · {effPts.toFixed(1)}/{totalPts.toFixed(1)}</div>
              </div>
              <div style={{ background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:8, padding:"10px 14px", flex:1, minWidth:130 }}>
                <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>EF — Horas (50%)</div>
                <div style={{ color:"#34d399", fontWeight:800, fontSize:20 }}>{ef!==null?`${(ef*100).toFixed(0)}%`:"—"}</div>
                <div style={{ color:"var(--tx4)", fontSize:9, marginTop:3 }}>{taggedH.toFixed(1)}h etiq / {estimatedH.toFixed(1)}h est · desv {dev>=0?"+":""}{(dev*100).toFixed(0)}%</div>
              </div>
              <div style={{ background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:8, padding:"10px 14px", flex:1, minWidth:130 }}>
                <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>GH — GitHub (25%)</div>
                <div style={{ color:"#38bdf8", fontWeight:800, fontSize:20 }}>{(ghNorm*100).toFixed(0)}%</div>
                <div style={{ color:"var(--tx4)", fontSize:9, marginTop:3 }}>{ghCombined} PRs+reviews · media {meanGh.toFixed(1)}</div>
              </div>
              <div style={{ background:`${rendColor}12`, border:`1px solid ${rendColor}35`, borderRadius:8, padding:"10px 14px", flex:1, minWidth:130 }}>
                <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Rendimiento final</div>
                <div style={{ color:rendColor, fontWeight:800, fontSize:24 }}>{rendimiento.toFixed(0)}%</div>
                <div style={{ color:"var(--tx4)", fontSize:9, marginTop:3 }}>0.25×CR + 0.50×EF + 0.25×GH</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const viewTabs = [
    { id:"tasks",    label:"📋 Tarea vs Estimado" },
    { id:"users",    label:"👥 Persona"           },
    { id:"equipo",   label:"👤 Equipo"            },
    { id:"burndown", label:"📈 Burndown"          },
    { id:"velocity", label:"⚡ Velocidad"          },
    { id:"activity", label:"📅 Actividad"         },
    { id:"areas",    label:"📐 Áreas"             },
    { id:"coverage", label:"🏷️ Cobertura"         },
    { id:"alerts",   label:"⚠️ Alertas"           },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {showExport && <ExportMdModal report={report} sprint={sprint} onClose={() => setShowExport(false)} />}

      {/* Header */}
      <div style={{ background:"var(--bg2)", border:"1px solid #10b98130", borderRadius:12, padding:"14px 20px" }}>
        <div style={{ color:"#10b981", fontWeight:700, fontSize:14, marginBottom:2 }}>📊 Informe CSV — Clockify × Backlog</div>
        <div style={{ color:"var(--tx3)", fontSize:11 }}>Exporta el informe Detallado de Clockify en CSV y arrástralo aquí. Los tags de cada entrada deben incluir el ID de tarea (NX-S1.1, NX-S2.3...).</div>
      </div>

      {/* Cómo exportar */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"14px 20px" }}>
        <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:12, marginBottom:10 }}>📤 Cómo exportar desde Clockify</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {[
            "1. Ve a Clockify → Reports → Detailed",
            "2. Selecciona el rango de fechas del sprint",
            "3. Pulsa Export (arriba derecha) → CSV",
            "4. Arrastra el archivo descargado al área de abajo",
          ].map((s,i)=>(
            <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
              <span style={{ color:"#10b981", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>→</span>
              <span style={{ color:"var(--tx2)", fontSize:11 }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, background:"var(--bg0)", borderRadius:7, padding:"8px 12px", color:"var(--tx4)", fontSize:10 }}>
          ⚙️ Cada entrada debe tener un tag con el ID de tarea (NX-S1.1, NX-S2.3...). El tag puede ir junto a otros tags.
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e=>{e.preventDefault();setDrag(true);}}
        onDragLeave={()=>setDrag(false)}
        onDrop={onDrop}
        style={{
          border:`2px dashed ${drag?"#10b981":"var(--bdr)"}`,
          borderRadius:12, padding:"36px 20px",
          textAlign:"center", cursor:"pointer",
          background: drag?"#10b98108":"var(--bg2)",
          transition:"all .15s"
        }}
        onClick={()=>document.getElementById("csv-input").click()}
      >
        <input id="csv-input" type="file" accept=".csv" style={{ display:"none" }} onChange={e=>processFile(e.target.files[0])} />
        <div style={{ fontSize:32, marginBottom:10 }}>{status==="ok"?"✅":"📂"}</div>
        {status==="ok"
          ? <div style={{ color:"#10b981", fontWeight:700, fontSize:13 }}>{fileName}</div>
          : <div style={{ color:"var(--tx4)", fontSize:13, fontWeight:600 }}>Arrastra el CSV de Clockify aquí o haz clic para seleccionarlo</div>
        }
        {status==="ok"
          ? <div style={{ color:"var(--tx4)", fontSize:11, marginTop:4 }}>{report.totalEntries} entradas · {report.matchedEntries} con tarea · haz clic para <strong style={{color:"#10b981"}}>actualizar con un nuevo CSV</strong></div>
          : <div style={{ color:"var(--bdr2)", fontSize:11, marginTop:4 }}>Exporta el informe Detallado desde Clockify → Reports → Detailed → Export CSV</div>
        }
      </div>

      {errMsg && <div style={{ color:"#ef4444", fontSize:11, background:"#ef444415", borderRadius:7, padding:"10px 14px" }}>⚠️ {errMsg}</div>}

      {/* Dashboard */}
      {status==="ok" && report && (
        <>
          {/* Sprint filter */}
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <span style={{ color:"var(--tx3)", fontSize:11, fontWeight:600 }}>Filtrar sprint:</span>
            {[{v:0,l:"Todos"},{v:-1,l:"Sprint 0"},{v:1,l:"Sprint 1"},{v:2,l:"Sprint 2"},{v:3,l:"Sprint 3"}].map(({v,l})=>{
              const active = sprint===v;
              const c = v===0?"#10b981":v===-1?"#6366f1":sprintC[v];
              return <button key={v} onClick={()=>setSprint(v)} style={{ padding:"4px 14px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", border:`1px solid ${active?c+"60":"transparent"}`, background:active?`${c}20`:"transparent", color:active?c:"var(--tx4)", transition:"all .12s" }}>{l}</button>;
            })}
            <button onClick={() => setShowExport(true)} title="Exportar secciones Clockify a Markdown"
              style={{ marginLeft:"auto", padding:"4px 12px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                background:"#34d39915", border:"1px solid #34d39940", color:"#34d399", transition:"all .15s" }}>
              📄 Exportar MD
            </button>
          </div>

          <KpiRow />

          {/* View tabs */}
          <div style={{ display:"flex", gap:3, background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:9, padding:3, alignSelf:"flex-start", flexWrap:"wrap" }}>
            {viewTabs.map(vt=>{
              const active=view===vt.id;
              return <button key={vt.id} onClick={()=>setView(vt.id)} style={{ padding:"5px 14px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", border:active?"1px solid #10b98145":"1px solid transparent", background:active?"#10b98120":"transparent", color:active?"#10b981":"var(--tx3)", transition:"all .12s" }}>{vt.label}</button>;
            })}
            {selectedPerson && (() => {
              const pm = TEAM_MEMBERS.find(m => m.login === selectedPerson);
              const active = view === "persona";
              const tc = { A:"#3b82f6", B:"#22c55e", C:"#f59e0b", D:"#a855f7" }[pm?.team] || "#10b981";
              return (
                <div key="persona" style={{ display:"flex", alignItems:"center", gap:0 }}>
                  <button onClick={()=>setView("persona")} style={{ padding:"5px 12px", borderRadius:"6px 0 0 6px", fontSize:11, fontWeight:700, cursor:"pointer", border:active?`1px solid ${tc}45`:"1px solid transparent", background:active?`${tc}20`:"transparent", color:active?tc:"var(--tx3)", transition:"all .12s" }}>
                    👤 {pm?.name || selectedPerson}
                  </button>
                  <button onClick={()=>{ setSelectedPerson(null); setView("users"); }} style={{ padding:"5px 7px", borderRadius:"0 6px 6px 0", fontSize:11, fontWeight:700, cursor:"pointer", border:active?`1px solid ${tc}45`:"1px solid transparent", borderLeft:"none", background:active?`${tc}20`:"transparent", color:"var(--tx4)", transition:"all .12s" }} title="Cerrar">×</button>
                </div>
              );
            })()}
          </div>

          <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:18 }}>
            {view==="tasks"    && <TasksView />}
            {view==="users"    && <UsersView />}
            {view==="equipo"   && <EquipoView />}
            {view==="burndown" && <BurndownView />}
            {view==="velocity" && <VelocityView />}
            {view==="activity" && <ActivityView />}
            {view==="areas"    && <AreasView />}
            {view==="coverage" && <CoverageView />}
            {view==="alerts"   && <AlertsView />}
            {view==="persona"  && selectedPerson && <PersonPane login={selectedPerson} onChangePerson={login => setSelectedPerson(login)} />}
          </div>
        </>
      )}
    </div>
  );
}

