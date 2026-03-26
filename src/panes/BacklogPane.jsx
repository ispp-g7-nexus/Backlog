import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { BACKLOG, rawData, SPRINTS } from '../data.js';
import { STATUS_META, AREA_COLORS, SIZE_META, SIZE_H_MAP, SC } from '../constants.js';
import { SizeBadge, StatusBadge } from '../components/badges.jsx';
import { updateIssueTitle, updateProjectField, fetchProjectSchema, addAssignee, removeAssignee, createIssue, addToProject, fetchIssueTemplates } from '../api/github.js';
import { TEAM_MEMBERS } from '../team.js';

const FIELD_GH_MAP = {
  status: 'Status', size: 'Size', equipo: 'Equipo', tipo: 'Tipo',
  startDate: 'Start date', targetDate: 'Target date', estimate: 'Estimate',
};

const STATUSES = ["Backlog", "Ready", "In progress", "In review", "Done"];
const STATUS_COLORS = {
  "Backlog":     "#52525b",
  "Ready":       "#38bdf8",
  "In progress": "#fbbf24",
  "In review":   "#c4b5fd",
  "Done":        "#34d399",
};

function CreateTaskModal({ sprint, area, nextId, defaultTipo, allEquipos, allTipos, statuses, onClose, onCreated }) {
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
      // Intentar añadir al proyecto (requiere scope project:write)
      try {
        const projItem = await addToProject(token, issue.node_id);
        const flds = [];
        if (form.status) flds.push(updateProjectField(token, projItem.id, 'Status', form.status));
        if (form.tipo)   flds.push(updateProjectField(token, projItem.id, 'Tipo', form.tipo));
        if (form.equipo) flds.push(updateProjectField(token, projItem.id, 'Equipo', form.equipo));
        if (form.size)   flds.push(updateProjectField(token, projItem.id, 'Size', form.size));
        if (form.estimate) flds.push(updateProjectField(token, projItem.id, 'Estimate', Number(form.estimate)));
        await Promise.allSettled(flds);
      } catch (projErr) {
        setError(`Issue creado en GitHub (#${issue.number}), pero no se pudo añadir al proyecto: ${projErr.message}. Asegúrate de que tu token tiene el scope "project" (PAT clásico) o el permiso "Projects: Read and write" (PAT fino). Aparecerá en el próximo sync.`);
        onCreated({ ...buildItem(), url: issue.html_url });
        return;
      }
      onCreated({ ...buildItem(), url: issue.html_url });
    } catch (e) { setError(e.message); setSaving(false); }
  };

  const inp = { background:'var(--bg0)', border:'1px solid var(--bdr)', borderRadius:6, padding:'5px 8px', fontSize:11, color:'var(--tx1)', width:'100%', boxSizing:'border-box', marginTop:3 };
  const lbl = { fontSize:10, color:'var(--tx4)', textTransform:'uppercase', letterSpacing:'.07em' };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'#00000070', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:14, padding:'20px 24px', width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto', scrollbarWidth:'thin' }}
        className="fdrop">
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <span style={{ background:'#6366f120', border:'1px solid #6366f140', borderRadius:6, padding:'2px 8px', fontSize:11, color:'#818cf8', fontWeight:700 }}>Nueva tarea</span>
          <span style={{ color:'var(--tx3)', fontSize:12 }}>{area} · S{sprint}</span>
        </div>

        {templates.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <label style={lbl}>Plantilla</label>
            <select onChange={e => { const t = templates.find(t => t.name === e.target.value); if (t) set('body', t.body); }} style={{ ...inp }}>
              <option value="">— Sin plantilla —</option>
              {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div>
            <label style={lbl}>ID</label>
            <input value={form.id} onChange={e => set('id', e.target.value)} style={{ ...inp, fontFamily:'monospace' }} />
          </div>
          <div>
            <label style={lbl}>Área / Etiqueta</label>
            <input value={form.area} onChange={e => set('area', e.target.value)} style={inp} />
          </div>
        </div>

        <div style={{ marginBottom:10 }}>
          <label style={lbl}>Título *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Como usuario quiero…" style={{ ...inp, fontSize:13, color:'var(--tx0)' }} autoFocus />
        </div>

        <div style={{ marginBottom:10 }}>
          <label style={lbl}>Descripción</label>
          <textarea value={form.body} onChange={e => set('body', e.target.value)} rows={5} style={{ ...inp, resize:'vertical', fontFamily:'inherit' }} />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
          <div>
            <label style={lbl}>Tipo</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={inp}>
              <option value="">—</option>
              {allTipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Equipo</label>
            <select value={form.equipo} onChange={e => set('equipo', e.target.value)} style={inp}>
              <option value="">—</option>
              {allEquipos.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Estado</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:16 }}>
          <div>
            <label style={lbl}>Talla</label>
            <select value={form.size} onChange={e => set('size', e.target.value)} style={inp}>
              <option value="">—</option>
              {['XS','S','M','L','XL'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Inicio</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Fin</label>
            <input type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Est. (h)</label>
            <input type="number" step="0.5" min="0" value={form.estimate} onChange={e => set('estimate', e.target.value)} style={inp} />
          </div>
        </div>

        {error && <div style={{ color:'#f87171', fontSize:11, marginBottom:10, padding:'6px 10px', background:'#dc262615', borderRadius:6 }}>{error}</div>}

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid var(--bdr)', background:'transparent', color:'var(--tx2)', cursor:'pointer', fontSize:12 }}>Cancelar</button>
          <button onClick={handleLocal} disabled={saving} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #6366f150', background:'#6366f115', color:'#818cf8', cursor:'pointer', fontSize:12, fontWeight:600 }}>Solo local</button>
          <button onClick={handleGitHub} disabled={saving} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:'#6366f1', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, opacity: saving ? .6 : 1 }}>
            {saving ? 'Creando…' : '+ Crear en GitHub'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BacklogPane({ sprint }) {
  const sc = sprint ? SC[sprint] : null;
  const [view,  setView]  = useState("tabla");
  const [stf,   setStf]   = useState([]);
  const [sf,    setSf]    = useState([]);
  const [af,    setAf]    = useState([]);
  const [ef,    setEf]    = useState([]);
  const [tf,    setTf]    = useState([]);
  const [pf,    setPf]    = useState([]);
  const [query, setQuery] = useState("");
  const [open,  setOpen]  = useState({});
  const toggleOpen = (id) => setOpen(p => ({ ...p, [id]: !p[id] }));
  const [edits,   setEdits]   = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_edits_v1') || '{}'); } catch { return {}; } });
  const [editing, setEditing] = useState(null);
  const editValRef = useRef('');
  const [editVal, setEditValState] = useState('');
  const setEditVal = (v) => { editValRef.current = v; setEditValState(v); };
  const [saved,   setSaved]   = useState(null);
  const [hovered, setHovered] = useState(null);
  const [syncing, setSyncing] = useState(null); // { id, field } | null
  const [syncErr, setSyncErr] = useState(null); // { id, field, msg } | null
  const [schemaFields, setSchemaFields] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nexus_project_schema_v1') || 'null')?.fields || {}; } catch { return {}; }
  });
  useEffect(() => {
    if (Object.keys(schemaFields).length > 0) return;
    const token = localStorage.getItem('nexus_gh_token');
    if (!token) return;
    fetchProjectSchema(token).then(s => setSchemaFields(s.fields)).catch(() => {});
  }, []);
  const [pickerOpen, setPickerOpen] = useState(null); // item.id | null
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!pickerOpen) return;
    const close = () => setPickerOpen(null);
    setTimeout(() => document.addEventListener('click', close), 0);
    window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [pickerOpen]);
  const [fieldDropdown, setFieldDropdown] = useState(null); // { id, field } | null
  const [fieldDropPos, setFieldDropPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!fieldDropdown) return;
    const close = () => setFieldDropdown(null);
    setTimeout(() => document.addEventListener('click', close), 0);
    window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [fieldDropdown]);
  const [hoveredAssignee, setHoveredAssignee] = useState(null); // { itemId, login } | null
  const hoverTimerRef = useRef(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletedIds, setDeletedIds] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('nexus_deleted_v1') || '[]')); } catch { return new Set(); } });
  const [createdItems, setCreatedItems] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_created_v1') || '[]'); } catch { return []; } });
  const [createModal, setCreateModal] = useState(null); // { area, sprint } | null

  const items = useMemo(() => sprint === null ? BACKLOG : BACKLOG.filter(i => i.sprint === sprint), [sprint]);
  const resolvedItems = useMemo(() => {
    const base = items.filter(i => !deletedIds.has(i.id)).map(i => edits[i.id] ? { ...i, ...edits[i.id] } : i);
    const created = createdItems
      .filter(i => (sprint === null || i.sprint === sprint) && !deletedIds.has(i.id))
      .map(i => edits[i.id] ? { ...i, ...edits[i.id] } : i);
    return [...base, ...created];
  }, [items, edits, deletedIds, createdItems, sprint]);
  const areas = useMemo(() => [...new Set(items.map(i => i.area))].sort(), [items]);
  const areaColor = useMemo(() => {
    const m = {};
    areas.forEach((a, i) => { m[a] = AREA_COLORS[i % AREA_COLORS.length]; });
    return m;
  }, [areas]);
  const equipos = useMemo(() => [...new Set(items.map(i => i.equipo).filter(Boolean))].sort(), [items]);
  const tipos   = useMemo(() => [...new Set(items.map(i => i.tipo).filter(Boolean))].sort(), [items]);
  const persons = useMemo(() => {
    const m = {};
    resolvedItems.forEach(i => (i.assignees || []).forEach(a => { if (!m[a.login]) m[a.login] = a; }));
    return Object.values(m).sort((a, b) => a.login.localeCompare(b.login));
  }, [resolvedItems]);

  const allEquipos = useMemo(() => Object.keys(schemaFields['Equipo']?.options || {}).sort(), [schemaFields]);
  const allTipos   = useMemo(() => Object.keys(schemaFields['Tipo']?.options   || {}).sort(), [schemaFields]);

  const toggle = (arr, set, v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const filtered = useMemo(() => resolvedItems.filter(item => {
    if (stf.length && !stf.includes(item.status)) return false;
    if (sf.length  && !sf.includes(item.size))    return false;
    if (af.length  && !af.includes(item.area))    return false;
    if (ef.length  && !ef.includes(item.equipo))  return false;
    if (tf.length  && !tf.includes(item.tipo))    return false;
    if (pf.length  && !(item.assignees || []).some(a => pf.includes(a.login))) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [resolvedItems, stf, sf, af, ef, tf, pf, query]);

  const byArea = useMemo(() => {
    const m = {};
    filtered.forEach(i => { (m[i.area] ??= []).push(i); });
    return m;
  }, [filtered]);

  const byStatus = useMemo(() => {
    const m = {};
    STATUSES.forEach(s => { m[s] = []; });
    filtered.forEach(i => { (m[i.status] ??= []).push(i); });
    return m;
  }, [filtered]);

  const areaMinId = useMemo(() => {
    const m = {};
    items.forEach(item => {
      const n = parseInt(item.id.match(/\.(\d+)$/)?.[1] ?? '9999', 10);
      if (!(item.area in m) || n < m[item.area]) m[item.area] = n;
    });
    return m;
  }, [items]);

  const areaStats = useMemo(() =>
    Object.entries(byArea)
      .sort(([a], [b]) => (areaMinId[a] ?? 9999) - (areaMinId[b] ?? 9999))
      .map(([area, its]) => ({
        area,
        total:   its.length,
        done:    its.filter(i => i.status === "Done").length,
        inProg:  its.filter(i => i.status === "In progress").length,
        inRev:   its.filter(i => i.status === "In review").length,
        ready:   its.filter(i => i.status === "Ready").length,
        backlog: its.filter(i => i.status === "Backlog").length,
        totalH:  its.reduce((s, i) => s + (SIZE_H_MAP[i.size] || 0), 0),
        items:   its,
      }))
  , [byArea, areaMinId]);

  const stats = {
    total:      filtered.length,
    inProgress: filtered.filter(i => i.status === "In progress").length,
    inReview:   filtered.filter(i => i.status === "In review").length,
    done:       filtered.filter(i => i.status === "Done").length,
  };
  const hasFilters = stf.length || sf.length || af.length || ef.length || tf.length || pf.length || query;
  const clearAll   = () => { setStf([]); setSf([]); setAf([]); setEf([]); setTf([]); setPf([]); setQuery(""); };

  const fmtDate = d => d ? `${d.slice(8,10)}/${d.slice(5,7)}` : null;
  const ganttPos = (item, s) => {
    const c = SC[s];
    if (!c || !item.startDate || !item.targetDate) return { left:0, width:100 };
    const tS = new Date(c.start).getTime(), tE = new Date(c.end).getTime(), dur = tE - tS;
    if (dur <= 0) return { left:0, width:100 };
    const l = Math.max(0, Math.min(100, (new Date(item.startDate).getTime() - tS) / dur * 100));
    const r = Math.max(0, Math.min(100, (new Date(item.targetDate).getTime() - tS) / dur * 100));
    return { left: l, width: Math.max(2, r - l) };
  };

  const getVal = (item, field) => edits[item.id]?.[field] ?? item[field];

  const nextIdForSprint = (sp) => {
    const prefix = `NX-S${sp}.`;
    const allIds = [
      ...BACKLOG.filter(i => i.sprint === sp).map(i => i.id),
      ...createdItems.filter(i => i.sprint === sp).map(i => i.id),
    ];
    const maxNum = allIds.reduce((mx, id) => {
      if (!id.startsWith(prefix)) return mx;
      const n = parseInt(id.slice(prefix.length), 10);
      return isNaN(n) ? mx : Math.max(mx, n);
    }, 0);
    return `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
  };

  const mostCommonTipoForArea = (area) => {
    const areaItems = BACKLOG.filter(i => i.area === area && i.tipo);
    if (!areaItems.length) return null;
    const counts = {};
    areaItems.forEach(i => { counts[i.tipo] = (counts[i.tipo] || 0) + 1; });
    return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || null;
  };
  const startEdit = (e, id, field, cur) => {
    e.stopPropagation();
    setEditing({ id, field });
    const initVal = cur != null ? String(cur) : '';
    editValRef.current = initVal;
    setEditValState(initVal);
  };
  const commitEdit = (id, field) => {
    const raw = editValRef.current;
    const v = field === 'estimate' ? (raw === '' ? null : Number(raw)) : (raw === '' ? null : raw);
    const next = { ...edits, [id]: { ...(edits[id] || {}), [field]: v } };
    setEdits(next);
    try { localStorage.setItem('nexus_edits_v1', JSON.stringify(next)); } catch {}
    try {
      const liveRaw = localStorage.getItem('nexus_live_data');
      if (liveRaw) {
        const live = JSON.parse(liveRaw);
        const raw = live.items.find(i => { const m = i.title?.match(/^\[([^\]]+)\]/); return m?.[1] === id; });
        if (raw) {
          if (field === 'title') { const pfx = raw.title.match(/^(\[[^\]]+\]\s*)/)?.[1] ?? ''; raw.title = pfx + (v ?? ''); }
          else { raw[field] = v; }
          localStorage.setItem('nexus_live_data', JSON.stringify(live));
        }
      }
    } catch {}
    setEditing(null);
    setSaved({ id, field });
    setTimeout(() => setSaved(p => p?.id === id && p?.field === field ? null : p), 1600);

    const token = localStorage.getItem('nexus_gh_token');
    if (token && v != null) {
      let syncPromise = null;
      if (field === 'title') {
        const item = items.find(i => i.id === id);
        if (item?.url) syncPromise = updateIssueTitle(token, item.url, id, v);
      } else if (FIELD_GH_MAP[field]) {
        try {
          const liveRaw = localStorage.getItem('nexus_live_data');
          if (liveRaw) {
            const nodeId = JSON.parse(liveRaw).items
              .find(i => i.title?.match(/^\[([^\]]+)\]/)?.[1] === id)?.id;
            if (nodeId) syncPromise = updateProjectField(token, nodeId, FIELD_GH_MAP[field], v);
          }
        } catch {}
      }
      if (syncPromise) {
        setSyncing({ id, field });
        setSyncErr(null);
        syncPromise
          .then(() => setSyncing(null))
          .catch(err => {
            setSyncing(null);
            setSyncErr({ id, field, msg: err.message });
            setTimeout(() => setSyncErr(p => p?.id === id ? null : p), 4000);
          });
      }
    }
  };
  const toggleAssignee = (item, member) => {
    const current = (getVal(item, 'assignees') || []);
    const isAssigned = current.some(a => a.login.toLowerCase() === member.login.toLowerCase());
    const newAssignees = isAssigned
      ? current.filter(a => a.login.toLowerCase() !== member.login.toLowerCase())
      : [...current, { login: member.login, name: member.name, avatarUrl: `https://github.com/${member.login}.png` }];
    const next = { ...edits, [item.id]: { ...(edits[item.id] || {}), assignees: newAssignees } };
    setEdits(next);
    try { localStorage.setItem('nexus_edits_v1', JSON.stringify(next)); } catch {}
    const token = localStorage.getItem('nexus_gh_token');
    if (token && item.url) {
      setSyncing({ id: item.id, field: 'assignees' });
      setSyncErr(null);
      (isAssigned ? removeAssignee : addAssignee)(token, item.url, member.login)
        .then(() => setSyncing(null))
        .catch(err => {
          setSyncing(null);
          setSyncErr({ id: item.id, field: 'assignees', msg: err.message });
          setTimeout(() => setSyncErr(p => p?.id === item.id ? null : p), 4000);
        });
    }
  };

  const doDelete = (item) => {
    const next = new Set([...deletedIds, item.id]);
    setDeletedIds(next);
    try { localStorage.setItem('nexus_deleted_v1', JSON.stringify([...next])); } catch {}
    setDeleteConfirm(null);
  };

  function renderAssignees(item) {
    const current = getVal(item, 'assignees') || [];
    const currentLogins = current.map(a => a.login.toLowerCase());
    const isOpen = pickerOpen === item.id;
    const isSyncing = syncing?.id === item.id && syncing?.field === 'assignees';
    const isErr     = syncErr?.id  === item.id && syncErr?.field  === 'assignees';
    return (
      <div style={{ position:'relative', display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}
        onClick={e => e.stopPropagation()}>
        <button
          onClick={e => { e.stopPropagation(); if (!isOpen) { const r = e.currentTarget.getBoundingClientRect(); setPickerPos({ top: r.bottom + 4, left: r.left }); } setPickerOpen(isOpen ? null : item.id); }}
          style={{ width:18, height:18, borderRadius:'50%', border:'1px dashed #6366f180', background:'transparent',
            color:'#818cf8', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            padding:0, lineHeight:1, flexShrink:0 }}>+</button>
        {current.slice(0, 5).map(a => {
          const isHov = hoveredAssignee?.itemId === item.id && hoveredAssignee?.login === a.login;
          return (
            <div key={a.login} style={{ position:'relative', width:18, height:18, flexShrink:0 }}
              onMouseEnter={() => {
                hoverTimerRef.current = setTimeout(() => setHoveredAssignee({ itemId: item.id, login: a.login }), 1500);
              }}
              onMouseLeave={() => {
                clearTimeout(hoverTimerRef.current);
                setHoveredAssignee(null);
              }}>
              <img src={a.avatarUrl || `https://github.com/${a.login}.png`} title={a.login}
                style={{ width:18, height:18, borderRadius:'50%', border:'1px solid var(--bdr2)', display:'block' }} />
              {isHov && (
                <div onClick={e => { e.stopPropagation(); setHoveredAssignee(null); toggleAssignee(item, a); }}
                  style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#dc262690',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    cursor:'pointer', fontSize:11, color:'#fff', fontWeight:700, lineHeight:1 }}>✕</div>
              )}
            </div>
          );
        })}
        {current.length > 5 && (
          <span style={{ fontSize:9, color:'var(--tx3)', background:'var(--bg0)', border:'1px solid var(--bdr)',
            borderRadius:9, padding:'1px 4px', flexShrink:0, lineHeight:'16px' }}>+{current.length - 5}</span>
        )}
        {isSyncing && <span style={{ fontSize:9, color:'#94a3b8' }}>⟳</span>}
        {isErr && <span style={{ fontSize:9, color:'#f87171' }} title={syncErr.msg}>✗</span>}
        {isOpen && (
          <div onClick={e => e.stopPropagation()}
            style={{ position:'fixed', top: pickerPos.top, left: pickerPos.left, zIndex:9999,
              background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:8,
              padding:'4px 0', minWidth:200, maxHeight:220, overflowY:'auto',
              boxShadow:'0 8px 24px #00000040' }}>
            {TEAM_MEMBERS.map(m => {
              const assigned = currentLogins.includes(m.login.toLowerCase());
              return (
                <div key={m.login} onClick={() => toggleAssignee(item, m)}
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 10px',
                    cursor:'pointer', background: assigned ? '#6366f115' : 'transparent',
                    transition:'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = assigned ? '#6366f125' : '#ffffff08'}
                  onMouseLeave={e => e.currentTarget.style.background = assigned ? '#6366f115' : 'transparent'}>
                  <img src={`https://github.com/${m.login}.png?size=28`}
                    style={{ width:18, height:18, borderRadius:'50%', flexShrink:0 }} />
                  <span style={{ fontSize:10, color: assigned ? '#818cf8' : 'var(--tx2)', flex:1 }}>{m.name}</span>
                  <span style={{ fontSize:9, color:'var(--tx4)', flexShrink:0 }}>{m.team}</span>
                  {assigned && <span style={{ fontSize:9, color:'#34d399', flexShrink:0 }}>✓</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderEditable(item, field, displayEl, center = false) {
    const isEditing = editing?.id === item.id && editing?.field === field;
    const val = getVal(item, field);
    if (isEditing) {
      const base = {
        autoFocus: true, value: editVal,
        onBlur: () => commitEdit(item.id, field),
        onKeyDown: e => { if (e.key === 'Enter') commitEdit(item.id, field); if (e.key === 'Escape') setEditing(null); },
        onClick: e => e.stopPropagation(),
        style: { width:'100%', background:'var(--bg0)', border:'1px solid #6366f1', borderRadius:4, padding:'2px 5px', fontSize:11, color:'var(--tx0)', outline:'none', fontFamily:'inherit' },
      };
      if (field === 'startDate' || field === 'targetDate') return <input type="date" {...base} onChange={e => setEditVal(e.target.value)} />;
      if (field === 'estimate') return <input type="number" step="0.5" min="0" {...base} onChange={e => setEditVal(e.target.value)} />;
      return <input {...base} onChange={e => setEditVal(e.target.value)} />;
    }
    const isSaved   = saved?.id    === item.id && saved?.field    === field;
  const isHov     = hovered?.id  === item.id && hovered?.field  === field;
  const isSyncing = syncing?.id  === item.id && syncing?.field  === field;
  const isErr     = syncErr?.id  === item.id && syncErr?.field  === field;
  const isSelect  = ['status','size','equipo','tipo'].includes(field);
  return (
    <span
      onMouseEnter={() => setHovered({ id: item.id, field })}
      onMouseLeave={() => setHovered(p => p?.id === item.id && p?.field === field ? null : p)}
      onClick={e => { e.stopPropagation(); if (isSelect) { const r = e.currentTarget.getBoundingClientRect(); setFieldDropPos({ top: r.bottom + 2, left: r.left }); setFieldDropdown({ id: item.id, field }); } else { startEdit(e, item.id, field, val != null ? String(val) : ''); } }}
      style={{ cursor: isSelect ? 'pointer' : 'text', display:'flex', alignItems:'center', justifyContent: center ? 'center' : 'flex-start', width:'100%', position: center ? 'relative' : undefined, borderRadius:3, background: isSaved ? '#052e1650' : 'transparent', transition:'background 1s' }}
    >
      <span style={{ flex: center ? 'unset' : 1, minWidth:0, textAlign: center ? 'center' : undefined }}>
        {displayEl !== undefined ? displayEl : (val != null ? String(val) : '—')}
      </span>
      {isSelect && <span style={{ color: isHov ? '#6366f199' : 'transparent', fontSize:9, flexShrink: center ? undefined : 0, transition:'color .12s', ...(center ? { position:'absolute', right:3 } : { marginLeft:2 }) }}>▾</span>}
      {isSyncing && <span style={{ marginLeft:4, color:'#94a3b8', fontSize:9, flexShrink:0 }} title="Sincronizando con GitHub…">⟳</span>}
      {!isSyncing && isSaved && !isErr && <span style={{ marginLeft:4, color:'#34d399', fontSize:9, fontWeight:700, flexShrink:0 }}>✓</span>}
      {isErr && <span style={{ marginLeft:4, color:'#f87171', fontSize:9, fontWeight:700, flexShrink:0 }} title={syncErr.msg}>✗</span>}
    </span>
  );
  }

  function FilterBtn({ active, onClick, children, activeBg, activeColor }) {
    return (
      <button onClick={onClick} style={{
        padding:"3px 10px", borderRadius:5, fontSize:11, fontWeight:700, cursor:"pointer",
        background: active ? activeBg   : "transparent",
        color:      active ? activeColor : "var(--tx3)",
        border:     active ? `1px solid ${activeBg}` : "1px solid var(--bdr)",
        transition:"all .12s",
      }}>{children}</button>
    );
  }

  const emptyState = (
    <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:48, textAlign:"center", color:"var(--tx4)" }}>
      Sin resultados para los filtros seleccionados
    </div>
  );

  return (
    <div>
      {/* Banner */}
      <div style={{ background:"var(--bg2)", border:`1px solid ${sc ? sc.color : "#6366f1"}25`, borderRadius:12, padding:"13px 18px", marginBottom:12, display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:sc ? sc.color : "#6366f1", boxShadow:`0 0 8px ${sc ? sc.color : "#6366f1"}` }} />
            <span style={{ color:sc ? sc.color : "#818cf8", fontWeight:800, fontSize:14 }}>{sc ? sc.label : "Todo el proyecto"}</span>
            {sc && <span style={{ color:"var(--tx3)", fontSize:11 }}>{sc.date}</span>}
          </div>
          <div style={{ color:"var(--tx2)", fontSize:11 }}>
            {sprint === null && `${SPRINTS.length} sprints · ${BACKLOG.length} historias de usuario`}
            {sprint === 1 && "Core del MVP + infraestructura base"}
            {sprint === 2 && "MVP v1 completo · ciclo de mejora continua · pilotaje"}
            {sprint === 3 && "MVP v2 · diferenciadores · matching IA · marketing"}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { l:"Total",       val:stats.total,      c:"var(--tx0)" },
            { l:"En curso",    val:stats.inProgress, c:"#6ee7b7" },
            { l:"En revisión", val:stats.inReview,   c:"#c4b5fd" },
            { l:"Hecho",       val:stats.done,       c:"#34d399" },
          ].map(s => (
            <div key={s.l} style={{ background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:8, padding:"6px 12px", textAlign:"center", minWidth:48 }}>
              <div style={{ color:s.c, fontSize:17, fontWeight:800, lineHeight:1 }}>{s.val}</div>
              <div style={{ color:"var(--tx4)", fontSize:9, marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* View selector + Filters */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"13px 18px", marginBottom:12 }}>
        {/* View toggle */}
        <div style={{ display:"flex", gap:3, background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:7, padding:3, width:"fit-content", marginBottom:12 }}>
          {[
            { id:"tabla",   label:"☰ Tabla"       },
            { id:"tablero", label:"⬜ Tablero"     },
            { id:"roadmap", label:"📊 Hoja de ruta" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)} style={{
              padding:"4px 12px", borderRadius:5, fontSize:11, fontWeight:600, cursor:"pointer",
              background: view === id ? "#6366f120" : "transparent",
              color:      view === id ? "#818cf8"   : "var(--tx3)",
              border:     view === id ? "1px solid #6366f140" : "1px solid transparent",
              transition:"all .12s",
            }}>{label}</button>
          ))}
        </div>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por ID o título…"
          style={{ width:"100%", background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:7, padding:"7px 10px", fontSize:12, color:"var(--tx0)", outline:"none", boxSizing:"border-box", marginBottom:9 }}
        />
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
          <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Estado</span>
          {rawData.statuses.map(s => {
            const meta = STATUS_META[s] || { bg:"var(--bdr)", text:"var(--tx3)" };
            return (
              <FilterBtn key={s} active={stf.includes(s)} onClick={() => toggle(stf, setStf, s)} activeBg={meta.bg} activeColor={meta.text}>
                {s}
              </FilterBtn>
            );
          })}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
          <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Talla</span>
          {["XS","S","M","L","XL"].map(s => (
            <FilterBtn key={s} active={sf.includes(s)} onClick={() => toggle(sf, setSf, s)} activeBg={SIZE_META[s].bg} activeColor={SIZE_META[s].text}>{s}</FilterBtn>
          ))}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
          <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Etiquetas</span>
          {areas.map(a => (
            <FilterBtn key={a} active={af.includes(a)} onClick={() => toggle(af, setAf, a)} activeBg={`${areaColor[a]}35`} activeColor={areaColor[a]}>{a}</FilterBtn>
          ))}
        </div>
        {equipos.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
            <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Equipo</span>
            {equipos.map(e => (
              <FilterBtn key={e} active={ef.includes(e)} onClick={() => toggle(ef, setEf, e)} activeBg="#6366f130" activeColor="#818cf8">{e}</FilterBtn>
            ))}
          </div>
        )}
        {tipos.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
            <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Tipo</span>
            {tipos.map(t => (
              <FilterBtn key={t} active={tf.includes(t)} onClick={() => toggle(tf, setTf, t)} activeBg="#f97316" activeColor="#fff7ed">{t}</FilterBtn>
            ))}
          </div>
        )}
        {persons.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
            <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Persona</span>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
              {persons.map(a => (
                <button key={a.login} onClick={() => toggle(pf, setPf, a.login)} title={a.name || a.login} style={{
                  background:"none", border:"none", padding:0, cursor:"pointer",
                  borderRadius:"50%", outline: pf.includes(a.login) ? "2px solid #818cf8" : "2px solid transparent",
                  outlineOffset:1, transition:"outline .12s",
                }}>
                  <img src={a.avatarUrl} alt={a.login}
                    style={{ width:22, height:22, borderRadius:"50%", display:"block", opacity: pf.length && !pf.includes(a.login) ? 0.35 : 1, transition:"opacity .12s" }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
        {hasFilters && (
          <button onClick={clearAll} style={{ marginTop:7, background:"none", border:"none", color:"#f87171", fontSize:11, cursor:"pointer", padding:0 }}>
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* ── VISTA: TABLA ──────────────────────────────────────────── */}
      {view === "tabla" && (
        Object.keys(byArea).length === 0 ? emptyState : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {Object.entries(byArea).sort(([a], [b]) => (areaMinId[a] ?? 9999) - (areaMinId[b] ?? 9999)).map(([area, its]) => (
              <div key={area} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, overflow:"hidden" }}>
                <div style={{ background:"var(--bg0)", borderBottom:"1px solid var(--bdr)", padding:"8px 16px", display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:4, height:14, borderRadius:3, background:areaColor[area] }} />
                  <span style={{ color:areaColor[area], fontWeight:700, fontSize:12 }}>{area}</span>
                  <span style={{ color:"var(--bdr2)", fontSize:10 }}>({its.length} HU)</span>
                  <button
                    onClick={e => { e.stopPropagation(); setCreateModal({ area, sprint: sprint ?? 3 }); }}
                    title="Nueva tarea"
                    style={{ marginLeft:'auto', padding:'2px 8px', borderRadius:5, border:'1px solid #6366f140', background:'#6366f110', color:'#818cf8', fontSize:11, fontWeight:700, cursor:'pointer', lineHeight:1.4 }}>
                    + Nueva
                  </button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, tableLayout:"fixed" }}>
                    <colgroup>
                      <col style={{ width:82 }} />
                      <col style={{ width:240 }} />
                      <col style={{ width:130 }} />
                      <col style={{ width:110 }} />
                      <col style={{ width:76 }} />
                      <col style={{ width:100 }} />
                      <col style={{ width:50 }} />
                      <col style={{ width:60 }} />
                      <col style={{ width:60 }} />
                      <col style={{ width:46 }} />
                      <col style={{ width:32 }} />
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom:"1px solid var(--bdr)" }}>
                        {["ID","Historia de usuario","Asignados","Equipo","Tipo","Estado","Talla","Inicio","Fin","Est."].map((h, i) => {
                          const pad = i >= 6 ? "7px 6px" : "7px 14px";
                          return <th key={h} style={{ textAlign: i >= 2 ? "center" : "left", padding: pad, color:"var(--tx4)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:".07em", whiteSpace:"nowrap" }}>{h}</th>;
                        })}
                        <th style={{ width:32 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {its.map((item, idx) => {
                        const rowBg  = idx % 2 === 0 ? "transparent" : "#0f0f1108";
                        const hasSubs = item.subtasks && item.subtasks.length > 0;
                        const isOpen  = !!open[item.id];
                        return (
                          <Fragment key={item.id}>
                            <tr
                              onClick={hasSubs ? () => toggleOpen(item.id) : undefined}
                              onMouseEnter={() => setHoveredRow(item.id)}
                              onMouseLeave={() => setHoveredRow(null)}
                              style={{
                                background: hoveredRow === item.id ? '#ffffff0a' : rowBg,
                                borderBottom: (!isOpen && idx < its.length - 1) ? "1px solid #1c1c1e" : "none",
                                cursor: hasSubs ? "pointer" : "default",
                              }}
                            >
                              <td style={{ padding:"9px 14px", whiteSpace:"nowrap" }}>
                                {item.url ? (
                                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                                    style={{ color:"#6b7280", fontSize:10, fontFamily:"monospace", fontWeight:600, textDecoration:"none" }}
                                    onMouseEnter={e => e.currentTarget.style.color="#818cf8"}
                                    onMouseLeave={e => e.currentTarget.style.color="#6b7280"}
                                  >{item.id}</a>
                                ) : (
                                  <span style={{ color:"#6b7280", fontSize:10, fontFamily:"monospace", fontWeight:600 }}>{item.id}</span>
                                )}
                              </td>
                              <td style={{ padding:"9px 14px", overflow:"hidden" }}>
                                <div style={{ overflow:"hidden", color:"var(--tx1)", fontSize:12 }}>
                                  {renderEditable(item, 'title', <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{getVal(item, 'title') || '—'}</span>)}
                                </div>
                              </td>
                              <td style={{ padding:"6px 14px", textAlign:"center" }}>
                                {renderAssignees(item)}
                              </td>
                              <td style={{ padding:"9px 14px", whiteSpace:"nowrap", fontSize:11 }}>
                                {renderEditable(item, 'equipo', <span style={{ color:"var(--tx3)" }}>{getVal(item, 'equipo') || '—'}</span>, true)}
                              </td>
                              <td style={{ padding:"9px 14px", whiteSpace:"nowrap" }}>
                                {renderEditable(item, 'tipo', (() => { const t = getVal(item, 'tipo'); return t ? <span style={{ fontSize:10, color: tf.includes(t) ? "#fff7ed" : "var(--tx3)", background: tf.includes(t) ? "#f97316" : "var(--bg0)", border:"1px solid #f9731640", borderRadius:4, padding:"1px 6px" }}>{t}</span> : <span style={{ color:"var(--tx4)", fontSize:10 }}>—</span>; })(), true)}
                              </td>
                              <td style={{ padding:"9px 14px" }}>
                                {renderEditable(item, 'status', <StatusBadge s={getVal(item, 'status')} />, true)}
                              </td>
                              <td style={{ padding:"9px 8px" }}>
                                {renderEditable(item, 'size', getVal(item, 'size') ? <SizeBadge s={getVal(item, 'size')} /> : <span style={{ color:"var(--tx4)", fontSize:10 }}>—</span>, true)}
                              </td>
                              <td style={{ padding:"9px 6px", color:"var(--tx4)", fontSize:10, whiteSpace:"nowrap" }}>
                                {renderEditable(item, 'startDate', <span>{fmtDate(getVal(item, 'startDate')) ?? '—'}</span>, true)}
                              </td>
                              <td style={{ padding:"9px 6px", color:"var(--tx4)", fontSize:10, whiteSpace:"nowrap" }}>
                                {renderEditable(item, 'targetDate', <span>{fmtDate(getVal(item, 'targetDate')) ?? '—'}</span>, true)}
                              </td>
                              <td style={{ padding:"9px 6px", color:"var(--tx4)", fontSize:10, whiteSpace:"nowrap" }}>
                                {renderEditable(item, 'estimate', <span>{getVal(item, 'estimate') != null ? `${getVal(item, 'estimate')}h` : '—'}</span>, true)}
                              </td>
                              <td style={{ padding:"0 4px", textAlign:"center", verticalAlign:"middle" }}>
                                {hoveredRow === item.id && (
                                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(item); }}
                                    style={{ background:'#dc262620', border:'1px solid #dc262640', borderRadius:4, color:'#f87171', fontSize:10, cursor:'pointer', padding:'2px 5px', lineHeight:1 }}>✕</button>
                                )}
                              </td>
                            </tr>
                            {hasSubs && isOpen && item.subtasks.map((sub, si) => (
                              <tr key={`${item.id}-${si}`} style={{
                                background:"#0a0a14",
                                borderBottom: (si < item.subtasks.length - 1 || idx < its.length - 1) ? "1px solid #18181f" : "none",
                              }}>
                                <td style={{ padding:"6px 14px 6px 36px", color:"var(--bdr2)", fontSize:11, whiteSpace:"nowrap" }}>└</td>
                                <td style={{ padding:"6px 14px", color:"var(--tx3)", fontSize:11, fontStyle:"italic" }}>{sub.title}</td>
                                <td colSpan={9} style={{ padding:"6px 14px" }} />
                              </tr>
                            ))}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── VISTA: TABLERO (Kanban) ───────────────────────────────── */}
      {view === "tablero" && (
        filtered.length === 0 ? emptyState : (
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${STATUSES.length}, minmax(200px, 1fr))`, gap:10, overflowX:"auto" }}>
            {STATUSES.map(status => {
              const col = byStatus[status] || [];
              const color = STATUS_COLORS[status];
              return (
                <div key={status} style={{ display:"flex", flexDirection:"column", gap:8, minWidth:200 }}>
                  {/* Column header */}
                  <div style={{ background:"var(--bg2)", border:`1px solid ${color}30`, borderRadius:9, padding:"8px 12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ color, fontSize:11, fontWeight:700 }}>{status}</span>
                    <span style={{ background:`${color}20`, color, fontSize:10, fontWeight:700, borderRadius:10, padding:"1px 7px" }}>{col.length}</span>
                  </div>
                  {/* Cards */}
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {col.map(item => (
                      <div key={item.id} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:9, padding:"10px 12px" }}>
                        {/* Area dot + ID */}
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                          <div style={{ width:6, height:6, borderRadius:"50%", background:areaColor[item.area] ?? "#52525b", flexShrink:0 }} />
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer"
                              style={{ color:"var(--tx4)", fontSize:9, fontFamily:"monospace", textDecoration:"none" }}
                              onMouseEnter={e => e.currentTarget.style.color="#818cf8"}
                              onMouseLeave={e => e.currentTarget.style.color="var(--tx4)"}
                            >{item.id}</a>
                          ) : (
                            <span style={{ color:"var(--tx4)", fontSize:9, fontFamily:"monospace" }}>{item.id}</span>
                          )}
                          {item.size && <span style={{ marginLeft:"auto", cursor:"pointer" }} onClick={() => toggle(sf, setSf, item.size)}><SizeBadge s={item.size} /></span>}
                        </div>
                        {/* Title */}
                        <div style={{ color:"var(--tx0)", fontSize:11, lineHeight:1.4, marginBottom:6 }}>{item.title}</div>
                        {/* Footer: equipo + assignees */}
                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                          {item.equipo && (
                            <span onClick={() => toggle(ef, setEf, item.equipo)} style={{ color: ef.includes(item.equipo) ? "#818cf8" : "var(--tx4)", fontSize:9, background: ef.includes(item.equipo) ? "#6366f120" : "var(--bg0)", border: ef.includes(item.equipo) ? "1px solid #6366f140" : "1px solid var(--bdr)", borderRadius:4, padding:"1px 6px", cursor:"pointer", transition:"all .12s" }}>{item.equipo}</span>
                          )}
                          {item.tipo && (
                            <span onClick={() => toggle(tf, setTf, item.tipo)} style={{ color: tf.includes(item.tipo) ? "#fff7ed" : "var(--tx4)", fontSize:9, background: tf.includes(item.tipo) ? "#f97316" : "var(--bg0)", border:"1px solid #f9731640", borderRadius:4, padding:"1px 6px", cursor:"pointer", transition:"all .12s" }}>{item.tipo}</span>
                          )}
                          {item.assignees && item.assignees.length > 0 && (
                            <span style={{ marginLeft:"auto", display:"inline-flex", gap:2 }}>
                              {item.assignees.map(a => (
                                <img key={a.login} src={a.avatarUrl} title={a.name || a.login}
                                  onClick={() => toggle(pf, setPf, a.login)}
                                  style={{ width:16, height:16, borderRadius:"50%", border: pf.includes(a.login) ? "2px solid #818cf8" : "1px solid var(--bdr)", cursor:"pointer", transition:"border .12s" }}
                                />
                              ))}
                            </span>
                          )}
                        </div>
                        {(item.startDate || item.targetDate || item.estimate != null) && (
                          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:5 }}>
                            {(item.startDate || item.targetDate) && (
                              <span style={{ fontSize:9, color:"#60a5fa", background:"#0f2235", border:"1px solid #60a5fa30", borderRadius:4, padding:"1px 5px" }}>
                                {fmtDate(item.startDate) ?? "?"}–{fmtDate(item.targetDate) ?? "?"}
                              </span>
                            )}
                            {item.estimate != null && (
                              <span style={{ fontSize:9, color:"#a78bfa", background:"#2d1b69", border:"1px solid #a78bfa30", borderRadius:4, padding:"1px 5px" }}>
                                ~{item.estimate}h
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {col.length === 0 && (
                      <div style={{ border:"1px dashed var(--bdr)", borderRadius:9, padding:"20px 12px", textAlign:"center", color:"var(--tx4)", fontSize:10 }}>
                        Sin tareas
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── VISTA: HOJA DE RUTA (Gantt) ──────────────────────────── */}
      {view === "roadmap" && (
        areaStats.length === 0 ? emptyState : (
          <div style={{ overflowX:"auto" }}>
            {/* Timeline header */}
            <div style={{ display:"grid", gridTemplateColumns: sprint === null ? "180px 1fr 1fr 1fr" : "180px 1fr", gap:4, marginBottom:4, minWidth: sprint === null ? 640 : 400 }}>
              <div style={{ padding:"6px 0", color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em" }}>Etiqueta / Historia</div>
              {sprint === null
                ? SPRINTS.map(({ sprint: s }) => (
                    <div key={s} style={{ background:`${SC[s].color}12`, border:`1px solid ${SC[s].color}30`, borderRadius:6, padding:"5px 10px", textAlign:"center" }}>
                      <div style={{ color:SC[s].color, fontWeight:700, fontSize:11 }}>{SC[s].label}</div>
                      <div style={{ color:"var(--tx4)", fontSize:9 }}>{SC[s].date}</div>
                    </div>
                  ))
                : (
                    <div style={{ background:`${sc.color}12`, border:`1px solid ${sc.color}30`, borderRadius:6, padding:"5px 10px", textAlign:"center" }}>
                      <div style={{ color:sc.color, fontWeight:700, fontSize:11 }}>{sc.label}</div>
                      <div style={{ color:"var(--tx4)", fontSize:9 }}>{sc.date}</div>
                    </div>
                  )
              }
            </div>

            {/* Rows per area */}
            <div style={{ display:"flex", flexDirection:"column", gap:2, minWidth: sprint === null ? 640 : 400 }}>
              {areaStats.map(({ area, items: its }) => {
                const color = areaColor[area];
                const byS = {};
                its.forEach(i => { (byS[i.sprint] ??= []).push(i); });
                const visibleSprints = sprint === null ? SPRINTS.map(s => s.sprint) : [sprint];
                const cols = sprint === null ? "180px 1fr 1fr 1fr" : "180px 1fr";

                return (
                  <div key={area}>
                    {/* Area row header */}
                    <div style={{ display:"grid", gridTemplateColumns:cols, gap:4, marginBottom:2 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 2px" }}>
                        <div style={{ width:3, height:14, borderRadius:2, background:color, flexShrink:0 }} />
                        <span style={{ color, fontSize:11, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{area}</span>
                        <span style={{ color:"var(--tx4)", fontSize:9, flexShrink:0 }}>{its.length} HU</span>
                      </div>
                      {visibleSprints.map(s => (
                        <div key={s} style={{ background:"var(--bg1)", borderRadius:5, padding:"4px 5px", minHeight:24, borderLeft:`2px solid ${SC[s].color}40`, position:"relative" }}>
                          {(byS[s] || []).map(item => {
                            const c = STATUS_COLORS[item.status] || "#52525b";
                            const pos = ganttPos(item, s);
                            return (
                              <div key={item.id} style={{ position:"relative", height:20, marginBottom:2 }}>
                                <div style={{
                                  position:"absolute", top:1, height:18,
                                  left:`${pos.left}%`, width:`${pos.width}%`,
                                  background:`${c}28`, border:`1px solid ${c}55`,
                                  borderRadius:3, overflow:"hidden",
                                  display:"flex", alignItems:"center", padding:"0 5px", gap:3,
                                }}>
                                  <div style={{ width:5, height:5, borderRadius:"50%", background:c, flexShrink:0 }} />
                                  {item.tipo && <span style={{ fontSize:8, color:"#fff7ed", background:"#f97316", borderRadius:3, padding:"0 3px", flexShrink:0 }}>{item.tipo}</span>}
                                  <span style={{ color:"var(--tx0)", fontSize:9, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                                    {sprint === null
                                      ? item.title
                                      : <>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color:"var(--tx4)", fontFamily:"monospace", fontSize:8, textDecoration:"none", marginRight:4 }} onMouseEnter={e=>e.currentTarget.style.color="#818cf8"} onMouseLeave={e=>e.currentTarget.style.color="var(--tx4)"}>{item.id}</a> : <span style={{ color:"var(--tx4)", fontFamily:"monospace", fontSize:8, marginRight:4 }}>{item.id}</span>}{item.title}</>
                                    }
                                  </span>
                                  {item.size && <span style={{ flexShrink:0 }}><SizeBadge s={item.size} /></span>}
                                </div>
                              </div>
                            );
                          })}
                          {!(byS[s] || []).length && (
                            <div style={{ color:"var(--tx4)", fontSize:9, padding:"3px 4px", fontStyle:"italic" }}>—</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display:"flex", gap:12, flexWrap:"wrap", padding:"10px 2px 2px" }}>
              {Object.entries(STATUS_COLORS).map(([s, c]) => (
                <div key={s} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:c }} />
                  <span style={{ color:"var(--tx4)", fontSize:9 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Legend (solo en vista tabla) */}
      {view === "tabla" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
          <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"12px 16px" }}>
            <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", marginBottom:7 }}>Estado del Kanban</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {Object.keys(STATUS_META).map(k => <StatusBadge key={k} s={k} />)}
            </div>
          </div>
          <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"12px 16px" }}>
            <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", marginBottom:7 }}>Tallas (estimación orientativa)</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {[["XS","~2h"],["S","~4h"],["M","~8h"],["L","~16h"],["XL","~30h+"]].map(([s,h]) => (
                <div key={s} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <SizeBadge s={s} />
                  <span style={{ color:"var(--tx2)", fontSize:10 }}>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {fieldDropdown && (() => {
        const { id, field } = fieldDropdown;
        const fdItem = resolvedItems.find(i => i.id === id);
        const curVal = fdItem ? String(getVal(fdItem, field) ?? '') : '';
        let options = [];
        if (field === 'status') options = STATUSES;
        if (field === 'size')   options = ['XS','S','M','L','XL'];
        if (field === 'equipo') options = ['', ...allEquipos];
        if (field === 'tipo')   options = ['', ...allTipos];
        return (
          <>
            <style>{`.fdrop::-webkit-scrollbar{width:4px}.fdrop::-webkit-scrollbar-track{background:transparent}.fdrop::-webkit-scrollbar-thumb{background:#3f3f46;border-radius:2px}`}</style>
            <div className="fdrop" onClick={e => e.stopPropagation()}
              style={{ position:'fixed', top: fieldDropPos.top, left: fieldDropPos.left, zIndex:9999,
                background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:8,
                padding:'4px 0', minWidth:130, maxHeight:220, overflowY:'auto', scrollbarWidth:'thin',
                boxShadow:'0 8px 24px #00000040' }}>
              {options.map(opt => {
                const isCur = opt === curVal || (opt === '' && curVal === '');
                return (
                  <div key={opt || '_empty'}
                    onClick={() => { editValRef.current = opt; commitEdit(id, field); setFieldDropdown(null); }}
                    style={{ padding:'6px 12px', cursor:'pointer', fontSize:11,
                      color: isCur ? '#818cf8' : (opt ? 'var(--tx1)' : 'var(--tx4)'),
                      background: isCur ? '#6366f115' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}
                    onMouseEnter={e => e.currentTarget.style.background = isCur ? '#6366f125' : '#ffffff08'}
                    onMouseLeave={e => e.currentTarget.style.background = isCur ? '#6366f115' : 'transparent'}>
                    {opt || '—'}
                    {isCur && <span style={{ fontSize:9, color:'#818cf8' }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {createModal && (
        <CreateTaskModal
          sprint={createModal.sprint}
          area={createModal.area}
          nextId={nextIdForSprint(createModal.sprint)}
          defaultTipo={mostCommonTipoForArea(createModal.area)}
          allEquipos={allEquipos}
          allTipos={allTipos}
          statuses={STATUSES}
          onClose={() => setCreateModal(null)}
          onCreated={item => {
            const next = [...createdItems, item];
            setCreatedItems(next);
            try { localStorage.setItem('nexus_created_v1', JSON.stringify(next)); } catch {}
            setCreateModal(null);
          }}
        />
      )}

      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)}
          style={{ position:'fixed', inset:0, background:'#00000060', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:12, padding:'20px 24px', maxWidth:360, width:'90%' }}>
            <div style={{ color:'var(--tx0)', fontWeight:700, fontSize:14, marginBottom:8 }}>¿Eliminar tarea?</div>
            <div style={{ color:'var(--tx2)', fontSize:12, marginBottom:16 }}>{deleteConfirm.id} — {deleteConfirm.title}</div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid var(--bdr)', background:'transparent', color:'var(--tx2)', cursor:'pointer', fontSize:12 }}>Cancelar</button>
              <button onClick={() => doDelete(deleteConfirm)} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:'#dc2626', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
