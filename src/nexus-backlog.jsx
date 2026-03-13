import { useState, useEffect } from "react";
import BacklogPane from './panes/BacklogPane.jsx';
import CalendarPane from './panes/CalendarPane.jsx';
import GitHubPane from './panes/GitHubPane.jsx';
import InformePane from './panes/InformePane.jsx';
import CostesPane from './panes/CostesPane.jsx';
import SyncModal from './components/SyncModal.jsx';
import { fetchFromGitHub } from './api/github.js';
import { SPRINTS, _storedLive } from './data.js';

const DEFAULT_SPRINTS = [{ sprint: 1, label: "Sprint 1" }, { sprint: 2, label: "Sprint 2" }, { sprint: 3, label: "Sprint 3" }];
const AVAIL_SPRINTS = SPRINTS.length > 0 ? SPRINTS : DEFAULT_SPRINTS;
const ALL_SPRINT_TABS = [{ sprint: null, label: "Todo" }, ...AVAIL_SPRINTS];

export default function App() {
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

  return (
    <div style={{ background: "var(--bg0)", minHeight: "100vh", color: "var(--tx0)", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        :root{--bg0:#09090b;--bg1:#0c0c10;--bg2:#111113;--bg3:#18181b;--bdr:#27272a;--tx0:#e2e8f0;--tx3:#71717a;--tx4:#52525b;
          --bdg-backlog-bg:#27272a;--bdg-backlog-tx:#71717a;
          --bdg-ready-bg:#0c2d4a;--bdg-ready-tx:#38bdf8;
          --bdg-prog-bg:#3b1f00;--bdg-prog-tx:#fbbf24;
          --bdg-rev-bg:#2a1052;--bdg-rev-tx:#c4b5fd;
          --bdg-done-bg:#052e16;--bdg-done-tx:#34d399;
          --bdg-xs-bg:#1c1c1e;--bdg-xs-tx:#9ca3af;
          --bdg-s-bg:#0f2235;--bdg-s-tx:#60a5fa;
          --bdg-m-bg:#172554;--bdg-m-tx:#93c5fd;
          --bdg-l-bg:#2d1b69;--bdg-l-tx:#a78bfa;
          --bdg-xl-bg:#3b0764;--bdg-xl-tx:#c084fc}
        :root[data-theme="light"]{--bg0:#f8fafc;--bg1:#f1f5f9;--bg2:#ffffff;--bg3:#f8fafc;--bdr:#e2e8f0;--tx0:#111827;--tx3:#6b7280;--tx4:#9ca3af;
          --bdg-backlog-bg:#f4f4f5;--bdg-backlog-tx:#71717a;
          --bdg-ready-bg:#e0f2fe;--bdg-ready-tx:#0284c7;
          --bdg-prog-bg:#fef3c7;--bdg-prog-tx:#b45309;
          --bdg-rev-bg:#ede9fe;--bdg-rev-tx:#7c3aed;
          --bdg-done-bg:#dcfce7;--bdg-done-tx:#059669;
          --bdg-xs-bg:#f4f4f5;--bdg-xs-tx:#6b7280;
          --bdg-s-bg:#dbeafe;--bdg-s-tx:#1d4ed8;
          --bdg-m-bg:#dbeafe;--bdg-m-tx:#1e40af;
          --bdg-l-bg:#ede9fe;--bdg-l-tx:#6d28d9;
          --bdg-xl-bg:#f3e8ff;--bdg-xl-tx:#7e22ce}
        body{background:var(--bg0);color:var(--tx0)}*{box-sizing:border-box;margin:0;padding:0}
      `}</style>

      <div style={{ background: "var(--bg2)", borderBottom: "1px solid var(--bdr)", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <img src="https://github.com/ispp-g7-nexus.png" alt="NexUS" style={{ width: 29, height: 29, borderRadius: 7, border: "1px solid #6366f140", display: "block" }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--tx0)", lineHeight: 1.2 }}>NexUS — Product Backlog</div>
              <div style={{ fontSize: 10, color: "var(--tx4)" }}>Grupo 7 · ISPP 25/26</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 3, background: "var(--bg0)", border: "1px solid var(--bdr)", borderRadius: 9, padding: 3 }}>
            {[
              { id: "project", label: "📋 Backlog" },
              { id: "github",  label: "🐙 GitHub"  },
              { id: "informe", label: "⏱️ Horas"   },
              { id: "cal",     label: "📅 Sprint"  },
              { id: "costes",  label: "💰 Costes"  },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: "5px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: tab === id ? "#6366f120" : "transparent",
                color: tab === id ? "#818cf8" : "var(--tx3)",
                border: tab === id ? "1px solid #6366f145" : "1px solid transparent",
                transition: "all .12s"
              }}>{label}</button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:0 }}>
              <button onClick={handleSync} disabled={syncing} title={syncErr || undefined} style={{
                padding: "5px 12px",
                borderRadius: localStorage.getItem('nexus_gh_token') ? "7px 0 0 7px" : 7,
                fontSize: 11,
                fontWeight: 600,
                cursor: syncing ? "default" : "pointer",
                background: syncing ? "#6366f130" : (_storedLive ? "#6366f115" : "transparent"),
                border: "1px solid " + (syncErr ? "#f8717180" : _storedLive ? "#6366f140" : "var(--bdr)"),
                borderRight: localStorage.getItem('nexus_gh_token') ? "none" : undefined,
                color: syncErr ? "#f87171" : syncing ? "#818cf8" : _storedLive ? "#818cf8" : "var(--tx3)",
                transition: "all .15s"
              }}>
                {syncing ? "⏳ Sincronizando…" : syncErr ? "⚠ Error" : _storedLive ? "🔄 Sincronizado" : "🔄 Sincronizar"}
              </button>
              {localStorage.getItem('nexus_gh_token') && (
                <button onClick={() => setSyncOpen(true)} title="Configurar token" style={{
                  padding: "5px 7px",
                  borderRadius: "0 7px 7px 0",
                  fontSize: 11,
                  cursor: "pointer",
                  background: "transparent",
                  border: "1px solid " + (_storedLive ? "#6366f140" : "var(--bdr)"),
                  color: "var(--tx4)",
                  transition: "all .15s"
                }}>⚙</button>
              )}
            </div>
            <button onClick={() => setLightMode(lm => !lm)} style={{
              padding: "5px 10px",
              borderRadius: 7,
              fontSize: 14,
              cursor: "pointer",
              background: "transparent",
              border: "1px solid var(--bdr)",
              color: "var(--tx3)",
              transition: "all .15s"
            }}>
              {lightMode ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 16px 32px" }}>
        {tab === "project" && (
          <div>
            <div style={{ display: "flex", gap: 3, background: "var(--bg0)", border: "1px solid var(--bdr)", borderRadius: 9, padding: 3, marginBottom: 16, width: "fit-content" }}>
              {ALL_SPRINT_TABS.map(({ sprint, label }) => (
                <button key={String(sprint)} onClick={() => setSprintTab(sprint)} style={{
                  padding: "5px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: sprintTab === sprint ? "#34d39920" : "transparent",
                  color: sprintTab === sprint ? "#34d399" : "var(--tx3)",
                  border: sprintTab === sprint ? "1px solid #34d39945" : "1px solid transparent"
                }}>{label}</button>
              ))}
            </div>
            <BacklogPane sprint={sprintTab} />
          </div>
        )}
        {tab === "github" && <GitHubPane />}
        {tab === "informe" && <InformePane />}
        {tab === "cal" && <CalendarPane />}
        {tab === "costes" && <CostesPane />}
      </div>
      {syncOpen && <SyncModal onClose={() => setSyncOpen(false)} />}
    </div>
  );
}
