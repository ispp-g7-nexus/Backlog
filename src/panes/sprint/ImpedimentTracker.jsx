import { useState } from 'react';
import { TEAM_MEMBERS } from '../../team.js';

const IMPED_KEY = 'nexus_impediments_v1';

function load() {
  try { return JSON.parse(localStorage.getItem(IMPED_KEY) || '[]'); } catch { return []; }
}
function save(data) {
  try { localStorage.setItem(IMPED_KEY, JSON.stringify(data)); } catch {}
}

const EMPTY_FORM = { title: '', desc: '', reportedBy: '', linkedTask: '' };

export default function ImpedimentTracker({ activeSprint, items }) {
  const [impediments, setImpediments] = useState(load);
  const [form, setForm] = useState(null); // null = closed, {} = open
  const [resolvingId, setResolvingId] = useState(null);
  const [resolutionText, setResolutionText] = useState('');

  const sprintKey = `s${activeSprint}`;
  const sprintImped = impediments.filter(i => i.sprint === sprintKey);
  const open = sprintImped.filter(i => i.status === 'open');
  const resolved = sprintImped.filter(i => i.status === 'resolved');

  function addImpediment() {
    if (!form?.title?.trim()) return;
    const next = [...impediments, {
      id: `IMP-${Date.now()}`,
      sprint: sprintKey,
      title: form.title.trim(),
      desc: form.desc?.trim() || '',
      reportedBy: form.reportedBy || '',
      linkedTask: form.linkedTask || '',
      status: 'open',
      createdAt: new Date().toISOString(),
      resolution: '',
    }];
    setImpediments(next);
    save(next);
    setForm(null);
  }

  function resolve(id) {
    const next = impediments.map(i => i.id === id
      ? { ...i, status: 'resolved', resolution: resolutionText.trim(), resolvedAt: new Date().toISOString() }
      : i
    );
    setImpediments(next);
    save(next);
    setResolvingId(null);
    setResolutionText('');
  }

  function reopen(id) {
    const next = impediments.map(i => i.id === id ? { ...i, status: 'open', resolution: '', resolvedAt: null } : i);
    setImpediments(next);
    save(next);
  }

  function remove(id) {
    const next = impediments.filter(i => i.id !== id);
    setImpediments(next);
    save(next);
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '—';

  function ImpedCard({ imp }) {
    const isResolving = resolvingId === imp.id;
    return (
      <div className="card" style={{ marginBottom: 8, borderColor: imp.status === 'resolved' ? 'var(--bdr)' : '#f8717130', opacity: imp.status === 'resolved' ? 0.7 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 16, marginTop: 1 }}>{imp.status === 'resolved' ? '✅' : '🚧'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ color: 'var(--tx0)', fontWeight: 700, fontSize: 12 }}>{imp.title}</span>
              {imp.linkedTask && (
                <span style={{ fontSize: 9, color: '#818cf8', background: '#6366f115', border: '1px solid #6366f130', borderRadius: 4, padding: '1px 5px' }}>{imp.linkedTask}</span>
              )}
              <span style={{ fontSize: 9, color: 'var(--tx4)', marginLeft: 'auto' }}>{imp.id} · {fmtDate(imp.createdAt)}</span>
            </div>
            {imp.desc && <div style={{ color: 'var(--tx3)', fontSize: 11, marginBottom: 4 }}>{imp.desc}</div>}
            {imp.reportedBy && (
              <div style={{ fontSize: 10, color: 'var(--tx4)' }}>Reportado por: <strong>{imp.reportedBy}</strong></div>
            )}
            {imp.status === 'resolved' && imp.resolution && (
              <div style={{ marginTop: 6, padding: '6px 10px', background: '#34d39910', border: '1px solid #34d39930', borderRadius: 6, fontSize: 11, color: '#34d399' }}>
                ✓ {imp.resolution}
              </div>
            )}
            {isResolving && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <input
                  value={resolutionText}
                  onChange={e => setResolutionText(e.target.value)}
                  placeholder="Descripción de la resolución…"
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bdr)', background: 'var(--bg0)', color: 'var(--tx1)', fontSize: 11 }}
                  onKeyDown={e => e.key === 'Enter' && resolve(imp.id)}
                  autoFocus
                />
                <button onClick={() => resolve(imp.id)} className="btn btn-sm" style={{ background: '#34d39920', color: '#34d399', border: '1px solid #34d39940' }}>Resolver</button>
                <button onClick={() => setResolvingId(null)} className="btn btn-sm">Cancelar</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {imp.status === 'open' && !isResolving && (
              <button onClick={() => { setResolvingId(imp.id); setResolutionText(''); }}
                className="btn btn-sm" style={{ fontSize: 10, background: '#34d39915', color: '#34d399', border: '1px solid #34d39940' }}>Resolver</button>
            )}
            {imp.status === 'resolved' && (
              <button onClick={() => reopen(imp.id)} className="btn btn-sm" style={{ fontSize: 10 }}>Reabrir</button>
            )}
            <button onClick={() => remove(imp.id)} className="btn btn-sm" style={{ fontSize: 10, color: '#f87171' }}>✕</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <span className="card" style={{ padding: '6px 12px', fontSize: 12 }}>
            <span style={{ color: '#f87171', fontWeight: 800 }}>{open.length}</span>
            <span style={{ color: 'var(--tx4)', fontSize: 10 }}> abiertos</span>
          </span>
          <span className="card" style={{ padding: '6px 12px', fontSize: 12 }}>
            <span style={{ color: '#34d399', fontWeight: 800 }}>{resolved.length}</span>
            <span style={{ color: 'var(--tx4)', fontSize: 10 }}> resueltos</span>
          </span>
        </div>
        <button onClick={() => setForm(EMPTY_FORM)} className="btn btn-sm" style={{ background: '#6366f115', color: '#818cf8', border: '1px solid #6366f140' }}>
          + Añadir impedimento
        </button>
      </div>

      {/* New impediment form */}
      {form && (
        <div className="card" style={{ marginBottom: 12, borderColor: '#6366f130' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--tx0)', marginBottom: 10 }}>Nuevo impedimento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Título del impedimento *" autoFocus
              style={{ padding: '6px 10px', borderRadius: 5, border: '1px solid var(--bdr)', background: 'var(--bg0)', color: 'var(--tx1)', fontSize: 12 }} />
            <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
              placeholder="Descripción (opcional)"
              style={{ padding: '6px 10px', borderRadius: 5, border: '1px solid var(--bdr)', background: 'var(--bg0)', color: 'var(--tx1)', fontSize: 12, resize: 'vertical', minHeight: 60 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={form.reportedBy} onChange={e => setForm(f => ({ ...f, reportedBy: e.target.value }))}
                style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bdr)', background: 'var(--bg0)', color: form.reportedBy ? 'var(--tx1)' : 'var(--tx4)', fontSize: 11 }}>
                <option value="">Reportado por…</option>
                {TEAM_MEMBERS.map(m => <option key={m.login} value={m.name}>{m.name}</option>)}
              </select>
              <select value={form.linkedTask} onChange={e => setForm(f => ({ ...f, linkedTask: e.target.value }))}
                style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bdr)', background: 'var(--bg0)', color: form.linkedTask ? 'var(--tx1)' : 'var(--tx4)', fontSize: 11 }}>
                <option value="">Tarea vinculada (opcional)</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.id} — {i.title?.slice(0, 40)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setForm(null)} className="btn btn-sm">Cancelar</button>
              <button onClick={addImpediment} className="btn btn-sm" style={{ background: '#6366f120', color: '#818cf8', border: '1px solid #6366f145' }} disabled={!form.title?.trim()}>
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open */}
      {open.length > 0 && (
        <div>
          <div style={{ color: '#f87171', fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Abiertos ({open.length})</div>
          {open.map(i => <ImpedCard key={i.id} imp={i} />)}
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: '#34d399', fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>Resueltos ({resolved.length})</div>
          {resolved.map(i => <ImpedCard key={i.id} imp={i} />)}
        </div>
      )}

      {sprintImped.length === 0 && !form && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--tx4)' }}>
          Sin impedimentos registrados en este sprint.
        </div>
      )}
    </div>
  );
}
