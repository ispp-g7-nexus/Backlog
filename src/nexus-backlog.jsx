import { useState, useMemo, Fragment } from "react";
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
      <div style={{ background:"#18181b", border:"1px solid #3f3f46", borderRadius:12, padding:24, width:420, maxWidth:"92vw" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:14, color:"#f1f5f9" }}>🔄 Sincronizar con GitHub</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#71717a", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
        </div>
        <div style={{ fontSize:12, color:"#71717a", marginBottom:12, lineHeight:1.6 }}>
          Necesitas un <strong style={{color:"#a1a1aa"}}>Personal Access Token</strong> con permisos
          {' '}<code style={{background:"#09090b",padding:"1px 4px",borderRadius:3,color:"#818cf8"}}>read:project</code> y{' '}
          <code style={{background:"#09090b",padding:"1px 4px",borderRadius:3,color:"#818cf8"}}>repo</code>.
        </div>
        <input
          type="password" placeholder="ghp_…" value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && status !== 'loading' && handleSync()}
          autoFocus
          style={{ width:"100%", background:"#09090b", border:"1px solid #3f3f46", borderRadius:6,
            padding:"8px 10px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box" }}
        />
        <label style={{ display:"flex", alignItems:"center", gap:6, marginTop:8, fontSize:11, color:"#71717a", cursor:"pointer", userSelect:"none" }}>
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
            style={{ flex:1, padding:"8px", borderRadius:6, background:"transparent", border:"1px solid #3f3f46", color:"#71717a", cursor:"pointer", fontSize:12 }}>
            Cancelar
          </button>
          <button onClick={handleSync} disabled={status==='loading' || !token.trim()}
            style={{ flex:2, padding:"8px", borderRadius:6, background:"#6366f130", border:"1px solid #6366f155",
              color: status==='loading' ? "#52525b" : "#818cf8", cursor: status==='loading' ? "default" : "pointer", fontSize:12, fontWeight:700 }}>
            {status === 'loading' ? '⏳ Sincronizando…' : '🔄 Sincronizar ahora'}
          </button>
        </div>
        {_storedLive && (
          <div style={{ marginTop:12, fontSize:10, color:"#3f3f46", textAlign:"center" }}>
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
const GNODES = [
  // ── S1 – FUNCIONAL ─────────────────────────────────────────
  { id:"infra",      label:"Infraestructura",    sub:"NX-S1.1→NX-S1.5",   sprint:1, x:375, y:50,  track:"shared"  },
  { id:"auth",       label:"Autenticación",       sub:"NX-S1.6→NX-S1.9",   sprint:1, x:175, y:150, track:"shared"  },
  { id:"uxui",       label:"UX / UI",             sub:"NX-S1.10→NX-S1.12",   sprint:1, x:575, y:150, track:"shared"  },
  { id:"panel",      label:"Panel Residencias",   sub:"NX-S1.13→NX-S1.17",   sprint:1, x:50,  y:255, track:"admin"   },
  { id:"inc1",       label:"Incidencias",         sub:"NX-S1.18→NX-S1.22",   sprint:1, x:190, y:255, track:"both"    },
  { id:"avisos",     label:"Avisos",              sub:"NX-S1.23→NX-S1.24",   sprint:1, x:330, y:255, track:"admin"   },
  { id:"reservas1",  label:"Reservas",            sub:"NX-S1.25→NX-S1.28",   sprint:1, x:470, y:255, track:"both"    },
  { id:"eventos1",   label:"Eventos",             sub:"NX-S1.29→NX-S1.31",   sprint:1, x:610, y:255, track:"both"    },
  { id:"onboard1",   label:"Onboarding",          sub:"NX-S1.32→NX-S1.34",   sprint:1, x:50,  y:360, track:"admin"   },
  { id:"objetos1",   label:"Objetos",             sub:"NX-S1.35",         sprint:1, x:190, y:360, track:"admin"   },
  { id:"legal1",     label:"Legal / GDPR",        sub:"NX-S1.36",         sprint:1, x:330, y:360, track:"both"    },
  { id:"matching1",  label:"Matching",            sub:"NX-S1.37→NX-S1.41",   sprint:1, x:470, y:360, track:"student" },
  { id:"calidad1",   label:"Calidad",             sub:"NX-S1.42",         sprint:1, x:610, y:360, track:"both"    },
  // ── S1 – PROCESO ───────────────────────────────────────────
  { id:"docs1",      label:"Documentos",          sub:"D1-01→D1-08",   sprint:1, x:820, y:50,  track:"shared"  },
  { id:"dsscrum1",   label:"Docs Scrum",          sub:"DS1-01→DS1-05", sprint:1, x:820, y:150, track:"shared"  },
  { id:"asist1",     label:"Asistencia",          sub:"A1-01→A1-07",   sprint:1, x:820, y:255, track:"shared"  },

  // ── S2 – FUNCIONAL ─────────────────────────────────────────
  { id:"inc2",       label:"Incidencias+",        sub:"NX-S2.1→NX-S2.5",   sprint:2, x:50,  y:510, track:"both"    },
  { id:"reservas2",  label:"Reservas+",           sub:"NX-S2.6→NX-S2.7",   sprint:2, x:175, y:510, track:"both"    },
  { id:"com2",       label:"Comunicación",        sub:"NX-S2.8→NX-S2.10",   sprint:2, x:300, y:510, track:"admin"   },
  { id:"onboard2",   label:"Onboarding+",         sub:"NX-S2.11",         sprint:2, x:425, y:510, track:"admin"   },
  { id:"objetos2",   label:"Objetos+",            sub:"NX-S2.12→NX-S2.14",   sprint:2, x:550, y:510, track:"both"    },
  { id:"paqueteria", label:"Paquetería",          sub:"NX-S2.15→NX-S2.17",   sprint:2, x:50,  y:605, track:"admin"   },
  { id:"legal2",     label:"Legal / GDPR+",       sub:"NX-S2.18→NX-S2.19",   sprint:2, x:175, y:605, track:"both"    },
  { id:"matching2",  label:"Matching+",           sub:"NX-S2.20→NX-S2.22",   sprint:2, x:300, y:605, track:"student" },
  { id:"comedor2",   label:"Comedor",             sub:"NX-S2.23",         sprint:2, x:425, y:605, track:"admin"   },
  // ── S2 – PROCESO ───────────────────────────────────────────
  { id:"docs2",      label:"Documentos",          sub:"D2-01→D2-08",   sprint:2, x:820, y:510, track:"shared"  },
  { id:"dsscrum2",   label:"Docs Scrum",          sub:"DS2-01→DS2-06", sprint:2, x:820, y:605, track:"shared"  },
  { id:"asist2",     label:"Asistencia",          sub:"A2-01→A2-07",   sprint:2, x:820, y:700, track:"shared"  },

  // ── S3 – FUNCIONAL ─────────────────────────────────────────
  { id:"com3",       label:"Comunicación+",       sub:"NX-S3.1→NX-S3.2",   sprint:3, x:50,  y:770, track:"admin"   },
  { id:"gperfiles",  label:"Gestión Perfiles",    sub:"NX-S3.3→NX-S3.4",   sprint:3, x:175, y:770, track:"admin"   },
  { id:"objetos3",   label:"Objetos++",           sub:"NX-S3.5→NX-S3.6",   sprint:3, x:300, y:770, track:"admin"   },
  { id:"gacceso",    label:"Gestión de Acceso",   sub:"NX-S3.7→NX-S3.10",   sprint:3, x:425, y:770, track:"admin"   },
  { id:"matching3",  label:"Matching Social",     sub:"NX-S3.11→NX-S3.12",   sprint:3, x:550, y:770, track:"student" },
  { id:"premium",    label:"Premium",             sub:"NX-S3.13→NX-S3.14",   sprint:3, x:50,  y:865, track:"admin"   },
  { id:"comedor3",   label:"Comedor+",            sub:"NX-S3.15→NX-S3.17",   sprint:3, x:175, y:865, track:"student" },
  { id:"multisede",  label:"Multi-sede",          sub:"NX-S3.18",         sprint:3, x:300, y:865, track:"admin"   },
  { id:"analiticas", label:"Analíticas",          sub:"NX-S3.19",         sprint:3, x:425, y:865, track:"admin"   },
  { id:"calidad3",   label:"Calidad",             sub:"NX-S3.20→NX-S3.21",   sprint:3, x:550, y:865, track:"both"    },
  // ── S3 – PROCESO ───────────────────────────────────────────
  { id:"docs3",      label:"Documentos",          sub:"D3-01→D3-06",   sprint:3, x:820, y:770, track:"shared"  },
  { id:"dsscrum3",   label:"Docs Scrum",          sub:"DS3-01→DS3-06", sprint:3, x:820, y:865, track:"shared"  },
  { id:"asist3",     label:"Asistencia",          sub:"A3-01→A3-06",   sprint:3, x:820, y:960, track:"shared"  },
];
const GEDGES = [
  // ── S1 interno ─────────────────────────────────────────────
  { from:"infra",     to:"auth",      type:"main"      },
  { from:"infra",     to:"uxui",      type:"main"      },
  { from:"infra",     to:"calidad1",  type:"secondary" },
  { from:"auth",      to:"panel",     type:"main"      },
  { from:"auth",      to:"inc1",      type:"main"      },
  { from:"auth",      to:"avisos",    type:"main"      },
  { from:"auth",      to:"reservas1", type:"main"      },
  { from:"auth",      to:"eventos1",  type:"main"      },
  { from:"auth",      to:"onboard1",  type:"main"      },
  { from:"auth",      to:"matching1", type:"main"      },
  { from:"auth",      to:"legal1",    type:"main"      },
  { from:"uxui",      to:"inc1",      type:"secondary" },
  { from:"panel",     to:"objetos1",  type:"secondary" },
  { from:"onboard1",  to:"matching1", type:"secondary" },

  // ── S1 → S2 ────────────────────────────────────────────────
  { from:"inc1",      to:"inc2",      type:"main"      },
  { from:"reservas1", to:"reservas2", type:"main"      },
  { from:"avisos",    to:"com2",      type:"main"      },
  { from:"onboard1",  to:"onboard2",  type:"main"      },
  { from:"objetos1",  to:"objetos2",  type:"main"      },
  { from:"legal1",    to:"legal2",    type:"main"      },
  { from:"matching1", to:"matching2", type:"main"      },
  { from:"auth",      to:"paqueteria",type:"secondary" },
  { from:"panel",     to:"comedor2",  type:"secondary" },

  // ── S2 interno ─────────────────────────────────────────────
  { from:"onboard2",  to:"matching2", type:"secondary" },
  { from:"com2",      to:"comedor2",  type:"secondary" },

  // ── S2 → S3 ────────────────────────────────────────────────
  { from:"com2",      to:"com3",      type:"main"      },
  { from:"com2",      to:"gperfiles", type:"secondary" },
  { from:"objetos2",  to:"objetos3",  type:"main"      },
  { from:"matching2", to:"matching3", type:"main"      },
  { from:"gperfiles", to:"gacceso",   type:"main"      },
  { from:"comedor2",  to:"comedor3",  type:"main"      },
  { from:"matching3", to:"comedor3",  type:"secondary" },
  { from:"panel",     to:"premium",   type:"secondary" },
  { from:"panel",     to:"multisede", type:"secondary" },
  { from:"panel",     to:"analiticas",type:"secondary" },
  { from:"inc2",      to:"calidad3",  type:"secondary" },
  { from:"premium",   to:"multisede", type:"secondary" },
  { from:"multisede", to:"analiticas",type:"secondary" },

  // ── Proceso (continuidad vertical) ─────────────────────────
  { from:"infra",     to:"docs1",     type:"secondary" },
  { from:"infra",     to:"dsscrum1",  type:"secondary" },
  { from:"infra",     to:"asist1",    type:"secondary" },
  { from:"docs1",     to:"docs2",     type:"secondary" },
  { from:"dsscrum1",  to:"dsscrum2",  type:"secondary" },
  { from:"asist1",    to:"asist2",    type:"secondary" },
  { from:"docs2",     to:"docs3",     type:"secondary" },
  { from:"dsscrum2",  to:"dsscrum3",  type:"secondary" },
  { from:"asist2",    to:"asist3",    type:"secondary" },
];

// ── CONSTANTS ─────────────────────────────────────────────────
const MOSCOW_META = {
  M:{ label:"Must Have",   bg:"#dc2626", text:"#fff" },
  S:{ label:"Should Have", bg:"#b45309", text:"#fff" },
  C:{ label:"Could Have",  bg:"#0369a1", text:"#fff" },
  W:{ label:"Won't Have",  bg:"#3f3f46", text:"#fff" },
};
const STATUS_META = {
  "Backlog":     { bg:"#27272a", text:"#71717a" },
  "Ready":       { bg:"#1e3a8a", text:"#93c5fd" },
  "In progress": { bg:"#064e3b", text:"#6ee7b7" },
  "In review":   { bg:"#4c1d95", text:"#c4b5fd" },
  "Done":        { bg:"#052e16", text:"#34d399" },
};
const SIZE_META = {
  XS:{ bg:"#4c1d95", text:"#e9d5ff" },
  S: { bg:"#064e3b", text:"#6ee7b7" },
  M: { bg:"#1e3a8a", text:"#93c5fd" },
  L: { bg:"#7c2d12", text:"#fdba74" },
  XL:{ bg:"#881337", text:"#fda4af" },
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
  { id:"s1",    label:"Sprint 1",        color:"#818cf8" },
  { id:"s2",    label:"Sprint 2",        color:"#34d399" },
  { id:"s3",    label:"Sprint 3",        color:"#fbbf24" },
  { id:"cal",   label:"📅 Calendario",   color:"#38bdf8" },
  { id:"graph", label:"⬡ Grafo",         color:"#e879f9" },
  { id:"costes",    label:"💰 Costes",      color:"#f97316" },
  { id:"informe",   label:"📊 Informe CSV",  color:"#6ee7b7" },
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
  const meta = STATUS_META[s] || { bg:"#27272a", text:"#71717a" };
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
          color:      active ? activeColor : "#71717a",
          border:     active ? `1px solid ${activeBg}` : "1px solid #27272a",
          transition:"all .12s",
        }}
      >{children}</button>
    );
  }

  return (
    <div>
      {/* Banner */}
      <div style={{ background:"#111113", border:`1px solid ${sc.color}25`, borderRadius:12, padding:"13px 18px", marginBottom:12, display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:sc.color, boxShadow:`0 0 8px ${sc.color}` }} />
            <span style={{ color:sc.color, fontWeight:800, fontSize:14 }}>{sc.label}</span>
            <span style={{ color:"#71717a", fontSize:11 }}>{sc.date}</span>
          </div>
          <div style={{ color:"#94a3b8", fontSize:11 }}>
            {sprint === 1 && "Core del MVP + infraestructura base"}
            {sprint === 2 && "MVP v1 completo · ciclo de mejora continua · pilotaje"}
            {sprint === 3 && "MVP v2 · diferenciadores · matching IA · marketing"}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { l:"Total",       val:stats.total,      c:"#e2e8f0" },
            { l:"En curso",    val:stats.inProgress, c:"#6ee7b7" },
            { l:"En revisión", val:stats.inReview,   c:"#c4b5fd" },
            { l:"Hecho",       val:stats.done,       c:"#34d399" },
          ].map(s => (
            <div key={s.l} style={{ background:"#09090b", border:"1px solid #27272a", borderRadius:8, padding:"6px 12px", textAlign:"center", minWidth:48 }}>
              <div style={{ color:s.c, fontSize:17, fontWeight:800, lineHeight:1 }}>{s.val}</div>
              <div style={{ color:"#52525b", fontSize:9, marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"13px 18px", marginBottom:12 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por ID o título…"
          style={{ width:"100%", background:"#09090b", border:"1px solid #27272a", borderRadius:7, padding:"7px 10px", fontSize:12, color:"#e2e8f0", outline:"none", boxSizing:"border-box", marginBottom:9 }}
        />
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
          <span style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Estado</span>
          {rawData.statuses.map(s => {
            const meta = STATUS_META[s] || { bg:"#27272a", text:"#71717a" };
            return (
              <FilterBtn key={s} active={stf.includes(s)} onClick={() => toggle(stf, setStf, s)} activeBg={meta.bg} activeColor={meta.text}>
                {s}
              </FilterBtn>
            );
          })}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
          <span style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Talla</span>
          {["XS","S","M","L","XL"].map(s => (
            <FilterBtn key={s} active={sf.includes(s)} onClick={() => toggle(sf, setSf, s)} activeBg={SIZE_META[s].bg} activeColor={SIZE_META[s].text}>{s}</FilterBtn>
          ))}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" }}>
          <span style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Área</span>
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
        <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:48, textAlign:"center", color:"#52525b" }}>
          Sin resultados para los filtros seleccionados
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {Object.entries(byArea).sort(([a], [b]) => (areaMinId[a] ?? 9999) - (areaMinId[b] ?? 9999)).map(([area, its]) => (
            <div key={area} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, overflow:"hidden" }}>
              {/* Area header */}
              <div style={{ background:"#09090b", borderBottom:"1px solid #27272a", padding:"8px 16px", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:4, height:14, borderRadius:3, background:areaColor[area] }} />
                <span style={{ color:areaColor[area], fontWeight:700, fontSize:12 }}>{area}</span>
                <span style={{ color:"#3f3f46", fontSize:10 }}>({its.length} HU)</span>
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
                    <tr style={{ borderBottom:"1px solid #27272a" }}>
                      {["ID","Historia de usuario","Equipo","Estado","Talla"].map(h => (
                        <th key={h} style={{ textAlign:"left", padding:"7px 14px", color:"#52525b", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:".07em", whiteSpace:"nowrap" }}>{h}</th>
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
                            <td style={{ padding:"9px 14px", color:"#cbd5e1", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              <span>{item.title}</span>
                              {item.assignees && item.assignees.length > 0 && (
                                <span style={{ marginLeft:8, display:"inline-flex", gap:2, verticalAlign:"middle" }}>
                                  {item.assignees.map(a => (
                                    <img key={a.login} src={a.avatarUrl} title={a.name || a.login}
                                      style={{ width:16, height:16, borderRadius:"50%", border:"1px solid #3f3f46", verticalAlign:"middle" }}
                                    />
                                  ))}
                                </span>
                              )}
                            </td>
                            <td style={{ padding:"9px 14px", color:"#71717a", whiteSpace:"nowrap", fontSize:11 }}>{item.equipo || "—"}</td>
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
                              <td style={{ padding:"6px 14px 6px 36px", color:"#3f3f46", fontSize:11, whiteSpace:"nowrap" }}>└</td>
                              <td style={{ padding:"6px 14px", color:"#71717a", fontSize:11, fontStyle:"italic" }}>{sub.title}</td>
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
        <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"12px 16px" }}>
          <div style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", marginBottom:7 }}>Estado del Kanban</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {Object.keys(STATUS_META).map(k => (
              <StatusBadge key={k} s={k} />
            ))}
          </div>
        </div>
        <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"12px 16px" }}>
          <div style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", marginBottom:7 }}>Tallas (estimación orientativa)</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {[["XS","~2h"],["S","~4h"],["M","~8h"],["L","~16h"],["XL","~30h+"]].map(([s,h]) => (
              <div key={s} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <SizeBadge s={s} />
                <span style={{ color:"#94a3b8", fontSize:10 }}>{h}</span>
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
    return { label:title, color:"#94a3b8", dot:"#64748b" };
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
      <div key={label} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, overflow:"hidden" }}>
        <div style={{ background:"#09090b", borderBottom:"1px solid #27272a", padding:"10px 16px" }}>
          <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:13 }}>{label}</span>
        </div>
        <div style={{ padding:12 }}>
          {/* Day headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign:"center", color:"#52525b", fontSize:10, fontWeight:700, padding:"4px 0", letterSpacing:".05em" }}>{d}</div>
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
                    background: dayEvents.length || endSprint ? "#0f0f18" : "transparent",
                    border: isToday ? "1px solid #818cf840" : (dayEvents.length || endSprint) ? "1px solid #27272a" : "1px solid transparent",
                    position:"relative",
                  }}>
                    <div style={{
                      fontSize:11, fontWeight: dayEvents.length || endSprint ? 700 : 400,
                      color: isToday ? "#818cf8" : (dayEvents.length || endSprint) ? "#e2e8f0" : "#3f3f46",
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
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"12px 18px", marginBottom:12, display:"flex", flexWrap:"wrap", gap:14, alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ color:"#38bdf8", fontWeight:700, fontSize:13, marginBottom:2 }}>📅 Calendario de Asistencia</div>
          <div style={{ color:"#71717a", fontSize:11 }}>Clases y ceremonias Scrum · Feb – Abr 2026</div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {legend.map(l => (
            <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:l.dot }} />
              <span style={{ color:"#94a3b8", fontSize:10 }}>{l.label}</span>
            </div>
          ))}
          {[1,2,3].map(s => (
            <div key={s} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:2, background:SC_COLOR[s] }} />
              <span style={{ color:"#94a3b8", fontSize:10 }}>S{s}</span>
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

// ── GRAPH PANE ────────────────────────────────────────────────
function GraphPane() {
  const [hovered, setHovered] = useState(null);

  const nodeMap = useMemo(() => {
    const m = {};
    GNODES.forEach(n => { m[n.id] = n; });
    return m;
  }, []);

  const connectedEdgeKeys = useMemo(() => {
    if (!hovered) return new Set();
    return new Set(GEDGES.filter(e => e.from === hovered || e.to === hovered).map(e => `${e.from}>${e.to}`));
  }, [hovered]);

  const connectedNodeIds = useMemo(() => {
    if (!hovered) return new Set();
    const s = new Set([hovered]);
    GEDGES.forEach(e => { if (e.from === hovered) s.add(e.to); if (e.to === hovered) s.add(e.from); });
    return s;
  }, [hovered]);

  const sprintColor = { 1:"#818cf8", 2:"#34d399", 3:"#fbbf24" };
  const sprintLabel = { 1:"Sprint 1", 2:"Sprint 2", 3:"Sprint 3" };
  const trackColors = { admin:"#818cf8", student:"#34d399", shared:"#e879f9", both:"#fbbf24" };

  const bezier = (e) => {
    const s = nodeMap[e.from], d = nodeMap[e.to];
    if (!s || !d) return "";
    const sx = s.x + NW/2, sy = s.y + NH;
    const dx = d.x + NW/2, dy = d.y;
    const my = (sy + dy) / 2;
    return `M ${sx},${sy} C ${sx},${my} ${dx},${my} ${dx},${dy}`;
  };

  const SVG_W = 980, SVG_H = 1060;

  return (
    <div>
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"12px 18px", marginBottom:12, display:"flex", flexWrap:"wrap", gap:14, alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ color:"#e879f9", fontWeight:700, fontSize:13, marginBottom:2 }}>⬡ Grafo de dependencias</div>
          <div style={{ color:"#71717a", fontSize:11 }}>Hover sobre un módulo para ver sus dependencias · Continua = directa · Punteada = indirecta</div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {[{ l:"🏢 Residencias", c:"#818cf8" }, { l:"👤 Residentes", c:"#34d399" }, { l:"⚡ Compartido", c:"#e879f9" }].map(x => (
            <div key={x.l} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:9, height:9, borderRadius:2, background:x.c, opacity:.8 }} />
              <span style={{ color:"#94a3b8", fontSize:10 }}>{x.l}</span>
            </div>
          ))}
          {[1,2,3].map(s => (
            <div key={s} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:9, height:9, borderRadius:"50%", background:sprintColor[s] }} />
              <span style={{ color:"#94a3b8", fontSize:10 }}>{sprintLabel[s]}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:"#0c0c10", border:"1px solid #27272a", borderRadius:12, overflowX:"auto" }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width:"100%", minWidth:700, display:"block" }}>
          <defs>
            <marker id="arr" markerWidth="9" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 9 3.5, 0 7" fill="context-stroke" />
            </marker>
            {[1,2,3].map(s => (
              <filter key={s} id={`glow${s}`} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}
          </defs>

          <rect x="0" y="28"  width={SVG_W} height={453} fill="#818cf806" />
          <rect x="0" y="28"  width="3"    height={453} fill="#818cf8" opacity="0.5" />
          <text x="14" y="46" fill="#818cf850" fontSize="10" fontWeight="800" letterSpacing="1">SPRINT 1</text>

          <rect x="0" y="483" width={SVG_W} height={248} fill="#34d39906" />
          <rect x="0" y="483" width="3"    height={248} fill="#34d399" opacity="0.5" />
          <text x="14" y="500" fill="#34d39950" fontSize="10" fontWeight="800" letterSpacing="1">SPRINT 2</text>

          <rect x="0" y="733" width={SVG_W} height={320} fill="#fbbf2406" />
          <rect x="0" y="733" width="3"    height={320} fill="#fbbf24" opacity="0.5" />
          <text x="14" y="750" fill="#fbbf2450" fontSize="10" fontWeight="800" letterSpacing="1">SPRINT 3</text>

          <line x1="750" y1="28" x2="750" y2="1055" stroke="#27272a" strokeDasharray="5,5" strokeWidth="1" opacity="0.6" />
          <text x="370" y="42" fill="#3f3f46" fontSize="10" textAnchor="middle" fontWeight="700" letterSpacing="2">🏢  RESIDENCIAS  ←</text>
          <text x="570" y="42" fill="#3f3f46" fontSize="10" textAnchor="middle" fontWeight="700" letterSpacing="2">→  RESIDENTES  👤</text>
          <line x1="775" y1="28" x2="775" y2="1055" stroke="#27272a" strokeDasharray="3,5" strokeWidth="1" opacity="0.4" />
          <text x="885" y="42" fill="#3f3f46" fontSize="10" textAnchor="middle" fontWeight="700" letterSpacing="2">⚙ PROCESO</text>

          {GEDGES.map(e => {
            const key = `${e.from}>${e.to}`;
            const active = hovered && connectedEdgeKeys.has(key);
            return (
              <path
                key={key}
                d={bezier(e)}
                fill="none"
                stroke={!hovered ? "#2a2a35" : active ? sprintColor[nodeMap[e.from]?.sprint || 1] : "#1a1a22"}
                strokeWidth={active ? 2.5 : 1.5}
                strokeOpacity={!hovered ? 0.6 : active ? 1 : 0.08}
                strokeDasharray={e.type === "secondary" ? "6,4" : "none"}
                markerEnd="url(#arr)"
                style={{ transition:"stroke-opacity .15s" }}
              />
            );
          })}

          {GNODES.map(n => {
            const color   = sprintColor[n.sprint];
            const bc      = trackColors[n.track] || color;
            const isHov   = hovered === n.id;
            const opacity = !hovered ? 1 : connectedNodeIds.has(n.id) ? 1 : 0.2;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                style={{ cursor:"pointer", opacity, transition:"opacity .15s" }}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {isHov && <rect x="-4" y="-4" width={NW+8} height={NH+8} rx="11" fill={color} opacity="0.18" filter={`url(#glow${n.sprint})`} />}
                <rect x="0" y="0" width={NW} height={NH} rx="8" fill="#14141c" stroke={isHov ? color : `${bc}55`} strokeWidth={isHov ? 2 : 1} />
                <rect x="0" y="0" width="4" height={NH} rx="4" fill={bc} opacity="0.8" />
                <circle cx={NW-9} cy="10" r="4.5" fill={color} opacity="0.9" />
                <text x={NW/2+2} y="20" fill={isHov ? color : "#d1d5db"} fontSize="11" fontWeight="700" textAnchor="middle">{n.label}</text>
                <text x={NW/2+2} y="34" fill="#52525b" fontSize="9" textAnchor="middle">{n.sub}</text>
                {isHov && <text x={NW/2+2} y="46" fill={color} fontSize="8" textAnchor="middle" opacity="0.8">{sprintLabel[n.sprint]}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Info panel */}
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"11px 18px", marginTop:12, minHeight:52 }}>
        {hovered ? (() => {
          const n    = nodeMap[hovered];
          const deps = GEDGES.filter(e => e.to   === hovered).map(e => nodeMap[e.from]?.label).filter(Boolean);
          const enab = GEDGES.filter(e => e.from === hovered).map(e => nodeMap[e.to]?.label).filter(Boolean);
          return (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <span style={{ color:sprintColor[n.sprint], fontWeight:800, fontSize:13 }}>{n.label}</span>
                <span style={{ background:`${sprintColor[n.sprint]}20`, color:sprintColor[n.sprint], padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700 }}>{sprintLabel[n.sprint]}</span>
                <span style={{ color:"#52525b", fontSize:11 }}>{n.sub}</span>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:18 }}>
                {deps.length > 0 && (
                  <div>
                    <div style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", marginBottom:4 }}>Requiere</div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {deps.map(d => <span key={d} style={{ background:"#1a1a22", border:"1px solid #27272a", color:"#e2e8f0", padding:"2px 7px", borderRadius:4, fontSize:10 }}>← {d}</span>)}
                    </div>
                  </div>
                )}
                {enab.length > 0 && (
                  <div>
                    <div style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", marginBottom:4 }}>Habilita</div>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {enab.map(d => <span key={d} style={{ background:"#1a1a22", border:"1px solid #27272a", color:"#e2e8f0", padding:"2px 7px", borderRadius:4, fontSize:10 }}>{d} →</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })() : (
          <div style={{ color:"#3f3f46", fontSize:11 }}>Pasa el ratón sobre un módulo para ver sus dependencias…</div>
        )}
      </div>
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

  return { byTask, byUser, byEmail, dailyHours, dailyHoursBySprint, dailyHoursByProject };
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
    <div style={{ background:"#111113", border:`1px solid ${color}30`, borderRadius:10, padding:"14px 18px", flex:"1 1 150px", minWidth:130 }}>
      <div style={{ color:"#52525b", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
      <div style={{ color, fontSize:24, fontWeight:800, lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ color:"#71717a", fontSize:10, marginTop:4 }}>{sub}</div>}
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

  const spLabel = sprint > 0 ? sprint : 'X';
  const docs = [
    { id:'burndown', label:'📈 Burndown §4–5', file:`7-DP-S${spLabel}-Burndown-Chart.md`, gen:genBurndown },
    { id:'velocity', label:'⚡ Velocity §3',    file:`7-DP-S1-Velocity-Chart.md`,          gen:genVelocity },
    { id:'retro',    label:'🔄 Retro §1',        file:`7-DP-S${spLabel}-Retrospectiva.md`,  gen:genRetro    },
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
      <div style={{ background:"#18181b", border:"1px solid #3f3f46", borderRadius:12, padding:24, width:700, maxWidth:"95vw", maxHeight:"90vh", display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight:700, fontSize:14, color:"#f1f5f9" }}>📄 Exportar Markdown con datos reales</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#71717a", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {docs.map(d => (
            <button key={d.id} onClick={() => setDocType(d.id)}
              style={{ padding:"5px 12px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                background: docType===d.id ? "#6ee7b720" : "transparent",
                border:     docType===d.id ? "1px solid #6ee7b745" : "1px solid #27272a",
                color:      docType===d.id ? "#6ee7b7" : "#71717a" }}>
              {d.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize:10, color:"#52525b" }}>
          Archivo: <code style={{ background:"#09090b", padding:"1px 5px", borderRadius:3, color:"#818cf8" }}>{active.file}</code>
          {' — '}Descarga la sección generada y reemplázala en tu repositorio, o cópiala directamente.
        </div>
        <pre style={{ flex:1, overflowY:"auto", background:"#09090b", border:"1px solid #27272a", borderRadius:8, padding:14, fontSize:11, color:"#e2e8f0", margin:0, whiteSpace:"pre-wrap", fontFamily:"'Fira Code','Consolas','Courier New',monospace", lineHeight:1.5, maxHeight:"45vh" }}>
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

function InformePane() {
  const [drag,     setDrag]     = useState(false);
  const [status,   setStatus]   = useState(DEFAULT_CLOCKIFY ? "ok" : "idle");
  const [errMsg,   setErrMsg]   = useState("");
  const [report,   setReport]   = useState(DEFAULT_CLOCKIFY);
  const [fileName, setFileName] = useState(
    DEFAULT_CLOCKIFY
      ? `${DEFAULT_CLOCKIFY.sourceFile || "clockify-entries.json"}  ·  ${new Date(DEFAULT_CLOCKIFY.fetchedAt).toLocaleDateString("es-ES")}`
      : ""
  );
  const [view,     setView]     = useState("equipo"); // open on team tab by default
  const [sprint,   setSprint]   = useState(0);
  const [showExport, setShowExport] = useState(false);

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
        <div style={{ color:"#71717a", fontSize:12, marginBottom:10 }}>
          El Sprint 0 (DP) registra horas por proyecto "dp" en Clockify,<br/>no por tareas individuales del backlog.
        </div>
        <div style={{ color:"#52525b", fontSize:11 }}>
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
        <div style={{ background:"#0c0c10", border:"1px solid #27272a", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ color:"#52525b", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>
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

    const thS = { padding:"8px 10px", textAlign:"left", color:"#71717a", fontWeight:700, whiteSpace:"nowrap", borderBottom:"1px solid #27272a" };
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {metricsBlock}
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ background:"#18181b" }}>
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
                const sc   = sprintC[t.sprint] || "#52525b";
                return (
                  <tr key={tid} style={{ background:i%2===0?"#09090b":"#111113" }}>
                    <td style={{ padding:"7px 10px", color:sc, fontWeight:700, whiteSpace:"nowrap" }}>{tid}</td>
                    <td style={{ padding:"7px 10px", textAlign:"center" }}>
                      <span style={{ background:`${sc}20`, color:sc, padding:"2px 6px", borderRadius:4, fontSize:10, fontWeight:700 }}>S{t.sprint}</span>
                    </td>
                    <td style={{ padding:"7px 10px", color:"#94a3b8", whiteSpace:"nowrap", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis" }}>{t.area}</td>
                    <td style={{ padding:"7px 10px", color:"#e2e8f0", maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={t.title}>{t.title}</td>
                    <td style={{ padding:"7px 10px" }}>
                      <div style={{ display:"flex", gap:2, alignItems:"center" }}>
                        {(t.assignees||[]).map(a => (
                          <img key={a.login} src={a.avatarUrl} title={a.login}
                            style={{ width:18, height:18, borderRadius:"50%", border:"1px solid #3f3f46", flexShrink:0 }} />
                        ))}
                      </div>
                    </td>
                    <td style={{ padding:"7px 10px", whiteSpace:"nowrap" }}>
                      {t.equipo
                        ? <span style={{ background:"#ffffff08", border:"1px solid #3f3f46", borderRadius:4, padding:"1px 7px", color:"#94a3b8", fontSize:10 }}>{t.equipo}</span>
                        : null}
                    </td>
                    <td style={{ padding:"7px 10px", textAlign:"center", color:"#71717a" }}>{t.size}</td>
                    <td style={{ padding:"7px 10px", textAlign:"right", color:"#71717a" }}>
                      {t.area === "Asistencia" && t.size && EQUIPO_LOGINS[t.equipo] ? (
                        <span title={`${SIZE_H_INF[t.size]}h × ${EQUIPO_LOGINS[t.equipo].length} miembros`} style={{ cursor:"help" }}>
                          {t.estimated_h}h
                        </span>
                      ) : `${t.estimated_h}h`}
                    </td>
                    <td style={{ padding:"7px 10px", textAlign:"right", color:t.real_h>0?"#e2e8f0":"#3f3f46" }}>{t.real_h.toFixed(1)}h</td>
                    <td style={{ padding:"7px 10px", textAlign:"right", color:diff>0?"#ef4444":diff<0?"#22c55e":"#52525b", fontWeight:Math.abs(diff)>0?700:400 }}>{diff>0?"+":""}{diff.toFixed(1)}h</td>
                    <td style={{ padding:"7px 10px", minWidth:80 }}>
                      <div style={{ background:"#27272a", borderRadius:4, height:6, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:pct>=100?"#ef4444":pct>=80?"#f59e0b":"#22c55e" }} />
                      </div>
                      <div style={{ color:"#71717a", fontSize:10, textAlign:"right", marginTop:2 }}>{pct.toFixed(0)}%</div>
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
      const statusCounts = Object.fromEntries(STATUSES.map(s => [s, 0]));
      let estimatedH = 0, doneEstimatedH = 0;
      relevantTasks.forEach(t => {
        const assignees = t.assignees || [];
        // Direct assignee, OR (no assignees + person belongs to task's equipo group)
        const directlyAssigned = assignees.some(a => a.login.toLowerCase() === loginLower);
        const equipoLogins     = EQUIPO_LOGINS[t.equipo] || [];
        const impliedByEquipo  = assignees.length === 0 && equipoLogins.includes(loginLower);
        if (directlyAssigned || impliedByEquipo) {
          statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
          const perPersonH = (t.area === "Asistencia" && impliedByEquipo && equipoLogins.length > 0)
            ? t.estimated_h / equipoLogins.length
            : t.estimated_h;
          estimatedH += perPersonH || 0;
          if (t.status === "Done") doneEstimatedH += perPersonH || 0;
        }
      });
      const totalTasks  = STATUSES.reduce((s, st) => s + statusCounts[st], 0);
      const doneCount   = statusCounts["Done"];
      const pctTasks    = totalTasks > 0 ? doneCount / totalTasks * 100   : null;
      const pctHours    = estimatedH > 0 ? totalH / estimatedH * 100      : null;
      const pctTagged   = totalH > 0     ? taggedH / totalH * 100         : null;
      // Rendimiento = valor estimado entregado (h estimadas de tareas Done) / horas reales invertidas
      const rendimiento = totalH > 0     ? doneEstimatedH / totalH * 100  : null;
      return { member, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento };
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
    // Rendimiento medio: valor estimado entregado / horas reales (solo miembros con horas)
    const withRendimiento = memberStats.filter(ms => ms.rendimiento !== null);
    const avgRendimiento  = withRendimiento.length
      ? withRendimiento.reduce((s, ms) => s + ms.rendimiento, 0) / withRendimiento.length : null;
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
      <div style={{ background:"#0c0c10", border:"1px solid #27272a", borderRadius:10, padding:"14px 16px", marginBottom:4 }}>
        <div style={{ color:"#94a3b8", fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
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
              color={Math.abs(correlation)>=0.7?"#22c55e":Math.abs(correlation)>=0.4?"#f59e0b":"#94a3b8"} />
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
          const rows = memberStats
            .filter(ms => ms.member.team === team)
            .sort((a, b) => a.member.name.localeCompare(b.member.name));
          return (
            <div key={team}>
              {/* Team header */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ background:`${tc}20`, color:tc, fontWeight:800, fontSize:10, textTransform:"uppercase", letterSpacing:2, padding:"3px 10px", borderRadius:5, flexShrink:0 }}>Equipo {team}</span>
                <div style={{ flex:1, height:1, background:"#27272a" }}/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {rows.map(({ member, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento }) => {
                  const hoursColor      = pctHours===null?"#3f3f46":pctHours>=100?"#ef4444":pctHours>=75?"#f59e0b":"#22c55e";
                  const tasksColor      = pctTasks===null?"#3f3f46":pctTasks===100?"#22c55e":pctTasks>=50?"#f59e0b":"#94a3b8";
                  const taggedColor     = pctTagged===null?"#3f3f46":pctTagged>=60?"#22c55e":pctTagged>=25?"#f59e0b":"#ef4444";
                  const rendColor       = rendimiento===null?"#3f3f46":rendimiento>=100?"#22c55e":rendimiento>=50?"#f59e0b":"#ef4444";
                  return (
                    <div key={member.login} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"12px 16px" }}>
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
                              <span style={{ color:"#e2e8f0", fontWeight:700, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{member.name}</span>
                              {avgMemberEstH !== null && estimatedH > 0 && (() => {
                                const delta    = estimatedH - avgMemberEstH;
                                const deltaPct = delta / avgMemberEstH * 100;
                                const col = Math.abs(deltaPct) <= 20 ? "#52525b" : delta > 0 ? "#f59e0b" : "#818cf8";
                                return (
                                  <span title={`${estimatedH.toFixed(0)}h estimadas vs media ${avgMemberEstH.toFixed(0)}h`}
                                    style={{ fontSize:9, fontWeight:700, background:`${col}18`, color:col, padding:"1px 5px", borderRadius:3, flexShrink:0 }}>
                                    {delta>=0?"+":""}{delta.toFixed(0)}h
                                  </span>
                                );
                              })()}
                            </div>
                            <div style={{ color:"#52525b", fontSize:10 }}>@{member.login} · {member.role}{member.coord?" · Coord":""} · {totalTasks} tarea{totalTasks!==1?"s":""} asignada{totalTasks!==1?"s":""}</div>
                          </div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0, lineHeight:1.6 }}>
                          <div style={{ color:"#e2e8f0", fontWeight:800, fontSize:15 }}>{totalH.toFixed(1)}h</div>
                          <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                            <span style={{ fontSize:10, color: taggedH>0?"#22c55e":"#3f3f46" }}>{taggedH.toFixed(1)}h etiq.</span>
                            {pctTagged !== null && (
                              <span style={{ fontSize:9, fontWeight:700, background:`${taggedColor}20`, color:taggedColor, padding:"1px 5px", borderRadius:3 }}>
                                {pctTagged.toFixed(0)}%
                              </span>
                            )}
                          </div>
                          {rendimiento !== null && (
                            <div style={{ fontSize:9, color:rendColor, fontWeight:700 }} title="Valor estimado entregado (h estimadas Done) / horas Clockify · ideal ≥100%">
                              ⚡ {rendimiento.toFixed(0)}% rendimiento
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Progress bars */}
                      {sprint !== -1 && (
                        <div style={{ display:"flex", gap:14, marginTop:10 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                              <span style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Tareas done</span>
                              <span style={{ color:tasksColor, fontSize:9, fontWeight:700 }}>
                                {pctTasks!==null ? `${doneCount}/${totalTasks} · ${pctTasks.toFixed(0)}%` : "—"}
                              </span>
                            </div>
                            <div style={{ height:4, background:"#27272a", borderRadius:2, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${Math.min(pctTasks||0,100)}%`, background:tasksColor, borderRadius:2 }}/>
                            </div>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                              <span style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Horas consumidas</span>
                              <span style={{ color:hoursColor, fontSize:9, fontWeight:700 }}>
                                {pctHours!==null ? `${totalH.toFixed(1)}/${estimatedH.toFixed(0)}h · ${pctHours.toFixed(0)}%` : "—"}
                              </span>
                            </div>
                            <div style={{ height:4, background:"#27272a", borderRadius:2, overflow:"hidden" }}>
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
                            const meta  = STATUS_META[st] || { bg:"#27272a", text:"#71717a" };
                            return (
                              <span key={st} style={{
                                background: count>0 ? meta.bg : "#18181b",
                                color:      count>0 ? meta.text : "#3f3f46",
                                border:    `1px solid ${count>0 ? meta.bg+"aa" : "#27272a"}`,
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
        <div style={{ color:"#71717a", fontSize:12 }}>757h registradas · sprint finalizado</div>
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
    if (!days.length) return <div style={{ color:"#52525b", padding:20, textAlign:"center" }}>Sin entradas de tiempo registradas para este sprint.</div>;

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
    const t0ms = new Date(points[0].day).getTime();
    const t1ms = new Date(points[points.length-1].day).getTime();
    const dateToX = (dateStr) => {
      if (t1ms <= t0ms) return pad.l;
      const t = new Date(dateStr).getTime();
      return pad.l + ((t - t0ms) / (t1ms - t0ms)) * (points.length - 1) * xS;
    };

    // Ideal line: from origin to sprint end
    const idealX2 = (() => {
      if (!sprintInfo) return pad.l + cW;
      const x = dateToX(sprintInfo.end);
      return Math.min(pad.l + cW, x);
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
          <span style={{ color:"#71717a", fontSize:11 }}>Burndown — horas restantes de {totalEst}h estimadas</span>
          {sprintInfo && <span style={{ background:`${sprintColor}20`, color:sprintColor, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:4 }}>{sprintInfo.label} · {sprintInfo.date}</span>}
          <span style={{ color:"#52525b", fontSize:10 }}>La línea baja al registrar horas en Clockify</span>
        </div>
        <div style={{ background:"#0c0c10", borderRadius:10, padding:16, overflowX:"auto" }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width:"100%", maxWidth:svgW }}>
            {yTicks.map(({y, label, major}) => (
              <g key={label}>
                <line x1={pad.l} y1={y} x2={pad.l+cW} y2={y} stroke={major?"#27272a":"#1c1c1e"} strokeWidth={major?1:0.5} />
                <text x={pad.l-6} y={y+3.5} fill={major?"#71717a":"#3f3f46"} fontSize="9" textAnchor="end">{label}</text>
              </g>
            ))}
            {/* Sprint-end vertical marker */}
            {sprintEndX !== null && (
              <line x1={sprintEndX} y1={pad.t} x2={sprintEndX} y2={pad.t+cH}
                stroke="#52525b" strokeWidth={1} strokeDasharray="3,3" opacity={0.7} />
            )}
            {/* Ideal line */}
            <line x1={pad.l} y1={pad.t} x2={idealX2} y2={pad.t+cH} stroke="#3f3f46" strokeWidth={1.5} strokeDasharray="6,4" />
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
              <text x={sprintEndX+3} y={pad.t+9} fill="#52525b" fontSize="8">{sprintInfo.end.slice(5)}</text>
            )}
            {/* X-axis date labels */}
            {points.map((p,i)=> i%step===0 && (
              <text key={i} x={pad.l+i*xS} y={svgH-pad.b+14} fill="#52525b" fontSize="9" textAnchor="middle">
                {p.day.slice(5)}
              </text>
            ))}
          </svg>
        </div>
        {/* Legend + estimates */}
        <div style={{ display:"flex", gap:16, marginTop:8, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:18, height:2, borderTop:"2px dashed #3f3f46" }}/><span style={{ color:"#52525b", fontSize:11 }}>Ideal</span></div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:18, height:2, background:sprintColor }}/><span style={{ color:"#52525b", fontSize:11 }}>Real</span></div>
          {projLine && <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:18, height:2, borderTop:`2px dashed ${sprintColor}70` }}/><span style={{ color:"#52525b", fontSize:11 }}>Proyección</span></div>}
          {totalEst > 0 && remaining > 0 && <span style={{ color:"#f59e0b", fontSize:10 }}>⚠ Pendiente: {remaining.toFixed(0)}h ({(remaining/totalEst*100).toFixed(0)}%)</span>}
          {totalEst > 0 && remaining <= 0 && <span style={{ color:"#22c55e", fontSize:10 }}>✓ Sprint completado</span>}
        </div>
        {/* Completion estimate banner */}
        {estimatedDateStr && remaining > 0 && (
          <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10, background: isOnTrack===null?"#18181b":isOnTrack?"#22c55e12":"#ef444412", border:`1px solid ${isOnTrack===null?"#27272a":isOnTrack?"#22c55e30":"#ef444430"}`, borderRadius:8, padding:"8px 14px", flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:"#94a3b8" }}>📅 Estimación de cierre (ritmo actual):</span>
            <span style={{ fontSize:13, fontWeight:800, color: isOnTrack===null?"#e2e8f0":isOnTrack?"#22c55e":"#ef4444" }}>
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
            <span style={{ fontSize:10, color:"#52525b", marginLeft:"auto" }}>
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
    if (!alerts.length) return <div style={{ background:"#111113", borderRadius:10, padding:24, textAlign:"center", color:"#22c55e", fontWeight:700 }}>✅ No hay tareas en riesgo ni excedidas</div>;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {alerts.map(([tid,t])=>{
          const pct=t.real_h/t.estimated_h*100, isExc=pct>=100;
          const bg=isExc?"#ef444415":"#f59e0b12", border=isExc?"#ef444435":"#f59e0b35", color=isExc?"#ef4444":"#f59e0b";
          const sc=sprintC[t.sprint]||"#52525b";
          return (
            <div key={tid} style={{ background:bg, border:`1px solid ${border}`, borderRadius:10, padding:"12px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                    <span style={{ color:sc, fontWeight:800, fontSize:12 }}>{tid}</span>
                    <span style={{ color:"#52525b", fontSize:11 }}>{t.area}</span>
                  </div>
                  <div style={{ color:"#e2e8f0", fontSize:12, marginBottom:8 }}>{t.title}</div>
                  <div style={{ height:8, background:"#27272a", borderRadius:4, overflow:"hidden", maxWidth:300 }}>
                    <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:color }} />
                  </div>
                  {Object.keys(t.byUser).length>0 && (
                    <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                      {Object.entries(t.byUser).map(([u,h])=>(
                        <span key={u} style={{ background:"#18181b", color:"#94a3b8", padding:"2px 8px", borderRadius:4, fontSize:10 }}>{u}: {h.toFixed(1)}h</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"right", minWidth:110 }}>
                  <div style={{ color, fontWeight:800, fontSize:22 }}>{pct.toFixed(0)}%</div>
                  <div style={{ color:"#71717a", fontSize:11 }}>{t.real_h.toFixed(1)}h / {t.estimated_h}h</div>
                  <div style={{ color:"#52525b", fontSize:10, marginTop:4 }}>{isExc?"⛔ Excedida":"⚠️ En riesgo"}</div>
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
      let estimatedH = 0, doneEstimatedH = 0;
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
            estimatedH     += perPersonH || 0;
            if (t.status === "Done") doneEstimatedH += perPersonH || 0;
          }
        });
      });

      const totalTasks  = STATUSES.reduce((s, st) => s + statusCounts[st], 0);
      const doneCount   = statusCounts["Done"];
      const pctTasks    = totalTasks > 0 ? doneCount / totalTasks * 100   : null;
      const pctHours    = estimatedH > 0 ? totalH / estimatedH * 100      : null;
      const pctTagged   = totalH > 0     ? taggedH / totalH * 100         : null;
      const rendimiento = totalH > 0     ? doneEstimatedH / totalH * 100  : null;

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

      return { team, members, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento, memberEstHArr, avgMemberEstH, intraCV };
    });

    // Global comparison metrics across teams
    const withTasks = teamStats.filter(ts => ts.totalTasks > 0);
    const withHours = teamStats.filter(ts => ts.estimatedH > 0);
    const avgPctTasks = withTasks.length ? withTasks.reduce((s, ts) => s + ts.pctTasks, 0) / withTasks.length : null;
    const avgPctHours = withHours.length ? withHours.reduce((s, ts) => s + Math.min(ts.pctHours, 200), 0) / withHours.length : null;
    const best  = withTasks.length ? withTasks.reduce((a, b) => b.pctTasks > a.pctTasks ? b : a) : null;
    const withRend = teamStats.filter(ts => ts.rendimiento !== null);
    const avgRendimiento = withRend.length ? withRend.reduce((s, ts) => s + ts.rendimiento, 0) / withRend.length : null;

    // Inter-team workload balance: CV of estimatedH across teams
    const avgTeamEstH = withHours.length ? withHours.reduce((s, ts) => s + ts.estimatedH, 0) / withHours.length : null;
    const sigmaTeamEstH = avgTeamEstH && withHours.length >= 2
      ? Math.sqrt(withHours.reduce((s, ts) => s + (ts.estimatedH - avgTeamEstH) ** 2, 0) / withHours.length) : null;
    const cvTeamEstH = sigmaTeamEstH && avgTeamEstH ? sigmaTeamEstH / avgTeamEstH * 100 : null;

    const sigmaTasks = withTasks.length >= 2 && avgPctTasks !== null
      ? Math.sqrt(withTasks.reduce((s, ts) => s + (ts.pctTasks - avgPctTasks) ** 2, 0) / withTasks.length)
      : null;

    const globalMetrics = sprint !== -1 && withTasks.length > 0 ? (
      <div style={{ background:"#0c0c10", border:"1px solid #27272a", borderRadius:10, padding:"14px 16px", marginBottom:4 }}>
        <div style={{ color:"#94a3b8", fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
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
        {teamStats.map(({ team, members, statusCounts, totalTasks, doneCount, estimatedH, doneEstimatedH, totalH, taggedH, pctTasks, pctHours, pctTagged, rendimiento, memberEstHArr, avgMemberEstH, intraCV }) => {
          const tc         = TEAM_COLOR[team];
          const hoursColor = pctHours===null?"#3f3f46":pctHours>=100?"#ef4444":pctHours>=75?"#f59e0b":"#22c55e";
          const tasksColor = pctTasks===null?"#3f3f46":pctTasks===100?"#22c55e":pctTasks>=50?"#f59e0b":"#94a3b8";
          const taggedColor= pctTagged===null?"#3f3f46":pctTagged>=60?"#22c55e":pctTagged>=25?"#f59e0b":"#ef4444";
          const rendColor  = rendimiento===null?"#3f3f46":rendimiento>=100?"#22c55e":rendimiento>=50?"#f59e0b":"#ef4444";
          // Inter-team deviation badge
          const interDelta    = avgTeamEstH ? estimatedH - avgTeamEstH : null;
          const interDeltaPct = avgTeamEstH ? interDelta / avgTeamEstH * 100 : null;
          const interColor    = interDeltaPct===null?"#52525b":Math.abs(interDeltaPct)<=15?"#52525b":interDeltaPct>0?"#f59e0b":"#818cf8";
          // Intra-team color
          const intraColor = intraCV===null?"#3f3f46":intraCV<=25?"#22c55e":intraCV<=50?"#f59e0b":"#ef4444";
          return (
            <div key={team} style={{ background:"#111113", border:`1px solid ${tc}30`, borderRadius:12, padding:"14px 16px" }}>
              {/* Team header + aggregated hours */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <span style={{ background:`${tc}20`, color:tc, fontWeight:800, fontSize:13, textTransform:"uppercase", letterSpacing:2, padding:"4px 12px", borderRadius:6 }}>Equipo {team}</span>
                  <span style={{ color:"#52525b", fontSize:11 }}>{members.length} miembros · {totalTasks} tarea{totalTasks!==1?"s":""}</span>
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
                  <div style={{ color:"#e2e8f0", fontWeight:800, fontSize:16 }}>{totalH.toFixed(1)}h</div>
                  <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                    <span style={{ fontSize:10, color: taggedH>0?"#22c55e":"#3f3f46" }}>{taggedH.toFixed(1)}h etiq.</span>
                    {pctTagged !== null && (
                      <span style={{ fontSize:9, fontWeight:700, background:`${taggedColor}20`, color:taggedColor, padding:"1px 5px", borderRadius:3 }}>
                        {pctTagged.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {rendimiento !== null && (
                    <div style={{ fontSize:9, color:rendColor, fontWeight:700 }} title="Valor estimado entregado (h estimadas Done) / horas Clockify · ideal ≥100%">
                      ⚡ {rendimiento.toFixed(0)}% rendimiento
                    </div>
                  )}
                </div>
              </div>

              {/* Member avatars row */}
              <div style={{ display:"flex", gap:5, marginBottom:10, flexWrap:"wrap" }}>
                {members.sort((a,b) => a.name.localeCompare(b.name)).map(m => (
                  <div key={m.login} style={{ display:"flex", alignItems:"center", gap:5, background:"#18181b", borderRadius:6, padding:"3px 8px 3px 3px" }}>
                    <img
                      src={`https://github.com/${m.login}.png?size=24`}
                      alt={m.name}
                      style={{ width:22, height:22, borderRadius:"50%", border:`1.5px solid ${tc}50`, flexShrink:0 }}
                    />
                    <span style={{ color:"#94a3b8", fontSize:10, whiteSpace:"nowrap" }}>{m.name.split(" ")[0]}</span>
                    {m.coord && <span style={{ fontSize:7, background:"#818cf820", color:"#818cf8", padding:"0 3px", borderRadius:2, fontWeight:700 }}>C</span>}
                  </div>
                ))}
              </div>

              {/* Progress bars */}
              {sprint !== -1 && (
                <div style={{ display:"flex", gap:14, marginBottom:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Tareas done</span>
                      <span style={{ color:tasksColor, fontSize:9, fontWeight:700 }}>
                        {pctTasks!==null ? `${doneCount}/${totalTasks} · ${pctTasks.toFixed(0)}%` : "—"}
                      </span>
                    </div>
                    <div style={{ height:5, background:"#27272a", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(pctTasks||0,100)}%`, background:tasksColor, borderRadius:2 }}/>
                    </div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>Horas consumidas</span>
                      <span style={{ color:hoursColor, fontSize:9, fontWeight:700 }}>
                        {pctHours!==null ? `${totalH.toFixed(1)}/${estimatedH.toFixed(0)}h · ${pctHours.toFixed(0)}%` : "—"}
                      </span>
                    </div>
                    <div style={{ height:5, background:"#27272a", borderRadius:2, overflow:"hidden" }}>
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
                    const meta  = STATUS_META[st] || { bg:"#27272a", text:"#71717a" };
                    return (
                      <span key={st} style={{
                        background: count>0 ? meta.bg : "#18181b",
                        color:      count>0 ? meta.text : "#3f3f46",
                        border:    `1px solid ${count>0 ? meta.bg+"aa" : "#27272a"}`,
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
        <div style={{ background:"#0c0c10", borderRadius:10, padding:16, overflowX:"auto" }}>
          <div style={{ color:"#71717a", fontSize:10, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>
            Velocidad por sprint — h estimadas entregadas (Done) vs h Clockify invertidas
          </div>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width:"100%", maxWidth:svgW }}>
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = pad.t + cH * (1 - f);
              const maj = f===0||f===1;
              return (
                <g key={f}>
                  <line x1={pad.l} y1={y} x2={pad.l+cW} y2={y} stroke={maj?"#27272a":"#1c1c1e"} strokeWidth={maj?1:0.5} />
                  <text x={pad.l-6} y={y+3.5} fill={maj?"#71717a":"#3f3f46"} fontSize="9" textAnchor="end">{Math.round(maxH*f)}h</text>
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
                  <text x={cx} y={svgH-pad.b+24} fill="#52525b" fontSize="8" textAnchor="middle">{d.doneCount}/{d.totalCount} Done</text>
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
                <span style={{ color:"#71717a", fontSize:10 }}>{lbl}</span>
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
    if (!dates.length) return <div style={{ color:"#52525b", padding:20, textAlign:"center" }}>Sin datos Clockify.</div>;

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
        <div style={{ background:"#0c0c10", borderRadius:10, padding:16, overflowX:"auto" }}>
          <div style={{ color:"#71717a", fontSize:10, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>
            Actividad diaria — horas Clockify registradas por día
          </div>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width:"100%", minWidth:Math.min(svgW,380) }}>
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = pad.t + cH * (1-f), maj = f===0||f===1;
              return (
                <g key={f}>
                  <line x1={pad.l} y1={y} x2={pad.l+cW} y2={y} stroke={maj?"#27272a":"#1c1c1e"} strokeWidth={maj?1:0.5} />
                  <text x={pad.l-5} y={y+3.5} fill="#52525b" fontSize="8" textAnchor="end">{(maxH*f).toFixed(0)}h</text>
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
                    <text x={cx} y={svgH-pad.b+12} fill="#52525b" fontSize="8" textAnchor="middle">{bar.date.slice(5)}</text>
                  )}
                </g>
              );
            })}
          </svg>
          <div style={{ display:"flex", gap:14, marginTop:4, flexWrap:"wrap" }}>
            {projectDefs.map(({ key, color, label }) => (
              <div key={key} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:2, background:color }} />
                <span style={{ color:"#71717a", fontSize:10 }}>{label}</span>
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

    if (sprint === -1) return <div style={{ color:"#52525b", padding:20, textAlign:"center" }}>S0/DP no tiene tareas en el backlog.</div>;
    if (!relevantTasks.length) return <div style={{ color:"#52525b", padding:20, textAlign:"center" }}>Sin tareas para este filtro.</div>;

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
          <InfStatCard label="Áreas" value={`${areas.length}`} sub={`${totalTasks} tareas · ${totalEst.toFixed(0)}h estimadas`} color="#94a3b8" />
          <InfStatCard label="Tareas Done" value={`${totalDone}/${totalTasks}`} sub={`${(totalDone/totalTasks*100).toFixed(0)}% completitud global`} color={totalDone/totalTasks>=0.75?"#22c55e":totalDone/totalTasks>=0.4?"#f59e0b":"#ef4444"} />
          {totalClockify > 0 && <InfStatCard label="H Clockify" value={`${totalClockify.toFixed(1)}h`} sub={`de ${totalEst.toFixed(0)}h estimadas · ${(totalClockify/totalEst*100).toFixed(0)}%`} color={totalClockify/totalEst>=1?"#ef4444":totalClockify/totalEst>=0.75?"#f59e0b":"#22c55e"} />}
        </div>
        {areas.map(({ area, estimatedH, doneH, clockifyH, total, done, pctDone }) => {
          const pctClockify = estimatedH > 0 ? clockifyH / estimatedH * 100 : null;
          const doneColor   = pctDone>=80?"#22c55e":pctDone>=40?"#f59e0b":"#94a3b8";
          const clockColor  = pctClockify===null?"#3f3f46":pctClockify>=100?"#ef4444":pctClockify>=75?"#f59e0b":"#22c55e";
          return (
            <div key={area} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:8, padding:"10px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                <span style={{ flex:1, color:"#e2e8f0", fontWeight:700, fontSize:12 }}>{area}</span>
                <span style={{ color:"#52525b", fontSize:10 }}>{done}/{total}</span>
                <span style={{ color:doneColor, fontSize:10, fontWeight:700, minWidth:34, textAlign:"right" }}>{pctDone.toFixed(0)}%</span>
                <span style={{ color:"#71717a", fontSize:10, minWidth:58, textAlign:"right" }}>{estimatedH.toFixed(0)}h est.</span>
                {clockifyH > 0 && <span style={{ color:clockColor, fontSize:10, minWidth:58, textAlign:"right" }}>{clockifyH.toFixed(1)}h reg.</span>}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ color:"#3f3f46", fontSize:8, textTransform:"uppercase", letterSpacing:1 }}>Done</span>
                    <span style={{ color:doneColor, fontSize:8, fontWeight:700 }}>{pctDone.toFixed(0)}%</span>
                  </div>
                  <div style={{ height:3, background:"#27272a", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${Math.min(pctDone,100)}%`, background:doneColor, borderRadius:2 }} />
                  </div>
                </div>
                {pctClockify !== null && (
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                      <span style={{ color:"#3f3f46", fontSize:8, textTransform:"uppercase", letterSpacing:1 }}>Consumo</span>
                      <span style={{ color:clockColor, fontSize:8, fontWeight:700 }}>{pctClockify.toFixed(0)}%</span>
                    </div>
                    <div style={{ height:3, background:"#27272a", borderRadius:2, overflow:"hidden" }}>
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

    if (sprint === -1) return <div style={{ color:"#52525b", padding:20, textAlign:"center" }}>S0/DP no tiene tareas en el backlog.</div>;
    if (!relevantTasks.length) return <div style={{ color:"#52525b", padding:20, textAlign:"center" }}>Sin tareas para este filtro.</div>;

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
        <div style={{ color:"#52525b", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>
          Por área — peor cobertura primero
        </div>
        {areas.map(({ area, taggedCount, total, pct, untaggedTasks }) => {
          const c = pct>=80?"#22c55e":pct>=40?"#f59e0b":"#ef4444";
          return (
            <div key={area} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:8, padding:"10px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: untaggedTasks.length>0?6:0 }}>
                <span style={{ flex:1, color:"#e2e8f0", fontWeight:600, fontSize:12 }}>{area}</span>
                <span style={{ color:"#52525b", fontSize:10 }}>{taggedCount}/{total}</span>
                <span style={{ color:c, fontWeight:700, fontSize:10, minWidth:38, textAlign:"right" }}>{pct.toFixed(0)}%</span>
                <div style={{ width:80, height:4, background:"#27272a", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:c, borderRadius:2 }} />
                </div>
              </div>
              {untaggedTasks.length > 0 && (
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {untaggedTasks.map(t => (
                    <span key={t.id} style={{ background:"#18181b", color:"#71717a", fontSize:9, padding:"2px 6px", borderRadius:3, border:"1px solid #27272a" }}>
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
      <div style={{ background:"#111113", border:"1px solid #6ee7b730", borderRadius:12, padding:"14px 20px" }}>
        <div style={{ color:"#6ee7b7", fontWeight:700, fontSize:14, marginBottom:2 }}>📊 Informe CSV — Clockify × Backlog</div>
        <div style={{ color:"#71717a", fontSize:11 }}>Exporta el informe Detallado de Clockify en CSV y arrástralo aquí. Los tags de cada entrada deben incluir el ID de tarea (NX-S1.1, NX-S2.3...).</div>
      </div>

      {/* Cómo exportar */}
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"14px 20px" }}>
        <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:12, marginBottom:10 }}>📤 Cómo exportar desde Clockify</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {[
            "1. Ve a Clockify → Reports → Detailed",
            "2. Selecciona el rango de fechas del sprint",
            "3. Pulsa Export (arriba derecha) → CSV",
            "4. Arrastra el archivo descargado al área de abajo",
          ].map((s,i)=>(
            <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
              <span style={{ color:"#6ee7b7", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>→</span>
              <span style={{ color:"#94a3b8", fontSize:11 }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, background:"#09090b", borderRadius:7, padding:"8px 12px", color:"#52525b", fontSize:10 }}>
          ⚙️ Cada entrada debe tener un tag con el ID de tarea (NX-S1.1, NX-S2.3...). El tag puede ir junto a otros tags.
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e=>{e.preventDefault();setDrag(true);}}
        onDragLeave={()=>setDrag(false)}
        onDrop={onDrop}
        style={{
          border:`2px dashed ${drag?"#6ee7b7":"#27272a"}`,
          borderRadius:12, padding:"36px 20px",
          textAlign:"center", cursor:"pointer",
          background: drag?"#6ee7b708":"#111113",
          transition:"all .15s"
        }}
        onClick={()=>document.getElementById("csv-input").click()}
      >
        <input id="csv-input" type="file" accept=".csv" style={{ display:"none" }} onChange={e=>processFile(e.target.files[0])} />
        <div style={{ fontSize:32, marginBottom:10 }}>{status==="ok"?"✅":"📂"}</div>
        {status==="ok"
          ? <div style={{ color:"#6ee7b7", fontWeight:700, fontSize:13 }}>{fileName}</div>
          : <div style={{ color:"#52525b", fontSize:13, fontWeight:600 }}>Arrastra el CSV de Clockify aquí o haz clic para seleccionarlo</div>
        }
        {status==="ok"
          ? <div style={{ color:"#52525b", fontSize:11, marginTop:4 }}>{report.totalEntries} entradas · {report.matchedEntries} con tarea · haz clic para <strong style={{color:"#6ee7b7"}}>actualizar con un nuevo CSV</strong></div>
          : <div style={{ color:"#3f3f46", fontSize:11, marginTop:4 }}>Exporta el informe Detallado desde Clockify → Reports → Detailed → Export CSV</div>
        }
      </div>

      {errMsg && <div style={{ color:"#ef4444", fontSize:11, background:"#ef444415", borderRadius:7, padding:"10px 14px" }}>⚠️ {errMsg}</div>}

      {/* Dashboard */}
      {status==="ok" && report && (
        <>
          {/* Sprint filter */}
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <span style={{ color:"#71717a", fontSize:11, fontWeight:600 }}>Filtrar sprint:</span>
            {[{v:0,l:"Todos"},{v:-1,l:"Sprint 0"},{v:1,l:"Sprint 1"},{v:2,l:"Sprint 2"},{v:3,l:"Sprint 3"}].map(({v,l})=>{
              const active = sprint===v;
              const c = v===0?"#6ee7b7":v===-1?"#6366f1":sprintC[v];
              return <button key={v} onClick={()=>setSprint(v)} style={{ padding:"4px 14px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", border:`1px solid ${active?c+"60":"transparent"}`, background:active?`${c}20`:"transparent", color:active?c:"#52525b", transition:"all .12s" }}>{l}</button>;
            })}
            <button onClick={() => setShowExport(true)} title="Exportar secciones Clockify a Markdown"
              style={{ marginLeft:"auto", padding:"4px 12px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                background:"#34d39915", border:"1px solid #34d39940", color:"#34d399", transition:"all .15s" }}>
              📄 Exportar MD
            </button>
          </div>

          <KpiRow />

          {/* View tabs */}
          <div style={{ display:"flex", gap:3, background:"#09090b", border:"1px solid #27272a", borderRadius:9, padding:3, alignSelf:"flex-start" }}>
            {viewTabs.map(vt=>{
              const active=view===vt.id;
              return <button key={vt.id} onClick={()=>setView(vt.id)} style={{ padding:"5px 14px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", border:active?"1px solid #6ee7b745":"1px solid transparent", background:active?"#6ee7b720":"transparent", color:active?"#6ee7b7":"#71717a", transition:"all .12s" }}>{vt.label}</button>;
            })}
          </div>

          <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:18 }}>
            {view==="tasks"    && <TasksView />}
            {view==="users"    && <UsersView />}
            {view==="equipo"   && <EquipoView />}
            {view==="burndown" && <BurndownView />}
            {view==="velocity" && <VelocityView />}
            {view==="activity" && <ActivityView />}
            {view==="areas"    && <AreasView />}
            {view==="coverage" && <CoverageView />}
            {view==="alerts"   && <AlertsView />}
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
    <div style={{ background:"#111113", border:`1px solid ${color}30`, borderRadius:12, padding:"18px 22px", flex:"1 1 180px" }}>
      <div style={{ color:"#52525b", fontSize:11, fontWeight:600, marginBottom:4, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
      <div style={{ color, fontSize:28, fontWeight:800, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ color:"#71717a", fontSize:11, marginTop:5 }}>{sub}</div>}
    </div>
  );
}

function ProgressBar({ pct, color, label, spent, total }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ color:"#e2e8f0", fontSize:12, fontWeight:600 }}>{label}</span>
        <span style={{ color:"#71717a", fontSize:11 }}>{spent}h / {total}h ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ height:8, background:"#27272a", borderRadius:4, overflow:"hidden" }}>
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
        borderTop: border ? "1px solid #3f3f46" : "none" }}>
        <span style={{ color: color || "#71717a", fontSize:12, fontWeight: bold ? 700 : 400 }}>{label}</span>
        <span style={{ color: color || "#e2e8f0", fontSize:12, fontWeight: bold ? 700 : 600, fontVariantNumeric:"tabular-nums" }}>
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
            <div style={{ color:"#52525b", fontSize:10 }}>HORAS</div>
            <div style={{ color:"#e2e8f0", fontWeight:800, fontSize:16 }}>{hours}h</div>
            <div style={{ color:"#71717a" }}>{(hours/21).toFixed(1)}h/persona</div>
          </div>
          <div>
            <div style={{ color:"#52525b", fontSize:10 }}>TOTAL (IVA inc.)</div>
            <div style={{ color, fontWeight:800, fontSize:16 }}>{eur(bud.total)} €</div>
            <div style={{ color:"#71717a" }}>PEM: {eur(bud.pem)} €</div>
          </div>
        </div>
        <div style={{ background:"#09090b", borderRadius:7, padding:"8px 12px", fontSize:11 }}>
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
      <div style={{ background:"#111113", border:"1px solid #f9731630", borderRadius:12, padding:"14px 20px" }}>
        <div style={{ color:"#f97316", fontWeight:700, fontSize:14, marginBottom:2 }}>💰 Seguimiento económico — PPT Junta de Andalucía</div>
        <div style={{ color:"#71717a", fontSize:11 }}>
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
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"18px 22px" }}>
        <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:13, marginBottom:14 }}>
          📋 Desglose de Costes de Personal (HBS — Hora Básica de Servicio)
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #27272a" }}>
                {["Perfil Profesional (PPT)","Rol Asignado","Multiplicador","Precio/Hora","Personas","Horas S1 (20h/p)","Total Sprint 1"].map(h => (
                  <th key={h} style={{ padding:"7px 12px", color:"#71717a", fontWeight:600, textAlign: h.startsWith("Total") || h.startsWith("Horas") || h === "Personas" || h === "Multiplicador" || h === "Precio/Hora" ? "right" : "left", whiteSpace:"nowrap" }}>{h}</th>
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
                    <td style={{ padding:"8px 12px", color:"#e2e8f0", fontWeight:600, textAlign:"right" }}>×{p.mult.toFixed(2)}</td>
                    <td style={{ padding:"8px 12px", color:p.color, fontWeight:700, textAlign:"right" }}>{eur(p.precioH)} €</td>
                    <td style={{ padding:"8px 12px", color:"#e2e8f0", fontWeight:800, textAlign:"right" }}>{p.count}</td>
                    <td style={{ padding:"8px 12px", color:"#71717a", textAlign:"right" }}>{p.count * hS1}h</td>
                    <td style={{ padding:"8px 12px", color:"#e2e8f0", fontWeight:700, textAlign:"right" }}>{eur(total)} €</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:"1px solid #3f3f46", background:"#09090b" }}>
                <td colSpan={5} style={{ padding:"8px 12px", color:"#71717a", fontSize:11 }}>
                  HBS base: {eur(HBS_RATE)} €/h · Total equipo: 21 personas
                </td>
                <td style={{ padding:"8px 12px", color:"#f1f5f9", fontWeight:800, textAlign:"right" }}>
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
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"18px 22px" }}>
        <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:13, marginBottom:16 }}>📊 Presupuesto de Licitación por Fase</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:12 }}>
          <PhaseCard label="S0 — Devising a Project" color="#6366f1" hours={S0_HOURS} bud={s0bud} />
          <PhaseCard label="Sprint 1" color="#818cf8" hours={SPRINT_HOURS[1]} bud={s1bud} isEstim
            realH={S1_REAL_HOURS} realBud={s1real} />
          <PhaseCard label="Sprint 2" color="#34d399" hours={SPRINT_HOURS[2]} bud={s2bud} isEstim />
          <PhaseCard label="Sprint 3" color="#fbbf24" hours={SPRINT_HOURS[3]} bud={s3bud} isEstim />
        </div>

        {/* Total proyecto */}
        <div style={{ background:"#09090b", border:"1px solid #3f3f46", borderRadius:10, padding:"16px 18px", marginTop:14 }}>
          <div style={{ color:"#f1f5f9", fontWeight:700, fontSize:13, marginBottom:10 }}>TOTAL PROYECTO (Estimado)</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, marginBottom:12, fontSize:11 }}>
            {[
              { l:"PEM",              v: totbud.pem,  c:"#a1a1aa" },
              { l:`GG (${(GG_PCT*100).toFixed(0)}%)`, v: totbud.gg,   c:"#71717a" },
              { l:`BI (${(BI_PCT*100).toFixed(0)}%)`,  v: totbud.bi,   c:"#71717a" },
              { l:"Base Imponible",   v: totbud.base, c:"#e2e8f0" },
              { l:`IVA (${(IVA_PCT*100).toFixed(0)}%)`,v: totbud.iva,  c:"#71717a" },
              { l:"TOTAL CON IVA",    v: totbud.total,c:"#818cf8" },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ background:"#111113", borderRadius:7, padding:"10px 12px" }}>
                <div style={{ color:"#52525b", fontSize:10 }}>{l}</div>
                <div style={{ color:c, fontWeight:700, fontSize:15 }}>{eur(v)} €</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Estado presupuesto global */}
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:12, padding:"18px 22px" }}>
        <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:13, marginBottom:16 }}>📈 Estado del Presupuesto Global</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16, fontSize:11 }}>
          <div style={{ background:"#09090b", borderRadius:8, padding:"12px 14px" }}>
            <div style={{ color:"#52525b", fontSize:10, marginBottom:3 }}>PRESUPUESTO TOTAL ADJUDICADO</div>
            <div style={{ color:"#f1f5f9", fontWeight:800, fontSize:18 }}>150.000,00 €</div>
            <div style={{ color:"#71717a" }}>IVA incluido</div>
          </div>
          <div style={{ background:"#09090b", borderRadius:8, padding:"12px 14px" }}>
            <div style={{ color:"#52525b", fontSize:10, marginBottom:3 }}>GASTO ACUMULADO (S0 + S1)</div>
            <div style={{ color:"#f43f5e", fontWeight:800, fontSize:18 }}>{eur(gastadoAcum)} €</div>
            <div style={{ color:"#71717a" }}>S0 real + S1 real Clockify</div>
          </div>
          <div style={{ background:"#09090b", borderRadius:8, padding:"12px 14px" }}>
            <div style={{ color:"#52525b", fontSize:10, marginBottom:3 }}>REMANENTE PRESUPUESTARIO</div>
            <div style={{ color:"#34d399", fontWeight:800, fontSize:18 }}>{eur(remanente)} €</div>
            <div style={{ color:"#71717a" }}>Disponible para S2 + S3</div>
          </div>
        </div>
        <div style={{ marginBottom:6 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#71717a", marginBottom:5 }}>
            <span>Grado de Ejecución Presupuestaria</span>
            <span style={{ color: ejecucion < 15 ? "#34d399" : "#f87171", fontWeight:700, fontSize:13 }}>
              {ejecucion.toFixed(2)} %
            </span>
          </div>
          <div style={{ height:12, background:"#27272a", borderRadius:6, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${Math.min(ejecucion,100)}%`,
              background: ejecucion < 15 ? "#34d399" : "#f87171", borderRadius:6, transition:"width .5s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, fontSize:10, color:"#3f3f46" }}>
            <span>0 €</span>
            <span style={{ color:"#52525b" }}>↑ Umbral lineal estimado: ~15 %</span>
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
      <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:8, padding:"10px 16px", color:"#52525b", fontSize:11 }}>
        📄 Metodología: PPT Junta de Andalucía · HBS {eur(HBS_RATE)}€/h · GG {(GG_PCT*100).toFixed(0)}% · BI {(BI_PCT*100).toFixed(0)}% · IVA {(IVA_PCT*100).toFixed(0)}%.
        Horas S0 y S1: datos reales Clockify. Sprints S2-S3: estimación por tamaños backlog (XS=2h · S=4h · M=8h · L=16h · XL=24h).
        Composición: 1 PO (Jefe de Proyecto) + 1 SM (Consultor) + 4 Coordinadores + 15 Programadores.
      </div>
    </div>
  );
}

export default function App() {
  const [tab,      setTab]      = useState("s1");
  const [showSync, setShowSync] = useState(false);
  const isLive = _storedLive && _storedLive.fetchedAt > rawData.fetchedAt;
  return (
    <div style={{ background:"#09090b", minHeight:"100vh", fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:"#e2e8f0" }}>
      {showSync && <SyncModal onClose={() => setShowSync(false)} />}
      {/* NAV */}
      <div style={{ background:"#111113", borderBottom:"1px solid #27272a", position:"sticky", top:0, zIndex:30 }}>
        <div style={{ maxWidth:1080, margin:"0 auto", padding:"10px 16px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <div style={{ width:29, height:29, borderRadius:7, background:"#3730a320", border:"1px solid #6366f140", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#818cf8", fontSize:13 }}>N</div>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:"#f1f5f9", lineHeight:1.2 }}>NexUS — Product Backlog</div>
              <div style={{ fontSize:10, color:"#52525b" }}>
                Grupo 7 · ISPP 25/26 · {BACKLOG.length} HU · Sync: {new Date(_sourceData.fetchedAt).toLocaleString("es-ES",{dateStyle:"short",timeStyle:"short"})}
                {isLive && <span style={{ color:"#34d399", marginLeft:4 }}>● live</span>}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:3, background:"#09090b", border:"1px solid #27272a", borderRadius:9, padding:3 }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    padding:"5px 14px", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer",
                    background: active ? `${t.color}20` : "transparent",
                    color:      active ? t.color : "#71717a",
                    border:     active ? `1px solid ${t.color}45` : "1px solid transparent",
                    transition:"all .12s",
                  }}>{t.label}</button>
              );
            })}
          </div>
          <button onClick={() => setShowSync(true)} title="Sincronizar datos desde GitHub"
            style={{ marginLeft:"auto", padding:"5px 10px", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer",
              background: isLive ? "#34d39915" : "#6366f115",
              border: isLive ? "1px solid #34d39940" : "1px solid #6366f140",
              color: isLive ? "#34d399" : "#818cf8", transition:"all .15s" }}>
            🔄 {isLive ? "Actualizar" : "Sync GitHub"}
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth:1080, margin:"0 auto", padding:"16px 16px 32px" }}>
        {tab === "s1"    && <BacklogPane sprint={1} />}
        {tab === "s2"    && <BacklogPane sprint={2} />}
        {tab === "s3"    && <BacklogPane sprint={3} />}
        {tab === "cal"   && <CalendarPane />}
        {tab === "graph"  && <GraphPane />}
        {tab === "costes"  && <CostesPane />}
        {tab === "informe" && <InformePane />}
      </div>
    </div>
  );
}
