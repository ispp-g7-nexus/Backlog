import { useState, useEffect } from 'react';
import { fetchFromGitHub } from '../../api/github.js';
import { _storedLive } from '../../data.js';
import { GH_STATS_KEY } from '../../hooks/useGitHubStats.js';
import { useApp } from '../../context/AppContext.jsx';
import { updateConfig, linkProject, fetchSprints, createSprint, updateSprint, deleteSprint, fetchLabels, createLabel, updateLabel, deleteLabel } from '../../api/backend.js';
import { CACHE_KEYS, getJson, setJson } from '../../lib/cache.js';

function loadSettings() {
  return getJson(CACHE_KEYS.SETTINGS, {});
}
function saveSettings(s) {
  setJson(CACHE_KEYS.SETTINGS, s);
}

function SectionTitle({ children }) {
  return <div style={{ color: 'var(--tx3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>{children}</div>;
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', color: 'var(--tx2)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</label>
      {hint && <div style={{ color: 'var(--tx4)', fontSize: 10, marginBottom: 4 }}>{hint}</div>}
      {children}
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder, ...rest }) {
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{ width: '100%', background: 'var(--bg0)', border: '1px solid var(--bdr)', borderRadius: 6,
        padding: '7px 10px', color: 'var(--tx1)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
      {...rest}
    />
  );
}

/* ── TAB: Conexión ── */
function ConnectionTab({ settings, setSettings }) {
  const { user, project, setProject } = useApp();
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem(CACHE_KEYS.API_URL) || '');
  const [linkForm, setLinkForm] = useState({ github_org: 'ispp-g7-nexus', github_repo: 'ispp-g7-nexus', project_number: '', name: 'NexUS Backlog' });
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem(CACHE_KEYS.GH_TOKEN) || '');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncErr, setSyncErr] = useState('');

  const saveApiUrl = () => {
    const v = apiUrl.trim().replace(/\/$/, '');
    if (v) localStorage.setItem(CACHE_KEYS.API_URL, v);
    else localStorage.removeItem(CACHE_KEYS.API_URL);
    setSyncMsg('URL guardada. Recarga para aplicar.');
    setTimeout(() => setSyncMsg(''), 2500);
  };

  const doLink = async () => {
    if (!linkForm.github_org || !linkForm.github_repo || !linkForm.project_number) {
      setLinkErr('Rellena todos los campos'); return;
    }
    setLinking(true); setLinkErr(''); setLinkMsg('');
    try {
      const p = await linkProject(linkForm);
      localStorage.setItem(CACHE_KEYS.PROJECT_ID, p.id);
      setProject(p);
      setLinkMsg(`✅ Vinculado: ${p.name}`);
    } catch (e) { setLinkErr(e.message); }
    finally { setLinking(false); }
  };

  const doUnlink = () => {
    localStorage.removeItem(CACHE_KEYS.PROJECT_ID);
    setProject(null);
  };

  const saveToken = () => {
    if (token.trim()) localStorage.setItem(CACHE_KEYS.GH_TOKEN, token.trim());
    else localStorage.removeItem(CACHE_KEYS.GH_TOKEN);
    setSyncMsg('Token guardado');
    setTimeout(() => setSyncMsg(''), 2000);
  };

  const doSync = async () => {
    const t = token.trim() || localStorage.getItem(CACHE_KEYS.GH_TOKEN);
    if (!t) { setSyncErr('Introduce un token primero'); return; }
    setSyncing(true); setSyncErr(''); setSyncMsg('Descargando datos…');
    try {
      const data = await fetchFromGitHub(t);
      localStorage.setItem(CACHE_KEYS.LIVE_DATA, JSON.stringify(data));
      localStorage.removeItem(CACHE_KEYS.EDITS);
      setSyncMsg(`✅ ${data.total} HU sincronizadas. Recargando…`);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) { setSyncErr(e.message); setSyncMsg(''); }
    finally { setSyncing(false); }
  };

  const clearAll = () => {
    if (!confirm('¿Borrar todos los datos locales (ediciones, cache, token)?')) return;
    [CACHE_KEYS.LIVE_DATA, CACHE_KEYS.EDITS, CACHE_KEYS.DELETED, CACHE_KEYS.CREATED,
      CACHE_KEYS.GH_TOKEN, GH_STATS_KEY, CACHE_KEYS.SCHEMA].forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  return (
    <div style={{ maxWidth: 500 }}>

      {/* Servidor backend */}
      <SectionTitle>Servidor backend</SectionTitle>
      <Field label="URL de la API" hint="Ej: http://localhost:4000/api — déjalo vacío para modo standalone">
        <div style={{ display: 'flex', gap: 6 }}>
          <Input value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="http://localhost:4000/api"
            onKeyDown={e => e.key === 'Enter' && saveApiUrl()} />
          <button onClick={saveApiUrl} style={btnStyle('#818cf8')}>Guardar</button>
        </div>
      </Field>
      {syncMsg && !syncErr && <div style={{ color: '#34d399', fontSize: 11, marginBottom: 8 }}>{syncMsg}</div>}

      {/* Proyecto vinculado */}
      {user && (
        <>
          <SectionTitle>Repositorio vinculado</SectionTitle>
          {project ? (
            <div style={{ background: 'var(--bg2)', border: '1px solid #34d39930', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#34d399', fontWeight: 700, fontSize: 12 }}>{project.name}</div>
                  <div style={{ color: 'var(--tx4)', fontSize: 10, marginTop: 2 }}>
                    {project.github_org}/{project.github_repo} · Proyecto #{project.project_number}
                  </div>
                </div>
                <button onClick={doUnlink} style={btnStyle('#71717a', 'small')}>Desvincular</button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ color: 'var(--tx3)', fontSize: 11, marginBottom: 10 }}>
                Vincula tu repositorio de GitHub para activar sincronización segura y persistencia en servidor.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <Field label="Organización">
                  <Input value={linkForm.github_org} onChange={e => setLinkForm(f => ({ ...f, github_org: e.target.value }))} placeholder="ispp-g7-nexus" />
                </Field>
                <Field label="Repositorio">
                  <Input value={linkForm.github_repo} onChange={e => setLinkForm(f => ({ ...f, github_repo: e.target.value }))} placeholder="ispp-g7-nexus" />
                </Field>
                <Field label="Número de proyecto GitHub">
                  <Input type="number" value={linkForm.project_number} onChange={e => setLinkForm(f => ({ ...f, project_number: e.target.value }))} placeholder="1" />
                </Field>
                <Field label="Nombre">
                  <Input value={linkForm.name} onChange={e => setLinkForm(f => ({ ...f, name: e.target.value }))} placeholder="NexUS Backlog" />
                </Field>
              </div>
              <button onClick={doLink} disabled={linking} style={btnStyle('#818cf8')}>
                {linking ? 'Vinculando…' : 'Vincular repositorio'}
              </button>
              {linkMsg && <div style={{ color: '#34d399', fontSize: 11, marginTop: 6 }}>{linkMsg}</div>}
              {linkErr && <div style={{ color: '#f87171', fontSize: 11, marginTop: 6 }}>⚠️ {linkErr}</div>}
            </div>
          )}
        </>
      )}

      {/* PAT — acceso directo (fallback) */}
      <SectionTitle>{user && project ? 'Acceso directo (fallback sin backend)' : 'GitHub Personal Access Token'}</SectionTitle>
      <Field label="Token" hint="Necesita permisos: repo, read:project, read:org">
        <Input type="password" value={token} onChange={e => setToken(e.target.value)}
          placeholder="ghp_…" onKeyDown={e => e.key === 'Enter' && saveToken()} />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={saveToken} style={btnStyle('#818cf8')}>Guardar token</button>
        <button onClick={doSync} disabled={syncing} style={btnStyle('#34d399')}>
          {syncing ? '⏳ Sincronizando…' : '🔄 Sincronizar datos del proyecto'}
        </button>
      </div>
      {syncErr && <div style={{ color: '#f87171', fontSize: 11, marginBottom: 8 }}>⚠️ {syncErr}</div>}

      {_storedLive && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: 'var(--tx3)', marginBottom: 16 }}>
          Último sync: <b style={{ color: 'var(--tx1)' }}>{new Date(_storedLive.fetchedAt).toLocaleString('es-ES')}</b>
          {' · '}{_storedLive.total} HU
        </div>
      )}

      <SectionTitle>Cache y datos locales</SectionTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => { localStorage.removeItem(GH_STATS_KEY); alert('Cache de GitHub eliminada. Recarga para refrescar.'); }}
          style={btnStyle('#f59e0b', 'small')}>Borrar cache GitHub</button>
        <button onClick={() => { localStorage.removeItem(CACHE_KEYS.SCHEMA); alert('Schema eliminado.'); }}
          style={btnStyle('#f59e0b', 'small')}>Borrar schema proyecto</button>
        <button onClick={clearAll} style={btnStyle('#ef4444', 'small')}>⚠️ Borrar todo</button>
      </div>
    </div>
  );
}

