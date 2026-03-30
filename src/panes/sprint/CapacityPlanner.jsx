import { useState, useMemo } from 'react';
import { TEAM_MEMBERS } from '../../team.js';

const CAPACITY_KEY = 'nexus_capacity_v1';

function loadCapacity() {
  try { return JSON.parse(localStorage.getItem(CAPACITY_KEY) || '{}'); } catch { return {}; }
}

function saveCapacity(data) {
  try { localStorage.setItem(CAPACITY_KEY, JSON.stringify(data)); } catch {}
}

export default function CapacityPlanner({ items, sc, activeSprint }) {
  const [capacity, setCapacity] = useState(loadCapacity);

  const sprintKey = `s${activeSprint}`;

  const getAvail = (login) => capacity[sprintKey]?.[login] ?? '';

  const setAvail = (login, hours) => {
    const next = { ...capacity, [sprintKey]: { ...(capacity[sprintKey] || {}), [login]: hours === '' ? '' : Number(hours) } };
    setCapacity(next);
    saveCapacity(next);
  };

  // Committed hours per member from backlog items
  const committed = useMemo(() => {
    const map = {};
    items.forEach(item => {
      const est = Number(item.estimate) || 0;
      if (!est) return;
      const assignees = item.assignees || [];
      if (assignees.length > 0) {
        const share = est / assignees.length;
        assignees.forEach(a => { map[a.login] = (map[a.login] || 0) + share; });
      }
    });
    return map;
  }, [items]);

  const sprintDays = sc ? Math.ceil((new Date(sc.end) - new Date(sc.start)) / 86400000) + 1 : 10;
  const defaultAvail = Math.round(sprintDays * 6 * 0.7); // ~70% working hours

  const rows = TEAM_MEMBERS.map(m => {
    const avail = getAvail(m.login);
    const availH = avail === '' ? defaultAvail : Number(avail);
    const committedH = committed[m.login] || 0;
    const load = availH > 0 ? committedH / availH : 0;
    return { m, avail, availH, committedH, load };
  });

  const totalAvail = rows.reduce((s, r) => s + r.availH, 0);
  const totalComm = rows.reduce((s, r) => s + r.committedH, 0);
  const teamLoad = totalAvail > 0 ? totalComm / totalAvail : 0;

  function loadColor(load) {
    if (load > 1.1) return '#f87171';
    if (load > 0.85) return '#fbbf24';
    return '#34d399';
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { l: 'Capacidad total', v: `${totalAvail}h`, c: 'var(--tx2)' },
          { l: 'Comprometido', v: `${totalComm.toFixed(1)}h`, c: '#818cf8' },
          { l: 'Carga media', v: `${(teamLoad * 100).toFixed(0)}%`, c: loadColor(teamLoad) },
          { l: 'Días sprint', v: `${sprintDays}d`, c: 'var(--tx3)' },
        ].map(k => (
          <div key={k.l} className="card" style={{ padding: '8px 14px', flex: '1 0 100px' }}>
            <div style={{ color: k.c, fontSize: 16, fontWeight: 800 }}>{k.v}</div>
            <div style={{ color: 'var(--tx4)', fontSize: 10, marginTop: 2 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: 'var(--bg0)', borderBottom: '1px solid var(--bdr)' }}>
              {['Miembro', 'Equipo', 'Disponible (h)', 'Comprometido', 'Carga', ''].map(h => (
                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--tx4)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, avail, availH, committedH, load }) => (
              <tr key={m.login} style={{ borderBottom: '1px solid var(--bdr)' }}>
                <td style={{ padding: '6px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={`https://github.com/${m.login}.png?size=28`} style={{ width: 20, height: 20, borderRadius: '50%' }} />
                    <span style={{ color: 'var(--tx1)', fontWeight: 600 }}>{m.name.split(' ').slice(0, 2).join(' ')}</span>
                  </div>
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <span style={{ fontSize: 10, color: 'var(--tx4)', background: 'var(--bg0)', border: '1px solid var(--bdr)', borderRadius: 4, padding: '1px 5px' }}>
                    {m.team}
                  </span>
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    step="1"
                    value={avail}
                    placeholder={String(defaultAvail)}
                    onChange={e => setAvail(m.login, e.target.value)}
                    style={{ width: 60, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--bdr)', background: 'var(--bg0)', color: 'var(--tx1)', fontSize: 11 }}
                  />
                </td>
                <td style={{ padding: '6px 10px', color: committedH > 0 ? '#818cf8' : 'var(--tx4)' }}>
                  {committedH.toFixed(1)}h
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg0)', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                      <div style={{ width: `${Math.min(load * 100, 100)}%`, height: '100%', background: loadColor(load), borderRadius: 3, transition: 'width .3s' }} />
                    </div>
                    <span style={{ color: loadColor(load), fontSize: 10, minWidth: 28 }}>{(load * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td style={{ padding: '6px 10px' }}>
                  {load > 1.1 && <span style={{ fontSize: 9, color: '#f87171' }}>Sobrecargado</span>}
                  {load > 0.85 && load <= 1.1 && <span style={{ fontSize: 9, color: '#fbbf24' }}>Al límite</span>}
                  {load <= 0.85 && committedH > 0 && <span style={{ fontSize: 9, color: '#34d399' }}>OK</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: 'var(--tx4)', marginTop: 6 }}>
        * Disponible por defecto: {defaultAvail}h ({sprintDays} días × 6h × 70%). Edítalo por persona.
      </div>
    </div>
  );
}
