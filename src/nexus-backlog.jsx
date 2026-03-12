import { useState, useMemo, Fragment, useEffect } from "react";
import rawData        from '../data/nexus-backlog.json';
import clockifyRaw   from '../data/clockify-entries.json';

// ── MAP GITHUB PROJECT DATA ────────────────────────────────────
function mapGithubItem(raw) {
  const idMatch = raw.title.match(/^\[([^\]]+)\]/);
  const id    = idMatch ? idMatch[1] : `#${raw.number}`;
  const title = raw.title.replace(/^\[[^\]]+\]\s*/, '').trim();
  const sprintMatch = raw.milestone && raw.milestone.match(/\d+/);
  const sprint = sprintMatch ? parseInt(sprintMatch[0], 10) : null;
  const area   = raw.labels && raw.labels.length > 0 ? raw.labels[0].name : 'Sin área';
  return {
    id, sprint, area, title,
    size:      raw.size      || null,
    status:    raw.status    || 'Backlog',
    equipo:    raw.equipo    || null,
    assignees: raw.assignees || [],
    url:       raw.url       || null,
    state:     raw.state     || 'OPEN',
  };
}
// ── LIVE DATA (localStorage override) ────────────────────────
const _storedLive = (() => {
  try {
    const raw = localStorage.getItem('nexus_live_data');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
})();
const _sourceData = (_storedLive && _storedLive.fetchedAt > rawData.fetchedAt) ? _storedLive : rawData;

// ── GITHUB SYNC (browser fetch) ──────────────────────────────
async function fetchFromGitHub(token) {
  const ENDPOINT = "https://api.github.com/graphql";
  const ITEM_FIELDS = `
    id type
    fieldValues(first: 20) {
      nodes {
        ... on ProjectV2ItemFieldTextValue        { text   field { ... on ProjectV2Field { name } } }
        ... on ProjectV2ItemFieldSingleSelectValue{ name   field { ... on ProjectV2SingleSelectField { name } } }
        ... on ProjectV2ItemFieldNumberValue      { number field { ... on ProjectV2Field { name } } }
        ... on ProjectV2ItemFieldDateValue        { date   field { ... on ProjectV2Field { name } } }
        ... on ProjectV2ItemFieldUserValue        { users(first:5){ nodes{ login name avatarUrl } } field { ... on ProjectV2Field { name } } }
        ... on ProjectV2ItemFieldLabelValue       { labels(first:10){ nodes{ name color } } field { ... on ProjectV2Field { name } } }
        ... on ProjectV2ItemFieldMilestoneValue   { milestone{ title } field { ... on ProjectV2Field { name } } }
        ... on ProjectV2ItemFieldRepositoryValue  { repository{ name } field { ... on ProjectV2Field { name } } }
      }
    }
    content {
      ... on Issue {
        number title body url state
        createdAt updatedAt closedAt
        assignees(first:10) { nodes { login name avatarUrl } }
        labels(first:10)    { nodes { name color } }
        milestone           { title dueOn }
      }
    }
  `;
  async function gql(query) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map(e => e.message).join('; '));
    return json.data;
  }
  let cursor = null, allItems = [];
  do {
    const after = cursor ? `, after: "${cursor}"` : "";
    const data = await gql(`{
      organization(login: "ispp-g7-nexus") {
        projectV2(number: 2) {
          items(first: 100${after}) {
            pageInfo { hasNextPage endCursor }
            nodes { ${ITEM_FIELDS} }
          }
        }
      }
    }`);
    const { nodes, pageInfo } = data.organization.projectV2.items;
    allItems = allItems.concat(nodes);
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);

  function normalizeItem(item) {
    if (item.type !== "ISSUE" || !item.content) return null;
    const fields = {};
    for (const fv of item.fieldValues.nodes) {
      const fname = fv.field?.name;
      if (!fname) continue;
      if ("text"       in fv) fields[fname] = fv.text;
      if ("name"       in fv) fields[fname] = fv.name;
      if ("number"     in fv) fields[fname] = fv.number;
      if ("date"       in fv) fields[fname] = fv.date;
      if ("users"      in fv) fields[fname] = fv.users.nodes;
      if ("labels"     in fv) fields[fname] = fv.labels.nodes;
      if ("milestone"  in fv) fields[fname] = fv.milestone?.title ?? null;
      if ("repository" in fv) fields[fname] = fv.repository?.name ?? null;
    }
    const c = item.content;
    return {
      id: item.id, number: c.number,
      title: fields["Title"] ?? c.title, body: c.body, url: c.url, state: c.state,
      status: fields["Status"] ?? null, priority: fields["Priority"] ?? null,
      size: fields["Size"] ?? null, estimate: fields["Estimate"] ?? null,
      startDate: fields["Start date"] ?? null, targetDate: fields["Target date"] ?? null,
      equipo: fields["Equipo"] ?? null,
      milestone: fields["Milestone"] ?? c.milestone?.title ?? null,
      repository: fields["Repository"] ?? null,
      assignees: fields["Assignees"] ?? c.assignees.nodes,
      labels: fields["Labels"] ?? c.labels.nodes,
      createdAt: c.createdAt, updatedAt: c.updatedAt, closedAt: c.closedAt,
    };
  }
  const normalized = allItems.map(normalizeItem).filter(Boolean);
  return {
    fetchedAt: new Date().toISOString(),
    total: normalized.length,
    statuses:   rawData.statuses,
    priorities: rawData.priorities,
    sizes:      rawData.sizes,
    equipos:    rawData.equipos,
    items: normalized,
  };
}

