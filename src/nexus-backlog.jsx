import { useState, useEffect } from "react";
import { AppProvider } from './context/AppContext.jsx';
import BacklogPane from './panes/backlog/BacklogPane.jsx';
import SprintPane from './panes/sprint/SprintPane.jsx';
import GitHubPane from './panes/github/GitHubPane.jsx';
import InformePane from './panes/InformePane.jsx';
import CostesPane from './panes/CostesPane.jsx';
import RisksPane from './panes/risks/RisksPane.jsx';
import InsightsPane from './panes/insights/InsightsPane.jsx';
import RetroPane from './panes/retro/RetroPane.jsx';
import SyncModal from './components/SyncModal.jsx';
import { Tabs } from './components/ui/Tabs.jsx';
import { fetchFromGitHub } from './api/github.js';
import { SPRINTS, _storedLive } from './data.js';

const DEFAULT_SPRINTS = [{ sprint: 1, label: "Sprint 1" }, { sprint: 2, label: "Sprint 2" }, { sprint: 3, label: "Sprint 3" }];
const AVAIL_SPRINTS = SPRINTS.length > 0 ? SPRINTS : DEFAULT_SPRINTS;
const ALL_SPRINT_TABS = [{ sprint: null, label: "Todo" }, ...AVAIL_SPRINTS];

const MAIN_TABS = [
  { id: "project", label: "📋 Backlog" },
  { id: "github",  label: "🐙 GitHub"  },
  { id: "informe", label: "⏱️ Horas"   },
  { id: "cal",     label: "📅 Sprint"  },
  { id: "costes",  label: "💰 Costes"  },
  { id: "risks",   label: "⚠ Riesgos"  },
  { id: "insights", label: "📊 Conclusiones" },
  { id: "retro",    label: "🔄 Retro" },
];

const SPRINT_TABS = ALL_SPRINT_TABS.map(s => ({ id: String(s.sprint), label: s.label }));

function AppContent() {
  const [tab, setTab] = useState("project");
  const [sprintTab, setSprintTab] = useState(AVAIL_SPRINTS[AVAIL_SPRINTS.length - 1].sprint);
  const [lightMode, setLightMode] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncErr, setSyncErr] = useState('');

  async function handleSync() {
    const token = localStorage.getItem('nexus_gh_token');
    if (!token) { setSyncOpen(true); return; }
    setSyncing(true); setSyncErr('');
    try {
      const data = await fetchFromGitHub(token);
      localStorage.setItem('nexus_live_data', JSON.stringify(data));
      localStorage.removeItem('nexus_edits_v1');
      window.location.reload();
    } catch(e) {
      setSyncing(false);
      setSyncErr(e.message);
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", lightMode ? "light" : "dark");
  }, [lightMode]);

  const hasToken = localStorage.getItem('nexus_gh_token');
  const syncBtnClass = `sync-btn ${_storedLive ? 'synced' : ''} ${hasToken ? 'has-config' : ''}`;

  return (
    <div className="app-root">
      <div className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <img src="https://github.com/ispp-g7-nexus.png" alt="NexUS" />
            <div>
              <div className="navbar-brand-title">NexUS — Product Backlog</div>
              <div className="navbar-brand-sub">Grupo 7 · ISPP 25/26</div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <Tabs tabs={MAIN_TABS} active={tab} onChange={setTab} />
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            <div className="sync-group">
              <button onClick={handleSync} disabled={syncing} title={syncErr || undefined} className={syncBtnClass}>
                {syncing ? "⏳ Sincronizando…" : syncErr ? "⚠ Error" : _storedLive ? "🔄 Sincronizado" : "🔄 Sincronizar"}
              </button>
              {hasToken && (
                <button onClick={() => setSyncOpen(true)} title="Configurar token" className="sync-config-btn">⚙</button>
              )}
            </div>
            <button onClick={() => setLightMode(lm => !lm)} className="btn-icon">
              {lightMode ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 16px 32px" }}>
        {tab === "project" && (
          <div>
            <Tabs
              tabs={SPRINT_TABS}
              active={String(sprintTab)}
              onChange={id => setSprintTab(id === "null" ? null : Number(id))}
              variant="green"
              className="mb-4"
            />
            <BacklogPane sprint={sprintTab} />
          </div>
        )}
        {tab === "github" && <GitHubPane />}
        {tab === "informe" && <InformePane />}
        {tab === "cal" && <SprintPane />}
        {tab === "costes" && <CostesPane />}
        {tab === "risks" && <RisksPane />}
        {tab === "insights" && <InsightsPane />}
        {tab === "retro" && <RetroPane />}
      </div>
      {syncOpen && <SyncModal onClose={() => setSyncOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