/* ── TAB: Sprints ── */
const DEFAULT_SPRINT_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#38bdf8', '#a78bfa'];

function SprintsTab({ settings, setSettings, projectId }) {
  const defaultSprints = {
    1: { label: 'Sprint 1', start: '2026-02-19', end: '2026-03-05', color: '#818cf8' },
    2: { label: 'Sprint 2', start: '2026-03-12', end: '2026-03-26', color: '#34d399' },
    3: { label: 'Sprint 3', start: '2026-04-02', end: '2026-04-16', color: '#fbbf24' },
  };
  const [form, setForm] = useState(() => settings.sprints || defaultSprints);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  // Load from backend if available
  useEffect(() => {
    if (!projectId) return;
    fetchSprints(projectId).then(rows => {
      if (!rows?.length) return;
      const map = {};
      rows.forEach(r => { map[r.number ?? r.id] = { id: r.id, label: r.name, start: r.start_date?.slice(0,10) || '', end: r.end_date?.slice(0,10) || '', color: r.color || '#818cf8' }; });
      setForm(map);
    }).catch(() => {});
  }, [projectId]);

  const set = (n, k, v) => setForm(f => ({ ...f, [n]: { ...f[n], [k]: v } }));

  const addSprint = () => {
    const keys = Object.keys(form).map(Number);
    const n = keys.length ? Math.max(...keys) + 1 : 1;
    const color = DEFAULT_SPRINT_COLORS[(n - 1) % DEFAULT_SPRINT_COLORS.length];
    setForm(f => ({ ...f, [n]: { label: `Sprint ${n}`, start: '', end: '', color } }));
  };

  const removeSprint = async (n) => {
    if (!confirm(`¿Eliminar Sprint ${n}?`)) return;
    const { id } = form[n] || {};
    if (projectId && id) {
      try { await deleteSprint(projectId, id); } catch (e) { setErr(e.message); return; }
    }
    setForm(f => { const next = { ...f }; delete next[n]; return next; });
  };

  const save = async () => {
    setErr('');
    const next = { ...settings, sprints: form };
    setSettings(next); saveSettings(next);
    if (projectId) {
      try {
        for (const [n, s] of Object.entries(form)) {
          const payload = { name: s.label, number: Number(n), start_date: s.start || null, end_date: s.end || null, color: s.color };
          if (s.id) await updateSprint(projectId, s.id, payload);
          else { const created = await createSprint(projectId, payload); set(n, 'id', created.id); }
        }
      } catch (e) { setErr(e.message); return; }
    }
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const sortedKeys = Object.keys(form).map(Number).sort((a, b) => a - b);

  return (
    <div style={{ maxWidth: 520 }}>
      <SectionTitle>Configuración de sprints</SectionTitle>
      {sortedKeys.map(n => (
        <div key={n} style={{ background: 'var(--bg2)', border: `1px solid ${form[n]?.color}30`, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: form[n]?.color, fontWeight: 700, fontSize: 12 }}>Sprint {n}</span>
            <button onClick={() => removeSprint(n)} style={{ ...btnStyle('#ef4444', 'small'), padding: '2px 8px' }}>✕ Eliminar</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Etiqueta">
              <Input value={form[n]?.label || ''} onChange={e => set(n, 'label', e.target.value)} />
            </Field>
            <Field label="Color">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="color" value={form[n]?.color || '#818cf8'} onChange={e => set(n, 'color', e.target.value)}
                  style={{ width: 36, height: 30, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
                <span style={{ color: 'var(--tx3)', fontSize: 11 }}>{form[n]?.color}</span>
              </div>
            </Field>
            <Field label="Inicio">
              <Input type="date" value={form[n]?.start || ''} onChange={e => set(n, 'start', e.target.value)} />
            </Field>
            <Field label="Fin">
              <Input type="date" value={form[n]?.end || ''} onChange={e => set(n, 'end', e.target.value)} />
            </Field>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={addSprint} style={btnStyle('#818cf8')}>+ Añadir sprint</button>
        <button onClick={save} style={btnStyle('#34d399')}>Guardar sprints</button>
        {saved && <span style={{ color: '#34d399', fontSize: 11 }}>✓ Guardado</span>}
        {err && <span style={{ color: '#f87171', fontSize: 11 }}>⚠ {err}</span>}
      </div>
      <div style={{ color: 'var(--tx4)', fontSize: 10, marginTop: 8 }}>Los cambios afectan a gráficos y calendarios. Recarga la página para aplicarlos.</div>
    </div>
  );
}

/* ── TAB: Labels ── */
function LabelsTab({ projectId }) {
  const [labels, setLabels] = useState([]);
  const [newLabel, setNewLabel] = useState({ name: '', color: '#818cf8', description: '' });
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!projectId) return;
    fetchLabels(projectId).then(rows => setLabels(rows || [])).catch(() => {});
  }, [projectId]);

  const add = async () => {
    if (!newLabel.name.trim()) { setErr('El nombre es obligatorio'); return; }
    setErr('');
    try {
      const created = await createLabel(projectId, newLabel);
      setLabels(l => [...l, created]);
      setNewLabel({ name: '', color: '#818cf8', description: '' });
      setSaved('Etiqueta creada'); setTimeout(() => setSaved(''), 2000);
    } catch (e) { setErr(e.message); }
  };

  const update = async (id, data) => {
    try { const updated = await updateLabel(projectId, id, data); setLabels(l => l.map(x => x.id === id ? updated : x)); }
    catch (e) { setErr(e.message); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta etiqueta?')) return;
    try { await deleteLabel(projectId, id); setLabels(l => l.filter(x => x.id !== id)); }
    catch (e) { setErr(e.message); }
  };

  if (!projectId) return <div style={{ color: 'var(--tx4)', fontSize: 12 }}>Conecta un proyecto para gestionar etiquetas.</div>;

  return (
    <div style={{ maxWidth: 520 }}>
      <SectionTitle>Etiquetas del proyecto</SectionTitle>
      {labels.length === 0 && <div style={{ color: 'var(--tx4)', fontSize: 11, marginBottom: 12 }}>Sin etiquetas. Crea la primera.</div>}
      {labels.map(lb => (
        <div key={lb.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: 7, padding: '8px 12px' }}>
          <input type="color" value={lb.color || '#818cf8'} onChange={e => update(lb.id, { ...lb, color: e.target.value })}
            style={{ width: 28, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent', flexShrink: 0 }} />
          <div style={{ background: `${lb.color}20`, color: lb.color, border: `1px solid ${lb.color}50`, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{lb.name}</div>
          <input value={lb.description || ''} onChange={e => update(lb.id, { ...lb, description: e.target.value })}
            placeholder="Descripción" style={{ flex: 1, background: 'var(--bg0)', border: '1px solid var(--bdr)', borderRadius: 5, padding: '4px 8px', color: 'var(--tx2)', fontSize: 11, outline: 'none' }} />
          <button onClick={() => remove(lb.id)} style={{ ...btnStyle('#ef4444', 'small'), padding: '2px 8px', flexShrink: 0 }}>✕</button>
        </div>
      ))}

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '12px', marginTop: 8 }}>
        <div style={{ color: 'var(--tx3)', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Nueva etiqueta</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="color" value={newLabel.color} onChange={e => setNewLabel(l => ({ ...l, color: e.target.value }))}
            style={{ width: 32, height: 30, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
          <Input value={newLabel.name} onChange={e => setNewLabel(l => ({ ...l, name: e.target.value }))} placeholder="Nombre *" style={{ width: 140 }} />
          <Input value={newLabel.description} onChange={e => setNewLabel(l => ({ ...l, description: e.target.value }))} placeholder="Descripción" style={{ flex: 1 }} />
          <button onClick={add} style={btnStyle('#34d399')}>+ Añadir</button>
        </div>
      </div>
      {err && <div style={{ color: '#f87171', fontSize: 11, marginTop: 6 }}>⚠ {err}</div>}
      {saved && <div style={{ color: '#34d399', fontSize: 11, marginTop: 6 }}>✓ {saved}</div>}
    </div>
  );
}

/* ── TAB: Costes ── */
function CostesTab({ settings, setSettings, projectId }) {
  const defaults = {
    hbs: 25.50, gg: 13, bi: 6, iva: 21, presupuesto: 150000,
    perfiles: [
      { perfil: 'Jefe de Proyecto', mult: 2.20, precioH: 56.10, count: 1 },
      { perfil: 'Consultor',        mult: 1.70, precioH: 43.35, count: 1 },
      { perfil: 'Coordinador',      mult: 1.42, precioH: 36.21, count: 6 },
      { perfil: 'Programador',      mult: 1.12, precioH: 28.56, count: 13 },
    ],
  };
  const costes = settings.costes || defaults;
  const [form, setForm] = useState(costes);
  const [saved, setSaved] = useState(false);

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setPerfil = (i, k, v) => setForm(f => {
    const p = [...f.perfiles];
    p[i] = { ...p[i], [k]: k === 'perfil' ? v : Number(v) };
    return { ...f, perfiles: p };
  });

  const save = () => {
    const next = { ...settings, costes: form };
    setSettings(next); saveSettings(next);
    if (projectId) updateConfig(projectId, 'costes', form).catch(() => {});
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <SectionTitle>Tarifas PPT (Junta de Andalucía)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <Field label="HBS — Hora Básica de Servicio (€/h)">
          <Input type="number" value={form.hbs} onChange={e => setF('hbs', e.target.value)} />
        </Field>
        <Field label="Presupuesto total adjudicado (€ IVA inc.)">
          <Input type="number" value={form.presupuesto} onChange={e => setF('presupuesto', e.target.value)} />
        </Field>
        <Field label="Gastos Generales (%)">
          <Input type="number" value={form.gg} onChange={e => setF('gg', e.target.value)} />
        </Field>
        <Field label="Beneficio Industrial (%)">
          <Input type="number" value={form.bi} onChange={e => setF('bi', e.target.value)} />
        </Field>
        <Field label="IVA (%)">
          <Input type="number" value={form.iva} onChange={e => setF('iva', e.target.value)} />
        </Field>
      </div>

      <SectionTitle>Perfiles y tarifas horarias</SectionTitle>
      {form.perfiles.map((p, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginBottom: 8, alignItems: 'end' }}>
          <Field label={i === 0 ? 'Perfil' : undefined}>
            <Input value={p.perfil} onChange={e => setPerfil(i, 'perfil', e.target.value)} />
          </Field>
          <Field label={i === 0 ? 'Multiplicador' : undefined}>
            <Input type="number" step="0.01" value={p.mult} onChange={e => setPerfil(i, 'mult', e.target.value)} />
          </Field>
          <Field label={i === 0 ? '€/h' : undefined}>
            <Input type="number" step="0.01" value={p.precioH} onChange={e => setPerfil(i, 'precioH', e.target.value)} />
          </Field>
          <Field label={i === 0 ? 'Personas' : undefined}>
            <Input type="number" min="0" value={p.count} onChange={e => setPerfil(i, 'count', e.target.value)} />
          </Field>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button onClick={save} style={btnStyle('#34d399')}>Guardar costes</button>
        {saved && <span style={{ color: '#34d399', fontSize: 11 }}>✓ Guardado</span>}
      </div>
    </div>
  );
}

/* ── TAB: Riesgos ── */
function RiesgosTab({ settings, setSettings, projectId }) {
  const defaults = {
    blockedDays: 5, overloadPct: 30, velocityDropPct: 20,
    burnRateWarn: 120, coveragePct: 70, mergeTimeDays: 3,
  };
  const risks = settings.risks || defaults;
  const [form, setForm] = useState(risks);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: Number(v) }));

  const save = () => {
    const next = { ...settings, risks: form };
    setSettings(next); saveSettings(next);
    if (projectId) updateConfig(projectId, 'risks', form).catch(() => {});
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const thresholds = [
    { key: 'blockedDays',    label: 'Días en "In progress" sin avance (alerta)',  unit: 'días'  },
    { key: 'overloadPct',    label: 'Sobrecarga de equipo (% máximo por persona)', unit: '%'    },
    { key: 'velocityDropPct',label: 'Caída de velocidad respecto sprint anterior', unit: '%'    },
    { key: 'burnRateWarn',   label: 'Proyección de gasto sobre presupuesto',       unit: '%'    },
    { key: 'coveragePct',    label: 'Cobertura mínima de tests requerida',         unit: '%'    },
    { key: 'mergeTimeDays',  label: 'Tiempo medio de merge aceptable',             unit: 'días' },
  ];

  return (
    <div style={{ maxWidth: 480 }}>
      <SectionTitle>Umbrales de riesgo</SectionTitle>
      {thresholds.map(t => (
        <Field key={t.key} label={t.label}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="number" value={form[t.key]} onChange={e => set(t.key, e.target.value)}
              style={{ width: 80, background: 'var(--bg0)', border: '1px solid var(--bdr)', borderRadius: 6,
                padding: '6px 8px', color: 'var(--tx1)', fontSize: 12, outline: 'none' }} />
            <span style={{ color: 'var(--tx4)', fontSize: 11 }}>{t.unit}</span>
          </div>
        </Field>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <button onClick={save} style={btnStyle('#34d399')}>Guardar umbrales</button>
        {saved && <span style={{ color: '#34d399', fontSize: 11 }}>✓ Guardado</span>}
      </div>
    </div>
  );
}

/* ── TAB: Métricas ── */
function MetricasTab() {
  const rows = [
    { label: 'Velocity',           formula: 'Σ points(done) / sprint',                           desc: 'Capacidad del equipo' },
    { label: 'Rendimiento',        formula: 'h_done_est / h_clockify × 100',                     desc: 'Eficiencia real' },
    { label: 'Consumo',            formula: 'h_clockify / h_estimadas × 100',                    desc: 'Gasto de horas' },
    { label: 'Completitud',        formula: 'h_done / h_estimadas × 100',                        desc: 'Progreso sprint' },
    { label: 'Collaboration',      formula: 'reviews / (commits + 1) × 50',                      desc: 'Equilibrio prod./revisión' },
    { label: 'PR Efficiency',      formula: 'merged / total_prs × 100',                          desc: 'Calidad PRs' },
    { label: 'Health Score',       formula: '0.3×norm(commits) + 0.3×norm(reviews) + 0.2×prEff + 0.2×consistency', desc: 'Score compuesto' },
    { label: 'Distribución carga', formula: 'σ(h) / μ(h)',                                       desc: 'CV: más bajo = mejor' },
    { label: 'Precisión est.',     formula: 'h_real / h_estimada',                               desc: '<1 sobreest., >1 subestimado' },
    { label: 'PEM',                formula: 'Σ(horas × HBS × multiplicador)',                    desc: 'Presupuesto ejecución material' },
  ];
  return (
    <div>
      <SectionTitle>Fórmulas de métricas (referencia)</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(r => (
          <div key={r.label} style={{ background: 'var(--bg2)', border: '1px solid var(--bdr)', borderRadius: 7, padding: '8px 12px', display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 10, alignItems: 'center' }}>
            <div style={{ color: 'var(--tx1)', fontSize: 11, fontWeight: 700 }}>{r.label}</div>
            <code style={{ color: '#818cf8', fontSize: 10, background: 'var(--bg0)', padding: '2px 6px', borderRadius: 4 }}>{r.formula}</code>
            <div style={{ color: 'var(--tx4)', fontSize: 10, textAlign: 'right' }}>{r.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ color: 'var(--tx4)', fontSize: 10, marginTop: 10 }}>La edición de fórmulas estará disponible cuando se integre el backend.</div>
    </div>
  );
}

function btnStyle(color, size = 'normal') {
  const pad = size === 'small' ? '5px 10px' : '7px 16px';
  return {
    padding: pad, borderRadius: 6, fontSize: size === 'small' ? 10 : 11, fontWeight: 700, cursor: 'pointer',
    background: `${color}15`, border: `1px solid ${color}40`, color,
  };
}

const TABS = [
  { id: 'conexion', label: '🔑 Conexión' },
  { id: 'sprints',  label: '📅 Sprints'  },
  { id: 'costes',   label: '💰 Costes'   },
  { id: 'riesgos',  label: '⚠ Riesgos'  },
  { id: 'metricas', label: '📊 Métricas' },
];

export default function SettingsPane() {
  const { project } = useApp();
  const projectId = project?.id || null;
  const [tab, setTab] = useState('conexion');
  const [settings, setSettings] = useState(loadSettings);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ color: 'var(--tx0)', fontWeight: 700, fontSize: 15 }}>⚙ Configuración</div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--bdr)', paddingBottom: 2 }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '6px 14px', borderRadius: '6px 6px 0 0', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: active ? 'var(--bg2)' : 'transparent',
                border: active ? '1px solid var(--bdr)' : '1px solid transparent',
                borderBottom: active ? '1px solid var(--bg2)' : '1px solid transparent',
                color: active ? 'var(--tx1)' : 'var(--tx3)', transition: 'all .12s' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ paddingTop: 4 }}>
        {tab === 'conexion' && <ConnectionTab settings={settings} setSettings={setSettings} />}
        {tab === 'sprints'  && <SprintsTab settings={settings} setSettings={setSettings} projectId={projectId} />}
        {tab === 'costes'   && <CostesTab settings={settings} setSettings={setSettings} projectId={projectId} />}
        {tab === 'riesgos'  && <RiesgosTab settings={settings} setSettings={setSettings} projectId={projectId} />}
        {tab === 'metricas' && <MetricasTab />}
      </div>
    </div>
  );
}
