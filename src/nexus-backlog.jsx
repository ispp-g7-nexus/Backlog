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
const BACKLOG_MAP = (() => {
  const map = {};
  BACKLOG.forEach(it => { map[it.id] = { ...it, estimated_h: SIZE_H_INF[it.size] || 0 }; });
  return map;
})();

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

    // find task ID in tags or description (NX-S1.1, NX-S2.3, etc.)
    const combined = tags + " " + desc;
    // // Formato: NX-S1.1 — mismo ID que en el backlog
    const match = combined.match(/NX-S[1-3]\.\d{1,2}/i);
    const taskId = match ? match[0].toUpperCase() : null;

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
      byEmail[email] = byEmail[email] || { name: user, total_h: 0, dp_h: 0, s1_h: 0, s2_h: 0, s3_h: 0 };
      byEmail[email].total_h += hours;
      if (project === "dp") byEmail[email].dp_h += hours;
      if (project === "s1") byEmail[email].s1_h += hours;
      if (project === "s2") byEmail[email].s2_h += hours;
      if (project === "s3") byEmail[email].s3_h += hours;
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
    .filter(([,t]) => sprint <= 0 || t.sprint === sprint)
    .sort((a,b) => a[1].sprint - b[1].sprint || a[0].localeCompare(b[0]));

  // ── Sub-views ──────────────────────────────────────────────
  function KpiRow() {
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
    const tasks = filtered(report);
    return (
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead>
            <tr style={{ background:"#18181b" }}>
              {["ID","Sp","Módulo","Tarea","Talla","Est.","Real","Dif.","% Uso","Estado"].map(h=>(
                <th key={h} style={{ padding:"8px 10px", textAlign:"left", color:"#71717a", fontWeight:700, whiteSpace:"nowrap", borderBottom:"1px solid #27272a" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map(([tid,t],i)=>{
              const pct  = t.estimated_h ? t.real_h/t.estimated_h*100 : 0;
              const diff = t.real_h - t.estimated_h;
              const sc   = sprintC[t.sprint] || "#52525b";
              const stato = t.real_h===0 ? {icon:"⬜",c:"#52525b"} : pct>=100 ? {icon:"🔴",c:"#ef4444"} : pct>=80 ? {icon:"🟡",c:"#f59e0b"} : {icon:"🟢",c:"#22c55e"};
              return (
                <tr key={tid} style={{ background:i%2===0?"#09090b":"#111113" }}>
                  <td style={{ padding:"7px 10px", color:sc, fontWeight:700, whiteSpace:"nowrap" }}>{tid}</td>
                  <td style={{ padding:"7px 10px", textAlign:"center" }}><span style={{ background:`${sc}20`, color:sc, padding:"2px 6px", borderRadius:4, fontSize:10, fontWeight:700 }}>S{t.sprint}</span></td>
                  <td style={{ padding:"7px 10px", color:"#94a3b8", whiteSpace:"nowrap" }}>{t.area}</td>
                  <td style={{ padding:"7px 10px", color:"#e2e8f0", maxWidth:260, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={t.title}>{t.title}</td>
                  <td style={{ padding:"7px 10px", textAlign:"center", color:"#71717a" }}>{t.size}</td>
                  <td style={{ padding:"7px 10px", textAlign:"right", color:"#71717a" }}>{t.estimated_h}h</td>
                  <td style={{ padding:"7px 10px", textAlign:"right", color:t.real_h>0?"#e2e8f0":"#3f3f46" }}>{t.real_h.toFixed(1)}h</td>
                  <td style={{ padding:"7px 10px", textAlign:"right", color:diff>0?"#ef4444":diff<0?"#22c55e":"#52525b", fontWeight:Math.abs(diff)>0?700:400 }}>{diff>0?"+":""}{diff.toFixed(1)}h</td>
                  <td style={{ padding:"7px 10px", minWidth:90 }}>
                    <div style={{ background:"#27272a", borderRadius:4, height:6, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:pct>=100?"#ef4444":pct>=80?"#f59e0b":"#22c55e" }} />
                    </div>
                    <div style={{ color:"#71717a", fontSize:10, textAlign:"right", marginTop:2 }}>{pct.toFixed(0)}%</div>
                  </td>
                  <td style={{ padding:"7px 10px", color:stato.c, fontWeight:700, textAlign:"center" }}>{stato.icon}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function UsersView() {
    const users = Object.entries(report.byUser).sort((a,b)=>b[1].total_h-a[1].total_h);
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {users.map(([name,u])=>{
          const tasks = Object.entries(u.byTask)
            .filter(([tid])=>!sprint||BACKLOG_MAP[tid]?.sprint===sprint)
            .sort((a,b)=>b[1]-a[1]);
          const userTotal = tasks.reduce((s,[,h])=>s+h,0);
          return (
            <div key={name} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px 18px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:"50%", background:"#6ee7b720", border:"1px solid #6ee7b740", display:"flex", alignItems:"center", justifyContent:"center", color:"#6ee7b7", fontWeight:800, fontSize:14 }}>{name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:13 }}>{name}</div>
                    <div style={{ color:"#52525b", fontSize:10 }}>{tasks.length} tareas · {u.total_h.toFixed(1)}h totales (sprint filtrado: {userTotal.toFixed(1)}h)</div>
                  </div>
                </div>
                <span style={{ background:"#6ee7b720", color:"#6ee7b7", padding:"4px 12px", borderRadius:6, fontWeight:800, fontSize:14 }}>{userTotal.toFixed(1)}h</span>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {tasks.map(([tid,h])=>{
                  const sc = sprintC[BACKLOG_MAP[tid]?.sprint]||"#52525b";
                  return (
                    <div key={tid} style={{ background:`${sc}10`, border:`1px solid ${sc}25`, borderRadius:6, padding:"4px 10px", display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ color:sc, fontWeight:700, fontSize:10 }}>{tid}</span>
                      <span style={{ color:"#71717a", fontSize:10 }}>{h.toFixed(1)}h</span>
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

    // Use project daily hours (s1/s2/s3 only — excludes DP to avoid inflating burndown)
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
    const days   = Object.keys(dailyH).sort();
    if (!days.length) return <div style={{ color:"#52525b", padding:20, textAlign:"center" }}>Sin entradas de tiempo registradas para este sprint.</div>;

    let remaining = totalEst;
    const points = days.map(d => { remaining -= (dailyH[d]||0); return { day:d, remaining:Math.max(remaining,0) }; });

    const svgW=620, svgH=220, pad={t:20,r:20,b:36,l:58};
    const cW=svgW-pad.l-pad.r, cH=svgH-pad.t-pad.b;
    const xS = points.length>1 ? cW/(points.length-1) : cW;
    const yS = totalEst ? cH/totalEst : 1;
    const pathA = points.map((p,i)=>`${i===0?"M":"L"} ${pad.l+i*xS},${pad.t+cH-(p.remaining*yS)}`).join(" ");
    const step  = Math.max(1, Math.ceil(points.length/8));

    // Ideal line: anchored to sprint start→end dates when sprint is selected
    const sprintInfo = sprint > 0 ? SC[sprint] : null;
    const idealX2 = (() => {
      if (!sprintInfo) return pad.l + cW;
      const endDate = sprintInfo.end;
      const endIdx = days.indexOf(endDate);
      if (endIdx >= 0) return pad.l + endIdx * xS;
      // Sprint end is in the future: extrapolate by calendar days
      if (endDate > days[days.length-1] && days.length > 1) {
        const t0 = new Date(days[0]).getTime(), t1 = new Date(days[days.length-1]).getTime(), tE = new Date(endDate).getTime();
        if (t1 > t0) return pad.l + Math.min(cW, (tE - t0) / (t1 - t0) * cW);
      }
      return pad.l + cW;
    })();

    // Y-axis ticks: 0, 25%, 50%, 75%, 100%
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
      y: pad.t + cH * (1 - f),
      label: Math.round(totalEst * f) + "h",
      major: f === 0 || f === 1,
    }));

    const sprintColor = sprint > 0 ? SC[sprint].color : "#6ee7b7";

    return (
      <div>
        <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:10, flexWrap:"wrap" }}>
          <span style={{ color:"#71717a", fontSize:11 }}>Burndown — horas restantes de {totalEst}h estimadas</span>
          {sprintInfo && <span style={{ background:`${sprintColor}20`, color:sprintColor, fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:4 }}>{sprintInfo.label} · {sprintInfo.date}</span>}
        </div>
        <div style={{ background:"#0c0c10", borderRadius:10, padding:16, overflowX:"auto" }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width:"100%", maxWidth:svgW }}>
            {/* Grid lines + Y-axis labels */}
            {yTicks.map(({y, label, major}) => (
              <g key={label}>
                <line x1={pad.l} y1={y} x2={pad.l+cW} y2={y} stroke={major?"#27272a":"#1c1c1e"} strokeWidth={major?1:0.5} />
                <text x={pad.l-6} y={y+3.5} fill={major?"#71717a":"#3f3f46"} fontSize="9" textAnchor="end">{label}</text>
              </g>
            ))}
            {/* Ideal line */}
            <line x1={pad.l} y1={pad.t} x2={idealX2} y2={pad.t+cH}
              stroke="#3f3f46" strokeWidth={1.5} strokeDasharray="6,4" />
            {/* Real burndown */}
            <path d={pathA} fill="none" stroke={sprintColor} strokeWidth={2.5} />
            {points.map((p,i)=>(
              <circle key={i} cx={pad.l+i*xS} cy={pad.t+cH-(p.remaining*yS)} r={3} fill={sprintColor} />
            ))}
            {/* X-axis labels: MM-DD (ISO format → slice(5) = "MM-DD") */}
            {points.map((p,i)=> i%step===0 && (
              <text key={i} x={pad.l+i*xS} y={svgH-pad.b+14} fill="#52525b" fontSize="9" textAnchor="middle">
                {p.day.slice(5)}
              </text>
            ))}
          </svg>
        </div>
        <div style={{ display:"flex", gap:16, marginTop:8, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:18, height:2, borderTop:"2px dashed #3f3f46" }}/><span style={{ color:"#52525b", fontSize:11 }}>Ideal</span></div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:18, height:2, background:sprintColor }}/><span style={{ color:"#52525b", fontSize:11 }}>Real</span></div>
          {totalEst > 0 && remaining > 0 && <span style={{ color:"#f59e0b", fontSize:10 }}>⚠ Pendiente: {remaining.toFixed(0)}h ({(remaining/totalEst*100).toFixed(0)}%)</span>}
          {totalEst > 0 && remaining <= 0 && <span style={{ color:"#22c55e", fontSize:10 }}>✓ Sprint completado</span>}
        </div>
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
    const teamColor  = { A:"#38bdf8", B:"#34d399", C:"#f472b6", D:"#fbbf24" };
    const roleColor  = { SM:"#a78bfa", PO:"#fb923c", Dev:"#52525b" };
    const roleOrder  = { SM:0, PO:1, Dev:2 };
    const sprintColor = { 1:"#818cf8", 2:"#34d399", 3:"#fbbf24" };

    const thStyle = { padding:"7px 10px", color:"#71717a", fontWeight:700, whiteSpace:"nowrap",
      borderBottom:"1px solid #27272a", fontSize:9, textTransform:"uppercase", letterSpacing:".07em" };

    // Members sorted by team → role → name, enriched with Clockify hours
    const members = [...TEAM_MEMBERS].sort((a, b) => {
      const ta = a.team||"Z", tb = b.team||"Z";
      if (ta !== tb) return ta.localeCompare(tb);
      if (roleOrder[a.role] !== roleOrder[b.role]) return roleOrder[a.role] - roleOrder[b.role];
      return a.name.localeCompare(b.name);
    }).map(m => {
      const ue = report.byEmail[m.email] || { dp_h:0, s1_h:0, s2_h:0, s3_h:0 };
      return { ...m, dp_h: ue.dp_h, sh: { 1:ue.s1_h, 2:ue.s2_h, 3:ue.s3_h } };
    });

    const fh = (h, color) => h > 0
      ? <span style={{ color, fontWeight:700 }}>{h.toFixed(1)}h</span>
      : <span style={{ color:"#3f3f46" }}>—</span>;

    function AvanceCell({ dedicatedH, assignedH }) {
      if (!assignedH) return <span style={{ color:"#3f3f46", fontSize:10 }}>sin asignar</span>;
      const pct = dedicatedH / assignedH * 100;
      return (
        <div>
          <div style={{ background:"#27272a", borderRadius:3, height:6, overflow:"hidden", minWidth:60 }}>
            <div style={{ height:"100%", width:`${Math.min(pct,100)}%`,
              background: pct>=100?"#ef4444":pct>=80?"#f59e0b":"#22c55e" }} />
          </div>
          <div style={{ color:"#71717a", fontSize:9, textAlign:"right", marginTop:2 }}>{pct.toFixed(0)}%</div>
        </div>
      );
    }

    // Shared name + role + team cells
    function MemberCells({ m }) {
      const tc = teamColor[m.team] || "#818cf8";
      const rc = roleColor[m.role] || "#52525b";
      return (
        <>
          <td style={{ padding:"8px 10px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:3, height:18, borderRadius:2, background:tc, flexShrink:0 }} />
              <span style={{ color:"#e2e8f0", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.name}</span>
              {m.coord && <span style={{ fontSize:8, background:"#818cf820", color:"#818cf8", padding:"1px 5px", borderRadius:3, fontWeight:700, flexShrink:0 }}>COORD</span>}
            </div>
          </td>
          <td style={{ padding:"8px 10px", textAlign:"center" }}>
            <span style={{ background:`${rc}20`, color:rc, padding:"2px 6px", borderRadius:4, fontSize:10, fontWeight:700 }}>{m.role}</span>
          </td>
          <td style={{ padding:"8px 10px", textAlign:"center" }}>
            {m.team
              ? <span style={{ background:`${teamColor[m.team]}20`, color:teamColor[m.team], padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700 }}>{m.team}</span>
              : <span style={{ color:"#3f3f46" }}>—</span>}
          </td>
        </>
      );
    }

    // ── S0 — siempre visible ─────────────────────────────────
    const totalDp  = members.reduce((s, m) => s + m.dp_h, 0);
    const activeS0 = members.filter(m => m.dp_h > 0).length;

    function S0Section() {
      return (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ width:4, height:20, borderRadius:2, background:"#6366f1" }} />
            <span style={{ color:"#6366f1", fontWeight:700, fontSize:13 }}>S0 — Devising a Project</span>
            <span style={{ background:"#22c55e18", color:"#22c55e", fontSize:10, fontWeight:700,
              padding:"2px 8px", borderRadius:4, border:"1px solid #22c55e30" }}>✓ COMPLETADO</span>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <InfStatCard label="S0 — DP" value={`${totalDp.toFixed(1)}h`} sub="Devising a Project" color="#6366f1" />
            <InfStatCard label="Personas" value={`${activeS0} / ${members.length}`} sub="con horas registradas" color="#e879f9" />
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead>
                <tr style={{ background:"#18181b" }}>
                  <th style={{ ...thStyle, textAlign:"left", width:190 }}>Nombre</th>
                  <th style={{ ...thStyle, textAlign:"center", width:52 }}>Rol</th>
                  <th style={{ ...thStyle, textAlign:"center", width:46 }}>Eq.</th>
                  <th style={{ ...thStyle, textAlign:"right", width:100, color:"#6366f1" }}>S0 (DP)</th>
                  <th style={{ ...thStyle, textAlign:"left", width:110 }}>Avance</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.email} style={{ background:i%2===0?"#09090b":"#111113", borderBottom:"1px solid #1c1c1e" }}>
                    <MemberCells m={m} />
                    <td style={{ padding:"8px 10px", textAlign:"right" }}>{fh(m.dp_h, "#6366f1")}</td>
                    <td style={{ padding:"8px 10px" }}>
                      {m.dp_h > 0
                        ? <AvanceCell dedicatedH={m.dp_h} assignedH={m.dp_h} />
                        : <span style={{ color:"#3f3f46", fontSize:10 }}>Sin datos</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:"#18181b", borderTop:"2px solid #27272a" }}>
                  <td style={{ padding:"8px 10px", color:"#e2e8f0", fontWeight:700 }}>TOTAL</td>
                  <td colSpan={2} />
                  <td style={{ padding:"8px 10px", textAlign:"right", color:"#6366f1", fontWeight:700 }}>{totalDp.toFixed(1)}h</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    // ── Sprint section — datos de UN solo sprint ─────────────
    function SprintSection({ n }) {
      const color     = sprintColor[n];
      const assigned  = ASSIGNED_PER_SPRINT[n] || {};
      const totalSn   = members.reduce((s, m) => s + (m.sh[n] || 0), 0);
      const totalAsig = members.reduce((s, m) => s + (assigned[m.login.toLowerCase()] || 0), 0);
      const avgPct    = totalAsig > 0 ? totalSn / totalAsig * 100 : null;

      return (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ width:4, height:20, borderRadius:2, background:color }} />
            <span style={{ color, fontWeight:700, fontSize:13 }}>Sprint {n}</span>
            {totalSn === 0 && (
              <span style={{ background:"#27272a", color:"#52525b", fontSize:10,
                fontWeight:600, padding:"2px 8px", borderRadius:4 }}>Sin datos Clockify</span>
            )}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <InfStatCard label={`S${n} dedicado`}
              value={totalSn > 0 ? `${totalSn.toFixed(1)}h` : "—"}
              sub={`Sprint ${n} registrado`} color={color} />
            <InfStatCard label={`Asignado S${n}`}
              value={`${(+totalAsig.toFixed(1))}h`}
              sub="estimado backlog" color="#f97316" />
            {avgPct !== null && (
              <InfStatCard label={`Avance S${n}`}
                value={`${avgPct.toFixed(0)}%`} sub="ded. / asignado"
                color={avgPct>=100?"#ef4444":avgPct>=80?"#f59e0b":"#22c55e"} />
            )}
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead>
                <tr style={{ background:"#18181b" }}>
                  <th style={{ ...thStyle, textAlign:"left", width:190 }}>Nombre</th>
                  <th style={{ ...thStyle, textAlign:"center", width:52 }}>Rol</th>
                  <th style={{ ...thStyle, textAlign:"center", width:46 }}>Eq.</th>
                  <th style={{ ...thStyle, textAlign:"right", width:90, color }}>S{n}</th>
                  <th style={{ ...thStyle, textAlign:"right", width:90, color:"#f97316" }}>Asig. S{n}</th>
                  <th style={{ ...thStyle, textAlign:"left", minWidth:100 }}>Avance S{n}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => {
                  const assignedH  = assigned[m.login.toLowerCase()] || 0;
                  const dedicatedH = m.sh[n] || 0;
                  return (
                    <tr key={m.email} style={{ background:i%2===0?"#09090b":"#111113", borderBottom:"1px solid #1c1c1e" }}>
                      <MemberCells m={m} />
                      <td style={{ padding:"8px 10px", textAlign:"right" }}>{fh(dedicatedH, color)}</td>
                      <td style={{ padding:"8px 10px", textAlign:"right", color:assignedH>0?"#f97316":"#3f3f46" }}>
                        {assignedH > 0 ? (+assignedH.toFixed(1))+"h" : "—"}
                      </td>
                      <td style={{ padding:"8px 10px" }}>
                        <AvanceCell dedicatedH={dedicatedH} assignedH={assignedH} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:"#18181b", borderTop:"2px solid #27272a" }}>
                  <td style={{ padding:"8px 10px", color:"#e2e8f0", fontWeight:700 }}>TOTAL</td>
                  <td colSpan={2} />
                  <td style={{ padding:"8px 10px", textAlign:"right", color, fontWeight:700 }}>
                    {totalSn > 0 ? totalSn.toFixed(1)+"h" : "—"}
                  </td>
                  <td style={{ padding:"8px 10px", textAlign:"right", color:"#f97316", fontWeight:700 }}>
                    {(+totalAsig.toFixed(1))}h
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    // ── Todos los sprints — tabla combinada ─────────────────────
    function TodosSection() {
      const snColors = { 0:"#6366f1", 1:"#818cf8", 2:"#34d399", 3:"#fbbf24" };
      const snLabel  = { 0:"S0", 1:"S1", 2:"S2", 3:"S3" };
      const sprintKeys = [0, 1, 2, 3];
      const totalsByS = Object.fromEntries(
        sprintKeys.map(n => [n, members.reduce((s, m) => s + (n === 0 ? m.dp_h : (m.sh[n] || 0)), 0)])
      );
      return (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ width:4, height:20, borderRadius:2, background:"#6ee7b7" }} />
            <span style={{ color:"#6ee7b7", fontWeight:700, fontSize:13 }}>Todos los sprints</span>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {sprintKeys.map(n => (
              <InfStatCard key={n}
                label={n === 0 ? "S0 — DP" : `S${n} dedicado`}
                value={`${totalsByS[n].toFixed(1)}h`}
                sub={n === 0 ? "Devising a Project" : `Sprint ${n}`}
                color={snColors[n]} />
            ))}
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead>
                <tr style={{ background:"#18181b" }}>
                  <th style={{ ...thStyle, textAlign:"left", width:190 }}>Nombre</th>
                  <th style={{ ...thStyle, textAlign:"center", width:52 }}>Rol</th>
                  <th style={{ ...thStyle, textAlign:"center", width:46 }}>Eq.</th>
                  {sprintKeys.map(n => (
                    <th key={n} style={{ ...thStyle, textAlign:"left", minWidth:110, color:snColors[n] }}>{snLabel[n]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.email} style={{ background:i%2===0?"#09090b":"#111113", borderBottom:"1px solid #1c1c1e" }}>
                    <MemberCells m={m} />
                    <td style={{ padding:"8px 10px" }}>
                      {m.dp_h > 0
                        ? <><div style={{ color:snColors[0], fontWeight:700, marginBottom:2 }}>{m.dp_h.toFixed(1)}h</div><AvanceCell dedicatedH={m.dp_h} assignedH={m.dp_h} /></>
                        : <span style={{ color:"#3f3f46" }}>—</span>}
                    </td>
                    {[1, 2, 3].map(n => {
                      const dedicatedH = m.sh[n] || 0;
                      const assignedH  = (ASSIGNED_PER_SPRINT[n] || {})[m.login.toLowerCase()] || 0;
                      return (
                        <td key={n} style={{ padding:"8px 10px" }}>
                          {dedicatedH > 0 || assignedH > 0 ? (
                            <>
                              <div style={{ color:snColors[n], fontWeight:700, marginBottom:2 }}>{dedicatedH > 0 ? dedicatedH.toFixed(1)+"h" : "—"}</div>
                              {assignedH > 0 && <AvanceCell dedicatedH={dedicatedH} assignedH={assignedH} />}
                            </>
                          ) : <span style={{ color:"#3f3f46" }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:"#18181b", borderTop:"2px solid #27272a" }}>
                  <td style={{ padding:"8px 10px", color:"#e2e8f0", fontWeight:700 }}>TOTAL</td>
                  <td colSpan={2} />
                  {sprintKeys.map(n => (
                    <td key={n} style={{ padding:"8px 10px", color:snColors[n], fontWeight:700 }}>{totalsByS[n].toFixed(1)}h</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        {sprint === -1 && <S0Section />}
        {sprint === 0  && <TodosSection />}
        {sprint > 0   && <SprintSection n={sprint} />}
        {/* Legend */}
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", padding:"4px 0" }}>
          {[["A","#38bdf8"],["B","#34d399"],["C","#f472b6"],["D","#fbbf24"]].map(([t,c])=>(
            <div key={t} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:2, background:c }} />
              <span style={{ color:"#71717a", fontSize:10 }}>Equipo {t}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const viewTabs = [
    { id:"tasks",    label:"📋 Tarea vs Estimado" },
    { id:"users",    label:"👥 Por persona"       },
    { id:"burndown", label:"📈 Burndown"          },
    { id:"alerts",   label:"⚠️ Alertas"           },
    { id:"equipo",   label:"👤 Equipo"            },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

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
            {view==="burndown" && <BurndownView />}
            {view==="alerts"   && <AlertsView />}
            {view==="equipo"   && <EquipoView />}
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
