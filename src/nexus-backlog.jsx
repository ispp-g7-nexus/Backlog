import { useState, useMemo, Fragment, useEffect, lazy, Suspense } from "react";
import clockifyRaw   from '../data/clockify-entries.json';
import { saveClockify, loadClockify, getGitHubStats, saveGitHubStats, getGitHubToken, saveGitHubToken, getLiveData, saveLiveData } from './lib/cache.js';
import { normDate } from './lib/utils.js';
import { calcPEM, calcBudget } from './lib/costes.js';
import { StatCard } from './components/StatCard.jsx';
import { ProgressBar } from './components/ProgressBar.jsx';
import { BACKLOG, rawData } from './data.js';
import { MOSCOW_META, STATUS_META, SIZE_META, SC, AREA_COLORS, TABS, SIZE_H_MAP } from './constants.js';
import { fetchFromGitHub } from './api/github.js';
const BacklogPane = lazy(() => import('./panes/BacklogPane.jsx'));
const CalendarPane = lazy(() => import('./panes/CalendarPane.jsx'));
const GitHubPane = lazy(() => import('./panes/GitHubPane.jsx'));
const InformePane = lazy(() => import('./panes/InformePane.jsx'));
const CostesPane = lazy(() => import('./panes/CostesPane.jsx'));

// GitHub sync function moved to api/github.js

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
        {getLiveData() && (
          <div style={{ marginTop:12, fontSize:10, color:"var(--bdr2)", textAlign:"center" }}>
            Último sync: {new Date(getLiveData().fetchedAt).toLocaleString("es-ES")} · {getLiveData().total} HU
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

// BACKLOG, MOSCOW_META, STATUS_META, SIZE_META, SC, AREA_COLORS, TABS moved to constants.js, data.js

// ── LAZY LOADING FALLBACK ─────────────────────────────────────
function PaneLoader() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"200px", color:"var(--tx3)" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:12, marginBottom:8 }}>⏳ Cargando pane…</div>
        <div style={{ width:20, height:20, border:"2px solid var(--bdr)", borderTopColor:"#818cf8", borderRadius:"50%", margin:"0 auto", animation:"spin 1s linear infinite" }} />
      </div>
    </div>
  );
}

// ── GRAPH DATA ────────────────────────────────────────────────
const NW = 128, NH = 46;
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
// BacklogPane moved to panes/BacklogPane.jsx

// ── CALENDAR PANE ─────────────────────────────────────────────
// CalendarPane moved to panes/CalendarPane.jsx



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

// normDate moved to lib/utils.js

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


// ── COSTES PANE ───────────────────────────────────────────────
// SIZE_H_MAP moved to constants.js
const sprintH = (() => {
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

// CostesPane moved to panes/CostesPane.jsx


export default function App() {
  const [tab,       setTab]       = useState("github");
  const [showSync,  setShowSync]  = useState(false);
  const [sprintTab, setSprintTab] = useState("s1");
  const [lightMode, setLightMode] = useState(false);
  const isLive = getLiveData() && getLiveData().fetchedAt > rawData.fetchedAt;
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", lightMode ? "light" : "dark");
  }, [lightMode]);
  return (
    <>
    <style>{`
      :root{--bg0:#09090b;--bg1:#0c0c10;--bg2:#111113;--bg3:#18181b;--bg4:#1c1c1f;--bdr:#27272a;--bdr2:#3f3f46;--tx0:#e2e8f0;--tx1:#cbd5e1;--tx2:#94a3b8;--tx3:#71717a;--tx4:#52525b;--cal-day:#0f0f18;--st-ready-bg:#1e3a8a;--st-ready-tx:#93c5fd;--st-prog-bg:#064e3b;--st-prog-tx:#6ee7b7;--st-rev-bg:#4c1d95;--st-rev-tx:#c4b5fd;--st-done-bg:#052e16;--st-done-tx:#34d399;--sz-xs-bg:#4c1d95;--sz-xs-tx:#e9d5ff;--sz-s-bg:#064e3b;--sz-s-tx:#6ee7b7;--sz-m-bg:#1e3a8a;--sz-m-tx:#93c5fd;--sz-l-bg:#7c2d12;--sz-l-tx:#fdba74;--sz-xl-bg:#881337;--sz-xl-tx:#fda4af;}
      :root[data-theme="light"]{--bg0:#f8fafc;--bg1:#f1f5f9;--bg2:#ffffff;--bg3:#f8fafc;--bg4:#f1f5f9;--bdr:#e2e8f0;--bdr2:#cbd5e1;--tx0:#111827;--tx1:#1f2937;--tx2:#4b5563;--tx3:#6b7280;--tx4:#9ca3af;--cal-day:#eef2ff;--st-ready-bg:#dbeafe;--st-ready-tx:#1d4ed8;--st-prog-bg:#d1fae5;--st-prog-tx:#065f46;--st-rev-bg:#ede9fe;--st-rev-tx:#6d28d9;--st-done-bg:#dcfce7;--st-done-tx:#15803d;--sz-xs-bg:#ede9fe;--sz-xs-tx:#6d28d9;--sz-s-bg:#d1fae5;--sz-s-tx:#065f46;--sz-m-bg:#dbeafe;--sz-m-tx:#1d4ed8;--sz-l-bg:#ffedd5;--sz-l-tx:#c2410c;--sz-xl-bg:#ffe4e6;--sz-xl-tx:#be123c;}
      @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
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
            <Suspense fallback={<PaneLoader />}>
              {sprintTab === "s1" && <BacklogPane sprint={1} />}
              {sprintTab === "s2" && <BacklogPane sprint={2} />}
              {sprintTab === "s3" && <BacklogPane sprint={3} />}
            </Suspense>
          </div>
        )}
        {tab === "cal" && <Suspense fallback={<PaneLoader />}><CalendarPane /></Suspense>}
        {tab === "github" && <Suspense fallback={<PaneLoader />}><GitHubPane /></Suspense>}
        {tab === "costes" && <Suspense fallback={<PaneLoader />}><CostesPane /></Suspense>}
        {tab === "informe" && <Suspense fallback={<PaneLoader />}><InformePane /></Suspense>}
      </div>
    </div>
    </>
  );
}
