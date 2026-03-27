import { useState } from 'react';
import { BACKLOG_MAP } from '../../../data.js';
import { SC, TEAM_MEMBERS, EQUIPO_LOGINS } from '../../../constants.js';

export default function ExportMdModal({ report, sprint, onClose }) {
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
          ? `En plazo (${Math.abs(diff)} dias de margen)`
          : `${diff} dias de retraso`;
      }
    } else if (pendingH <= 0) {
      closeDateStr = 'Completado'; closeDeltaStr = 'En plazo';
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
      `| **Dentro del milestone?** | ${closeDeltaStr} |`,
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

    const personH = (t, ll2) => {
      const ass = t.assignees || [];
      const eqL = EQUIPO_LOGINS[t.equipo] || [];
      const directlyAssigned = ass.some(a => a.login.toLowerCase() === ll2);
      const impliedByEquipo  = ass.length === 0 && eqL.includes(ll2);
      if (!directlyAssigned && !impliedByEquipo) return 0;
      const base = t.estimated_h || 0;
      return directlyAssigned
        ? base / (ass.length || 1)
        : base / (eqL.length || 1);
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

    const corrSample = active.filter(d => d.myTasks.length > 0 && d.clkH > 0);
    const xs = corrSample.map(d => d.pctDone);
    const ys = corrSample.map(d => Math.min(d.doneH / d.clkH * 100, 200));
    const nc = corrSample.length;
    const mx = nc ? xs.reduce((s, v) => s + v, 0) / nc : 0;
    const my = nc ? ys.reduce((s, v) => s + v, 0) / nc : 0;
    const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
    const corr = den > 0 ? num / den : 0;

    const cvInterp   = cvEstH <= 20 ? 'Distribucion equilibrada de carga'
      : cvEstH <= 35 ? 'Desequilibrio en el reparto de tareas'
      : 'Desequilibrio severo — revisar asignacion';
    const rendInterp = avgRend >= 150 ? 'Alta eficiencia tecnica del equipo'
      : avgRend >= 100 ? 'Rendimiento dentro de lo esperado'
      : 'Rendimiento bajo — revisar estimaciones';
    const corrInterp = Math.abs(corr) >= 0.7 ? 'Relacion logica entre esfuerzo y resultado'
      : Math.abs(corr) >= 0.4 ? 'Correlacion moderada entre tareas y horas'
      : 'Baja correlacion tareas–horas';

    const TEAM_NAMES = { A:'Infraestructura y coordinacion', B:'Producto y gestion', C:'Desarrollo e incidencias', D:'Backend e IA' };
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
      `# Informe de rendimiento y metricas final — Sprint ${sprint} – NexUS`, ``,
      `<p align="center">`,
      `  <img src="../../images/logo-app.png" alt="Logo NexUS" width="500">`,
      `</p>`, ``,
      `<div align="center">`, ``,
      `<p>`,
      `  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square" alt="Version">`,
      `  <img src="https://img.shields.io/badge/Estado-Finalizado-green?style=flat-square" alt="Estado">`,
      `  <img src="https://img.shields.io/badge/Grupo-7--NexUS-green?style=flat-square" alt="Grupo">`,
      `  <img src="https://img.shields.io/badge/Asignatura-ISPP-red?style=flat-square" alt="Asignatura">`,
      `</p>`, ``,
      `</div>`, ``,
      `---`, ``,
      `**Proyecto:** NexUS  `,
      `**Grupo:** 7 - NexUS  `,
      `**Asignatura:** Ingenieria del Software y Practica Profesional (ISPP)  `,
      `**Institucion:** ETSII – Universidad de Sevilla  `,
      `**Curso academico:** 2025/2026  `,
      `**Sprint:** S${sprint} — ${fFull(spInfo?.start)} al ${fFull(spInfo?.end)}  `, ``,
      `<p align="center">`,
      `  <img src="../../images/logo-etsii.jpe" alt="Logo ETSII" width="400">`,
      `</p>`, ``,
      `---`, ``,
      `## Historial de versiones`, ``,
      `| Version | Fecha | Cambio principal |`,
      `|---------|-------|------------------|`,
      `| 1.0.0 | ${today} | Creacion del documento |`, ``,
      `---`, ``,
      `| Metrica Global | Valor | Interpretacion |`,
      `| :--- | :---: | :--- |`,
      `| **Media completitud tareas** | **${avgDone.toFixed(1)}%** | ${avgDone >= 70 ? 'Progreso solido (0 tareas sin avance)' : avgDone >= 50 ? 'Progreso moderado' : 'Progreso bajo — revisar bloqueos'} |`,
      `| **Rendimiento medio** | **${avgRend.toFixed(1)}%** | ${rendInterp} |`,
      `| **Desbalance de carga (CV)** | **${cvEstH.toFixed(0)}%** | ${cvInterp} |`,
      `| **Equilibrio del equipo (sigma)** | **${sigmaDone.toFixed(1)}%** | ${sigmaDone <= 15 ? 'Ritmo de entrega sincronizado' : 'Alta dispersion en el ritmo de entrega'} |`,
      `| **Correlacion tareas - horas** | **${corr.toFixed(2)}** | ${corrInterp} |`, ``,
      `---`, ``,
      `## 1. Analisis por celulas de trabajo`, ``,
      ...teamSections,
      `---`, ``,
      `## 2. Registro detallado de rendimiento (${active.length} Integrantes)`, ``,
      `| Equipo | Usuario | Tareas (D/Total) | % Done | Horas Real | Rendimiento | Desviacion |`,
      `| :--- | :--- | :---: | :---: | :---: | :---: | :---: |`,
      tableRows, ``,
      `---`, ``,
      `## 3. Conclusiones y Plan de Accion${nextSp}`, ``,
      `1.  **Redistribucion de carga:** El **CV del ${cvEstH.toFixed(0)}%** ${cvEstH > 30 ? 'confirma un desequilibrio. Se debe nivelar la carga en el siguiente Sprint Planning.' : 'muestra una distribucion aceptable. Mantener el criterio de asignacion actual.'}`,
      `2.  **Gestion de cuellos de botella:** Revisar tareas en *In Review* y priorizarlas antes de iniciar nuevas funcionalidades para evitar acumulacion de deuda tecnica.`,
      `3.  **Ajuste de velocidad:** Con un rendimiento medio del **${avgRend.toFixed(1)}%**, ${avgRend > 130 ? 'el equipo ha demostrado mayor eficiencia que lo estimado. Se propone aumentar el compromiso del Backlog en el siguiente sprint en un **15%**.' : 'las estimaciones se ajustan bien a la velocidad real. Mantener la cadencia actual.'}`,
      `4.  **Optimizacion individual:** ${lowPerf.length > 0 ? `${lowPerf.length} miembro(s) con rendimiento por debajo del 80% (${lowPerf.map(d => d.m.name.split(' ')[0]).join(', ')}). Revisar posibles bloqueos.` : 'Todos los miembros mantienen un rendimiento aceptable.'}`, ``,
      `---`,
      `*Este informe ha sido generado automaticamente integrando datos de Clockify y el estado del Backlog en GitHub al cierre del ${fFull(spInfo?.end) !== '—' ? fFull(spInfo?.end) : today}.*`,
    ].join('\n');
  }

  const spLabel = sprint > 0 ? sprint : 'X';
  const docs = [
    { id:'burndown',   label:'Burndown §4–5',     file:`7-DP-S${spLabel}-Burndown-Chart.md`,      gen:genBurndown   },
    { id:'velocity',   label:'Velocity §3',         file:`7-DP-S1-Velocity-Chart.md`,               gen:genVelocity   },
    { id:'retro',      label:'Retro §1',            file:`7-DP-S${spLabel}-Retrospectiva.md`,       gen:genRetro      },
    { id:'dedication', label:'Dedication Template', file:`7-DP-S${spLabel}-Dedication-Template.md`, gen:genDedication },
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
          <div style={{ fontWeight:700, fontSize:14, color:"var(--tx0)" }}>Exportar Markdown con datos reales</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--tx3)", cursor:"pointer", fontSize:20, lineHeight:1 }}>x</button>
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
          {' — '}Descarga la seccion generada y reemplazala en tu repositorio, o copiala directamente.
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
            {copied ? "Copiado!" : "Copiar seccion"}
          </button>
          <button onClick={handleDownload}
            style={{ flex:1, padding:"8px", borderRadius:6, fontWeight:700, fontSize:12, cursor:"pointer",
              background:"#34d39915", border:"1px solid #34d39940", color:"#34d399" }}>
            Descargar {active.file}
          </button>
        </div>
      </div>
    </div>
  );
}