// ── SYNC MODAL ────────────────────────────────────────────────
function SyncModal({ onClose }) {
  const [token,    setToken]    = useState(() => localStorage.getItem('nexus_gh_token') || '');
  const [remember, setRemember] = useState(true);
  const [status,   setStatus]   = useState('idle'); // idle | loading | error
  const [error,    setError]    = useState('');
  const [progress, setProgress] = useState('');

  async function handleSync() {
    if (!token.trim()) return;
    setStatus('loading'); setError(''); setProgress('Conectando con GitHub…');
    try {
      if (remember) localStorage.setItem('nexus_gh_token', token.trim());
      else          localStorage.removeItem('nexus_gh_token');
      setProgress('Descargando datos del proyecto…');
      const data = await fetchFromGitHub(token.trim());
      setProgress(`✅ ${data.total} HU recibidas, recargando…`);
      localStorage.setItem('nexus_live_data', JSON.stringify(data));
      setTimeout(() => window.location.reload(), 500);
    } catch(e) {
      setStatus('error');
      setError(e.message);
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"#000000bb", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"var(--bg3)", border:"1px solid var(--bdr2)", borderRadius:12, padding:24, width:420, maxWidth:"92vw" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:14, color:"var(--tx0)" }}>🔄 Sincronizar con GitHub</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--tx3)", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
        </div>
        <div style={{ fontSize:12, color:"var(--tx3)", marginBottom:12, lineHeight:1.6 }}>
          Necesitas un <strong style={{color:"#a1a1aa"}}>Personal Access Token</strong> con permisos
          {' '}<code style={{background:"var(--bg0)",padding:"1px 4px",borderRadius:3,color:"#818cf8"}}>read:project</code> y{' '}
          <code style={{background:"var(--bg0)",padding:"1px 4px",borderRadius:3,color:"#818cf8"}}>repo</code>.
        </div>
        <input
          type="password" placeholder="ghp_…" value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && status !== 'loading' && handleSync()}
          autoFocus
          style={{ width:"100%", background:"var(--bg0)", border:"1px solid var(--bdr2)", borderRadius:6,
            padding:"8px 10px", color:"var(--tx0)", fontSize:13, outline:"none", boxSizing:"border-box" }}
        />
        <label style={{ display:"flex", alignItems:"center", gap:6, marginTop:8, fontSize:11, color:"var(--tx3)", cursor:"pointer", userSelect:"none" }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          Recordar token en este navegador
        </label>
        {status === 'loading' && (
          <div style={{ marginTop:8, fontSize:11, color:"#818cf8" }}>⏳ {progress}</div>
        )}
        {status === 'error' && (
          <div style={{ marginTop:8, fontSize:11, color:"#f87171" }}>⚠ {error}</div>
        )}
        <div style={{ display:"flex", gap:8, marginTop:16 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:"8px", borderRadius:6, background:"transparent", border:"1px solid var(--bdr2)", color:"var(--tx3)", cursor:"pointer", fontSize:12 }}>
            Cancelar
          </button>
          <button onClick={handleSync} disabled={status==='loading' || !token.trim()}
            style={{ flex:2, padding:"8px", borderRadius:6, background:"#6366f130", border:"1px solid #6366f155",
              color: status==='loading' ? "var(--tx4)" : "#818cf8", cursor: status==='loading' ? "default" : "pointer", fontSize:12, fontWeight:700 }}>
            {status === 'loading' ? '⏳ Sincronizando…' : '🔄 Sincronizar ahora'}
          </button>
        </div>
        {_storedLive && (
          <div style={{ marginTop:12, fontSize:10, color:"var(--bdr2)", textAlign:"center" }}>
            Último sync: {new Date(_storedLive.fetchedAt).toLocaleString("es-ES")} · {_storedLive.total} HU
            {' '}·{' '}
            <span style={{ color:"#ef4444", cursor:"pointer", textDecoration:"underline" }}
              onClick={() => { localStorage.removeItem('nexus_live_data'); window.location.reload(); }}>
              borrar cache
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const BACKLOG = _sourceData.items
  .map(mapGithubItem)
  .filter(i => i.sprint && !isNaN(i.sprint))
  .sort((a, b) => {
    if (a.sprint !== b.sprint) return a.sprint - b.sprint;
    const na = parseInt(a.id.match(/\.(\d+)$/)?.[1] ?? '0', 10);
    const nb = parseInt(b.id.match(/\.(\d+)$/)?.[1] ?? '0', 10);
    return na - nb;
  });


// ── GRAPH DATA ────────────────────────────────────────────────
const NW = 128, NH = 46;

// ── CONSTANTS ─────────────────────────────────────────────────
const MOSCOW_META = {
  M:{ label:"Must Have",   bg:"#dc2626", text:"#fff" },
  S:{ label:"Should Have", bg:"#b45309", text:"#fff" },
  C:{ label:"Could Have",  bg:"#0369a1", text:"#fff" },
  W:{ label:"Won't Have",  bg:"var(--bdr2)", text:"#fff" },
};
const STATUS_META = {
  "Backlog":     { bg:"var(--bdr)", text:"var(--tx3)" },
  "Ready":       { bg:"var(--st-ready-bg)", text:"var(--st-ready-tx)" },
  "In progress": { bg:"var(--st-prog-bg)",  text:"var(--st-prog-tx)" },
  "In review":   { bg:"var(--st-rev-bg)",   text:"var(--st-rev-tx)" },
  "Done":        { bg:"var(--st-done-bg)",  text:"var(--st-done-tx)" },
};
const SIZE_META = {
  XS:{ bg:"var(--sz-xs-bg)", text:"var(--sz-xs-tx)" },
  S: { bg:"var(--sz-s-bg)",  text:"var(--sz-s-tx)" },
  M: { bg:"var(--sz-m-bg)",  text:"var(--sz-m-tx)" },
  L: { bg:"var(--sz-l-bg)",  text:"var(--sz-l-tx)" },
  XL:{ bg:"var(--sz-xl-bg)", text:"var(--sz-xl-tx)" },
};
const SC = {
  1:{ label:"Sprint 1", date:"19 feb–5 mar",  start:"2026-02-19", end:"2026-03-05", weight:"10%", color:"#818cf8" },
  2:{ label:"Sprint 2", date:"12 mar–26 mar",  start:"2026-03-12", end:"2026-03-26", weight:"15%", color:"#34d399" },
  3:{ label:"Sprint 3", date:"2 abr–16 abr",   start:"2026-04-02", end:"2026-04-16", weight:"30%", color:"#fbbf24" },
};
const AREA_COLORS = [
  "#818cf8","#f472b6","#2dd4bf","#fb923c","#a78bfa",
  "#f87171","#38bdf8","#a3e635","#facc15","#c084fc","#4ade80","#60a5fa",
];
const TABS = [
  { id:"github",   label:"🐙 GitHub",          color:"var(--tx2)" },
  { id:"project",  label:"📋 GitHub Project",  color:"#818cf8" },
  { id:"informe",  label:"⏱️ Clockify",         color:"#6ee7b7" },
  { id:"cal",      label:"📅 Calendario",       color:"#38bdf8" },
  { id:"costes",   label:"💰 Costes",           color:"#f97316" },
];
const SPRINT_TABS = [
  { id:"s1", label:"Sprint 1", color:"#818cf8" },
  { id:"s2", label:"Sprint 2", color:"#34d399" },
  { id:"s3", label:"Sprint 3", color:"#fbbf24" },
];

// ── BADGES ────────────────────────────────────────────────────
function MoscowBadge({ m }) {
  return (
    <span style={{
      background: MOSCOW_META[m].bg, color: MOSCOW_META[m].text,
      padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, whiteSpace:"nowrap",
    }}>{m}</span>
  );
}
function SizeBadge({ s }) {
  return (
    <span style={{
      background: SIZE_META[s].bg, color: SIZE_META[s].text,
      padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700,
      minWidth:26, display:"inline-block", textAlign:"center",
    }}>{s}</span>
  );
}
function StatusBadge({ s }) {
  const meta = STATUS_META[s] || { bg:"var(--bdr)", text:"var(--tx3)" };
  return (
    <span style={{
      background:meta.bg, color:meta.text,
      padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700, whiteSpace:"nowrap",
    }}>{s || "Backlog"}</span>
  );
}

// ── BACKLOG PANE ──────────────────────────────────────────────
function BacklogPane({ sprint }) {
  const sc = SC[sprint];
  const [stf,   setStf]  = useState([]);
  const [sf,    setSf]   = useState([]);
  const [af,    setAf]   = useState([]);
  const [query, setQuery] = useState("");
  const [open,  setOpen]  = useState({});
  const toggleOpen = (id) => setOpen(p => ({ ...p, [id]: !p[id] }));
  const items = useMemo(() => BACKLOG.filter(i => i.sprint === sprint), [sprint]);
  const areas = useMemo(() => [...new Set(items.map(i => i.area))].sort(), [items]);
  const areaColor = useMemo(() => {
    const m = {};
    areas.forEach((a, i) => { m[a] = AREA_COLORS[i % AREA_COLORS.length]; });
    return m;
  }, [areas]);

  const toggle = (arr, set, v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const filtered = useMemo(() => items.filter(item => {
    if (stf.length && !stf.includes(item.status)) return false;
    if (sf.length  && !sf.includes(item.size))    return false;
    if (af.length  && !af.includes(item.area))    return false;
    if (query) {
      const q = query.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [items, stf, sf, af, query]);

  const byArea = useMemo(() => {
    const m = {};
    filtered.forEach(i => { (m[i.area] ??= []).push(i); });
    return m;
  }, [filtered]);

  // Orden dinámico de áreas: la que tenga el ID más bajo va primero
  const areaMinId = useMemo(() => {
    const m = {};
    items.forEach(item => {
      const n = parseInt(item.id.match(/\.(\d+)$/)?.[1] ?? '9999', 10);
      if (!(item.area in m) || n < m[item.area]) m[item.area] = n;
    });
    return m;
  }, [items]);

  const stats = {
    total:      filtered.length,
    inProgress: filtered.filter(i => i.status === "In progress").length,
    inReview:   filtered.filter(i => i.status === "In review").length,
    done:       filtered.filter(i => i.status === "Done").length,
  };
  const hasFilters = stf.length || sf.length || af.length || query;
  const clearAll   = () => { setStf([]); setSf([]); setAf([]); setQuery(""); };

  function FilterBtn({ active, onClick, children, activeBg, activeColor }) {
    return (
      <button
        onClick={onClick}
        style={{
          padding:"3px 10px", borderRadius:5, fontSize:11, fontWeight:700, cursor:"pointer",
          background: active ? activeBg   : "transparent",
          color:      active ? activeColor : "var(--tx3)",
          border:     active ? `1px solid ${activeBg}` : "1px solid var(--bdr)",
          transition:"all .12s",
        }}
      >{children}</button>
    );
  }

  return (
    <div>
      {/* Banner */}
      <div style={{ background:"var(--bg2)", border:`1px solid ${sc.color}25`, borderRadius:12, padding:"13px 18px", marginBottom:12, display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:sc.color, boxShadow:`0 0 8px ${sc.color}` }} />
            <span style={{ color:sc.color, fontWeight:800, fontSize:14 }}>{sc.label}</span>
            <span style={{ color:"var(--tx3)", fontSize:11 }}>{sc.date}</span>
          </div>
          <div style={{ color:"var(--tx2)", fontSize:11 }}>
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

      {/* Filters */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"13px 18px", marginBottom:12 }}>
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
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" }}>
          <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Área</span>
          {areas.map(a => (
            <FilterBtn key={a} active={af.includes(a)} onClick={() => toggle(af, setAf, a)} activeBg={`${areaColor[a]}35`} activeColor={areaColor[a]}>{a}</FilterBtn>
          ))}
        </div>
        {hasFilters && (
          <button onClick={clearAll} style={{ marginTop:7, background:"none", border:"none", color:"#f87171", fontSize:11, cursor:"pointer", padding:0 }}>
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {Object.keys(byArea).length === 0 ? (
        <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:48, textAlign:"center", color:"var(--tx4)" }}>
          Sin resultados para los filtros seleccionados
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {Object.entries(byArea).sort(([a], [b]) => (areaMinId[a] ?? 9999) - (areaMinId[b] ?? 9999)).map(([area, its]) => (
            <div key={area} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, overflow:"hidden" }}>
              {/* Area header */}
              <div style={{ background:"var(--bg0)", borderBottom:"1px solid var(--bdr)", padding:"8px 16px", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:4, height:14, borderRadius:3, background:areaColor[area] }} />
                <span style={{ color:areaColor[area], fontWeight:700, fontSize:12 }}>{area}</span>
                <span style={{ color:"var(--bdr2)", fontSize:10 }}>({its.length} HU)</span>
              </div>

              {/* Table */}
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, tableLayout:"fixed" }}>
                  <colgroup>
                    <col style={{ width:110 }} />
                    <col />
                    <col style={{ width:140 }} />
                    <col style={{ width:120 }} />
                    <col style={{ width:72 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom:"1px solid var(--bdr)" }}>
                      {["ID","Historia de usuario","Equipo","Estado","Talla"].map(h => (
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
                          {/* Parent row */}
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
                            <td style={{ padding:"9px 14px", color:"var(--tx1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              <span>{item.title}</span>
                              {item.assignees && item.assignees.length > 0 && (
                                <span style={{ marginLeft:8, display:"inline-flex", gap:2, verticalAlign:"middle" }}>
                                  {item.assignees.map(a => (
                                    <img key={a.login} src={a.avatarUrl} title={a.name || a.login}
                                      style={{ width:16, height:16, borderRadius:"50%", border:"1px solid var(--bdr2)", verticalAlign:"middle" }}
                                    />
                                  ))}
                                </span>
                              )}
                            </td>
                            <td style={{ padding:"9px 14px", color:"var(--tx3)", whiteSpace:"nowrap", fontSize:11 }}>{item.equipo || "—"}</td>
                            <td style={{ padding:"9px 14px" }}><StatusBadge s={item.status} /></td>
                            <td style={{ padding:"9px 14px" }}>{item.size ? <SizeBadge s={item.size} /> : null}</td>
                          </tr>

                          {/* Subtask rows */}
                          {hasSubs && isOpen && item.subtasks.map((sub, si) => (
                            <tr
                              key={`${item.id}-${si}`}
                              style={{
                                background:"#0a0a14",
                                borderBottom: (si < item.subtasks.length - 1 || idx < its.length - 1) ? "1px solid #18181f" : "none",
                              }}
                            >
                              <td style={{ padding:"6px 14px 6px 36px", color:"var(--bdr2)", fontSize:11, whiteSpace:"nowrap" }}>└</td>
                              <td style={{ padding:"6px 14px", color:"var(--tx3)", fontSize:11, fontStyle:"italic" }}>{sub.title}</td>
                              <td colSpan={3} style={{ padding:"6px 14px" }} />
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
      )}

      {/* Legend */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
        <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"12px 16px" }}>
          <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", marginBottom:7 }}>Estado del Kanban</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {Object.keys(STATUS_META).map(k => (
              <StatusBadge key={k} s={k} />
            ))}
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
    </div>
  );
}


// ── CALENDAR PANE ─────────────────────────────────────────────
function CalendarPane() {
  const SC_COLOR = { 1:"#818cf8", 2:"#34d399", 3:"#fbbf24" };

  // Parse date from title: "Clase 19/2", "Sprint Planning (20/2)", etc.
  function parseDate(title) {
    const m = title.match(/(\d{1,2})\/(\d{1,2})/);
    if (!m) return null;
    return new Date(2026, parseInt(m[2]) - 1, parseInt(m[1]));
  }

  const events = useMemo(() => {
    const map = {};
    BACKLOG.filter(i => i.area === "Asistencia").forEach(item => {
      const d = parseDate(item.title);
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map[key] ??= []).push({ ...item, date: d });
    });
    return map;
  }, []);

  // Months to show: Feb, Mar, Apr 2026
  const MONTHS = [
    { year:2026, month:1, label:"Febrero 2026" },
    { year:2026, month:2, label:"Marzo 2026"   },
    { year:2026, month:3, label:"Abril 2026"   },
  ];
  const DAYS = ["L","M","X","J","V","S","D"];

  function getEventType(title) {
    if (title.startsWith("Clase"))               return { label:"Clase", color:"#818cf8", dot:"#6366f1" };
    if (title.includes("Planning"))              return { label:"Planning", color:"#34d399", dot:"#10b981" };
    if (title.includes("Weekly"))               return { label:"Weekly",   color:"#fbbf24", dot:"#f59e0b" };
    if (title.includes("Review"))               return { label:"Review",   color:"#f472b6", dot:"#ec4899" };
    if (title.includes("Retrospective"))        return { label:"Retro",    color:"#fb923c", dot:"#f97316" };
    return { label:title, color:"var(--tx2)", dot:"#64748b" };
  }

  function renderMonth({ year, month, label }) {
    const firstDay = new Date(year, month, 1);
    // Monday-based: 0=Mon ... 6=Sun
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = startDow === 0 ? 6 : startDow - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div key={label} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, overflow:"hidden" }}>
        <div style={{ background:"var(--bg0)", borderBottom:"1px solid var(--bdr)", padding:"10px 16px" }}>
          <span style={{ color:"var(--tx0)", fontWeight:700, fontSize:13 }}>{label}</span>
        </div>
        <div style={{ padding:12 }}>
          {/* Day headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign:"center", color:"var(--tx4)", fontSize:10, fontWeight:700, padding:"4px 0", letterSpacing:".05em" }}>{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {Array.from({ length: cells.length / 7 }, (_, wi) => (
            <div key={wi} style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:3 }}>
              {cells.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                if (!day) return <div key={di} />;
                const key = `${year}-${month}-${day}`;
                const dayEvents = events[key] || [];
                const isToday = year === 2026 && month === 1 && day === 20; // Feb 20
                const SPRINT_ENDS = [
                  { sprint:1, year:2026, month:2, day:5  },
                  { sprint:2, year:2026, month:2, day:26 },
                  { sprint:3, year:2026, month:3, day:16 },
                ];
                const endSprint = SPRINT_ENDS.find(e => e.year===year && e.month===month && e.day===day)?.sprint || null;
                return (
                  <div key={di} style={{
                    minHeight:64, borderRadius:8, padding:"5px 6px",
                    background: dayEvents.length || endSprint ? "var(--cal-day)" : "transparent",
                    border: isToday ? "1px solid #818cf840" : (dayEvents.length || endSprint) ? "1px solid var(--bdr)" : "1px solid transparent",
                    position:"relative",
                  }}>
                    <div style={{
                      fontSize:11, fontWeight: dayEvents.length || endSprint ? 700 : 400,
                      color: isToday ? "#818cf8" : (dayEvents.length || endSprint) ? "var(--tx0)" : "var(--bdr2)",
                      marginBottom:3,
                    }}>{day}</div>
                    {endSprint && (
                      <div style={{
                        background:`${SC_COLOR[endSprint]}20`, border:`1px solid ${SC_COLOR[endSprint]}50`,
                        borderRadius:4, padding:"2px 5px", marginBottom:2,
                        display:"flex", alignItems:"center", gap:4,
                      }}>
                        <div style={{ width:5, height:5, borderRadius:"50%", background:SC_COLOR[endSprint], flexShrink:0 }} />
                        <span style={{ color:SC_COLOR[endSprint], fontSize:9, fontWeight:800, lineHeight:1.2 }}>
                          Finaliza S{endSprint}
                        </span>
                      </div>
                    )}
                    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                      {dayEvents.map((ev, ei) => {
                        const type = getEventType(ev.title);
                        const sc = SC_COLOR[ev.sprint];
                        return (
                          <div key={ei} style={{
                            background:`${sc}18`, border:`1px solid ${sc}35`,
                            borderRadius:4, padding:"2px 5px",
                            display:"flex", alignItems:"center", gap:4,
                          }}>
                            <div style={{ width:5, height:5, borderRadius:"50%", background:type.dot, flexShrink:0 }} />
                            <span style={{ color:type.color, fontSize:9, fontWeight:700, lineHeight:1.2, overflow:"hidden" }}>
                              {type.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const legend = [
    { label:"Clase",     dot:"#6366f1" },
    { label:"Planning",  dot:"#10b981" },
    { label:"Weekly",    dot:"#f59e0b" },
    { label:"Review",    dot:"#ec4899" },
    { label:"Retro",     dot:"#f97316" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"12px 18px", marginBottom:12, display:"flex", flexWrap:"wrap", gap:14, alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ color:"#38bdf8", fontWeight:700, fontSize:13, marginBottom:2 }}>📅 Calendario de Asistencia</div>
          <div style={{ color:"var(--tx3)", fontSize:11 }}>Clases y ceremonias Scrum · Feb – Abr 2026</div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {legend.map(l => (
            <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:l.dot }} />
              <span style={{ color:"var(--tx2)", fontSize:10 }}>{l.label}</span>
            </div>
          ))}
          {[1,2,3].map(s => (
            <div key={s} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:2, background:SC_COLOR[s] }} />
              <span style={{ color:"var(--tx2)", fontSize:10 }}>S{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Months grid */}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {MONTHS.map(renderMonth)}
      </div>
    </div>
  );
}

// ── GITHUB PANE ─────────────────────────────────────────────
const GH_OWNER = "ispp-g7-nexus", GH_REPO = "7-NexUS";

async function fetchGitHubStats(token) {
  const h = { "Authorization": `bearer ${token}`, "Content-Type": "application/json" };
  const B = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;

  async function gs(ep) {
    for (let i = 0; i < 4; i++) {
      const r = await fetch(`${B}/${ep}`, { headers: h });
      if (r.status === 202) { await new Promise(ok => setTimeout(ok, 3000)); continue; }
      if (r.ok) return r.json();
      return null;
    }
    return null;
  }

  // 1. Contributors - commit counts per login
  const crRaw = await fetch(`${B}/contributors?per_page=100`, { headers: h });
  if (!crRaw.ok) throw new Error(`HTTP ${crRaw.status}: ${crRaw.statusText}`);
  const crData = await crRaw.json();
  const commits = {};
  (Array.isArray(crData) ? crData : []).forEach(c => { commits[c.login.toLowerCase()] = c.contributions; });

  // 2–5. GitHub Insights stats endpoints (in parallel)
  const [statsContribs, commitActivity, punchCard, codeFreq] = await Promise.all([
    gs("stats/contributors"),
    gs("stats/commit_activity"),
    gs("stats/punch_card"),
    gs("stats/code_frequency"),
  ]);

  const lines = {}, consistency = {}, weeklyCommits = {}, linesWeekMap = {};
  if (Array.isArray(statsContribs)) {
    statsContribs.forEach(sc => {
      const l = sc.author?.login?.toLowerCase(); if (!l) return;
      lines[l] = {
        added:   sc.weeks.reduce((s, w) => s + w.a, 0),
        deleted: sc.weeks.reduce((s, w) => s + w.d, 0),
      };
      const aw = sc.weeks.filter(w => w.c > 0).length;
      consistency[l] = sc.weeks.length ? Math.round(aw / sc.weeks.length * 100) : 0;
      weeklyCommits[l] = sc.weeks.slice(-26).map(w => w.c);
      sc.weeks.forEach(w => {
        if (w.a > 0 || w.d !== 0) {
          if (!linesWeekMap[w.w]) linesWeekMap[w.w] = { a: 0, d: 0 };
          linesWeekMap[w.w].a += w.a || 0;
          linesWeekMap[w.w].d += Math.abs(w.d || 0);
        }
      });
    });
  }
  // Build linesActivity (52 weeks) from statsContribs weekly data
  const laNow = new Date(), laDow = laNow.getUTCDay();
  const laSun = new Date(laNow); laSun.setUTCDate(laNow.getUTCDate() - laDow); laSun.setUTCHours(0,0,0,0);
  const linesActivity = Array.from({length: 52}, (_, i) => {
    const wStart = new Date(laSun); wStart.setUTCDate(laSun.getUTCDate() - (51 - i) * 7);
    const ts = Math.floor(wStart.getTime() / 1000);
    const e = linesWeekMap[ts] || { a: 0, d: 0 };
    return { week: ts, added: e.a, deleted: e.d, total: e.a + e.d };
  });

  // 6. PRs + reviews via GraphQL (paginated, with dates & line counts)
  const prs = {}, reviews = {}, mergeTs = {}, prDayMap = {}, prPunchRaw = {}, prLoginDayMap = {};
  let cursor = null, hasMore = true;
  while (hasMore) {
    const af = cursor ? `, after:"${cursor}"` : "";
    const q = `{repository(owner:"${GH_OWNER}",name:"${GH_REPO}"){pullRequests(first:100${af}){nodes{author{login}state createdAt mergedAt additions deletions reviews(first:50){nodes{author{login}}}}pageInfo{hasNextPage endCursor}}}}`;
    const gr = await fetch("https://api.github.com/graphql", { method: "POST", headers: h, body: JSON.stringify({ query: q }) });
    if (!gr.ok) throw new Error(`GraphQL ${gr.status}`);
    const { data, errors } = await gr.json();
    if (errors?.length) throw new Error(errors[0].message);
    const pg = data?.repository?.pullRequests; if (!pg) break;
    pg.nodes.forEach(pr => {
      const a = pr.author?.login?.toLowerCase();
      if (a) {
        prs[a] = prs[a] || { total: 0, merged: 0, open: 0, additions: 0, deletions: 0 };
        prs[a].total++;
        if (pr.state === "MERGED") {
          prs[a].merged++;
          if (pr.mergedAt && pr.createdAt)
            (mergeTs[a] = mergeTs[a] || []).push((new Date(pr.mergedAt) - new Date(pr.createdAt)) / 86400000);
        } else if (pr.state === "OPEN") prs[a].open++;
        prs[a].additions += pr.additions || 0;
        prs[a].deletions += pr.deletions || 0;
        if (pr.createdAt) {
          const d = new Date(pr.createdAt);
          const dateStr = d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
          prDayMap[dateStr] = (prDayMap[dateStr] || 0) + 1;
          const pk = `${d.getUTCDay()}-${d.getUTCHours()}`;
          prPunchRaw[pk] = (prPunchRaw[pk] || 0) + 1;
          if (!prLoginDayMap[a]) prLoginDayMap[a] = {};
          prLoginDayMap[a][dateStr] = (prLoginDayMap[a][dateStr] || 0) + 1;
        }
      }
      pr.reviews?.nodes?.forEach(rv => {
        const r2 = rv.author?.login?.toLowerCase();
        if (r2 && r2 !== a) reviews[r2] = (reviews[r2] || 0) + 1;
      });
    });
    hasMore = pg.pageInfo.hasNextPage; cursor = pg.pageInfo.endCursor;
  }

  const avgMergeTime = {};
  Object.entries(mergeTs).forEach(([l, ts]) => {
    avgMergeTime[l] = Math.round(ts.reduce((s, d) => s + d, 0) / ts.length * 10) / 10;
  });

  // Build prActivity in same format as commitActivity: [{week, total, days:[sun..sat]}, ...]
  // Use Sunday-based weeks (same as GitHub stats/commit_activity)
  const prNow = new Date(), prDow = prNow.getUTCDay();
  const prSun = new Date(prNow); prSun.setUTCDate(prNow.getUTCDate() - prDow); prSun.setUTCHours(0,0,0,0);
  const prActivity = Array.from({length: 52}, (_, i) => {
    const wStart = new Date(prSun); wStart.setUTCDate(prSun.getUTCDate() - (51 - i) * 7);
    const days = Array.from({length: 7}, (_, d) => {
      const day = new Date(wStart); day.setUTCDate(wStart.getUTCDate() + d);
      return prDayMap[day.toISOString().slice(0, 10)] || 0;
    });
    return { week: Math.floor(wStart.getTime() / 1000), total: days.reduce((s, c) => s + c, 0), days };
  });
  const prPunch = [];
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) prPunch.push([d, h, prPunchRaw[`${d}-${h}`] || 0]);

  // Build weeklyPRs per login (last 26 weeks, same Sunday base as prActivity)
  const weeklyPRs = {};
  TEAM_MEMBERS.forEach(m => {
    const l = m.login.toLowerCase();
    const userDayMap = prLoginDayMap[l] || {};
    weeklyPRs[l] = Array.from({length: 26}, (_, i) => {
      const wStart = new Date(prSun); wStart.setUTCDate(prSun.getUTCDate() - (25 - i) * 7);
      return Array.from({length: 7}, (_, d) => {
        const day = new Date(wStart); day.setUTCDate(wStart.getUTCDate() + d);
        return userDayMap[day.toISOString().slice(0, 10)] || 0;
      }).reduce((s, c) => s + c, 0);
    });
  });

  return {
    commits, lines, consistency, weeklyCommits,
    prs, reviews, avgMergeTime,
    commitActivity, punchCard, codeFreq,
    prActivity, prPunch,
    linesActivity, weeklyPRs,
    fetchedAt: new Date().toISOString(),
  };
}

const GH_STATS_KEY = "nexus_gh_stats_v5";

function GitHubPane() {
  const TC = { A: "#3b82f6", B: "#22c55e", C: "#f59e0b", D: "#a855f7" };
  const [stats,   setStats]   = useState(() => {
    try { const r = localStorage.getItem(GH_STATS_KEY); return r ? JSON.parse(r) : null; } catch (_) { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [ghView,  setGhView]  = useState("persona");
  const [ghTab,   setGhTab]   = useState("commits");

  async function refresh() {
    const token = localStorage.getItem("nexus_gh_token");
    if (!token) return;
    setLoading(true); setError("");
    try {
      const s = await fetchGitHubStats(token);
      setStats(s);
      localStorage.setItem(GH_STATS_KEY, JSON.stringify(s));
    } catch (ex) { setError(ex.message); }
    finally { setLoading(false); }
  }

  // Auto-refresh silencioso al montar si los datos tienen más de 2 minutos
  useEffect(() => {
    const token = localStorage.getItem("nexus_gh_token");
    if (!token) return;
    const age = stats?.fetchedAt ? Date.now() - new Date(stats.fetchedAt).getTime() : Infinity;
    if (age > 2 * 60 * 1000) refresh();
  }, []);

  // ── Per-member computed stats ──────────────────────────────
  const memberStats = TEAM_MEMBERS.map(m => {
    const ll      = m.login.toLowerCase();
    const commits = stats?.commits?.[ll]     || 0;
    const pr      = stats?.prs?.[ll]         || { total: 0, merged: 0, open: 0, additions: 0, deletions: 0 };
    const revs    = stats?.reviews?.[ll]     || 0;
    const lns     = stats?.lines?.[ll]       || { added: 0, deleted: 0 };
    const cons    = stats?.consistency?.[ll] ?? null;
    const amt     = stats?.avgMergeTime?.[ll]?? null;
    const wc      = stats?.weeklyCommits?.[ll]|| [];
    // Custom metrics
    const collabScore   = Math.min(Math.round(revs / (commits + 1) * 50), 100);
    const prEfficiency  = pr.total > 0 ? Math.round(pr.merged / pr.total * 100) : null;
    const codeImpact    = lns.added + lns.deleted;
    const codeChurn     = codeImpact > 0 ? Math.round(lns.deleted / codeImpact * 100) : null;
    const avgPRSize     = pr.merged > 0 ? Math.round((pr.additions + pr.deletions) / pr.merged) : null;
    return { m, commits, pr, revs, lns, cons, amt, wc, collabScore, prEfficiency, codeImpact, codeChurn, avgPRSize };
  });

  const totalCommits  = memberStats.reduce((s, ms) => s + ms.commits, 0);
  const totalPRs      = memberStats.reduce((s, ms) => s + ms.pr.merged, 0);
  const totalRevs     = memberStats.reduce((s, ms) => s + ms.revs, 0);
  const totalAdded    = memberStats.reduce((s, ms) => s + ms.lns.added, 0);
  const activeMembers = memberStats.filter(ms => ms.commits > 0 || ms.pr.total > 0 || ms.revs > 0).length;
  const hasData       = stats && (totalCommits > 0 || totalPRs > 0 || totalRevs > 0);

  const allMergeTimes = Object.values(stats?.avgMergeTime || {});
  const teamAvgMerge  = allMergeTimes.length
    ? Math.round(allMergeTimes.reduce((s, d) => s + d, 0) / allMergeTimes.length * 10) / 10
    : null;

  // Sorted arrays for charts
  const byCommits  = [...memberStats].sort((a, b) => b.commits      - a.commits);
  const byPRs      = [...memberStats].sort((a, b) => b.pr.merged    - a.pr.merged);
  const byRevs     = [...memberStats].sort((a, b) => b.revs         - a.revs);
  const byLines    = [...memberStats].sort((a, b) => b.lns.added    - a.lns.added);
  const byDeleted  = [...memberStats].sort((a, b) => b.lns.deleted  - a.lns.deleted);
  const byCons     = [...memberStats].sort((a, b) => (b.cons ?? -1) - (a.cons ?? -1));
  const byCollab   = [...memberStats].sort((a, b) => b.collabScore  - a.collabScore);
  const byChurn    = [...memberStats].filter(ms => ms.codeChurn !== null && ms.lns.added > 0).sort((a, b) => a.codeChurn - b.codeChurn);
  const byPRSize   = [...memberStats].filter(ms => ms.avgPRSize !== null).sort((a, b) => b.avgPRSize - a.avgPRSize);
  const byMerge    = [...memberStats].filter(ms => ms.amt !== null).sort((a, b) => a.amt - b.amt);

  const maxCommits = Math.max(...memberStats.map(ms => ms.commits), 1);
  const maxPRs     = Math.max(...memberStats.map(ms => ms.pr.merged), 1);
  const maxRevs    = Math.max(...memberStats.map(ms => ms.revs), 1);
  const maxAdded   = Math.max(...memberStats.map(ms => ms.lns.added), 1);
  const maxDeleted = Math.max(...memberStats.map(ms => ms.lns.deleted), 1);
  const maxPRSize  = Math.max(...memberStats.filter(ms => ms.avgPRSize !== null).map(ms => ms.avgPRSize), 1);

  // Team totals
  const teamTotals = ["A", "B", "C", "D"].map(team => {
    const rows = memberStats.filter(ms => ms.m.team === team);
    return {
      team, color: TC[team],
      commits:  rows.reduce((s, ms) => s + ms.commits, 0),
      prs:      rows.reduce((s, ms) => s + ms.pr.merged, 0),
      reviews:  rows.reduce((s, ms) => s + ms.revs, 0),
      added:    rows.reduce((s, ms) => s + ms.lns.added, 0),
      members:  rows.length,
      active:   rows.filter(ms => ms.commits > 0 || ms.pr.total > 0 || ms.revs > 0).length,
    };
  });
  const maxTC  = Math.max(...teamTotals.map(t => t.commits), 1);
  const maxTPR = Math.max(...teamTotals.map(t => t.prs), 1);
  const maxTRV = Math.max(...teamTotals.map(t => t.reviews), 1);
  const maxTA  = Math.max(...teamTotals.map(t => t.added), 1);

  // Scatter
  const meanC  = memberStats.reduce((s, ms) => s + ms.commits, 0) / memberStats.length;
  const meanR  = memberStats.reduce((s, ms) => s + ms.revs, 0) / memberStats.length;
  const maxSC  = Math.max(...memberStats.map(ms => ms.commits), 1);
  const maxSR  = Math.max(...memberStats.map(ms => ms.revs), 1);

  // ── Helpers ───────────────────────────────────────────────
  function HBar({ sorted, getValue, getLabel, maxVal, color, showMax, avgVal }) {
    const mv     = showMax ? maxVal : Math.max(...sorted.map(ms => getValue(ms)), 1);
    const avgPct = avgVal !== undefined && mv > 0 ? avgVal / mv * 100 : null;
    return sorted.map(ms => {
      const v = getValue(ms);
      return (
        <div key={ms.m.login} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
          <img src={`https://github.com/${ms.m.login}.png?size=20`} alt={ms.m.name}
            style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, border: `1px solid ${TC[ms.m.team]}50` }} />
          <span style={{ color: "var(--tx2)", fontSize: 8.5, width: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
            {ms.m.name.split(" ")[0]}
          </span>
          <div style={{ flex: 1, height: 6, background: "var(--bdr)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: `${mv > 0 ? v / mv * 100 : 0}%`, background: TC[ms.m.team], borderRadius: 3 }} />
            {avgPct !== null && <div style={{ position:"absolute", top:0, bottom:0, left:`${avgPct}%`, width:1, background:"var(--tx2)", opacity:0.6 }}/>}
          </div>
          <span style={{ color, fontSize: 8.5, fontWeight: 700, width: 28, textAlign: "right", flexShrink: 0 }}>
            {getLabel ? getLabel(ms) : v}
          </span>
        </div>
      );
    });
  }

  // ── MemberCards helper ────────────────────────────────────
  function MemberCards() {
    return ["A","B","C","D"].map(team => {
      const tc   = TC[team];
      const rows = memberStats.filter(ms => ms.m.team === team);
      const tt   = teamTotals.find(t => t.team === team);
      return (
        <div key={team}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <span style={{ background:`${tc}20`, color:tc, fontWeight:800, fontSize:10, textTransform:"uppercase", letterSpacing:2, padding:"3px 10px", borderRadius:5, flexShrink:0 }}>
              Equipo {team}
            </span>
            <span style={{ color:"var(--tx4)", fontSize:10 }}>
              {ghTab === "commits"
                ? `${tt.commits} commits`
                : `${tt.commits} commits · ${tt.prs} PRs · ${tt.reviews} reviews · +${(tt.added/1000).toFixed(1)}k líneas`}
            </span>
            <div style={{ flex:1, height:1, background:"var(--bdr)" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {rows.map(({ m, commits, pr, revs, lns, cons, amt, collabScore, prEfficiency }) => (
              <div key={m.login} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"10px 14px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:160 }}>
                    <img src={`https://github.com/${m.login}.png?size=36`} alt={m.name}
                      style={{ width:32, height:32, borderRadius:"50%", border:`2px solid ${tc}50`, flexShrink:0 }} />
                    <div>
                      <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:12 }}>{m.name}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <a href={`https://github.com/${m.login}`} target="_blank" rel="noreferrer"
                          style={{ display:"inline-flex", alignItems:"center", gap:3, color:"var(--tx4)", fontSize:9, textDecoration:"none" }}>
                          <svg viewBox="0 0 16 16" width={10} height={10} fill="var(--tx4)">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                          </svg>
                          @{m.login}
                        </a>
                        <span style={{ color:"var(--bdr2)", fontSize:9 }}>· {m.role}{m.coord?" · Coord":""}</span>
                      </div>
                    </div>
                  </div>
                  {ghTab === "commits" ? (
                    <div style={{ display:"flex", gap:16, flex:1, flexWrap:"wrap", alignItems:"center" }}>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ color:"#818cf8", fontWeight:800, fontSize:20, lineHeight:1.1 }}>{commits}</div>
                        <div style={{ color:"var(--tx4)", fontSize:8, textTransform:"uppercase", letterSpacing:1 }}>Commits</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:"flex", gap:16, flex:1, flexWrap:"wrap" }}>
                      {[
                        { value:commits,   label:"Commits",  color:"#818cf8" },
                        { value:pr.merged, label:"PRs",      color:"#34d399", sub:`/${pr.total}` },
                        ...(pr.open>0?[{ value:pr.open, label:"Open PRs", color:"#fbbf24" }]:[]),
                        { value:revs,      label:"Reviews",  color:"#f59e0b" },
                      ].map(({ value, label, color, sub }) => (
                        <div key={label} style={{ textAlign:"center" }}>
                          <div style={{ color, fontWeight:800, fontSize:16, lineHeight:1.1 }}>
                            {value}{sub && <span style={{ color:"var(--tx4)", fontSize:10, fontWeight:400 }}>{sub}</span>}
                          </div>
                          <div style={{ color:"var(--tx4)", fontSize:8, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {ghTab !== "commits" && (
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                      {cons!==null && <span title={`${cons}% semanas con ≥1 commit`} style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:cons>=50?"#38bdf820":"var(--bdr)", color:cons>=70?"#38bdf8":cons>=40?"var(--tx2)":"var(--tx4)", border:`1px solid ${cons>=50?"#38bdf840":"var(--bdr2)"}` }}>📅 {cons}%</span>}
                      <span title="Score colaboración" style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:collabScore>=60?"#a855f720":"var(--bdr)", color:collabScore>=60?"#a855f7":collabScore>=30?"var(--tx2)":"var(--tx4)", border:`1px solid ${collabScore>=60?"#a855f740":"var(--bdr2)"}` }}>🤝 {collabScore}</span>
                      {prEfficiency!==null && <span title={`${prEfficiency}% PRs mergeadas`} style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:prEfficiency>=70?"#34d39920":"var(--bdr)", color:prEfficiency>=70?"#34d399":"var(--tx2)", border:`1px solid ${prEfficiency>=70?"#34d39940":"var(--bdr2)"}` }}>🔀 {prEfficiency}%</span>}
                      {amt!==null && <span title={`${amt}d promedio hasta merge`} style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:amt<=1?"#22c55e20":amt<=3?"#f59e0b20":"#ef444420", color:amt<=1?"#22c55e":amt<=3?"#f59e0b":"#ef4444", border:`1px solid ${amt<=1?"#22c55e40":amt<=3?"#f59e0b40":"#ef444440"}` }}>⚡ {amt}d</span>}
                      {lns.added>0 && <span title={`+${lns.added.toLocaleString()} líneas`} style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:"#38bdf815", color:"#38bdf8", border:"1px solid #38bdf830" }}>+{lns.added>999?`${(lns.added/1000).toFixed(1)}k`:lns.added}</span>}
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", gap:8, marginTop:8 }}>
                  {ghTab === "commits" ? (() => {
                    const teamAvg = rows.length > 0 ? rows.reduce((s, r) => s + r.commits, 0) / rows.length : 0;
                    const globalAvg = memberStats.filter(r => r.commits > 0).length > 0
                      ? totalCommits / memberStats.filter(r => r.commits > 0).length : 0;
                    return (
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                          <span style={{ color:"var(--tx4)", fontSize:7.5, textTransform:"uppercase", letterSpacing:0.8 }}>Commits</span>
                          <span style={{ color:"#818cf8", fontSize:7.5, fontWeight:700 }}>{commits}</span>
                        </div>
                        <div style={{ height:4, background:"var(--bdr)", borderRadius:2, overflow:"hidden", position:"relative" }}>
                          <div style={{ height:"100%", width:`${maxCommits>0?commits/maxCommits*100:0}%`, background:"#818cf8", borderRadius:2 }} />
                          {globalAvg > 0 && <div title={`Media global: ${Math.round(globalAvg)}`} style={{ position:"absolute", top:0, bottom:0, left:`${maxCommits>0?globalAvg/maxCommits*100:0}%`, width:1, background:"var(--tx2)", opacity:0.7 }}/>}
                          {teamAvg > 0 && <div title={`Media equipo ${team}: ${Math.round(teamAvg)}`} style={{ position:"absolute", top:0, bottom:0, left:`${maxCommits>0?teamAvg/maxCommits*100:0}%`, width:1, background:tc, opacity:0.9 }}/>}
                        </div>
                      </div>
                    );
                  })() : [
                    { label:"Commits", val:commits,   max:maxCommits, col:"#818cf8" },
                    { label:"PRs",     val:pr.merged, max:maxPRs,     col:"#34d399" },
                    { label:"Reviews", val:revs,      max:maxRevs,    col:"#f59e0b" },
                    { label:"+Líneas", val:lns.added, max:maxAdded,   col:"#38bdf8" },
                  ].map(({ label, val, max, col }) => (
                    <div key={label} style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                        <span style={{ color:"var(--tx4)", fontSize:7.5, textTransform:"uppercase", letterSpacing:0.8 }}>{label}</span>
                        <span style={{ color:col, fontSize:7.5, fontWeight:700 }}>{val>999?`${(val/1000).toFixed(1)}k`:val}</span>
                      </div>
                      <div style={{ height:3, background:"var(--bdr)", borderRadius:2, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${max>0?val/max*100:0}%`, background:col, borderRadius:2 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    });
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ color: "var(--tx0)", fontWeight: 800, fontSize: 15 }}>🐙 GitHub — Insights & Métricas</span>
        {loading
          ? <span style={{ color: "var(--tx4)", fontSize: 10 }}>⏳ actualizando métricas…</span>
          : stats?.fetchedAt && (
            <span style={{ color: "var(--tx4)", fontSize: 10 }}>
              Actualizado {new Date(stats.fetchedAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          )
        }
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#ef444415", border: "1px solid #ef444440", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 12 }}>
          ⚠ {error}
        </div>
      )}

      {/* No data */}
      {!hasData && !loading && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🐙</div>
          <div style={{ color: "var(--tx2)", fontSize: 13, fontWeight: 600 }}>No hay datos de GitHub cargados</div>
          <div style={{ color: "var(--tx4)", fontSize: 11, marginTop: 4 }}>Sincroniza el backlog con tu token y pulsa «Actualizar métricas»</div>
        </div>
      )}

      {hasData && (<>

        {/* ── KPI Cards ─────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <InfStatCard label="Commits totales"  value={totalCommits}
            sub={`${memberStats.filter(ms => ms.commits > 0).length}/${TEAM_MEMBERS.length} contribuidores`} color="#818cf8" />
          <InfStatCard label="PRs mergeadas"    value={totalPRs}
            sub={`de ${memberStats.reduce((s, ms) => s + ms.pr.total, 0)} PRs totales`} color="#34d399" />
          <InfStatCard label="Code reviews"     value={totalRevs}
            sub={`${memberStats.filter(ms => ms.revs > 0).length}/${TEAM_MEMBERS.length} revisores`} color="#f59e0b" />
          <InfStatCard label="Participación"    value={`${Math.round(activeMembers / TEAM_MEMBERS.length * 100)}%`}
            sub={`${activeMembers}/${TEAM_MEMBERS.length} miembros activos`}
            color={activeMembers / TEAM_MEMBERS.length >= 0.8 ? "#22c55e" : activeMembers / TEAM_MEMBERS.length >= 0.5 ? "#f59e0b" : "#ef4444"} />
          <InfStatCard label="Líneas añadidas"  value={totalAdded.toLocaleString()}
            sub={`total proyecto`} color="#38bdf8" />
          {teamAvgMerge !== null && (
            <InfStatCard label="Tiempo medio merge" value={`${teamAvgMerge}d`}
              sub={`de ${allMergeTimes.length} PRs con fecha`}
              color={teamAvgMerge <= 1 ? "#22c55e" : teamAvgMerge <= 3 ? "#f59e0b" : "#ef4444"} />
          )}
        </div>

        {/* ── Sidebar + Content layout ──────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"148px 1fr", gap:14, alignItems:"start" }}>

          {/* Left sidebar */}
          <div style={{ display:"flex", flexDirection:"column", gap:3, position:"sticky", top:72 }}>
            {[
              { id:"commits", label:"💻 Commits",       color:"#818cf8" },
              { id:"prs",     label:"🔀 Pull Requests",  color:"#34d399" },
              { id:"lineas",  label:"📦 Líneas",         color:"#38bdf8" },
            ].map(t => {
              const active = ghTab === t.id;
              return (
                <button key={t.id} onClick={() => setGhTab(t.id)}
                  style={{ padding:"9px 12px", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer", textAlign:"left",
                    border: active ? `1px solid ${t.color}45` : "1px solid var(--bdr)",
                    background: active ? `${t.color}15` : "var(--bg2)",
                    color: active ? t.color : "var(--tx3)", transition:"all .12s" }}>
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Right content */}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

            {/* ── Heatmap + Punch card — genérico pestaña Commits ── */}
            {ghTab === "commits" && (<>
              {Array.isArray(stats?.commitActivity) && stats.commitActivity.length > 0 && (() => {
                const weeks=stats.commitActivity.slice(-52), maxDay=Math.max(...weeks.flatMap(w=>w.days),1);
                const cellSize=11,gap=2,step=cellSize+gap, DAYS=["D","L","M","X","J","V","S"];
                const W=52*step+28,H=7*step+22;
                const col=(v)=>{ if(v===0)return"#1a1a2e"; return["#1e3a5f","#2563eb","#3b82f6","#93c5fd"][Math.min(Math.floor(v/maxDay*4),3)]; };
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>📈 Actividad — últimas 52 semanas</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {DAYS.map((d,i)=><text key={d} x={14} y={20+i*step+cellSize/2} textAnchor="middle" fontSize={5} fill="var(--tx4)">{d}</text>)}
                      {weeks.map((w,wi)=>w.days.map((count,di)=>(
                        <rect key={`${wi}-${di}`} x={22+wi*step} y={16+di*step} width={cellSize} height={cellSize} rx={2} fill={col(count)} opacity={0.95}>
                          <title>{`Sem ${wi+1}, ${DAYS[di]}: ${count} commits`}</title>
                        </rect>
                      )))}
                      {[0,4,8,13,17,21,26,30,34,39,43,47].map((wi,mi)=>{
                        const months=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                        return <text key={mi} x={22+wi*step+cellSize/2} y={11} textAnchor="middle" fontSize={4.5} fill="var(--bdr2)">{months[mi]}</text>;
                      })}
                    </svg>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
                      <span style={{ color:"var(--tx4)", fontSize:8 }}>Menos</span>
                      {["#1a1a2e","#1e3a5f","#2563eb","#3b82f6","#93c5fd"].map(c=><span key={c} style={{ width:8, height:8, borderRadius:1, background:c, display:"inline-block" }}/>)}
                      <span style={{ color:"var(--tx4)", fontSize:8 }}>Más</span>
                    </div>
                  </div>
                );
              })()}
              {Array.isArray(stats?.punchCard) && stats.punchCard.length > 0 && (() => {
                const data=stats.punchCard, maxV=Math.max(...data.map(([,,c])=>c),1);
                const DAYS=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"], cellW=20,cellH=18,padL=30,padT=20;
                const W=padL+24*cellW+10, H=padT+7*cellH+10;
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>⏰ Patrón temporal — commits por hora y día</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {DAYS.map((d,i)=><text key={d} x={padL-3} y={padT+i*cellH+cellH/2+1.5} textAnchor="end" fontSize={5} fill="var(--tx4)">{d}</text>)}
                      {Array.from({length:24},(_,h)=><text key={h} x={padL+h*cellW+cellW/2} y={padT-3} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{h%3===0?`${h}h`:""}</text>)}
                      {data.map(([day,hour,count])=>{
                        const r=count>0?Math.sqrt(count/maxV)*(cellH/2-1.5):0;
                        const cx=padL+hour*cellW+cellW/2, cy=padT+day*cellH+cellH/2;
                        const c=day===0||day===6?"#f59e0b":"#818cf8";
                        return r>0?<circle key={`${day}-${hour}`} cx={cx} cy={cy} r={r} fill={c} opacity={0.7}><title>{`${DAYS[day]} ${hour}:00 — ${count} commits`}</title></circle>:<rect key={`${day}-${hour}`} x={cx-1} y={cy-1} width={2} height={2} fill="#1f2937"/>;
                      })}
                    </svg>
                    <div style={{ display:"flex", gap:12, marginTop:4 }}>
                      <span style={{ fontSize:8.5, color:"var(--tx4)" }}><span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:"#818cf8", marginRight:3 }}/>Días laborables</span>
                      <span style={{ fontSize:8.5, color:"var(--tx4)" }}><span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:"#f59e0b", marginRight:3 }}/>Fines de semana</span>
                    </div>
                  </div>
                );
              })()}
              {/* Tendencia — últimas 4 sem vs anteriores 4 sem */}
              {Array.isArray(stats?.commitActivity) && stats.commitActivity.length >= 8 && (() => {
                const acts  = stats.commitActivity;
                const last4 = acts.slice(-4).reduce((s, w) => s + w.total, 0);
                const prev4 = acts.slice(-8, -4).reduce((s, w) => s + w.total, 0);
                const pct   = prev4 > 0 ? Math.round((last4 - prev4) / prev4 * 100) : null;
                const up    = pct !== null && pct >= 0;
                const color = pct === null ? "var(--tx2)" : pct > 10 ? "#22c55e" : pct < -10 ? "#ef4444" : "#f59e0b";
                const w8    = acts.slice(-8);
                const mx    = Math.max(...w8.map(w => w.total), 1);
                return (
                  <div style={{ background:"var(--bg2)", border:`1px solid ${color}25`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>📈 Tendencia — últimas 4 semanas</div>
                      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                        <span style={{ color, fontSize:24, fontWeight:800, lineHeight:1 }}>{pct !== null ? `${up?"+":""}${pct}%` : "—"}</span>
                        <span style={{ color, fontSize:16 }}>{pct !== null ? (up ? "↑" : "↓") : ""}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:20, alignItems:"center" }}>
                      <div>
                        <div style={{ color:"var(--tx4)", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ult. 4 sem</div>
                        <div style={{ color:"var(--tx0)", fontWeight:800, fontSize:15 }}>{last4}</div>
                      </div>
                      <div style={{ width:1, height:28, background:"var(--bdr)" }}/>
                      <div>
                        <div style={{ color:"var(--tx4)", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ant. 4 sem</div>
                        <div style={{ color:"var(--tx4)", fontWeight:700, fontSize:15 }}>{prev4}</div>
                      </div>
                    </div>
                    <svg viewBox="0 0 88 28" style={{ width:88, height:28, flexShrink:0 }}>
                      {w8.map((w, i) => {
                        const bh = (w.total / mx) * 24;
                        const bx = i * 11;
                        return <rect key={i} x={bx} y={28 - bh} width={9} height={bh} rx={1.5}
                          fill={i >= 4 ? color : "var(--bdr)"} opacity={i >= 4 ? 0.9 : 0.6}/>;
                      })}
                    </svg>
                  </div>
                );
              })()}
            </>)}

            {/* ── Heatmap + Punch card + Tendencia — pestaña PRs ── */}
            {ghTab === "prs" && (<>
              {(() => {
                const MN=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                const DAYS=["D","L","M","X","J","V","S"];
                // prActivity already has daily breakdown: [{week, total, days:[sun..sat]}, ...]
                const weeks = Array.isArray(stats?.prActivity) && stats.prActivity[0]?.days
                  ? stats.prActivity.slice(-52)
                  : Array.from({length:52}, (_,i)=>({ week:0, total:0, days:Array(7).fill(0) }));
                const maxDay=Math.max(...weeks.flatMap(w=>w.days),1);
                const cellS=11,gap=2,step=cellS+gap,W=52*step+28,H=7*step+22;
                const col=(v)=>{ if(v===0)return"#1a1a2e"; return["#1e3a5f","#6d28d9","#7c3aed","#a78bfa"][Math.min(Math.floor(v/maxDay*4),3)]; };
                const mnLbls=[]; let prevM=-1;
                weeks.forEach((w,wi)=>{ if(!w.week) return; const m=new Date(w.week*1000).getUTCMonth(); if(m!==prevM){mnLbls.push({wi,m});prevM=m;} });
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
                      📊 Actividad PRs — últimas 52 semanas
                      {!stats?.prActivity && <span style={{color:"var(--tx4)",fontWeight:400,marginLeft:8,fontSize:8}}>(pulsa Actualizar para ver datos)</span>}
                    </div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {DAYS.map((d,i)=><text key={d} x={14} y={20+i*step+cellS/2} textAnchor="middle" fontSize={5} fill="var(--tx4)">{d}</text>)}
                      {mnLbls.map(({wi,m})=><text key={m} x={22+wi*step+cellS/2} y={11} textAnchor="middle" fontSize={4.5} fill="var(--bdr2)">{MN[m]}</text>)}
                      {weeks.map((w,wi)=>w.days.map((count,di)=>(
                        <rect key={`${wi}-${di}`} x={22+wi*step} y={16+di*step} width={cellS} height={cellS} rx={2} fill={col(count)} opacity={0.95}>
                          <title>{`Sem ${wi+1}, ${DAYS[di]}: ${count} PRs`}</title>
                        </rect>
                      )))}
                    </svg>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
                      <span style={{ color:"var(--tx4)", fontSize:8 }}>Menos</span>
                      {["#1a1a2e","#1e3a5f","#6d28d9","#7c3aed","#a78bfa"].map(c=><span key={c} style={{ width:8,height:8,borderRadius:1,background:c,display:"inline-block" }}/>)}
                      <span style={{ color:"var(--tx4)", fontSize:8 }}>Más</span>
                    </div>
                  </div>
                );
              })()}
              {Array.isArray(stats?.prPunch) && stats.prPunch.some(([,,c])=>c>0) && (() => {
                const data=stats.prPunch, maxV=Math.max(...data.map(([,,c])=>c),1);
                const DAYS=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"], cellW=20,cellH=18,padL=30,padT=20;
                const W=padL+24*cellW+10, H=padT+7*cellH+10;
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>⏰ Patrón temporal — PRs por hora y día</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {DAYS.map((d,i)=><text key={d} x={padL-3} y={padT+i*cellH+cellH/2+1.5} textAnchor="end" fontSize={5} fill="var(--tx4)">{d}</text>)}
                      {Array.from({length:24},(_,h)=><text key={h} x={padL+h*cellW+cellW/2} y={padT-3} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{h%3===0?`${h}h`:""}</text>)}
                      {data.map(([day,hour,count])=>{
                        const r=count>0?Math.sqrt(count/maxV)*(cellH/2-1.5):0;
                        const cx=padL+hour*cellW+cellW/2, cy=padT+day*cellH+cellH/2;
                        const c=day===0||day===6?"#f59e0b":"#7c3aed";
                        return r>0?<circle key={`${day}-${hour}`} cx={cx} cy={cy} r={r} fill={c} opacity={0.7}><title>{`${DAYS[day]} ${hour}:00 — ${count} PRs`}</title></circle>:<rect key={`${day}-${hour}`} x={cx-1} y={cy-1} width={2} height={2} fill="#1f2937"/>;
                      })}
                    </svg>
                    <div style={{ display:"flex", gap:12, marginTop:4 }}>
                      <span style={{ fontSize:8.5, color:"var(--tx4)" }}><span style={{ display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#7c3aed",marginRight:3 }}/>Días laborables</span>
                      <span style={{ fontSize:8.5, color:"var(--tx4)" }}><span style={{ display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#f59e0b",marginRight:3 }}/>Fines de semana</span>
                    </div>
                  </div>
                );
              })()}
              {Array.isArray(stats?.prActivity) && stats.prActivity.length >= 8 && (() => {
                const acts=stats.prActivity;
                const last4=acts.slice(-4).reduce((s,w)=>s+w.total,0);
                const prev4=acts.slice(-8,-4).reduce((s,w)=>s+w.total,0);
                // Si prev4=0, extender a ventana de 8 semanas anteriores (normalizado a 4 semanas)
                const prev8=acts.slice(-12,-4).reduce((s,w)=>s+w.total,0)/2;
                const base=prev4>0?prev4:prev8>0?prev8:null;
                const pct=base!==null?Math.round((last4-base)/base*100):null;
                const up=pct!==null&&pct>=0;
                const color=pct===null?"var(--tx2)":pct>10?"#22c55e":pct<-10?"#ef4444":"#f59e0b";
                const w8=acts.slice(-8), mx=Math.max(...w8.map(w=>w.total),1);
                return (
                  <div style={{ background:"var(--bg2)", border:`1px solid ${color}25`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>📈 Tendencia PRs — últimas 4 semanas</div>
                      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                        <span style={{ color, fontSize:24, fontWeight:800, lineHeight:1 }}>{pct!==null?`${up?"+":""}${pct}%`:"—"}</span>
                        <span style={{ color, fontSize:16 }}>{pct!==null?(up?"↑":"↓"):""}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:20, alignItems:"center" }}>
                      <div><div style={{ color:"var(--tx4)", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ult. 4 sem</div><div style={{ color:"var(--tx0)", fontWeight:800, fontSize:15 }}>{last4}</div></div>
                      <div style={{ width:1, height:28, background:"var(--bdr)" }}/>
                      <div><div style={{ color:"var(--tx4)", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ant. 4 sem</div><div style={{ color:"var(--tx4)", fontWeight:700, fontSize:15 }}>{prev4}</div></div>
                    </div>
                    <svg viewBox="0 0 88 28" style={{ width:88, height:28, flexShrink:0 }}>
                      {w8.map((w,i)=>{ const bh=(w.total/mx)*24; return <rect key={i} x={i*11} y={28-bh} width={9} height={bh} rx={1.5} fill={i>=4?color:"var(--bdr)"} opacity={i>=4?0.9:0.6}/>; })}
                    </svg>
                  </div>
                );
              })()}
            </>)}

            {/* ── Heatmap + Tendencia — pestaña Líneas ── */}
            {ghTab === "lineas" && (<>
              {(() => {
                const MN=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                const DAYS=["D","L","M","X","J","V","S"];
                // Build 52 Sunday-based weekly slots (GitHub codeFreq uses Sunday)
                const addMap={}, delMap={};
                (stats?.codeFreq||[]).forEach(([ts,a,d])=>{ addMap[ts]=a; delMap[ts]=Math.abs(d); });
                const now=new Date(), dow=now.getUTCDay();
                const sun0=new Date(now); sun0.setUTCDate(now.getUTCDate()-dow); sun0.setUTCHours(0,0,0,0);
                const wks52=Array.from({length:52},(_,i)=>{ const d=new Date(sun0); d.setUTCDate(sun0.getUTCDate()-(51-i)*7); const ts=Math.floor(d.getTime()/1000); return {ts,added:addMap[ts]||0,deleted:delMap[ts]||0}; });
                const maxA=Math.max(...wks52.map(w=>w.added),1);
                const maxD=Math.max(...wks52.map(w=>w.deleted),1);
                const cellS=11,gap=2,step=cellS+gap,W=52*step+28,H=cellS+24;
                const colA=(v)=>{ if(v===0)return"#1a1a2e"; return["#1e3a5f","#1d4ed8","#2563eb","#60a5fa"][Math.min(Math.floor(v/maxA*4),3)]; };
                const colD=(v)=>{ if(v===0)return"#1a1a2e"; return["#1a1a2e","#7f1d1d","#b91c1c","#f87171"][Math.min(Math.floor(v/maxD*4),3)]; };
                const mnLbls=[]; let prevM=-1;
                wks52.forEach((w,wi)=>{ const m=new Date(w.ts*1000).getUTCMonth(); if(m!==prevM){mnLbls.push({wi,m});prevM=m;} });
                const Row = ({vals, col, label, palette, titleFmt}) => (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>{label}</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {mnLbls.map(({wi,m})=><text key={m} x={22+wi*step+cellS/2} y={11} textAnchor="middle" fontSize={4.5} fill="var(--bdr2)">{MN[m]}</text>)}
                      {vals.map((v,wi)=>(
                        <rect key={wi} x={22+wi*step} y={16} width={cellS} height={cellS} rx={2} fill={col(v)} opacity={0.95}>
                          <title>{titleFmt(v, wks52[wi].ts)}</title>
                        </rect>
                      ))}
                    </svg>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
                      <span style={{ color:"var(--tx4)", fontSize:8 }}>Menos</span>
                      {palette.map(c=><span key={c} style={{ width:8,height:8,borderRadius:1,background:c,display:"inline-block" }}/>)}
                      <span style={{ color:"var(--tx4)", fontSize:8 }}>Más</span>
                    </div>
                  </div>
                );
                return (<>
                  <Row vals={wks52.map(w=>w.added)} col={colA} label="➕ Líneas añadidas — últimas 52 semanas"
                    palette={["#1a1a2e","#1e3a5f","#1d4ed8","#2563eb","#60a5fa"]}
                    titleFmt={(v,ts)=>`${new Date(ts*1000).toLocaleDateString('es')}: +${v.toLocaleString()} líneas`}/>
                  <Row vals={wks52.map(w=>w.deleted)} col={colD} label="➖ Líneas eliminadas — últimas 52 semanas"
                    palette={["#1a1a2e","#7f1d1d","#b91c1c","#ef4444","#f87171"]}
                    titleFmt={(v,ts)=>`${new Date(ts*1000).toLocaleDateString('es')}: -${v.toLocaleString()} líneas`}/>
                </>);
              })()}
              {Array.isArray(stats?.linesActivity) && stats.linesActivity.length >= 8 && (() => {
                const acts=stats.linesActivity;
                const tot=(w)=>w.total;
                const last4=acts.slice(-4).reduce((s,w)=>s+tot(w),0);
                const prev4=acts.slice(-8,-4).reduce((s,w)=>s+tot(w),0);
                const prev8=acts.slice(-12,-4).reduce((s,w)=>s+tot(w),0)/2;
                const base=prev4>0?prev4:prev8>0?prev8:null;
                const pct=base!==null?Math.round((last4-base)/base*100):null;
                const up=pct!==null&&pct>=0;
                const color=pct===null?"var(--tx2)":pct>10?"#22c55e":pct<-10?"#ef4444":"#f59e0b";
                const w8=acts.slice(-8), mx=Math.max(...w8.map(tot),1);
                const fmt=(n)=>n>=1000?`${(n/1000).toFixed(1)}k`:String(n);
                return (
                  <div style={{ background:"var(--bg2)", border:`1px solid ${color}25`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>📈 Tendencia líneas — últimas 4 semanas</div>
                      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                        <span style={{ color, fontSize:24, fontWeight:800, lineHeight:1 }}>{pct!==null?`${up?"+":""}${pct}%`:"—"}</span>
                        <span style={{ color, fontSize:16 }}>{pct!==null?(up?"↑":"↓"):""}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:20, alignItems:"center" }}>
                      <div><div style={{ color:"var(--tx4)", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ult. 4 sem</div><div style={{ color:"var(--tx0)", fontWeight:800, fontSize:15 }}>{fmt(last4)}</div></div>
                      <div style={{ width:1, height:28, background:"var(--bdr)" }}/>
                      <div><div style={{ color:"var(--tx4)", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ant. 4 sem</div><div style={{ color:"var(--tx4)", fontWeight:700, fontSize:15 }}>{fmt(prev4)}</div></div>
                    </div>
                    <svg viewBox="0 0 88 28" style={{ width:88, height:28, flexShrink:0 }}>
                      {w8.map((w,i)=>{ const bh=(tot(w)/mx)*24; return <rect key={i} x={i*11} y={28-bh} width={9} height={bh} rx={1.5} fill={i>=4?color:"var(--bdr)"} opacity={i>=4?0.9:0.6}/>; })}
                    </svg>
                  </div>
                );
              })()}
            </>)}

            {/* Persona / Equipo toggle */}
            <div style={{ display:"flex", gap:3, background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:9, padding:3, alignSelf:"flex-start" }}>
              {[{ id:"persona", label:"👥 Persona" }, { id:"equipo", label:"👤 Equipo" }].map(vt => {
                const active = ghView === vt.id;
                return (
                  <button key={vt.id} onClick={() => setGhView(vt.id)}
                    style={{ padding:"5px 14px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                      border: active ? "1px solid #94a3b845" : "1px solid transparent",
                      background: active ? "#94a3b820" : "transparent",
                      color: active ? "var(--tx2)" : "var(--tx3)", transition:"all .12s" }}>
                    {vt.label}
                  </button>
                );
              })}
            </div>

            {/* ── COMMITS / PERSONA ──────────────────────────── */}
            {ghTab === "commits" && ghView === "persona" && (<>
              {/* Header metric cards */}
              {(() => {
                const active = byCommits.filter(ms => ms.commits > 0);
                const top    = active[0];
                const bottom = active[active.length - 1];
                const avg    = active.length > 0 ? Math.round(totalCommits / active.length) : 0;
                const wcLen  = Math.max(...memberStats.map(ms => (ms.wc || []).length), 0);
                const projActive = Array.from({length: wcLen}, (_, i) => memberStats.some(ms => (ms.wc || [])[i] > 0));
                const nProjW = projActive.filter(Boolean).length || 1;
                const byReg  = memberStats.filter(ms => ms.commits > 0)
                  .map(ms => {
                    const sum = projActive.reduce((s, a, i) => a ? s + ((ms.wc || [])[i] || 0) : s, 0);
                    return { ms, avg: sum / nProjW };
                  })
                  .sort((a, b) => b.avg - a.avg);
                const mostReg  = byReg[0];
                const leastReg = byReg[byReg.length - 1];
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))", gap:8 }}>
                    {[
                      { label:"🥇 Más commits",    name: top?.m.name.split(" ").slice(0,2).join(" "),        val:`${top?.commits ?? 0}`,                            color:"#818cf8" },
                      { label:"🔻 Menos commits",  name: bottom?.m.name.split(" ").slice(0,2).join(" "),      val:`${bottom?.commits ?? 0}`,                         color:"#f43f5e" },
                      { label:"📊 Media / persona",name: null,                                                 val:`${avg}`,                                          color:"var(--tx2)" },
                      { label:"🎯 Más regular",    name: mostReg?.ms.m.name.split(" ").slice(0,2).join(" "),  val:`${mostReg?.avg.toFixed(1)} c/sem`,                color:"#22c55e" },
                      { label:"📉 Menos regular",  name: leastReg?.ms.m.name.split(" ").slice(0,2).join(" "), val:`${leastReg?.avg.toFixed(1)} c/sem`,               color:"#f97316" },
                    ].map(({ label, name, val, color }) => (
                      <div key={label} style={{ background:"var(--bg2)", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>{label}</div>
                        {name && <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:11, marginBottom:2 }}>{name}</div>}
                        <div style={{ color, fontSize:14, fontWeight:800 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Weekly commits chart */}
              {Array.isArray(stats?.commitActivity) && stats.commitActivity.length > 0 && memberStats.length > 0 && (() => {
                const MN = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                const W=440, H=96, padL=26, padB=16, padT=8;
                const WEEK_S = 7 * 24 * 3600;
                const actWeeks = stats.commitActivity;
                // Extend to last sprint end
                const lastSprintTs = Math.max(...Object.values(SC).map(s => Math.floor(new Date(s.end).getTime() / 1000)));
                const futureTs = [];
                let fw = actWeeks[actWeeks.length - 1].week + WEEK_S;
                while (fw <= lastSprintTs + WEEK_S) { futureTs.push(fw); fw += WEEK_S; }
                // Totals from memberStats.wc (same source as equipo chart)
                const allData = [
                  ...actWeeks.map((w, i) => {
                    let total = 0;
                    memberStats.forEach(({ wc }) => {
                      if (!wc || !wc.length) return;
                      const wcIdx = i - (actWeeks.length - wc.length);
                      if (wcIdx >= 0 && wcIdx < wc.length) total += wc[wcIdx] || 0;
                    });
                    return { week: w.week, total };
                  }),
                  ...futureTs.map(week => ({ week, total: 0 })),
                ];
                // Trim to first week with data
                const firstIdx = allData.findIndex(w => w.total > 0);
                if (firstIdx < 0) return null;
                const display = allData.slice(firstIdx);
                const maxW  = Math.max(...display.map(w => w.total), 1);
                const colW  = (W - padL) / display.length;
                const barW  = Math.max(1.5, colW * 0.7);
                const yOf   = v => H - padB - (v / maxW) * (H - padT - padB);
                // Month labels from first data week onward, on month change
                let prevM = -1;
                const lbls = display.map(({ week }) => {
                  const m = new Date(week * 1000).getMonth();
                  if (m !== prevM) { prevM = m; return MN[m]; }
                  return "";
                });
                // Avg of non-zero weeks only
                const nzW = display.filter(w => w.total > 0);
                const avgW = nzW.length > 0 ? nzW.reduce((s,w) => s + w.total, 0) / nzW.length : 0;
                // Sprint milestone positions
                const milestones = Object.values(SC).map(s => {
                  const ts = Math.floor(new Date(s.end).getTime() / 1000);
                  let best = 0, bestD = Infinity;
                  display.forEach(({ week }, i) => { const d = Math.abs(week - ts); if (d < bestD) { bestD = d; best = i; } });
                  return { label: s.label.replace("Sprint ","S"), color: s.color, bx: padL + best * colW + colW / 2 };
                });
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid #818cf820", borderRadius:10, padding:"12px 14px 8px" }}>
                    <div style={{ color:"#818cf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📅 Commits por semana</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {[maxW, Math.round(maxW/2), 0].map(v => {
                        const y = yOf(v);
                        return (
                          <g key={v}>
                            <line x1={padL - 2} y1={y} x2={padL} y2={y} stroke="var(--bdr2)" strokeWidth={0.5}/>
                            <text x={padL - 4} y={y + 1.5} textAnchor="end" fontSize={4} fill="var(--tx4)">{v}</text>
                          </g>
                        );
                      })}
                      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--bdr2)" strokeWidth={0.5}/>
                      {milestones.map(({ label, color, bx }) => (
                        <g key={label}>
                          <line x1={bx} y1={padT} x2={bx} y2={H - padB} stroke={color} strokeWidth={0.8} strokeDasharray="2,1.5" opacity={0.6}/>
                          <text x={bx + 1} y={padT + 3.5} fontSize={3.5} fill={color} opacity={0.85}>{label}</text>
                        </g>
                      ))}
                      {display.map(({ week, total }, i) => {
                        const bh = (total / maxW) * (H - padT - padB);
                        const bx = padL + i * colW + (colW - barW) / 2;
                        const d  = new Date(week * 1000);
                        return (
                          <g key={week}>
                            {total > 0 && (
                              <rect x={bx} y={H - padB - bh} width={barW} height={bh} rx={1} fill="#818cf8" opacity={0.75}>
                                <title>{`${d.toLocaleDateString("es-ES",{day:"2-digit",month:"short"})}: ${total} commits`}</title>
                              </rect>
                            )}
                            {lbls[i] && <text x={bx + barW/2} y={H - 2} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{lbls[i]}</text>}
                          </g>
                        );
                      })}
                      {avgW > 0 && (() => {
                        const ly = yOf(avgW);
                        return (
                          <g>
                            <line x1={padL} y1={ly} x2={W - 2} y2={ly} stroke="var(--tx2)" strokeWidth={0.7} strokeDasharray="3,2" opacity={0.5}/>
                            <text x={W - 3} y={ly - 2} textAnchor="end" fontSize={4} fill="var(--tx2)" opacity={0.7}>ø {Math.round(avgW)}</text>
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                );
              })()}
              {/* Commits bar chart */}
              <div style={{ background:"var(--bg2)", border:"1px solid #818cf820", borderRadius:10, padding:"12px 12px 8px" }}>
                <div style={{ color:"#818cf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>💻 Commits por persona</div>
                <HBar sorted={byCommits} getValue={ms => ms.commits} getLabel={ms => ms.commits} maxVal={maxCommits} color="#818cf8" showMax
                  avgVal={memberStats.filter(ms => ms.commits > 0).length > 0 ? Math.round(totalCommits / memberStats.filter(ms => ms.commits > 0).length) : undefined} />
              </div>
              {/* Recomendaciones persona */}
              {(() => {
                const SC = { red:"#ef4444", yellow:"#f59e0b", green:"#22c55e", blue:"#38bdf8" };
                const SB = { red:"#ef444412", yellow:"#f59e0b12", green:"#22c55e12", blue:"#38bdf812" };
                const tip = (sev, icon, title, msg) => ({ sev, icon, title, msg });
                const tips = [];
                const active = memberStats.filter(ms => ms.commits > 0);
                const avg = active.length > 0 ? totalCommits / active.length : 0;
                const wcLen = Math.max(...memberStats.map(ms => (ms.wc||[]).length), 0);
                const projActive = Array.from({length:wcLen}, (_,i) => memberStats.some(ms => (ms.wc||[])[i] > 0));
                const nProjW = projActive.filter(Boolean).length || 1;
                // Sin commits
                const zero = memberStats.filter(ms => ms.commits === 0);
                if (zero.length) tips.push(tip("red","🚨","Sin commits registrados",
                  `${zero.map(ms=>ms.m.name.split(" ")[0]).join(", ")} no ${zero.length>1?"tienen":"tiene"} commits. Verificar que el login de GitHub sea correcto o que hayan subido código al repositorio.`));
                // Muy por debajo de la media (< 40%)
                const veryLow = active.filter(ms => ms.commits < avg * 0.4);
                if (veryLow.length) tips.push(tip("yellow","📉","Deberían aumentar su cadencia",
                  `${veryLow.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.commits})`).join(", ")} ${veryLow.length>1?"están":"está"} por debajo del 40% de la media (${Math.round(avg)} commits). Aumentar la frecuencia de commits o revisar si hay trabajo sin subir.`));
                // Baja consistencia semanal
                const lowCons = active.filter(ms => {
                  const aw = projActive.filter((a,i) => a && (ms.wc||[])[i] > 0).length;
                  return aw < Math.ceil(nProjW / 2);
                });
                if (lowCons.length) tips.push(tip("yellow","📅","Trabajo concentrado en pocas semanas",
                  `${lowCons.map(ms=>ms.m.name.split(" ")[0]).join(", ")} solo ${lowCons.length>1?"han":"ha"} commiteado en menos de la mitad de semanas activas. Distribuir el trabajo de forma más continua evita cuellos de botella al final del sprint.`));
                // Muy por encima (> 2.5× media) — pueden estar sobrecargados
                const veryHigh = active.filter(ms => ms.commits > avg * 2.5);
                if (veryHigh.length && avg > 0) tips.push(tip("blue","⚠️","Posible sobrecarga",
                  `${veryHigh.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.commits})`).join(", ")} acumula${veryHigh.length>1?"n":""} más del doble de la media. Revisar si el reparto de tareas es equilibrado.`));
                // Gran dispersión
                if (active.length > 1 && active[0].commits > active[active.length-1].commits * 8)
                  tips.push(tip("blue","↔️","Alta dispersión entre miembros",
                    `El máximo (${active[0].commits}) es más de 8× el mínimo activo (${active[active.length-1].commits}). El equipo debería nivelar la carga de trabajo.`));
                // Positivo: todos contribuyen
                if (!zero.length && veryLow.length === 0)
                  tips.push(tip("green","✅","Buena participación general",
                    `Todo el equipo tiene commits y nadie está por debajo del 40% de la media. Buen ritmo de trabajo.`));
                if (!tips.length) return null;
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px" }}>
                    <div style={{ color:"#818cf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>💡 Recomendaciones — Persona</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                      {tips.map(({ sev, icon, title, msg }) => (
                        <div key={title} style={{ background:SB[sev], borderLeft:`3px solid ${SC[sev]}`, borderRadius:6, padding:"8px 12px", display:"flex", gap:9, alignItems:"flex-start" }}>
                          <span style={{ fontSize:12, flexShrink:0, lineHeight:1.5 }}>{icon}</span>
                          <div>
                            <div style={{ color:SC[sev], fontWeight:700, fontSize:9.5, marginBottom:2 }}>{title}</div>
                            <div style={{ color:"var(--tx2)", fontSize:9, lineHeight:1.55 }}>{msg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>)}

            {/* ── COMMITS / EQUIPO ───────────────────────────── */}
            {ghTab === "commits" && ghView === "equipo" && (<>
              {/* Header metric cards */}
              {(() => {
                const sorted = [...teamTotals].sort((a, b) => b.commits - a.commits);
                const top    = sorted[0];
                const bot    = sorted[sorted.length - 1];
                const active = teamTotals.filter(t => t.commits > 0);
                const avg    = active.length > 0 ? Math.round(totalCommits / active.length) : 0;
                const wcLen  = Math.max(...memberStats.map(ms => (ms.wc || []).length), 0);
                const projActive = Array.from({length: wcLen}, (_, i) => memberStats.some(ms => (ms.wc || [])[i] > 0));
                const nProjW = projActive.filter(Boolean).length || 1;
                const byReg  = ["A","B","C","D"].map(team => {
                  const ms = memberStats.filter(r => r.m.team === team);
                  const sum = projActive.reduce((s, a, i) => a ? s + ms.reduce((t, r) => t + ((r.wc || [])[i] || 0), 0) : s, 0);
                  return { team, avg: sum / nProjW };
                }).sort((a, b) => b.avg - a.avg);
                const mostReg  = byReg[0];
                const leastReg = byReg[byReg.length - 1];
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))", gap:8 }}>
                    {[
                      { label:"🥇 Equipo líder",   name:`Equipo ${top?.team}`,      val:`${top?.commits}`,                   color: TC[top?.team] },
                      { label:"🔻 Equipo menor",   name:`Equipo ${bot?.team}`,      val:`${bot?.commits}`,                   color:"#f43f5e" },
                      { label:"📊 Media / equipo", name: null,                       val:`${avg}`,                            color:"var(--tx2)" },
                      { label:"🎯 Más regular",    name:`Equipo ${mostReg?.team}`,  val:`${mostReg?.avg.toFixed(1)} c/sem`,  color:"#22c55e" },
                      { label:"📉 Menos regular",  name:`Equipo ${leastReg?.team}`, val:`${leastReg?.avg.toFixed(1)} c/sem`, color:"#f97316" },
                    ].map(({ label, name, val, color }) => (
                      <div key={label} style={{ background:"var(--bg2)", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>{label}</div>
                        {name && <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:11, marginBottom:2 }}>{name}</div>}
                        <div style={{ color, fontSize:14, fontWeight:800 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Weekly commits by team (stacked) */}
              {Array.isArray(stats?.commitActivity) && stats.commitActivity.length > 0 && memberStats.length > 0 && (() => {
                const MN = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                const W=440, H=96, padL=26, padB=16, padT=8;
                const WEEK_S = 7 * 24 * 3600;
                const actWeeks = stats.commitActivity;
                const teamsArr = ["A","B","C","D"];
                // Extend to last sprint end
                const lastSprintTs = Math.max(...Object.values(SC).map(s => Math.floor(new Date(s.end).getTime() / 1000)));
                const futureTs = [];
                let fw = actWeeks[actWeeks.length - 1].week + WEEK_S;
                while (fw <= lastSprintTs + WEEK_S) { futureTs.push(fw); fw += WEEK_S; }
                // Per-team totals from memberStats.wc
                const allData = [
                  ...actWeeks.map((w, i) => {
                    const vals = { A:0, B:0, C:0, D:0 };
                    memberStats.forEach(({ m, wc }) => {
                      if (!wc || !wc.length) return;
                      const wcIdx = i - (actWeeks.length - wc.length);
                      if (wcIdx >= 0 && wcIdx < wc.length) vals[m.team] += wc[wcIdx] || 0;
                    });
                    return { week: w.week, vals };
                  }),
                  ...futureTs.map(week => ({ week, vals: { A:0, B:0, C:0, D:0 } })),
                ];
                // Trim to first week with data
                const firstIdx = allData.findIndex(w => Object.values(w.vals).some(v => v > 0));
                if (firstIdx < 0) return null;
                const display = allData.slice(firstIdx);
                const maxW  = Math.max(...display.map(w => Object.values(w.vals).reduce((s,v)=>s+v,0)), 1);
                const colW  = (W - padL) / display.length;
                const barW  = Math.max(1.5, colW * 0.7);
                const yOf   = v => H - padB - (v / maxW) * (H - padT - padB);
                // Month labels
                let prevM = -1;
                const lbls = display.map(({ week }) => {
                  const m = new Date(week * 1000).getMonth();
                  if (m !== prevM) { prevM = m; return MN[m]; }
                  return "";
                });
                // Avg of non-zero weeks only
                const nzW = display.filter(w => Object.values(w.vals).some(v => v > 0));
                const avgW = nzW.length > 0 ? nzW.reduce((s,w) => s + Object.values(w.vals).reduce((a,v)=>a+v,0), 0) / nzW.length : 0;
                // Sprint milestones
                const milestones = Object.values(SC).map(s => {
                  const ts = Math.floor(new Date(s.end).getTime() / 1000);
                  let best = 0, bestD = Infinity;
                  display.forEach(({ week }, i) => { const d = Math.abs(week - ts); if (d < bestD) { bestD = d; best = i; } });
                  return { label: s.label.replace("Sprint ","S"), color: s.color, bx: padL + best * colW + colW / 2 };
                });
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"12px 14px 8px" }}>
                    <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📅 Commits por semana — por equipo</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {[maxW, Math.round(maxW/2), 0].map(v => {
                        const y = yOf(v);
                        return (
                          <g key={v}>
                            <line x1={padL - 2} y1={y} x2={padL} y2={y} stroke="var(--bdr2)" strokeWidth={0.5}/>
                            <text x={padL - 4} y={y + 1.5} textAnchor="end" fontSize={4} fill="var(--tx4)">{v}</text>
                          </g>
                        );
                      })}
                      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--bdr2)" strokeWidth={0.5}/>
                      {milestones.map(({ label, color, bx }) => (
                        <g key={label}>
                          <line x1={bx} y1={padT} x2={bx} y2={H - padB} stroke={color} strokeWidth={0.8} strokeDasharray="2,1.5" opacity={0.6}/>
                          <text x={bx + 1} y={padT + 3.5} fontSize={3.5} fill={color} opacity={0.85}>{label}</text>
                        </g>
                      ))}
                      {display.map(({ week, vals }, i) => {
                        const bx = padL + i * colW + (colW - barW) / 2;
                        const d  = new Date(week * 1000);
                        const stacks = teamsArr.reduce((acc, t) => {
                          const v = vals[t] || 0;
                          if (v > 0) {
                            const bh = (v / maxW) * (H - padT - padB);
                            acc.rects.push(<rect key={t} x={bx} y={acc.y - bh} width={barW} height={bh} fill={TC[t]} opacity={0.85}><title>{`Equipo ${t}: ${v}`}</title></rect>);
                            acc.y -= bh;
                          }
                          return acc;
                        }, { rects: [], y: H - padB }).rects;
                        return (
                          <g key={week}>
                            {stacks}
                            {lbls[i] && <text x={bx + barW/2} y={H - 2} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{lbls[i]}</text>}
                          </g>
                        );
                      })}
                      {avgW > 0 && (() => {
                        const ly = yOf(avgW);
                        return (
                          <g>
                            <line x1={padL} y1={ly} x2={W - 2} y2={ly} stroke="var(--tx2)" strokeWidth={0.7} strokeDasharray="3,2" opacity={0.5}/>
                            <text x={W - 3} y={ly - 2} textAnchor="end" fontSize={4} fill="var(--tx2)" opacity={0.7}>ø {Math.round(avgW)}</text>
                          </g>
                        );
                      })()}
                    </svg>
                    <div style={{ display:"flex", gap:12, marginTop:4, flexWrap:"wrap" }}>
                      {Object.entries(TC).map(([t, c]) => (
                        <span key={t} style={{ display:"flex", alignItems:"center", gap:3, fontSize:8.5, color:"var(--tx2)" }}>
                          <span style={{ width:8, height:8, background:c, display:"inline-block", borderRadius:1 }}/>Eq.{t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Team comparison bar */}
              <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px" }}>
                <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>📊 Comparativa — Commits</div>
                {teamTotals.map(({ team, color, commits }) => (
                  <div key={team} style={{ marginBottom:12 }}>
                    <div style={{ marginBottom:4 }}>
                      <span style={{ background:`${color}20`, color, fontWeight:800, fontSize:9, textTransform:"uppercase", letterSpacing:2, padding:"2px 8px", borderRadius:4 }}>Equipo {team}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ color:"var(--tx4)", fontSize:7.5, width:38, flexShrink:0 }}>Commits</span>
                      <div style={{ flex:1, height:5, background:"var(--bdr)", borderRadius:3, overflow:"hidden", position:"relative" }}>
                        <div style={{ height:"100%", width:`${maxTC>0?commits/maxTC*100:0}%`, background:"#818cf8", borderRadius:3, opacity:0.9 }}/>
                        {maxTC > 0 && <div style={{ position:"absolute", top:0, bottom:0, left:`${totalCommits/4/maxTC*100}%`, width:1, background:"var(--tx2)", opacity:0.55 }}/>}
                      </div>
                      <span style={{ color:"#818cf8", fontSize:8.5, fontWeight:700, width:30, textAlign:"right", flexShrink:0 }}>{commits}</span>
                    </div>
                  </div>
                ))}
              </div>
              <MemberCards />
              {/* Recomendaciones equipo */}
              {(() => {
                const SC2 = { red:"#ef4444", yellow:"#f59e0b", green:"#22c55e", blue:"#38bdf8" };
                const SB2 = { red:"#ef444412", yellow:"#f59e0b12", green:"#22c55e12", blue:"#38bdf812" };
                const tip = (sev, icon, title, msg) => ({ sev, icon, title, msg });
                const tips = [];
                const sorted = [...teamTotals].sort((a,b) => b.commits - a.commits);
                const activeTeams = sorted.filter(t => t.commits > 0);
                const avgTeam = activeTeams.length > 0 ? totalCommits / activeTeams.length : 0;
                const wcLen = Math.max(...memberStats.map(ms => (ms.wc||[]).length), 0);
                const projActive = Array.from({length:wcLen}, (_,i) => memberStats.some(ms => (ms.wc||[])[i] > 0));
                const nProjW = projActive.filter(Boolean).length || 1;
                const lastWcIdx = wcLen - 1;
                const zeroTeams = sorted.filter(t => t.commits === 0);
                if (zeroTeams.length) tips.push(tip("red","🚨","Equipos sin commits",
                  `Equipo${zeroTeams.length>1?"s":""} ${zeroTeams.map(t=>t.team).join(", ")} no ${zeroTeams.length>1?"tienen":"tiene"} commits. Revisar asignación de tareas.`));
                const lowTeams = activeTeams.filter(t => t.commits < avgTeam * 0.5);
                if (lowTeams.length) tips.push(tip("yellow","📉","Equipos por debajo de la media",
                  `Equipo${lowTeams.length>1?"s":""} ${lowTeams.map(t=>`${t.team} (${t.commits})`).join(", ")} ${lowTeams.length>1?"están":"está"} por debajo del 50% de la media (${Math.round(avgTeam)}). Revisar si el volumen de tareas es proporcional.`));
                const silentNow = ["A","B","C","D"].filter(team =>
                  memberStats.filter(r => r.m.team === team).every(r => !((r.wc||[])[lastWcIdx] > 0))
                );
                if (silentNow.length) tips.push(tip("yellow","💤","Sin actividad esta semana",
                  `Equipo${silentNow.length>1?"s":""} ${silentNow.join(", ")} no ${silentNow.length>1?"han":"ha"} commiteado en la última semana. Verificar que el trabajo esté siendo subido regularmente.`));
                const teamCons = ["A","B","C","D"].map(team => {
                  const ms = memberStats.filter(r => r.m.team === team);
                  const aw = projActive.filter((a,i) => a && ms.some(r => (r.wc||[])[i] > 0)).length;
                  return { team, aw };
                }).filter(t => t.aw < Math.ceil(nProjW / 2) && activeTeams.some(at => at.team === t.team));
                if (teamCons.length) tips.push(tip("blue","📅","Consistencia semanal mejorable",
                  `Equipo${teamCons.length>1?"s":""} ${teamCons.map(t=>`${t.team} (${t.aw}/${nProjW} sem)`).join(", ")} solo ha${teamCons.length>1?"n":""} tenido actividad en menos de la mitad de semanas. Commit frecuente facilita la integración continua.`));
                if (activeTeams.length > 1) {
                  const ratio = sorted[0].commits / (sorted.find(t=>t.commits>0)?.commits || 1);
                  if (ratio > 2) tips.push(tip("blue","↔️","Desequilibrio entre equipos",
                    `El equipo más activo (${sorted[0].team}: ${sorted[0].commits}) acumula el doble que otros. Revisar si la distribución de historias de usuario es equitativa.`));
                }
                if (!zeroTeams.length && !lowTeams.length)
                  tips.push(tip("green","✅","Todos los equipos contribuyen",
                    `Los 4 equipos tienen commits registrados y ninguno está muy por debajo de la media. Buen equilibrio de trabajo.`));
                if (!tips.length) return null;
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px" }}>
                    <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>💡 Recomendaciones — Equipo</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                      {tips.map(({ sev, icon, title, msg }) => (
                        <div key={title} style={{ background:SB2[sev], borderLeft:`3px solid ${SC2[sev]}`, borderRadius:6, padding:"8px 12px", display:"flex", gap:9, alignItems:"flex-start" }}>
                          <span style={{ fontSize:12, flexShrink:0, lineHeight:1.5 }}>{icon}</span>
                          <div>
                            <div style={{ color:SC2[sev], fontWeight:700, fontSize:9.5, marginBottom:2 }}>{title}</div>
                            <div style={{ color:"var(--tx2)", fontSize:9, lineHeight:1.55 }}>{msg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>)}

            {/* ── PRs / PERSONA ──────────────────────────────── */}
            {ghTab === "prs" && ghView === "persona" && (<>
              {/* Highlight cards */}
              {(() => {
                const topPR   = byPRs[0];
                const topEff  = [...memberStats].filter(ms=>ms.prEfficiency!==null).sort((a,b)=>b.prEfficiency-a.prEfficiency)[0];
                const avgMerged = memberStats.filter(ms=>ms.pr.merged>0).length > 0
                  ? Math.round(totalPRs / memberStats.filter(ms=>ms.pr.merged>0).length) : 0;
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))", gap:8 }}>
                    {[
                      { label:"🥇 Más PRs",         name: topPR?.m.name.split(" ").slice(0,2).join(" "),   val:`${topPR?.pr.merged??0}`,                         color:"#34d399" },
                      { label:"⚡ Merge más rápido", name: byMerge[0]?.m.name.split(" ").slice(0,2).join(" "), val: byMerge[0] ? `${byMerge[0].amt}d`:"—",          color:"#fbbf24" },
                      { label:"📊 Media / persona",  name: null,                                             val:`${avgMerged} PRs`,                               color:"var(--tx2)" },
                      ...(topEff ? [{ label:"🎯 Mayor tasa merge", name: topEff.m.name.split(" ").slice(0,2).join(" "), val:`${topEff.prEfficiency}%`, color:"#22c55e" }] : []),
                      ...(byPRSize[0] ? [{ label:"📦 PRs más grandes", name: byPRSize[0].m.name.split(" ").slice(0,2).join(" "), val:`${byPRSize[0].avgPRSize>999?(byPRSize[0].avgPRSize/1000).toFixed(1)+"k":byPRSize[0].avgPRSize} l/PR`, color:"#f97316" }] : []),
                    ].map(({ label, name, val, color }) => (
                      <div key={label} style={{ background:"var(--bg2)", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>{label}</div>
                        {name && <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:11, marginBottom:2 }}>{name}</div>}
                        <div style={{ color, fontSize:14, fontWeight:800 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Weekly PRs chart */}
              {Array.isArray(stats?.prActivity) && stats.prActivity.length > 0 && (() => {
                const MN = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                const W=440, H=96, padL=26, padB=16, padT=8;
                const WEEK_S = 7 * 24 * 3600;
                const actWeeks = stats.prActivity;
                const lastSprintTs = Math.max(...Object.values(SC).map(s => Math.floor(new Date(s.end).getTime() / 1000)));
                const futureTs = [];
                let fw = actWeeks[actWeeks.length - 1].week + WEEK_S;
                while (fw <= lastSprintTs + WEEK_S) { futureTs.push(fw); fw += WEEK_S; }
                const allData = [
                  ...actWeeks.map(w => ({ week: w.week, total: w.total })),
                  ...futureTs.map(week => ({ week, total: 0 })),
                ];
                const firstIdx = allData.findIndex(w => w.total > 0);
                if (firstIdx < 0) return null;
                const display = allData.slice(firstIdx);
                const maxW  = Math.max(...display.map(w => w.total), 1);
                const colW  = (W - padL) / display.length;
                const barW  = Math.max(1.5, colW * 0.7);
                const yOf   = v => H - padB - (v / maxW) * (H - padT - padB);
                let prevM = -1;
                const lbls = display.map(({ week }) => {
                  const m = new Date(week * 1000).getMonth();
                  if (m !== prevM) { prevM = m; return MN[m]; }
                  return "";
                });
                const nzW = display.filter(w => w.total > 0);
                const avgW = nzW.length > 0 ? nzW.reduce((s,w) => s + w.total, 0) / nzW.length : 0;
                const milestones = Object.values(SC).map(s => {
                  const ts = Math.floor(new Date(s.end).getTime() / 1000);
                  let best = 0, bestD = Infinity;
                  display.forEach(({ week }, i) => { const d = Math.abs(week - ts); if (d < bestD) { bestD = d; best = i; } });
                  return { label: s.label.replace("Sprint ","S"), color: s.color, bx: padL + best * colW + colW / 2 };
                });
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid #34d39920", borderRadius:10, padding:"12px 14px 8px" }}>
                    <div style={{ color:"#34d399", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📅 PRs por semana</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {[maxW, Math.round(maxW/2), 0].map(v => {
                        const y = yOf(v);
                        return (
                          <g key={v}>
                            <line x1={padL - 2} y1={y} x2={padL} y2={y} stroke="var(--bdr2)" strokeWidth={0.5}/>
                            <text x={padL - 4} y={y + 1.5} textAnchor="end" fontSize={4} fill="var(--tx4)">{v}</text>
                          </g>
                        );
                      })}
                      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--bdr2)" strokeWidth={0.5}/>
                      {milestones.map(({ label, color, bx }) => (
                        <g key={label}>
                          <line x1={bx} y1={padT} x2={bx} y2={H - padB} stroke={color} strokeWidth={0.8} strokeDasharray="2,1.5" opacity={0.6}/>
                          <text x={bx + 1} y={padT + 3.5} fontSize={3.5} fill={color} opacity={0.85}>{label}</text>
                        </g>
                      ))}
                      {display.map(({ week, total }, i) => {
                        const bh = (total / maxW) * (H - padT - padB);
                        const bx = padL + i * colW + (colW - barW) / 2;
                        const d  = new Date(week * 1000);
                        return (
                          <g key={week}>
                            {total > 0 && (
                              <rect x={bx} y={H - padB - bh} width={barW} height={bh} rx={1} fill="#34d399" opacity={0.75}>
                                <title>{`${d.toLocaleDateString("es-ES",{day:"2-digit",month:"short"})}: ${total} PRs`}</title>
                              </rect>
                            )}
                            {lbls[i] && <text x={bx + barW/2} y={H - 2} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{lbls[i]}</text>}
                          </g>
                        );
                      })}
                      {avgW > 0 && (() => {
                        const ly = yOf(avgW);
                        return (
                          <g>
                            <line x1={padL} y1={ly} x2={W - 2} y2={ly} stroke="var(--tx2)" strokeWidth={0.7} strokeDasharray="3,2" opacity={0.5}/>
                            <text x={W - 3} y={ly - 2} textAnchor="end" fontSize={4} fill="var(--tx2)" opacity={0.7}>ø {Math.round(avgW)}</text>
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                );
              })()}
              {/* Bar charts */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
                <div style={{ background:"var(--bg2)", border:"1px solid #34d39920", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#34d399", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>🔀 PRs mergeadas</div>
                  <HBar sorted={byPRs} getValue={ms=>ms.pr.merged} getLabel={ms=>`${ms.pr.merged}/${ms.pr.total}`} maxVal={maxPRs} color="#34d399" showMax
                    avgVal={memberStats.filter(ms=>ms.pr.merged>0).length>0 ? totalPRs/memberStats.filter(ms=>ms.pr.merged>0).length : undefined} />
                </div>
                <div style={{ background:"var(--bg2)", border:"1px solid #22c55e20", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#22c55e", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>🎯 Tasa de merge (%)</div>
                  <HBar sorted={[...memberStats].filter(ms=>ms.prEfficiency!==null).sort((a,b)=>b.prEfficiency-a.prEfficiency)}
                    getValue={ms=>ms.prEfficiency??0} getLabel={ms=>`${ms.prEfficiency}%`} maxVal={100} color="#22c55e" showMax />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
                {byMerge.length > 0 && (
                  <div style={{ background:"var(--bg2)", border:"1px solid #fbbf2420", borderRadius:10, padding:"12px 12px 8px" }}>
                    <div style={{ color:"#fbbf24", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>⚡ Días hasta merge (↓ mejor)</div>
                    <HBar sorted={byMerge} getValue={ms=>ms.amt??0} getLabel={ms=>`${ms.amt}d`}
                      maxVal={Math.max(...byMerge.map(ms=>ms.amt),1)} color="#fbbf24" showMax />
                  </div>
                )}
                {byPRSize.length > 0 && (
                  <div style={{ background:"var(--bg2)", border:"1px solid #f9731620", borderRadius:10, padding:"12px 12px 8px" }}>
                    <div style={{ color:"#f97316", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📦 Tamaño medio PR (líneas)</div>
                    <HBar sorted={byPRSize} getValue={ms=>ms.avgPRSize??0}
                      getLabel={ms=>ms.avgPRSize>999?`${(ms.avgPRSize/1000).toFixed(1)}k`:`${ms.avgPRSize}`}
                      maxVal={maxPRSize} color="#f97316" showMax />
                  </div>
                )}
              </div>
              {/* Recommendation tips */}
              {(() => {
                const SCol = { red:"#ef4444", yellow:"#f59e0b", green:"#22c55e", blue:"#38bdf8" };
                const SBg  = { red:"#ef444412", yellow:"#f59e0b12", green:"#22c55e12", blue:"#38bdf812" };
                const tip  = (sev, icon, title, msg) => ({ sev, icon, title, msg });
                const tips = [];
                const withPRs = memberStats.filter(ms => ms.pr.total > 0);
                const noPRs   = memberStats.filter(ms => ms.pr.total === 0);
                const avgPRCount = withPRs.length > 0 ? totalPRs / withPRs.length : 0;
                if (noPRs.length)
                  tips.push(tip("yellow","📋","Sin PRs registradas",
                    `${noPRs.map(ms=>ms.m.name.split(" ")[0]).join(", ")} no ${noPRs.length>1?"tienen":"tiene"} PRs. Verificar que estén contribuyendo vía pull requests.`));
                const lowEff = withPRs.filter(ms => ms.prEfficiency !== null && ms.prEfficiency < 60);
                if (lowEff.length)
                  tips.push(tip("yellow","🔁","Alta tasa de PRs sin mergear",
                    `${lowEff.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.prEfficiency}%)`).join(", ")} ${lowEff.length>1?"tienen":"tiene"} menos del 60% de PRs mergeadas. Revisar si hay PRs abandonadas.`));
                const slowMerge = byMerge.filter(ms => ms.amt > 3);
                if (slowMerge.length)
                  tips.push(tip("blue","⏱️","PRs con merge lento",
                    `${slowMerge.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.amt}d)`).join(", ")} tarda${slowMerge.length>1?"n":""} más de 3 días en mergear. Agilizar el proceso de revisión mejora el flujo.`));
                const bigPRs = byPRSize.filter(ms => ms.avgPRSize > 500);
                if (bigPRs.length)
                  tips.push(tip("blue","📦","PRs muy grandes",
                    `${bigPRs.map(ms=>`${ms.m.name.split(" ")[0]} (~${ms.avgPRSize>999?(ms.avgPRSize/1000).toFixed(1)+"k":ms.avgPRSize} l)`).join(", ")} envía${bigPRs.length>1?"n":""} PRs muy grandes. PRs más pequeñas facilitan la revisión.`));
                if (!noPRs.length && !lowEff.length && !slowMerge.length)
                  tips.push(tip("green","✅","Buen ritmo de PRs",
                    `Todo el equipo tiene PRs y las tasas de merge son aceptables. Buen flujo de integración.`));
                if (!tips.length) return null;
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px" }}>
                    <div style={{ color:"#34d399", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>💡 Recomendaciones — PRs</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                      {tips.map(({ sev, icon, title, msg }) => (
                        <div key={title} style={{ background:SBg[sev], borderLeft:`3px solid ${SCol[sev]}`, borderRadius:6, padding:"8px 12px", display:"flex", gap:9, alignItems:"flex-start" }}>
                          <span style={{ fontSize:12, flexShrink:0, lineHeight:1.5 }}>{icon}</span>
                          <div>
                            <div style={{ color:SCol[sev], fontWeight:700, fontSize:9.5, marginBottom:2 }}>{title}</div>
                            <div style={{ color:"var(--tx2)", fontSize:9, lineHeight:1.55 }}>{msg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>)}

            {/* ── PRs / EQUIPO ───────────────────────────────── */}
            {ghTab === "prs" && ghView === "equipo" && (<>
              {/* Highlight team cards */}
              {(() => {
                const sorted = [...teamTotals].sort((a,b) => b.prs - a.prs);
                const topT   = sorted[0], botT = sorted[sorted.length-1];
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))", gap:8 }}>
                    {[
                      { label:"🥇 Más PRs",   name:`Equipo ${topT?.team}`, val:`${topT?.prs}`,  color: TC[topT?.team] },
                      { label:"🔻 Menos PRs", name:`Equipo ${botT?.team}`, val:`${botT?.prs}`,  color:"#f43f5e" },
                      { label:"📊 Total PRs", name: null,                  val:`${totalPRs}`,   color:"var(--tx2)" },
                    ].map(({ label, name, val, color }) => (
                      <div key={label} style={{ background:"var(--bg2)", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>{label}</div>
                        {name && <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:11, marginBottom:2 }}>{name}</div>}
                        <div style={{ color, fontSize:14, fontWeight:800 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Weekly PRs by team (stacked) */}
              {Array.isArray(stats?.prActivity) && stats.prActivity.length > 0 && stats.weeklyPRs && memberStats.length > 0 && (() => {
                const MN = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                const W=440, H=96, padL=26, padB=16, padT=8;
                const WEEK_S = 7 * 24 * 3600;
                const teamsArr = ["A","B","C","D"];
                // Use last 26 weeks from prActivity
                const actWeeks = stats.prActivity.slice(-26);
                const lastSprintTs = Math.max(...Object.values(SC).map(s => Math.floor(new Date(s.end).getTime() / 1000)));
                const futureTs = [];
                let fw = actWeeks[actWeeks.length - 1].week + WEEK_S;
                while (fw <= lastSprintTs + WEEK_S) { futureTs.push(fw); fw += WEEK_S; }
                // Build per-team stacked data from weeklyPRs
                const allData = [
                  ...actWeeks.map((w, i) => {
                    const vals = { A:0, B:0, C:0, D:0 };
                    memberStats.forEach(({ m, wc: _wc }) => {
                      const ll = m.login.toLowerCase();
                      const wp = stats.weeklyPRs[ll];
                      if (!wp) return;
                      // weeklyPRs has 26 entries; align with actWeeks
                      const wpIdx = i - (actWeeks.length - wp.length);
                      if (wpIdx >= 0 && wpIdx < wp.length) vals[m.team] += wp[wpIdx] || 0;
                    });
                    return { week: w.week, vals };
                  }),
                  ...futureTs.map(week => ({ week, vals: { A:0, B:0, C:0, D:0 } })),
                ];
                const firstIdx = allData.findIndex(w => Object.values(w.vals).some(v => v > 0));
                if (firstIdx < 0) return null;
                const display = allData.slice(firstIdx);
                const maxW  = Math.max(...display.map(w => Object.values(w.vals).reduce((s,v)=>s+v,0)), 1);
                const colW  = (W - padL) / display.length;
                const barW  = Math.max(1.5, colW * 0.7);
                const yOf   = v => H - padB - (v / maxW) * (H - padT - padB);
                let prevM = -1;
                const lbls = display.map(({ week }) => {
                  const m = new Date(week * 1000).getMonth();
                  if (m !== prevM) { prevM = m; return MN[m]; }
                  return "";
                });
                const nzW = display.filter(w => Object.values(w.vals).some(v => v > 0));
                const avgW = nzW.length > 0 ? nzW.reduce((s,w) => s + Object.values(w.vals).reduce((a,v)=>a+v,0), 0) / nzW.length : 0;
                const milestones = Object.values(SC).map(s => {
                  const ts = Math.floor(new Date(s.end).getTime() / 1000);
                  let best = 0, bestD = Infinity;
                  display.forEach(({ week }, i) => { const d = Math.abs(week - ts); if (d < bestD) { bestD = d; best = i; } });
                  return { label: s.label.replace("Sprint ","S"), color: s.color, bx: padL + best * colW + colW / 2 };
                });
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"12px 14px 8px" }}>
                    <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📅 PRs por semana — por equipo</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {[maxW, Math.round(maxW/2), 0].map(v => {
                        const y = yOf(v);
                        return (
                          <g key={v}>
                            <line x1={padL - 2} y1={y} x2={padL} y2={y} stroke="var(--bdr2)" strokeWidth={0.5}/>
                            <text x={padL - 4} y={y + 1.5} textAnchor="end" fontSize={4} fill="var(--tx4)">{v}</text>
                          </g>
                        );
                      })}
                      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="var(--bdr2)" strokeWidth={0.5}/>
                      {milestones.map(({ label, color, bx }) => (
                        <g key={label}>
                          <line x1={bx} y1={padT} x2={bx} y2={H - padB} stroke={color} strokeWidth={0.8} strokeDasharray="2,1.5" opacity={0.6}/>
                          <text x={bx + 1} y={padT + 3.5} fontSize={3.5} fill={color} opacity={0.85}>{label}</text>
                        </g>
                      ))}
                      {display.map(({ week, vals }, i) => {
                        const bx = padL + i * colW + (colW - barW) / 2;
                        const d  = new Date(week * 1000);
                        const stacks = teamsArr.reduce((acc, t) => {
                          const v = vals[t] || 0;
                          if (v > 0) {
                            const bh = (v / maxW) * (H - padT - padB);
                            acc.rects.push(<rect key={t} x={bx} y={acc.y - bh} width={barW} height={bh} fill={TC[t]} opacity={0.85}><title>{`Equipo ${t}: ${v} PRs`}</title></rect>);
                            acc.y -= bh;
                          }
                          return acc;
                        }, { rects: [], y: H - padB }).rects;
                        return (
                          <g key={week}>
                            {stacks}
                            {lbls[i] && <text x={bx + barW/2} y={H - 2} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{lbls[i]}</text>}
                          </g>
                        );
                      })}
                      {avgW > 0 && (() => {
                        const ly = yOf(avgW);
                        return (
                          <g>
                            <line x1={padL} y1={ly} x2={W - 2} y2={ly} stroke="var(--tx2)" strokeWidth={0.7} strokeDasharray="3,2" opacity={0.5}/>
                            <text x={W - 3} y={ly - 2} textAnchor="end" fontSize={4} fill="var(--tx2)" opacity={0.7}>ø {Math.round(avgW)}</text>
                          </g>
                        );
                      })()}
                    </svg>
                    <div style={{ display:"flex", gap:12, marginTop:4, flexWrap:"wrap" }}>
                      {Object.entries(TC).map(([t, c]) => (
                        <span key={t} style={{ display:"flex", alignItems:"center", gap:3, fontSize:8.5, color:"var(--tx2)" }}>
                          <span style={{ width:8, height:8, background:c, display:"inline-block", borderRadius:1 }}/>Eq.{t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px" }}>
                <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>📊 Comparativa — PRs por equipo</div>
                {teamTotals.map(({ team, color, prs, members, active }) => {
                  const teamEff = memberStats.filter(ms=>ms.m.team===team && ms.prEfficiency!==null);
                  const avgEff  = teamEff.length ? Math.round(teamEff.reduce((s,ms)=>s+(ms.prEfficiency??0),0)/teamEff.length) : null;
                  return (
                    <div key={team} style={{ marginBottom:12 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ background:`${color}20`, color, fontWeight:800, fontSize:9, textTransform:"uppercase", letterSpacing:2, padding:"2px 8px", borderRadius:4 }}>Equipo {team}</span>
                        <span style={{ color:"var(--tx4)", fontSize:8.5 }}>{active}/{members} activos{avgEff!==null?` · ${avgEff}% merge rate`:""}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ color:"var(--tx4)", fontSize:7.5, width:38, flexShrink:0 }}>PRs</span>
                        <div style={{ flex:1, height:5, background:"var(--bdr)", borderRadius:3, overflow:"hidden", position:"relative" }}>
                          <div style={{ height:"100%", width:`${maxTPR>0?prs/maxTPR*100:0}%`, background:"#34d399", borderRadius:3, opacity:0.9 }}/>
                          {maxTPR>0 && <div style={{ position:"absolute", top:0, bottom:0, left:`${totalPRs/4/maxTPR*100}%`, width:1, background:"var(--tx2)", opacity:0.5 }}/>}
                        </div>
                        <span style={{ color:"#34d399", fontSize:8.5, fontWeight:700, width:30, textAlign:"right", flexShrink:0 }}>{prs}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <MemberCards />
            </>)}

            {/* ── LÍNEAS / PERSONA ───────────────────────────── */}
            {ghTab === "lineas" && ghView === "persona" && (<>
              {/* Highlight cards */}
              {(() => {
                const topAdd  = byLines[0];
                const topDel  = byDeleted[0];
                const topImp  = [...memberStats].sort((a,b)=>b.codeImpact-a.codeImpact)[0];
                const loChurn = byChurn[0];
                const avgAdded = memberStats.filter(ms=>ms.lns.added>0).length > 0
                  ? Math.round(totalAdded / memberStats.filter(ms=>ms.lns.added>0).length) : 0;
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))", gap:8 }}>
                    {[
                      { label:"🥇 Más añadido",    name: topAdd?.m.name.split(" ").slice(0,2).join(" "),   val:`+${topAdd?.lns.added>999?(topAdd.lns.added/1000).toFixed(1)+"k":topAdd?.lns.added}`,    color:"#38bdf8" },
                      { label:"🗑️ Más borrado",    name: topDel?.m.name.split(" ").slice(0,2).join(" "),   val:`-${topDel?.lns.deleted>999?(topDel.lns.deleted/1000).toFixed(1)+"k":topDel?.lns.deleted}`, color:"#f43f5e" },
                      { label:"📊 Media / persona", name: null,                                              val: avgAdded>999?`${(avgAdded/1000).toFixed(1)}k l`:`${avgAdded} l`,                          color:"var(--tx2)" },
                      { label:"💥 Mayor impacto",   name: topImp?.m.name.split(" ").slice(0,2).join(" "),   val:`${topImp?.codeImpact>999?(topImp.codeImpact/1000).toFixed(1)+"k":topImp?.codeImpact} total`, color:"#a855f7" },
                      ...(loChurn ? [{ label:"⚖️ Menor churn", name: loChurn.m.name.split(" ").slice(0,2).join(" "), val:`${loChurn.codeChurn}% borrado`, color:"#22c55e" }] : []),
                    ].map(({ label, name, val, color }) => (
                      <div key={label} style={{ background:"var(--bg2)", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>{label}</div>
                        {name && <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:11, marginBottom:2 }}>{name}</div>}
                        <div style={{ color, fontSize:14, fontWeight:800 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* codeFreq evolution chart */}
              {Array.isArray(stats?.codeFreq) && stats.codeFreq.length > 0 && (() => {
                const MN   = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                const W=440, H=80, padL=32, padB=16, padT=8;
                const data = stats.codeFreq.filter(([,a,d]) => a > 0 || d < 0);
                if (!data.length) return null;
                const maxV = Math.max(...data.map(([,a,d]) => Math.max(a, Math.abs(d))), 1);
                const colW = (W - padL) / data.length;
                const barW = Math.max(1.2, colW * 0.38);
                const yMid = padT + (H - padT - padB) / 2;
                let prevM = -1;
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid #38bdf820", borderRadius:10, padding:"12px 14px 8px" }}>
                    <div style={{ color:"#38bdf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📈 Evolución semanal — añadidas vs borradas</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      <line x1={padL} y1={yMid} x2={W-2} y2={yMid} stroke="var(--bdr2)" strokeWidth={0.5}/>
                      <text x={padL-3} y={yMid+1.5} textAnchor="end" fontSize={4} fill="var(--bdr2)">0</text>
                      {data.map(([ts, a, d], i) => {
                        const bx  = padL + i * colW + (colW - barW * 2 - 1) / 2;
                        const ah  = (a / maxV) * (yMid - padT);
                        const dh  = (Math.abs(d) / maxV) * (H - padB - yMid);
                        const m   = new Date(ts * 1000).getMonth();
                        const lbl = m !== prevM ? (prevM = m, MN[m]) : "";
                        return (
                          <g key={ts}>
                            {a > 0 && <rect x={bx} y={yMid-ah} width={barW} height={ah} fill="#38bdf8" opacity={0.75}><title>{`+${a.toLocaleString()} líneas`}</title></rect>}
                            {d < 0 && <rect x={bx+barW+1} y={yMid} width={barW} height={dh} fill="#f43f5e" opacity={0.65}><title>{`${d.toLocaleString()} líneas`}</title></rect>}
                            {lbl && <text x={bx+barW} y={H-2} textAnchor="middle" fontSize={4.5} fill="var(--tx4)">{lbl}</text>}
                          </g>
                        );
                      })}
                    </svg>
                    <div style={{ display:"flex", gap:12, marginTop:4 }}>
                      <span style={{ fontSize:8.5, color:"var(--tx4)" }}><span style={{ display:"inline-block", width:8, height:7, background:"#38bdf8", marginRight:3, borderRadius:1 }}/>Añadidas</span>
                      <span style={{ fontSize:8.5, color:"var(--tx4)" }}><span style={{ display:"inline-block", width:8, height:7, background:"#f43f5e", marginRight:3, borderRadius:1 }}/>Borradas</span>
                    </div>
                  </div>
                );
              })()}
              {/* Bar charts */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
                <div style={{ background:"var(--bg2)", border:"1px solid #38bdf820", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#38bdf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📦 Líneas añadidas</div>
                  <HBar sorted={byLines} getValue={ms=>ms.lns.added} getLabel={ms=>ms.lns.added>999?`${(ms.lns.added/1000).toFixed(1)}k`:ms.lns.added}
                    maxVal={maxAdded} color="#38bdf8" showMax
                    avgVal={memberStats.filter(ms=>ms.lns.added>0).length>0?totalAdded/memberStats.filter(ms=>ms.lns.added>0).length:undefined} />
                </div>
                <div style={{ background:"var(--bg2)", border:"1px solid #f43f5e20", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#f43f5e", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>🗑️ Líneas borradas</div>
                  <HBar sorted={byDeleted} getValue={ms=>ms.lns.deleted} getLabel={ms=>ms.lns.deleted>999?`${(ms.lns.deleted/1000).toFixed(1)}k`:ms.lns.deleted}
                    maxVal={maxDeleted} color="#f43f5e" showMax />
                </div>
              </div>
              {byChurn.length > 0 && (
                <div style={{ background:"var(--bg2)", border:"1px solid #a855f720", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#a855f7", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>♻️ Code churn — % líneas borradas (↓ mejor)</div>
                  <div style={{ color:"var(--tx4)", fontSize:8, marginBottom:8 }}>Bajo churn = código estable. Alto churn = mucho refactor o reescritura.</div>
                  <HBar sorted={byChurn} getValue={ms=>ms.codeChurn??0} getLabel={ms=>`${ms.codeChurn}%`} maxVal={100} color="#a855f7" showMax />
                </div>
              )}
              {/* Recommendation tips */}
              {(() => {
                const SCol = { red:"#ef4444", yellow:"#f59e0b", green:"#22c55e", blue:"#38bdf8" };
                const SBg  = { red:"#ef444412", yellow:"#f59e0b12", green:"#22c55e12", blue:"#38bdf812" };
                const tip  = (sev, icon, title, msg) => ({ sev, icon, title, msg });
                const tips = [];
                const withLines = memberStats.filter(ms => ms.lns.added > 0);
                const noLines   = memberStats.filter(ms => ms.lns.added === 0);
                const avgAdded2 = withLines.length > 0 ? totalAdded / withLines.length : 0;
                if (noLines.length)
                  tips.push(tip("yellow","📭","Sin líneas de código registradas",
                    `${noLines.map(ms=>ms.m.name.split(" ")[0]).join(", ")} no ${noLines.length>1?"tienen":"tiene"} líneas añadidas. Verificar que sus commits estén en el repositorio correcto.`));
                const highChurn = byChurn.slice().reverse().filter(ms => (ms.codeChurn??0) > 60);
                if (highChurn.length)
                  tips.push(tip("blue","♻️","Alto code churn",
                    `${highChurn.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.codeChurn}%)`).join(", ")} tiene${highChurn.length>1?"n":""} más del 60% de sus líneas borradas. Puede indicar refactorización intensa.`));
                const veryLow = withLines.filter(ms => ms.lns.added < avgAdded2 * 0.3);
                if (veryLow.length && avgAdded2 > 0)
                  tips.push(tip("yellow","📉","Pocas líneas aportadas",
                    `${veryLow.map(ms=>`${ms.m.name.split(" ")[0]} (${ms.lns.added.toLocaleString()})`).join(", ")} está${veryLow.length>1?"n":""} por debajo del 30% de la media (${Math.round(avgAdded2).toLocaleString()}).`));
                if (!noLines.length && !highChurn.length && !veryLow.length)
                  tips.push(tip("green","✅","Buena distribución de código",
                    `Todo el equipo tiene líneas de código y no hay casos de churn extremo. El código parece estable.`));
                if (!tips.length) return null;
                return (
                  <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px" }}>
                    <div style={{ color:"#38bdf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>💡 Recomendaciones — Líneas</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                      {tips.map(({ sev, icon, title, msg }) => (
                        <div key={title} style={{ background:SBg[sev], borderLeft:`3px solid ${SCol[sev]}`, borderRadius:6, padding:"8px 12px", display:"flex", gap:9, alignItems:"flex-start" }}>
                          <span style={{ fontSize:12, flexShrink:0, lineHeight:1.5 }}>{icon}</span>
                          <div>
                            <div style={{ color:SCol[sev], fontWeight:700, fontSize:9.5, marginBottom:2 }}>{title}</div>
                            <div style={{ color:"var(--tx2)", fontSize:9, lineHeight:1.55 }}>{msg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>)}

            {/* ── LÍNEAS / EQUIPO ────────────────────────────── */}
            {ghTab === "lineas" && ghView === "equipo" && (<>
              {/* Highlight team cards */}
              {(() => {
                const sorted = [...teamTotals].sort((a,b) => b.added - a.added);
                return (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))", gap:8 }}>
                    {sorted.map(({ team, color, added }) => (
                      <div key={team} style={{ background:"var(--bg2)", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>Equipo {team}</div>
                        <div style={{ color, fontSize:14, fontWeight:800 }}>+{added>999?`${(added/1000).toFixed(1)}k`:added}</div>
                        <div style={{ color:"var(--tx4)", fontSize:8, marginTop:2 }}>líneas añadidas</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px" }}>
                <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>📊 Comparativa — Líneas por equipo</div>
                {(() => {
                  const maxDel = Math.max(...teamTotals.map(({ team }) =>
                    memberStats.filter(ms=>ms.m.team===team).reduce((s,ms)=>s+ms.lns.deleted,0)), 1);
                  return teamTotals.map(({ team, color, added, members, active }) => {
                    const deleted = memberStats.filter(ms=>ms.m.team===team).reduce((s,ms)=>s+ms.lns.deleted,0);
                    const net     = added - deleted;
                    return (
                      <div key={team} style={{ marginBottom:14 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ background:`${color}20`, color, fontWeight:800, fontSize:9, textTransform:"uppercase", letterSpacing:2, padding:"2px 8px", borderRadius:4 }}>Equipo {team}</span>
                          <span style={{ color:"var(--tx4)", fontSize:8.5 }}>{active}/{members} activos · net {net>0?"+":""}{net>999?`${(net/1000).toFixed(1)}k`:net}</span>
                        </div>
                        {[
                          { label:"+Líneas", val:added,   max:maxTA,  col:"#38bdf8" },
                          { label:"-Líneas", val:deleted, max:maxDel, col:"#f43f5e" },
                        ].map(({ label, val, max, col }) => (
                          <div key={label} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                            <span style={{ color:"var(--tx4)", fontSize:7.5, width:38, flexShrink:0 }}>{label}</span>
                            <div style={{ flex:1, height:5, background:"var(--bdr)", borderRadius:3, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${max>0?val/max*100:0}%`, background:col, borderRadius:3, opacity:0.9 }}/>
                            </div>
                            <span style={{ color:col, fontSize:8.5, fontWeight:700, width:36, textAlign:"right", flexShrink:0 }}>{val>999?`${(val/1000).toFixed(1)}k`:val}</span>
                          </div>
                        ))}
                      </div>
                    );
                  });
                })()}
              </div>
              <MemberCards />
            </>)}

          </div>
        </div>

      </>)}
    </div>
  );
}


// ── APP ───────────────────────────────────────────────────────


// ── INFORME PANE (CSV Clockify) ───────────────────────────────
const SIZE_H_INF = { XS:2, S:4, M:8, L:16, XL:24 };

// ── TEAM MEMBERS ──────────────────────────────────────────────
// email (Clockify) ↔ GitHub login, display name, role, team
const TEAM_MEMBERS = [
  { login:"mjnizac",          email:"mannizcob@alum.us.es",       name:"Manuel J. Niza Cobo",        role:"SM",  team:"B",  coord:true },
  { login:"mregidorgarcia",   email:"mregidorgarcia@gmail.com",   name:"Miguel Regidor García",      role:"PO",  team:"B",  coord:true },
  { login:"alereyper",        email:"alereyper@alum.us.es",       name:"Alejandro de los Reyes",     role:"Dev", team:"A",  coord:true },
  { login:"CarlosGallero",    email:"gallerolajara@gmail.com",     name:"Álvaro Carlos Gallero",      role:"Dev", team:"D",  coord:true },
  { login:"Igna0305",         email:"ignamartinezdiaz@gmail.com", name:"Ignacio Martínez Díaz",      role:"Dev", team:"B",  coord:true },
  { login:"MartaRecio",       email:"marrecgil@alum.us.es",       name:"Marta Recio Gil",            role:"Dev", team:"C",  coord:true },
  { login:"Javiergutpas",     email:"javgutpas@alum.us.es",       name:"Javier Gutiérrez Pastor",    role:"Dev", team:"A"             },
  { login:"Nuno1610",         email:"nundelesc@alum.us.es",       name:"Nuno del Pino Escalante",    role:"Dev", team:"A"             },
  { login:"javsorbla",        email:"javsorbla@alum.us.es",       name:"Javier Soria Blanco",        role:"Dev", team:"A"             },
  { login:"javcasrod1",       email:"javcasrod1@alum.us.es",      name:"Javier Castilla Rodríguez",  role:"Dev", team:"A"             },
  { login:"nicogomezclaraco", email:"nicogomezclaraco@gmail.com", name:"Nicolás Gómez Claraco",      role:"Dev", team:"B"             },
  { login:"JuanCardesa",      email:"juancardesasosa@gmail.com",  name:"Juan José Cardesa Sosa",     role:"Dev", team:"B"             },
  { login:"pausualin",        email:"pausualin@alum.us.es",       name:"Paula María Suárez Linares", role:"Dev", team:"C"             },
  { login:"celiasuaco",       email:"celsuacor@alum.us.es",       name:"Celia Suárez Córcoles",      role:"Dev", team:"C"             },
  { login:"cmurillog06",      email:"carmurgom@alum.us.es",       name:"Carmen Murillo Gómez",       role:"Dev", team:"C"             },
  { login:"olgacangom",       email:"olgcangom@alum.us.es",       name:"Olga Cano Gómez",            role:"Dev", team:"C"             },
  { login:"pabpergas",        email:"pabpergas@alum.us.es",       name:"Pablo Pérez Gaspar",         role:"Dev", team:"D"             },
  { login:"Albgarsan",        email:"albgarsan@alum.us.es",       name:"Alberto García San.",        role:"Dev", team:"D"             },
  { login:"angelmateos1",     email:"angmatmar@alum.us.es",       name:"Ángel Mateos Martínez",      role:"Dev", team:"D"             },
  { login:"pakillodecm",      email:"frademann@alum.us.es",       name:"frademann",                  role:"Dev", team:"D"             },
  { login:"JesusGarPer",      email:"jesgarper@alum.us.es",       name:"Jesús García Pérez",         role:"Dev", team:"D"             },
];

// equipo field value → GitHub logins (lowercase), for team-based hour distribution
const EQUIPO_LOGINS = {
  "Equipo A":           TEAM_MEMBERS.filter(m => m.team === "A").map(m => m.login.toLowerCase()),
  "Equipo B":           TEAM_MEMBERS.filter(m => m.team === "B").map(m => m.login.toLowerCase()),
  "Equipo C":           TEAM_MEMBERS.filter(m => m.team === "C").map(m => m.login.toLowerCase()),
  "Equipo D":           TEAM_MEMBERS.filter(m => m.team === "D").map(m => m.login.toLowerCase()),
  "Equipo Presentación":["javiergutpas","nicogomezclaraco","mregidorgarcia","juancardesa","alereyper"],
  "Coordinadores":      ["carlosgallero","alereyper","mregidorgarcia","martarecio","igna0305","mjnizac"],
  "All":                TEAM_MEMBERS.map(m => m.login.toLowerCase()),
};

const BACKLOG_MAP = (() => {
  const map = {};
  BACKLOG.forEach(it => {
    const baseH = SIZE_H_INF[it.size] || 0;
    let estimated_h = baseH;
    if (it.area === "Asistencia" && baseH > 0) {
      let memberCount = 1;
      if (it.assignees && it.assignees.length > 0) {
        memberCount = it.assignees.length;
      } else if (it.equipo && EQUIPO_LOGINS[it.equipo]) {
        memberCount = EQUIPO_LOGINS[it.equipo].length;
      }
      estimated_h = baseH * memberCount;
    }
    map[it.id] = { ...it, estimated_h };
  });
  return map;
})();

// Compute assigned hours per login for a given sprint
function computeSprintAssigned(sprintNum) {
  const m = {};
  BACKLOG.filter(i => i.sprint === sprintNum).forEach(item => {
    const h = SIZE_H_INF[item.size] || 0;
    if (!h) return;
    const assignees = item.assignees || [];
    if (assignees.length > 0) {
      assignees.forEach(a => {
        const k = a.login.toLowerCase();
        m[k] = (m[k] || 0) + h;
      });
    } else if (item.equipo && EQUIPO_LOGINS[item.equipo]) {
      const members = EQUIPO_LOGINS[item.equipo];
      const hEach = +(h / members.length).toFixed(4);
      members.forEach(login => { m[login] = (m[login] || 0) + hEach; });
    }
  });
  return m;
}

// Assigned hours per login, keyed by sprint number
const ASSIGNED_PER_SPRINT = {
  1: computeSprintAssigned(1),
  2: computeSprintAssigned(2),
  3: computeSprintAssigned(3),
};

function parseClockifyCSV(text) {
  // Clockify detailed CSV headers (may vary by language):
  // Project,Client,Description,Task,User,Group,Email,Tags,Billable,
  // Start Date,Start Time,End Date,End Time,Duration (h),Duration (decimal),...
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rawHeaders = lines[0].split(",").map(h => h.replace(/^"|"$/g,"").trim().toLowerCase());

  const col = (names) => {
    for (const n of names) {
      const i = rawHeaders.findIndex(h => h.includes(n));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iUser     = col(["user", "usuario"]);
  const iEmail    = col(["email"]);
  const iProject  = col(["project", "proyecto"]);
  const iTags     = col(["tags", "etiquetas", "tag"]);
  const iDurH     = col(["duration (h)", "duración (h)", "duracion (h)"]);
  const iDurDec   = col(["duration (decimal)", "decimal"]);
  const iStart    = col(["start date", "fecha inicio"]);
  const iDesc     = col(["description", "descripción"]);

  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    // parse CSV line respecting quoted fields
    const row = [];
    let cur = "", inQ = false;
    for (const ch of lines[i] + ",") {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { row.push(cur.trim()); cur = ""; }
      else cur += ch;
    }

    const user    = iUser    >= 0 ? row[iUser]    || "" : "";
    const email   = iEmail   >= 0 ? (row[iEmail]  || "").toLowerCase().trim() : "";
    const project = iProject >= 0 ? (row[iProject]|| "").toLowerCase().trim() : "";
    const tags    = iTags    >= 0 ? row[iTags]    || "" : "";
    const durH    = iDurH    >= 0 ? row[iDurH]    || "0:00:00" : "0:00:00";
    const durDec  = iDurDec  >= 0 ? parseFloat(row[iDurDec]) || 0 : 0;
    const date    = iStart   >= 0 ? (row[iStart]  || "").slice(0, 10) : "";
    const desc    = iDesc    >= 0 ? row[iDesc]    || "" : "";

    // parse duration h:mm:ss
    let hours = durDec;
    if (!hours) {
      const parts = durH.split(":").map(Number);
      hours = (parts[0]||0) + (parts[1]||0)/60 + (parts[2]||0)/3600;
    }
    if (!hours) continue;

    // find task ID in tags or description (NX-S1.1, NX-S1.01, NX-S2.3, etc.)
    const combined = tags + " " + desc;
    const match = combined.match(/NX-S([1-3])\.(\d{1,3})/i);
    // Normalise to 2-digit task number to match BACKLOG_MAP keys (NX-S1.01, NX-S1.10…)
    const taskId = match
      ? `NX-S${match[1]}.${match[2].padStart(2, '0')}`
      : null;

    entries.push({ user, email, project, taskId, hours, date });
  }
  return entries;
}

function normDate(d) {
  // Normalize DD/MM/YYYY → YYYY-MM-DD so sort() works correctly
  if (d && /^\d{2}\/\d{2}\/\d{4}$/.test(d))
    return `${d.slice(6)}-${d.slice(3,5)}-${d.slice(0,2)}`;
  return d;
}

function buildReport(entries) {
  const byTask = {};
  Object.entries(BACKLOG_MAP).forEach(([tid, t]) => {
    byTask[tid] = { ...t, real_h: 0, byUser: {} };
  });
  const byUser  = {};
  const byEmail = {}; // keyed by lowercase email → { name, total_h, dp_h, s1_h }
  const rawEntriesByUser = {}; // keyed by user name → [{taskId, hours, date, project}]
  const dailyHours = {};
  const dailyHoursBySprint = { 1:{}, 2:{}, 3:{} };
  const dailyHoursByProject = {};

  entries.forEach(({ user, email, project, taskId, hours, date }) => {
    const nd = normDate(date);
    // Track daily hours by project (s1/s2/s3/dp) — includes untagged entries
    if (nd && project) {
      dailyHoursByProject[project] = dailyHoursByProject[project] || {};
      dailyHoursByProject[project][nd] = (dailyHoursByProject[project][nd] || 0) + hours;
    }
    if (taskId && byTask[taskId]) {
      byTask[taskId].real_h += hours;
      byTask[taskId].byUser[user] = (byTask[taskId].byUser[user] || 0) + hours;
      const sn = byTask[taskId].sprint;
      if (sn && nd) dailyHoursBySprint[sn][nd] = (dailyHoursBySprint[sn][nd] || 0) + hours;
    }
    if (user) {
      byUser[user] = byUser[user] || { total_h: 0, byTask: {} };
      byUser[user].total_h += hours;
      if (taskId) byUser[user].byTask[taskId] = (byUser[user].byTask[taskId] || 0) + hours;
      rawEntriesByUser[user] = rawEntriesByUser[user] || [];
      rawEntriesByUser[user].push({ taskId, hours, date: nd || date, project });
    }
    if (email) {
      byEmail[email] = byEmail[email] || { name: user, total_h: 0, tagged_h: 0, dp_h: 0, s1_h: 0, s1_tagged_h: 0, s2_h: 0, s2_tagged_h: 0, s3_h: 0, s3_tagged_h: 0 };
      byEmail[email].total_h += hours;
      if (taskId) byEmail[email].tagged_h += hours;
      if (project === "dp") byEmail[email].dp_h += hours;
      if (project === "s1") { byEmail[email].s1_h += hours; if (taskId) byEmail[email].s1_tagged_h += hours; }
      if (project === "s2") { byEmail[email].s2_h += hours; if (taskId) byEmail[email].s2_tagged_h += hours; }
      if (project === "s3") { byEmail[email].s3_h += hours; if (taskId) byEmail[email].s3_tagged_h += hours; }
    }
    if (nd) dailyHours[nd] = (dailyHours[nd] || 0) + hours;
  });

  return { byTask, byUser, byEmail, rawEntriesByUser, dailyHours, dailyHoursBySprint, dailyHoursByProject };
}

// Pre-load Clockify data bundled at build time (data/clockify-entries.json)
const DEFAULT_CLOCKIFY = (() => {
  if (!clockifyRaw || !clockifyRaw.entries || !clockifyRaw.entries.length) return null;
  const entries = clockifyRaw.entries.map(e => ({
    user: e.u, email: e.e, project: e.p,
    taskId: e.t || null, hours: e.h, date: e.d,
  }));
  const rpt = buildReport(entries);
  rpt.totalEntries   = entries.length;
  rpt.matchedEntries = entries.filter(e => e.taskId).length;
  rpt.fetchedAt      = clockifyRaw.fetchedAt;
  rpt.sourceFile     = clockifyRaw.sourceFile;
  return rpt;
})();

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
                background: docType===d.id ? "#6ee7b720" : "transparent",
                border:     docType===d.id ? "1px solid #6ee7b745" : "1px solid var(--bdr)",
                color:      docType===d.id ? "#6ee7b7" : "var(--tx3)" }}>
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

const _CLOCK_KEY = "nexus_clockify_v1";
function _saveClockify(rpt, fileName) {
  try { localStorage.setItem(_CLOCK_KEY, JSON.stringify({ r: rpt, f: fileName, t: Date.now() })); } catch(_) {}
}
function _loadClockify() {
  try {
    const raw = localStorage.getItem(_CLOCK_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return (s?.r) ? s : null;
  } catch(_) { return null; }
}

function InformePane() {
  // Lazy-init: localStorage > DEFAULT_CLOCKIFY > vacío (runs once per mount)
  const [[initReport, initFileName, initStatus]] = useState(() => {
    const s = _loadClockify();
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
        _saveClockify(rpt, file.name);
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
          <InfStatCard label="Entradas CSV"    value={report.totalEntries}  sub={`${report.matchedEntries} con tarea identificada`} color="#6ee7b7" />
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
        <InfStatCard label="Entradas CSV"    value={report.totalEntries}             sub={`${report.matchedEntries} con tarea identificada`} color="#6ee7b7" />
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
          Consulta la pestaña <span style={{ color:"#6ee7b7", fontWeight:700 }}>Equipo</span> para ver el desglose de horas por persona.
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
    const sprintColor = sprint > 0 ? SC[sprint].color : "#6ee7b7";
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
    const tc = TC_P[member.team] || "#6ee7b7";
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
                        <td style={{ padding:"5px 8px", textAlign:"center", color:hReal>0?"#6ee7b7":"var(--bdr2)", fontWeight:hReal>0?700:400 }}>
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
                    <td colSpan={2} style={{ padding:"5px 8px", textAlign:"center", color:"#6ee7b7", fontWeight:800 }}>{totalH.toFixed(1)}h real</td>
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
      <div style={{ background:"var(--bg2)", border:"1px solid #6ee7b730", borderRadius:12, padding:"14px 20px" }}>
        <div style={{ color:"#6ee7b7", fontWeight:700, fontSize:14, marginBottom:2 }}>📊 Informe CSV — Clockify × Backlog</div>
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
              <span style={{ color:"#6ee7b7", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>→</span>
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
          border:`2px dashed ${drag?"#6ee7b7":"var(--bdr)"}`,
          borderRadius:12, padding:"36px 20px",
          textAlign:"center", cursor:"pointer",
          background: drag?"#6ee7b708":"var(--bg2)",
          transition:"all .15s"
        }}
        onClick={()=>document.getElementById("csv-input").click()}
      >
        <input id="csv-input" type="file" accept=".csv" style={{ display:"none" }} onChange={e=>processFile(e.target.files[0])} />
        <div style={{ fontSize:32, marginBottom:10 }}>{status==="ok"?"✅":"📂"}</div>
        {status==="ok"
          ? <div style={{ color:"#6ee7b7", fontWeight:700, fontSize:13 }}>{fileName}</div>
          : <div style={{ color:"var(--tx4)", fontSize:13, fontWeight:600 }}>Arrastra el CSV de Clockify aquí o haz clic para seleccionarlo</div>
        }
        {status==="ok"
          ? <div style={{ color:"var(--tx4)", fontSize:11, marginTop:4 }}>{report.totalEntries} entradas · {report.matchedEntries} con tarea · haz clic para <strong style={{color:"#6ee7b7"}}>actualizar con un nuevo CSV</strong></div>
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
              const c = v===0?"#6ee7b7":v===-1?"#6366f1":sprintC[v];
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
              return <button key={vt.id} onClick={()=>setView(vt.id)} style={{ padding:"5px 14px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", border:active?"1px solid #6ee7b745":"1px solid transparent", background:active?"#6ee7b720":"transparent", color:active?"#6ee7b7":"var(--tx3)", transition:"all .12s" }}>{vt.label}</button>;
            })}
            {selectedPerson && (() => {
              const pm = TEAM_MEMBERS.find(m => m.login === selectedPerson);
              const active = view === "persona";
              const tc = { A:"#3b82f6", B:"#22c55e", C:"#f59e0b", D:"#a855f7" }[pm?.team] || "#6ee7b7";
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


// ── COSTES PANE ───────────────────────────────────────────────
const SIZE_H_MAP = { XS:2, S:4, M:8, L:16, XL:24 };
const SPRINT_HOURS = (() => {
  const h = {1:0,2:0,3:0};
  BACKLOG.forEach(it => { h[it.sprint] = (h[it.sprint]||0) + (SIZE_H_MAP[it.size]||0); });
  return h;
})();

// Tarifas PPT — Pliego de Prescripciones Técnicas (Junta de Andalucía)
const HBS_RATE          = 25.50;    // Hora Básica de Servicio (€/h)
const GG_PCT            = 0.13;     // Gastos Generales (13 %)
const BI_PCT            = 0.06;     // Beneficio Industrial (6 %)
const IVA_PCT           = 0.21;     // IVA (21 %)
const PRESUPUESTO_TOTAL = 150_000;  // Presupuesto total adjudicado (IVA inc.)

// Perfiles profesionales según PPT — mapeados a nuestro equipo
const PPT_PERFILES = [
  { perfil:"Jefe de Proyecto", rolLabel:"Product Owner",  mult:2.20, precioH:56.10, color:"#fbbf24",
    count: TEAM_MEMBERS.filter(m => m.role === "PO").length },
  { perfil:"Consultor",        rolLabel:"Scrum Master",   mult:1.70, precioH:43.35, color:"#34d399",
    count: TEAM_MEMBERS.filter(m => m.role === "SM").length },
  { perfil:"Coordinador",      rolLabel:"Coordinador",    mult:1.42, precioH:36.21, color:"#818cf8",
    count: TEAM_MEMBERS.filter(m => m.role === "Dev" && m.coord).length },
  { perfil:"Programador",      rolLabel:"Desarrollador",  mult:1.12, precioH:28.56, color:"#a78bfa",
    count: TEAM_MEMBERS.filter(m => m.role === "Dev" && !m.coord).length },
];

// PEM: distribuir horas equitativamente entre los 21 miembros por perfil
function calcPEM(totalH) {
  const hPP = totalH / 21;
  return PPT_PERFILES.reduce((s, p) => s + p.count * hPP * p.precioH, 0);
}
// Presupuesto completo: PEM → GG → BI → Base Imponible → IVA → Total
function calcBudget(pem) {
  const gg   = pem * GG_PCT;
  const bi   = pem * BI_PCT;
  const base = pem + gg + bi;
  const iva  = base * IVA_PCT;
  return { pem, gg, bi, base, iva, total: base + iva };
}

const S0_HOURS        = 757; // horas reales Clockify (DP phase)
const S1_REAL_HOURS   = DEFAULT_CLOCKIFY
  ? +Object.values(DEFAULT_CLOCKIFY.byEmail || {}).reduce((s, e) => s + (e.s1_h || 0), 0).toFixed(1)
  : 0;
const TOTAL_PROJECT_HOURS = S0_HOURS + SPRINT_HOURS[1] + SPRINT_HOURS[2] + SPRINT_HOURS[3];

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background:"var(--bg2)", border:`1px solid ${color}30`, borderRadius:12, padding:"18px 22px", flex:"1 1 180px" }}>
      <div style={{ color:"var(--tx4)", fontSize:11, fontWeight:600, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
      <div style={{ color, fontSize:28, fontWeight:800, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ color:"var(--tx3)", fontSize:11, marginTop:5 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ pct, color, label, spent, total }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ color:"var(--tx0)", fontSize:12, fontWeight:600 }}>{label}</span>
        <span style={{ color:"var(--tx3)", fontSize:11 }}>{spent}h / {total}h ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ height:8, background:"var(--bdr)", borderRadius:4, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:color, borderRadius:4, transition:"width .4s" }} />
      </div>
    </div>
  );
}

function CostesPane() {
  const eur = (n) => n.toLocaleString("es-ES", { minimumFractionDigits:2, maximumFractionDigits:2 });

  // Presupuestos por fase
  const s0bud  = calcBudget(calcPEM(S0_HOURS));
  const s1bud  = calcBudget(calcPEM(SPRINT_HOURS[1]));  // estimado backlog
  const s1real = S1_REAL_HOURS > 0 ? calcBudget(calcPEM(S1_REAL_HOURS)) : null; // real Clockify
  const s2bud  = calcBudget(calcPEM(SPRINT_HOURS[2]));
  const s3bud  = calcBudget(calcPEM(SPRINT_HOURS[3]));
  const totbud = calcBudget(calcPEM(TOTAL_PROJECT_HOURS));

  // Gasto acumulado real: S0 + S1 real
  const gastadoAcum = s0bud.total + (s1real ? s1real.total : 0);
  const remanente   = PRESUPUESTO_TOTAL - gastadoAcum;
  const ejecucion   = (gastadoAcum / PRESUPUESTO_TOTAL) * 100;

  // Fila de desglose presupuestario
  function BudgetRow({ label, value, color, bold, border }) {
    return (
      <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0",
        borderTop: border ? "1px solid var(--bdr2)" : "none" }}>
        <span style={{ color: color || "var(--tx3)", fontSize:12, fontWeight: bold ? 700 : 400 }}>{label}</span>
        <span style={{ color: color || "var(--tx0)", fontSize:12, fontWeight: bold ? 700 : 600, fontVariantNumeric:"tabular-nums" }}>
          {value}
        </span>
      </div>
    );
  }

  // Tarjeta de fase con desglose
  function PhaseCard({ label, color, hours, bud, realH, realBud, isEstim }) {
    return (
      <div style={{ background:`${color}08`, border:`1px solid ${color}30`, borderRadius:10, padding:"14px 18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ color, fontWeight:700, fontSize:13 }}>{label}</span>
          <span style={{ background:`${color}20`, color, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:4 }}>
            {isEstim ? "Estimado backlog" : "Real Clockify"}
          </span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10, fontSize:11 }}>
          <div>
            <div style={{ color:"var(--tx4)", fontSize:10 }}>HORAS</div>
            <div style={{ color:"var(--tx0)", fontWeight:800, fontSize:16 }}>{hours}h</div>
            <div style={{ color:"var(--tx3)" }}>{(hours/21).toFixed(1)}h/persona</div>
          </div>
          <div>
            <div style={{ color:"var(--tx4)", fontSize:10 }}>TOTAL (IVA inc.)</div>
            <div style={{ color, fontWeight:800, fontSize:16 }}>{eur(bud.total)} €</div>
            <div style={{ color:"var(--tx3)" }}>PEM: {eur(bud.pem)} €</div>
          </div>
        </div>
        <div style={{ background:"var(--bg0)", borderRadius:7, padding:"8px 12px", fontSize:11 }}>
          <BudgetRow label="PEM (mano de obra)"          value={`${eur(bud.pem)} €`}   />
          <BudgetRow label={`Gastos Generales (${(GG_PCT*100).toFixed(0)}%)`}  value={`${eur(bud.gg)} €`}    />
          <BudgetRow label={`Beneficio Industrial (${(BI_PCT*100).toFixed(0)}%)`} value={`${eur(bud.bi)} €`} />
          <BudgetRow label="Base Imponible"               value={`${eur(bud.base)} €`} border />
          <BudgetRow label={`IVA (${(IVA_PCT*100).toFixed(0)}%)`} value={`${eur(bud.iva)} €`} />
          <BudgetRow label="TOTAL FASE"                   value={`${eur(bud.total)} €`} color={color} bold border />
        </div>
        {realBud && (
          <div style={{ marginTop:8, background:"#34d39910", border:"1px solid #34d39930", borderRadius:7, padding:"8px 12px", fontSize:11 }}>
            <div style={{ color:"#34d399", fontWeight:700, marginBottom:4 }}>Real Clockify: {realH}h registradas</div>
            <BudgetRow label="PEM real" value={`${eur(realBud.pem)} €`} color="#34d399" />
            <BudgetRow label="TOTAL REAL (IVA inc.)" value={`${eur(realBud.total)} €`} color="#34d399" bold border />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

      {/* Header */}
      <div style={{ background:"var(--bg2)", border:"1px solid #f9731630", borderRadius:12, padding:"14px 20px" }}>
        <div style={{ color:"#f97316", fontWeight:700, fontSize:14, marginBottom:2 }}>💰 Seguimiento económico — PPT Junta de Andalucía</div>
        <div style={{ color:"var(--tx3)", fontSize:11 }}>
          HBS {eur(HBS_RATE)}€/h · GG {(GG_PCT*100).toFixed(0)}% · BI {(BI_PCT*100).toFixed(0)}% · IVA {(IVA_PCT*100).toFixed(0)}% · Presupuesto adjudicado 150.000,00 €
        </div>
      </div>

      {/* KPI Globales */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <StatCard label="Presupuesto adjudicado"  value="150.000 €"              sub="IVA incluido"                                         color="#f97316" />
        <StatCard label="Gasto acumulado (S0+S1)" value={`${eur(gastadoAcum)} €`} sub={`${ejecucion.toFixed(2)}% ejecutado`}               color="#f43f5e" />
        <StatCard label="Remanente"               value={`${eur(remanente)} €`}  sub={`${(100-ejecucion).toFixed(2)}% disponible`}          color="#34d399" />
        <StatCard label="PEM total estimado"      value={`${eur(totbud.pem)} €`} sub={`${TOTAL_PROJECT_HOURS}h · ${eur(totbud.total)}€ c/IVA`} color="#818cf8" />
      </div>

      {/* Tabla de tarifas PPT */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"18px 22px" }}>
        <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:13, marginBottom:14 }}>
          📋 Desglose de Costes de Personal (HBS — Hora Básica de Servicio)
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid var(--bdr)" }}>
                {["Perfil Profesional (PPT)","Rol Asignado","Multiplicador","Precio/Hora","Personas","Horas S1 (20h/p)","Total Sprint 1"].map(h => (
                  <th key={h} style={{ padding:"7px 12px", color:"var(--tx3)", fontWeight:600, textAlign: h.startsWith("Total") || h.startsWith("Horas") || h === "Personas" || h === "Multiplicador" || h === "Precio/Hora" ? "right" : "left", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PPT_PERFILES.map(p => {
                const hS1   = 20; // horas por persona por sprint (según informe PPT)
                const total = p.count * hS1 * p.precioH;
                return (
                  <tr key={p.perfil} style={{ borderBottom:"1px solid #1c1c1e" }}>
                    <td style={{ padding:"8px 12px" }}><span style={{ color:p.color, fontWeight:700 }}>{p.perfil}</span></td>
                    <td style={{ padding:"8px 12px", color:"#a1a1aa" }}>{p.rolLabel}</td>
                    <td style={{ padding:"8px 12px", color:"var(--tx0)", fontWeight:600, textAlign:"right" }}>×{p.mult.toFixed(2)}</td>
                    <td style={{ padding:"8px 12px", color:p.color, fontWeight:700, textAlign:"right" }}>{eur(p.precioH)} €</td>
                    <td style={{ padding:"8px 12px", color:"var(--tx0)", fontWeight:800, textAlign:"right" }}>{p.count}</td>
                    <td style={{ padding:"8px 12px", color:"var(--tx3)", textAlign:"right" }}>{p.count * hS1}h</td>
                    <td style={{ padding:"8px 12px", color:"var(--tx0)", fontWeight:700, textAlign:"right" }}>{eur(total)} €</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:"1px solid var(--bdr2)", background:"var(--bg0)" }}>
                <td colSpan={5} style={{ padding:"8px 12px", color:"var(--tx3)", fontSize:11 }}>
                  HBS base: {eur(HBS_RATE)} €/h · Total equipo: 21 personas
                </td>
                <td style={{ padding:"8px 12px", color:"var(--tx0)", fontWeight:800, textAlign:"right" }}>
                  {PPT_PERFILES.reduce((s,p)=>s+p.count*20,0)}h
                </td>
                <td style={{ padding:"8px 12px", color:"#f97316", fontWeight:800, textAlign:"right" }}>
                  SUBTOTAL PEM: {eur(PPT_PERFILES.reduce((s,p)=>s+p.count*20*p.precioH,0))} €
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Desglose por fase */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"18px 22px" }}>
        <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:13, marginBottom:16 }}>📊 Presupuesto de Licitación por Fase</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
          <PhaseCard label="S0 — Devising a Project" color="#6366f1" hours={S0_HOURS} bud={s0bud} />
          <PhaseCard label="Sprint 1" color="#818cf8" hours={SPRINT_HOURS[1]} bud={s1bud} isEstim
            realH={S1_REAL_HOURS} realBud={s1real} />
          <PhaseCard label="Sprint 2" color="#34d399" hours={SPRINT_HOURS[2]} bud={s2bud} isEstim />
          <PhaseCard label="Sprint 3" color="#fbbf24" hours={SPRINT_HOURS[3]} bud={s3bud} isEstim />
        </div>

        {/* Total proyecto */}
        <div style={{ background:"var(--bg0)", border:"1px solid var(--bdr2)", borderRadius:10, padding:"16px 18px", marginTop:14 }}>
          <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:13, marginBottom:10 }}>TOTAL PROYECTO (Estimado)</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, marginBottom:12, fontSize:11 }}>
            {[
              { l:"PEM",              v: totbud.pem,  c:"#a1a1aa" },
              { l:`GG (${(GG_PCT*100).toFixed(0)}%)`, v: totbud.gg,   c:"var(--tx3)" },
              { l:`BI (${(BI_PCT*100).toFixed(0)}%)`,  v: totbud.bi,   c:"var(--tx3)" },
              { l:"Base Imponible",   v: totbud.base, c:"var(--tx0)" },
              { l:`IVA (${(IVA_PCT*100).toFixed(0)}%)`,v: totbud.iva,  c:"var(--tx3)" },
              { l:"TOTAL CON IVA",    v: totbud.total,c:"#818cf8" },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background:"var(--bg2)", borderRadius:7, padding:"10px 12px" }}>
                <div style={{ color:"var(--tx4)", fontSize:10 }}>{l}</div>
                <div style={{ color:c, fontWeight:700, fontSize:15 }}>{eur(v)} €</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Estado presupuesto global */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"18px 22px" }}>
        <div style={{ color:"var(--tx0)", fontWeight:700, fontSize:13, marginBottom:16 }}>📈 Estado del Presupuesto Global</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16, fontSize:11 }}>
          <div style={{ background:"var(--bg0)", borderRadius:8, padding:"12px 14px" }}>
            <div style={{ color:"var(--tx4)", fontSize:10, marginBottom:3 }}>PRESUPUESTO TOTAL ADJUDICADO</div>
            <div style={{ color:"var(--tx0)", fontWeight:800, fontSize:18 }}>150.000,00 €</div>
            <div style={{ color:"var(--tx3)" }}>IVA incluido</div>
          </div>
          <div style={{ background:"var(--bg0)", borderRadius:8, padding:"12px 14px" }}>
            <div style={{ color:"var(--tx4)", fontSize:10, marginBottom:3 }}>GASTO ACUMULADO (S0 + S1)</div>
            <div style={{ color:"#f43f5e", fontWeight:800, fontSize:18 }}>{eur(gastadoAcum)} €</div>
            <div style={{ color:"var(--tx3)" }}>S0 real + S1 real Clockify</div>
          </div>
          <div style={{ background:"var(--bg0)", borderRadius:8, padding:"12px 14px" }}>
            <div style={{ color:"var(--tx4)", fontSize:10, marginBottom:3 }}>REMANENTE PRESUPUESTARIO</div>
            <div style={{ color:"#34d399", fontWeight:800, fontSize:18 }}>{eur(remanente)} €</div>
            <div style={{ color:"var(--tx3)" }}>Disponible para S2 + S3</div>
          </div>
        </div>
        <div style={{ marginBottom:6 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--tx3)", marginBottom:5 }}>
            <span>Grado de Ejecución Presupuestaria</span>
            <span style={{ color: ejecucion < 15 ? "#34d399" : "#f87171", fontWeight:700, fontSize:13 }}>
              {ejecucion.toFixed(2)} %
            </span>
          </div>
          <div style={{ height:12, background:"var(--bdr)", borderRadius:6, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${Math.min(ejecucion,100)}%`,
              background: ejecucion < 15 ? "#34d399" : "#f87171", borderRadius:6, transition:"width .5s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, fontSize:10, color:"var(--bdr2)" }}>
            <span>0 €</span>
            <span style={{ color:"var(--tx4)" }}>↑ Umbral lineal estimado: ~15 %</span>
            <span>150.000 €</span>
          </div>
        </div>
        {ejecucion < 15 && (
          <div style={{ marginTop:12, background:"#34d39910", border:"1px solid #34d39930", borderRadius:8, padding:"10px 14px", fontSize:11, color:"#6ee7b7" }}>
            ✅ El gasto se mantiene por debajo del umbral lineal esperado por Sprint (~15%). Gestión eficiente de recursos — remanente mayor disponible para fases de mayor intensidad.
          </div>
        )}
      </div>

      {/* Nota metodológica */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:8, padding:"10px 16px", color:"var(--tx4)", fontSize:11 }}>
        📄 Metodología: PPT Junta de Andalucía · HBS {eur(HBS_RATE)}€/h · GG {(GG_PCT*100).toFixed(0)}% · BI {(BI_PCT*100).toFixed(0)}% · IVA {(IVA_PCT*100).toFixed(0)}%.
        Horas S0 y S1: datos reales Clockify. Sprints S2-S3: estimación por tamaños backlog (XS=2h · S=4h · M=8h · L=16h · XL=24h).
        Composición: 1 PO (Jefe de Proyecto) + 1 SM (Consultor) + 4 Coordinadores + 15 Programadores.
      </div>
    </div>
  );
}

export default function App() {
  const [tab,       setTab]       = useState("github");
  const [showSync,  setShowSync]  = useState(false);
  const [sprintTab, setSprintTab] = useState("s1");
  const [lightMode, setLightMode] = useState(false);
  const isLive = _storedLive && _storedLive.fetchedAt > rawData.fetchedAt;
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", lightMode ? "light" : "dark");
  }, [lightMode]);
  return (
    <>
    <style>{`
      :root{--bg0:#09090b;--bg1:#0c0c10;--bg2:#111113;--bg3:#18181b;--bg4:#1c1c1f;--bdr:#27272a;--bdr2:#3f3f46;--tx0:#e2e8f0;--tx1:#cbd5e1;--tx2:#94a3b8;--tx3:#71717a;--tx4:#52525b;--cal-day:#0f0f18;--st-ready-bg:#1e3a8a;--st-ready-tx:#93c5fd;--st-prog-bg:#064e3b;--st-prog-tx:#6ee7b7;--st-rev-bg:#4c1d95;--st-rev-tx:#c4b5fd;--st-done-bg:#052e16;--st-done-tx:#34d399;--sz-xs-bg:#4c1d95;--sz-xs-tx:#e9d5ff;--sz-s-bg:#064e3b;--sz-s-tx:#6ee7b7;--sz-m-bg:#1e3a8a;--sz-m-tx:#93c5fd;--sz-l-bg:#7c2d12;--sz-l-tx:#fdba74;--sz-xl-bg:#881337;--sz-xl-tx:#fda4af;}
      :root[data-theme="light"]{--bg0:#f8fafc;--bg1:#f1f5f9;--bg2:#ffffff;--bg3:#f8fafc;--bg4:#f1f5f9;--bdr:#e2e8f0;--bdr2:#cbd5e1;--tx0:#111827;--tx1:#1f2937;--tx2:#4b5563;--tx3:#6b7280;--tx4:#9ca3af;--cal-day:#eef2ff;--st-ready-bg:#dbeafe;--st-ready-tx:#1d4ed8;--st-prog-bg:#d1fae5;--st-prog-tx:#065f46;--st-rev-bg:#ede9fe;--st-rev-tx:#6d28d9;--st-done-bg:#dcfce7;--st-done-tx:#15803d;--sz-xs-bg:#ede9fe;--sz-xs-tx:#6d28d9;--sz-s-bg:#d1fae5;--sz-s-tx:#065f46;--sz-m-bg:#dbeafe;--sz-m-tx:#1d4ed8;--sz-l-bg:#ffedd5;--sz-l-tx:#c2410c;--sz-xl-bg:#ffe4e6;--sz-xl-tx:#be123c;}
    `}</style>
    <div style={{ background:"var(--bg0)", minHeight:"100vh", fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:"var(--tx0)" }}>
      {showSync && <SyncModal onClose={() => setShowSync(false)} />}
      {/* NAV */}
      <div style={{ background:"var(--bg2)", borderBottom:"1px solid var(--bdr)", position:"sticky", top:0, zIndex:30 }}>
        <div style={{ maxWidth:1080, margin:"0 auto", padding:"10px 16px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <div style={{ width:29, height:29, borderRadius:7, background:"#3730a320", border:"1px solid #6366f140", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#818cf8", fontSize:13 }}>N</div>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--tx0)", lineHeight:1.2 }}>NexUS — Product Backlog</div>
              <div style={{ fontSize:10, color:"var(--tx4)" }}>
                Grupo 7 · ISPP 25/26 · {BACKLOG.length} HU · Sync: {new Date(_sourceData.fetchedAt).toLocaleString("es-ES",{dateStyle:"short",timeStyle:"short"})}
                {isLive && <span style={{ color:"#34d399", marginLeft:4 }}>● live</span>}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:3, background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:9, padding:3 }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    padding:"5px 14px", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer",
                    background: active ? `${t.color}20` : "transparent",
                    color:      active ? t.color : "var(--tx3)",
                    border:     active ? `1px solid ${t.color}45` : "1px solid transparent",
                    transition:"all .12s",
                  }}>{t.label}</button>
              );
            })}
          </div>
          <button onClick={() => setLightMode(lm => !lm)}
            title={lightMode ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
            style={{ marginLeft:"auto", padding:"5px 10px", borderRadius:7, fontSize:14, cursor:"pointer",
              background:"transparent", border:"1px solid var(--bdr)", color:"var(--tx2)", transition:"all .15s" }}>
            {lightMode ? "🌙" : "☀️"}
          </button>
          <button onClick={() => setShowSync(true)} title="Sincronizar datos desde GitHub"
            style={{ padding:"5px 10px", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer",
              background: isLive ? "#34d39915" : "#6366f115",
              border: isLive ? "1px solid #34d39940" : "1px solid #6366f140",
              color: isLive ? "#34d399" : "#818cf8", transition:"all .15s" }}>
            🔄 {isLive ? "Actualizar" : "Sync GitHub"}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth:1080, margin:"0 auto", padding:"16px 16px 32px" }}>
        {tab === "project" && (
          <div>
            <div style={{ display:"flex", gap:3, background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:9, padding:3, marginBottom:16, width:"fit-content" }}>
              {SPRINT_TABS.map(s => {
                const active = sprintTab === s.id;
                return (
                  <button key={s.id} onClick={() => setSprintTab(s.id)}
                    style={{
                      padding:"5px 14px", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer",
                      background: active ? `${s.color}20` : "transparent",
                      color:      active ? s.color : "var(--tx3)",
                      border:     active ? `1px solid ${s.color}45` : "1px solid transparent",
                      transition:"all .12s",
                    }}>{s.label}</button>
                );
              })}
            </div>
            {sprintTab === "s1" && <BacklogPane sprint={1} />}
            {sprintTab === "s2" && <BacklogPane sprint={2} />}
            {sprintTab === "s3" && <BacklogPane sprint={3} />}
          </div>
        )}
        {tab === "cal"   && <CalendarPane />}
        {tab === "github" && <GitHubPane />}
        {tab === "costes"  && <CostesPane />}
        {tab === "informe" && <InformePane />}
      </div>
    </div>
    </>
  );
}
