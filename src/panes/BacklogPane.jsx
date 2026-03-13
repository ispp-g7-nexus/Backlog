import { useState, useMemo, Fragment } from 'react';
import { BACKLOG, rawData, SPRINTS } from '../data.js';
import { STATUS_META, AREA_COLORS, SIZE_META, SIZE_H_MAP, SC } from '../constants.js';
import { SizeBadge, StatusBadge } from '../components/badges.jsx';

const STATUSES = ["Backlog", "Ready", "In progress", "In review", "Done"];
const STATUS_COLORS = {
  "Backlog":     "#52525b",
  "Ready":       "#38bdf8",
  "In progress": "#fbbf24",
  "In review":   "#c4b5fd",
  "Done":        "#34d399",
};

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
  const [editVal, setEditVal] = useState('');
  const [saved,   setSaved]   = useState(null);
  const [hovered, setHovered] = useState(null);

  const items = useMemo(() => sprint === null ? BACKLOG : BACKLOG.filter(i => i.sprint === sprint), [sprint]);
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
    items.forEach(i => (i.assignees || []).forEach(a => { if (!m[a.login]) m[a.login] = a; }));
    return Object.values(m).sort((a, b) => a.login.localeCompare(b.login));
  }, [items]);

  const toggle = (arr, set, v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const filtered = useMemo(() => items.filter(item => {
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
  }), [items, stf, sf, af, ef, tf, pf, query]);

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
  const startEdit = (e, id, field, cur) => { e.stopPropagation(); setEditing({ id, field }); setEditVal(cur != null ? String(cur) : ''); };
  const commitEdit = (id, field) => {
    const v = field === 'estimate' ? (editVal === '' ? null : Number(editVal)) : (editVal === '' ? null : editVal);
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
  };
  function renderEditable(item, field, displayEl) {
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
      if (field === 'status') return <select {...base} onChange={e => setEditVal(e.target.value)}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>;
      if (field === 'size')   return <select {...base} onChange={e => setEditVal(e.target.value)}>{['XS','S','M','L','XL'].map(s => <option key={s} value={s}>{s}</option>)}</select>;
      if (field === 'equipo') { const opts = rawData.equipos || []; return <select {...base} onChange={e => setEditVal(e.target.value)}><option value="">—</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select>; }
      if (field === 'tipo')   { const opts = rawData.tipos || []; return opts.length ? <select {...base} onChange={e => setEditVal(e.target.value)}><option value="">—</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select> : <input {...base} onChange={e => setEditVal(e.target.value)} />; }
      if (field === 'startDate' || field === 'targetDate') return <input type="date" {...base} onChange={e => setEditVal(e.target.value)} />;
      if (field === 'estimate') return <input type="number" step="0.5" min="0" {...base} onChange={e => setEditVal(e.target.value)} />;
      return <input {...base} onChange={e => setEditVal(e.target.value)} />;
    }
    const isSaved  = saved?.id   === item.id && saved?.field   === field;
  const isHov    = hovered?.id === item.id && hovered?.field === field;
  const isSelect = ['status','size','equipo','tipo'].includes(field);
  return (
    <span
      onMouseEnter={() => setHovered({ id: item.id, field })}
      onMouseLeave={() => setHovered(p => p?.id === item.id && p?.field === field ? null : p)}
      onClick={e => startEdit(e, item.id, field, val != null ? String(val) : '')}
      style={{ cursor: isSelect ? 'pointer' : 'text', display:'flex', alignItems:'center', width:'100%', borderRadius:3, background: isSaved ? '#052e1650' : 'transparent', transition:'background 1s' }}
    >
      <span style={{ flex:1, minWidth:0 }}>
        {displayEl !== undefined ? displayEl : (val != null ? String(val) : '—')}
      </span>
      {isSelect && <span style={{ color: isHov ? '#6366f199' : 'transparent', fontSize:9, flexShrink:0, transition:'color .12s', marginLeft:2 }}>▾</span>}
      {isSaved && <span style={{ marginLeft:4, color:'#34d399', fontSize:9, fontWeight:700, flexShrink:0 }}>✓</span>}
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
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, tableLayout:"fixed" }}>
                    <colgroup>
                      <col style={{ width:100 }} />
                      <col />
                      <col style={{ width:140 }} />
                      <col style={{ width:100 }} />
                      <col style={{ width:115 }} />
                      <col style={{ width:70 }} />
                      <col style={{ width:78 }} />
                      <col style={{ width:78 }} />
                      <col style={{ width:60 }} />
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom:"1px solid var(--bdr)" }}>
                        {["ID","Historia de usuario","Equipo","Tipo","Estado","Talla","Inicio","Fin","Est."].map(h => (
                          <th key={h} style={{ textAlign:"left", padding:"7px 14px", color:"var(--tx4)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:".07em", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
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
                              style={{
                                background: rowBg,
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
                                <div style={{ display:"flex", alignItems:"center", gap:6, overflow:"hidden" }}>
                                  <div style={{ flex:1, overflow:"hidden", color:"var(--tx1)", fontSize:12 }}>
                                    {renderEditable(item, 'title', <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{getVal(item, 'title') || '—'}</span>)}
                                  </div>
                                  {item.assignees && item.assignees.length > 0 && (
                                    <span style={{ display:"inline-flex", gap:2, flexShrink:0 }}>
                                      {item.assignees.map(a => (
                                        <img key={a.login} src={a.avatarUrl} title={a.name || a.login}
                                          onClick={e => { e.stopPropagation(); toggle(pf, setPf, a.login); }}
                                          style={{ width:16, height:16, borderRadius:"50%", border: pf.includes(a.login) ? "2px solid #818cf8" : "1px solid var(--bdr2)", verticalAlign:"middle", cursor:"pointer", transition:"border .12s" }}
                                        />
                                      ))}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding:"9px 14px", whiteSpace:"nowrap", fontSize:11 }}>
                                {renderEditable(item, 'equipo', <span style={{ color:"var(--tx3)" }}>{getVal(item, 'equipo') || '—'}</span>)}
                              </td>
                              <td style={{ padding:"9px 14px", whiteSpace:"nowrap" }}>
                                {renderEditable(item, 'tipo', (() => { const t = getVal(item, 'tipo'); return t ? <span style={{ fontSize:10, color: tf.includes(t) ? "#fff7ed" : "var(--tx3)", background: tf.includes(t) ? "#f97316" : "var(--bg0)", border:"1px solid #f9731640", borderRadius:4, padding:"1px 6px" }}>{t}</span> : <span style={{ color:"var(--tx4)", fontSize:10 }}>—</span>; })())}
                              </td>
                              <td style={{ padding:"9px 14px" }}>
                                {renderEditable(item, 'status', <StatusBadge s={getVal(item, 'status')} />)}
                              </td>
                              <td style={{ padding:"9px 14px" }}>
                                {renderEditable(item, 'size', getVal(item, 'size') ? <SizeBadge s={getVal(item, 'size')} /> : <span style={{ color:"var(--tx4)", fontSize:10 }}>—</span>)}
                              </td>
                              <td style={{ padding:"9px 14px", color:"var(--tx4)", fontSize:10, whiteSpace:"nowrap" }}>
                                {renderEditable(item, 'startDate', <span>{fmtDate(getVal(item, 'startDate')) ?? '—'}</span>)}
                              </td>
                              <td style={{ padding:"9px 14px", color:"var(--tx4)", fontSize:10, whiteSpace:"nowrap" }}>
                                {renderEditable(item, 'targetDate', <span>{fmtDate(getVal(item, 'targetDate')) ?? '—'}</span>)}
                              </td>
                              <td style={{ padding:"9px 14px", color:"var(--tx4)", fontSize:10, whiteSpace:"nowrap" }}>
                                {renderEditable(item, 'estimate', <span>{getVal(item, 'estimate') != null ? `${getVal(item, 'estimate')}h` : '—'}</span>)}
                              </td>
                            </tr>
                            {hasSubs && isOpen && item.subtasks.map((sub, si) => (
                              <tr key={`${item.id}-${si}`} style={{
                                background:"#0a0a14",
                                borderBottom: (si < item.subtasks.length - 1 || idx < its.length - 1) ? "1px solid #18181f" : "none",
                              }}>
                                <td style={{ padding:"6px 14px 6px 36px", color:"var(--bdr2)", fontSize:11, whiteSpace:"nowrap" }}>└</td>
                                <td style={{ padding:"6px 14px", color:"var(--tx3)", fontSize:11, fontStyle:"italic" }}>{sub.title}</td>
                                <td colSpan={7} style={{ padding:"6px 14px" }} />
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
    </div>
  );
}
