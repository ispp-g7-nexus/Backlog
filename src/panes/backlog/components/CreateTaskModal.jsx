import { useState, useEffect } from 'react';
import { createIssue, addToProject, updateProjectField, fetchIssueTemplates } from '../../../api/github.js';

export default function CreateTaskModal({ sprint, area, nextId, defaultTipo, allEquipos, allTipos, statuses, onClose, onCreated }) {
  const [form, setForm] = useState({
    id: nextId, title: '', body: '', area,
    tipo: defaultTipo || '', equipo: '', status: 'Backlog', size: '',
    startDate: '', targetDate: '', estimate: '',
  });
  const [templates, setTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    const token = localStorage.getItem('nexus_gh_token');
    if (token) fetchIssueTemplates(token).then(setTemplates).catch(() => {});
  }, []);

  const buildItem = () => ({
    id: form.id, sprint, milestone: `S${sprint}`, area: form.area,
    title: form.title, size: form.size || null, status: form.status || 'Backlog',
    equipo: form.equipo || null, tipo: form.tipo || null, assignees: [],
    url: null, state: 'OPEN',
    startDate: form.startDate || null, targetDate: form.targetDate || null,
    estimate: form.estimate !== '' ? Number(form.estimate) : null,
  });

  const handleLocal = () => {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    onCreated(buildItem());
  };

  const handleGitHub = async () => {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    const token = localStorage.getItem('nexus_gh_token');
    if (!token) { setError('No hay token de GitHub configurado'); return; }
    setSaving(true); setError(null);
    try {
      const issue = await createIssue(token, {
        title: `[${form.id}] ${form.title}`,
        body: form.body,
        labels: form.area ? [form.area] : [],
        assignees: [],
      });
      try {
        const projItem = await addToProject(token, issue.node_id);
        const flds = [];
        if (form.status) flds.push(updateProjectField(token, projItem.id, 'Status', form.status));
        if (form.tipo) flds.push(updateProjectField(token, projItem.id, 'Tipo', form.tipo));
        if (form.equipo) flds.push(updateProjectField(token, projItem.id, 'Equipo', form.equipo));
        if (form.size) flds.push(updateProjectField(token, projItem.id, 'Size', form.size));
        if (form.estimate) flds.push(updateProjectField(token, projItem.id, 'Estimate', Number(form.estimate)));
        await Promise.allSettled(flds);
      } catch (projErr) {
        setError(`Issue creado en GitHub (#${issue.number}), pero no se pudo añadir al proyecto: ${projErr.message}`);
        onCreated({ ...buildItem(), url: issue.html_url });
        return;
      }
      onCreated({ ...buildItem(), url: issue.html_url });
    } catch (e) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="badge badge-info font-bold">Nueva tarea</span>
          <span className="text-muted text-base">{area} · S{sprint}</span>
        </div>

        {templates.length > 0 && (
          <div className="mb-2">
            <label className="input-label">Plantilla</label>
            <select onChange={e => { const t = templates.find(t => t.name === e.target.value); if (t) set('body', t.body); }} className="input">
              <option value="">— Sin plantilla —</option>
              {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-2 gap-2 mb-2">
          <div>
            <label className="input-label">ID</label>
            <input value={form.id} onChange={e => set('id', e.target.value)} className="input" style={{ fontFamily:'monospace' }} />
          </div>
          <div>
            <label className="input-label">Área / Etiqueta</label>
            <input value={form.area} onChange={e => set('area', e.target.value)} className="input" />
          </div>
        </div>

        <div className="mb-2">
          <label className="input-label">Título *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Como usuario quiero…" className="input" autoFocus />
        </div>

        <div className="mb-2">
          <label className="input-label">Descripción</label>
          <textarea value={form.body} onChange={e => set('body', e.target.value)} rows={5} className="textarea" />
        </div>

        <div className="grid grid-3 gap-2 mb-2">
          <div>
            <label className="input-label">Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="input">
              <option value="">—</option>
              {allTipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Equipo</label>
            <select value={form.equipo} onChange={e => set('equipo', e.target.value)} className="input">
              <option value="">—</option>
              {allEquipos.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Estado</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input">
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-4 gap-2 mb-4">
          <div>
            <label className="input-label">Talla</label>
            <select value={form.size} onChange={e => set('size', e.target.value)} className="input">
              <option value="">—</option>
              {['XS','S','M','L','XL'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Inicio</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className="input" />
          </div>
          <div>
            <label className="input-label">Fin</label>
            <input type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} className="input" />
          </div>
          <div>
            <label className="input-label">Est. (h)</label>
            <input type="number" step="0.5" min="0" value={form.estimate} onChange={e => set('estimate', e.target.value)} className="input" />
          </div>
        </div>

        {error && <div className="badge-danger" style={{ fontSize:11, marginBottom:10, padding:'6px 10px', borderRadius:6 }}>{error}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn">Cancelar</button>
          <button onClick={handleLocal} disabled={saving} className="btn" style={{ borderColor:'#6366f150', color:'#818cf8' }}>Solo local</button>
          <button onClick={handleGitHub} disabled={saving} className="btn btn-primary" style={{ opacity: saving ? .6 : 1 }}>
            {saving ? 'Creando…' : '+ Crear en GitHub'}
          </button>
        </div>
      </div>
    </div>
  );
}
