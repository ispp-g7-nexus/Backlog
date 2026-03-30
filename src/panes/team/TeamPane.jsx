import { useMemo, useState } from 'react';
import { TEAM_MEMBERS } from '../../constants.js';
import { BACKLOG } from '../../data.js';
import SprintSelector from '../../components/SprintSelector.jsx';
import { SIZE_H_MAP } from '../../constants.js';
import { GH_STATS_KEY } from '../../hooks/useGitHubStats.js';
import { loadClockify } from '../../lib/cache.js';
import { TC } from '../github/hooks/useGitHubData.js';

const TEAM_COLORS = TC;

function loadGhStats() {
  try { const r = localStorage.getItem(GH_STATS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

function StatBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, flex: 1 }}>
      <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 3 }} />
    </div>
  );
}

function Cell({ value, sub, color = 'var(--tx1)' }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ color, fontSize: 12, fontWeight: 700 }}>{value}</div>
      {sub !== undefined && <div style={{ color: 'var(--tx4)', fontSize: 9 }}>{sub}</div>}
    </div>
  );
}

export default function TeamPane() {
  const [view, setView] = useState('person'); // person | team
  const [sortCol, setSortCol] = useState('commits');
  const [sortDir, setSortDir] = useState(-1);
  const [selectedSprint, setSelectedSprint] = useState(null); // null = Todos

  const ghStats = useMemo(loadGhStats, []);
  const clockify = useMemo(() => loadClockify()?.report || null, []);

  const rows = useMemo(() => TEAM_MEMBERS.map(m => {
    const ll = m.login.toLowerCase();
    const commits = ghStats?.commits?.[ll] || 0;
    const pr = ghStats?.prs?.[ll] || { total: 0, merged: 0 };
    const revs = ghStats?.reviews?.[ll] || 0;
    const lns = ghStats?.lines?.[ll] || { added: 0, deleted: 0 };
    const cons = ghStats?.consistency?.[ll] ?? null;

    const sprintFilter = i => selectedSprint === null || i.sprint === selectedSprint;

    // Backlog: tareas Done asignadas a este miembro
    const doneTasks = BACKLOG.filter(i =>
      sprintFilter(i) && i.status === 'Done' && (i.assignees || []).some(a => (a.login || a).toLowerCase() === ll)
    );
    const inProgTasks = BACKLOG.filter(i =>
      sprintFilter(i) && i.status === 'In progress' && (i.assignees || []).some(a => (a.login || a).toLowerCase() === ll)
    );
    const doneH = doneTasks.reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0);
    const totalAssigned = BACKLOG.filter(i =>
      sprintFilter(i) && (i.assignees || []).some(a => (a.login || a).toLowerCase() === ll)
    ).length;

    // Clockify: horas reales
    let clockH = 0;
    if (clockify?.byEmail) {
      const email = m.email.toLowerCase();
      const entry = clockify.byEmail[email];
      if (entry) clockH = entry.total_h || 0;
    }

    // Health score (0–100)
    const maxCom = Math.max(...TEAM_MEMBERS.map(x => ghStats?.commits?.[x.login.toLowerCase()] || 0), 1);
    const maxRev = Math.max(...TEAM_MEMBERS.map(x => ghStats?.reviews?.[x.login.toLowerCase()] || 0), 1);
    const nCom = commits / maxCom;
    const nRev = revs / maxRev;
    const prEff = pr.total > 0 ? pr.merged / pr.total : 0;
    const nCons = cons != null ? cons / 100 : 0;
    const health = Math.round((0.3 * nCom + 0.3 * nRev + 0.2 * prEff + 0.2 * nCons) * 100);

    return { m, commits, pr, revs, lns, cons, doneH, doneCount: doneTasks.length, inProg: inProgTasks.length, totalAssigned, clockH, health };
  }), [ghStats, clockify, selectedSprint]);

  const sorted = useMemo(() => {
    const key = sortCol;
    return [...rows].sort((a, b) => {
      let av = 0, bv = 0;
      if (key === 'commits') { av = a.commits; bv = b.commits; }
      else if (key === 'prs') { av = a.pr.merged; bv = b.pr.merged; }
      else if (key === 'revs') { av = a.revs; bv = b.revs; }
      else if (key === 'lines') { av = a.lns.added; bv = b.lns.added; }
      else if (key === 'doneH') { av = a.doneH; bv = b.doneH; }
      else if (key === 'clockH') { av = a.clockH; bv = b.clockH; }
      else if (key === 'health') { av = a.health; bv = b.health; }
      return sortDir * (bv - av);
    });
  }, [rows, sortCol, sortDir]);

  const maxC = Math.max(...rows.map(r => r.commits), 1);
  const maxP = Math.max(...rows.map(r => r.pr.merged), 1);
  const maxR = Math.max(...rows.map(r => r.revs), 1);
  const maxL = Math.max(...rows.map(r => r.lns.added), 1);
  const maxD = Math.max(...rows.map(r => r.doneH), 1);
  const maxCl = Math.max(...rows.map(r => r.clockH), 1);

  const teamRows = useMemo(() => {
    return ['A', 'B', 'C', 'D'].map(team => {
      const ms = rows.filter(r => r.m.team === team);
      return {
        team, color: TEAM_COLORS[team],
        commits: ms.reduce((s, r) => s + r.commits, 0),
        prs: ms.reduce((s, r) => s + r.pr.merged, 0),
        revs: ms.reduce((s, r) => s + r.revs, 0),
        added: ms.reduce((s, r) => s + r.lns.added, 0),
        doneH: ms.reduce((s, r) => s + r.doneH, 0),
        clockH: ms.reduce((s, r) => s + r.clockH, 0),
        health: ms.length ? Math.round(ms.reduce((s, r) => s + r.health, 0) / ms.length) : 0,
        members: ms.length,
      };
    });
  }, [rows]);

  function SortHeader({ col, label }) {
    const active = sortCol === col;
    return (
      <th onClick={() => { if (sortCol === col) setSortDir(d => -d); else { setSortCol(col); setSortDir(-1); } }}
        style={{ cursor: 'pointer', color: active ? 'var(--tx1)' : 'var(--tx4)', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right', padding: '6px 8px', userSelect: 'none', whiteSpace: 'nowrap' }}>
        {label} {active ? (sortDir < 0 ? '↓' : '↑') : ''}
      </th>
    );
  }

  function healthColor(h) {
    if (h >= 70) return '#34d399';
    if (h >= 40) return '#fbbf24';
    return '#f87171';
  }

  const hasGh = !!ghStats;
  const hasCl = !!clockify;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--tx0)', fontWeight: 700, fontSize: 15 }}>👥 Equipo — Dashboard cruzado</span>
        <SprintSelector value={selectedSprint} onChange={setSelectedSprint} />
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
          {selectedSprint !== null && <span style={{ fontSize: 10, color: 'var(--tx4)', background: 'var(--bg0)', border: '1px solid var(--bdr)', borderRadius: 5, padding: '2px 7px' }}>Commits/PRs/Horas: totales acumulados</span>}
          {!hasGh && <span style={{ color: '#f59e0b', fontSize: 10 }}>⚠ Sin datos GitHub (pulsa Actualizar en pestaña GitHub)</span>}
          {!hasCl && <span style={{ color: '#f59e0b', fontSize: 10 }}>⚠ Sin datos Clockify (carga CSV en pestaña Horas)</span>}
        </div>
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg0)', border: '1px solid var(--bdr)', borderRadius: 9, padding: 3 }}>
          {[{ id: 'person', label: '👤 Persona' }, { id: 'team', label: '🏷 Equipo' }].map(v => {
            const active = view === v.id;
            return (
              <button key={v.id} onClick={() => setView(v.id)}
                style={{ padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: active ? '1px solid #94a3b845' : '1px solid transparent',
                  background: active ? '#94a3b820' : 'transparent',
                  color: active ? 'var(--tx2)' : 'var(--tx3)', transition: 'all .12s' }}>
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === 'person' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bdr)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--tx4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Miembro</th>
                <SortHeader col="commits" label="Commits" />
                <SortHeader col="prs" label="PRs" />
                <SortHeader col="revs" label="Reviews" />
                <SortHeader col="lines" label="Líneas+" />
                <SortHeader col="doneH" label="Done h" />
                <SortHeader col="clockH" label="Clockify h" />
                <SortHeader col="health" label="Health" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ m, commits, pr, revs, lns, doneH, doneCount, clockH, health }) => {
                const tc = TEAM_COLORS[m.team] || '#94a3b8';
                const rendimiento = clockH > 0 ? Math.round(doneH / clockH * 100) : null;
                return (
                  <tr key={m.login} style={{ borderBottom: '1px solid var(--bdr)', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '7px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: tc, flexShrink: 0 }} />
                        <div>
                          <div style={{ color: 'var(--tx1)', fontWeight: 600, fontSize: 11 }}>{m.name.split(' ').slice(0, 2).join(' ')}</div>
                          <div style={{ color: 'var(--tx4)', fontSize: 9 }}>{m.role} · {m.team}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                        <Cell value={commits} color="#818cf8" />
                        <StatBar value={commits} max={maxC} color="#818cf8" />
                      </div>
                    </td>
                    <td style={{ padding: '4px 8px' }}><Cell value={pr.merged} sub={`/${pr.total}`} color="#34d399" /></td>
                    <td style={{ padding: '4px 8px' }}><Cell value={revs} color="#f59e0b" /></td>
                    <td style={{ padding: '4px 8px' }}><Cell value={lns.added.toLocaleString()} color="#38bdf8" /></td>
                    <td style={{ padding: '4px 8px' }}><Cell value={`${doneH}h`} sub={`${doneCount} tareas`} color="#a78bfa" /></td>
                    <td style={{ padding: '4px 8px' }}>
                      <Cell value={`${clockH.toFixed(1)}h`}
                        sub={rendimiento != null ? `${rendimiento}% rend.` : undefined}
                        color={rendimiento != null ? (rendimiento >= 80 ? '#34d399' : rendimiento >= 50 ? '#fbbf24' : '#f87171') : 'var(--tx3)'} />
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                        <span style={{ color: healthColor(health), fontWeight: 700, fontSize: 12 }}>{health}</span>
                        <div style={{ width: 30, height: 5, background: 'var(--bg3)', borderRadius: 3 }}>
                          <div style={{ width: `${health}%`, height: 5, background: healthColor(health), borderRadius: 3 }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'team' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {teamRows.map(t => {
            const rendimiento = t.clockH > 0 ? Math.round(t.doneH / t.clockH * 100) : null;
            return (
              <div key={t.team} style={{ background: 'var(--bg2)', border: `1px solid ${t.color}30`, borderRadius: 12, padding: 16 }}>
                <div style={{ color: t.color, fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Equipo {t.team}</div>
                {[
                  { label: 'Commits',    value: t.commits,                color: '#818cf8' },
                  { label: 'PRs mergeadas', value: t.prs,                 color: '#34d399' },
                  { label: 'Reviews',    value: t.revs,                   color: '#f59e0b' },
                  { label: 'Líneas+',    value: t.added.toLocaleString(), color: '#38bdf8' },
                  { label: 'Done (h est.)', value: `${t.doneH}h`,        color: '#a78bfa' },
                  { label: 'Clockify h', value: `${t.clockH.toFixed(1)}h`, color: '#10b981' },
                  { label: 'Health avg', value: t.health, color: healthColor(t.health) },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--bdr)' }}>
                    <span style={{ color: 'var(--tx3)', fontSize: 11 }}>{label}</span>
                    <span style={{ color, fontWeight: 700, fontSize: 12 }}>{value}</span>
                  </div>
                ))}
                {rendimiento != null && (
                  <div style={{ marginTop: 8, fontSize: 10, color: 'var(--tx4)' }}>
                    Rendimiento: <span style={{ color: rendimiento >= 80 ? '#34d399' : rendimiento >= 50 ? '#fbbf24' : '#f87171', fontWeight: 700 }}>{rendimiento}%</span>
                    <span style={{ marginLeft: 4, color: 'var(--tx4)' }}>= doneH/clockify</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fórmula Health Score */}
      <div style={{ color: 'var(--tx4)', fontSize: 9, borderTop: '1px solid var(--bdr)', paddingTop: 8 }}>
        Health = 0.3×norm(commits) + 0.3×norm(reviews) + 0.2×(PRs mergeadas/total) + 0.2×consistencia · Rendimiento = h_done_est / h_clockify
      </div>
    </div>
  );
}
