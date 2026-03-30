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
import SettingsPane from './panes/settings/SettingsPane.jsx';
import TeamPane from './panes/team/TeamPane.jsx';
import SyncModal from './components/SyncModal.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { Tabs } from './components/ui/Tabs.jsx';
import SprintSelector from './components/SprintSelector.jsx';
import { fetchFromGitHub } from './api/github.js';
import { syncProject } from './api/backend.js';
import { _storedLive } from './data.js';
import { CACHE_KEYS } from './lib/cache.js';
import { useApp } from './context/AppContext.jsx';

const MAIN_TABS = [
  { id: "project", label: "📋 Backlog" },
  { id: "github",  label: "🐙 GitHub"  },
  { id: "equipo",  label: "👥 Equipo"  },
  { id: "informe", label: "⏱️ Horas"   },
  { id: "cal",     label: "📅 Sprint"  },
  { id: "costes",  label: "💰 Costes"  },
  { id: "risks",   label: "⚠️ Riesgos"  },
  { id: "insights", label: "📊 Conclusiones" },
  { id: "retro",    label: "🔄 Retro" },
  { id: "settings", label: "⚙️ Config" },
];

function AppContent() {
  const { user, project, activeSprint, setActiveSprint } = useApp();
  const [tab, setTab] = useState("project");
  const [lightMode, setLightMode] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncErr, setSyncErr] = useState('');

  async function handleSync() {
    setSyncing(true); setSyncErr('');
    try {
      let data;
      if (project?.id) {
        // Backend proxy — token almacenado cifrado en servidor
        data = await syncProject(project.id);
      } else {
        // Fallback: PAT directo desde el navegador
        const token = localStorage.getItem(CACHE_KEYS.GH_TOKEN);
        if (!token) { setSyncing(false); setSyncOpen(true); return; }
        data = await fetchFromGitHub(token);
      }
      localStorage.setItem(CACHE_KEYS.LIVE_DATA, JSON.stringify(data));
      localStorage.removeItem(CACHE_KEYS.EDITS);
      window.location.reload();
    } catch(e) {
      setSyncing(false);
      setSyncErr(e.message);
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", lightMode ? "light" : "dark");
  }, [lightMode]);

  const hasToken = localStorage.getItem(CACHE_KEYS.GH_TOKEN);
  const syncBtnClass = `sync-btn ${_storedLive ? 'synced' : ''} ${hasToken ? 'has-config' : ''}`;

  return (
    <div className="app-root">
      <nav className="navbar" role="navigation" aria-label="Navegación principal">
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
                <button onClick={() => setSyncOpen(true)} title="Configurar token" aria-label="Configurar token de GitHub" className="sync-config-btn">⚙</button>
              )}
            </div>
            <button onClick={() => setLightMode(lm => !lm)} className="btn-icon" aria-label={lightMode ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}>
              {lightMode ? "🌙" : "☀️"}
            </button>
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", background: "var(--bg2)", border: "1px solid var(--bdr)", borderRadius: 20 }}>
                {user.avatar_url && <img src={user.avatar_url} alt={user.login} style={{ width: 20, height: 20, borderRadius: "50%" }} />}
                <span style={{ color: "var(--tx2)", fontSize: 11, fontWeight: 600 }}>{user.login}</span>
                <button onClick={() => { localStorage.removeItem(CACHE_KEYS.JWT); window.location.reload(); }}
                  style={{ background: "none", border: "none", color: "var(--tx4)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2 }} title="Cerrar sesión" aria-label="Cerrar sesión">×</button>
              </div>
            ) : (
              <button onClick={() => {
                const apiUrl = localStorage.getItem(CACHE_KEYS.API_URL);
                if (apiUrl) window.location.href = apiUrl.replace(/\/api\/?$/, '') + '/auth/github';
                else setTab("settings");
              }} style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: "#6366f115", border: "1px solid #6366f140", color: "#818cf8" }}>
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 16px 32px" }}>
        {["project", "github", "informe", "cal", "costes", "risks", "insights"].includes(tab) && (
          <div className="card mb-3" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SprintSelector value={activeSprint} onChange={setActiveSprint} />
          </div>
        )}
        <ErrorBoundary key={tab}>
          {tab === "project" && <BacklogPane sprint={activeSprint} />}
          {tab === "github" && <GitHubPane />}
          {tab === "equipo" && <TeamPane />}
          {tab === "informe" && <InformePane />}
          {tab === "cal" && <SprintPane />}
          {tab === "costes" && <CostesPane />}
          {tab === "risks" && <RisksPane />}
          {tab === "insights" && <InsightsPane />}
          {tab === "retro" && <RetroPane />}
          {tab === "settings" && <SettingsPane />}
        </ErrorBoundary>
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
