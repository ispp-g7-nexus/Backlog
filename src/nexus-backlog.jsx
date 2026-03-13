import { useState, useEffect } from "react";
import BacklogPane from './panes/BacklogPane.jsx';
import CalendarPane from './panes/CalendarPane.jsx';
import GitHubPane from './panes/GitHubPane.jsx';
import InformePane from './panes/InformePane.jsx';
import CostesPane from './panes/CostesPane.jsx';

export default function App() {
  const [tab, setTab] = useState("github");
  const [sprintTab, setSprintTab] = useState("s2");
  const [lightMode, setLightMode] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", lightMode ? "light" : "dark");
  }, [lightMode]);

  return (
    <div style={{ background: "#09090b", minHeight: "100vh", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        :root{--bg0:#09090b;--bg1:#0c0c10;--bg2:#111113;--bg3:#18181b;--bdr:#27272a;--tx0:#e2e8f0;--tx3:#71717a;--tx4:#52525b}
        :root[data-theme="light"]{--bg0:#f8fafc;--bg1:#f1f5f9;--bg2:#ffffff;--bg3:#f8fafc;--bdr:#e2e8f0;--tx0:#111827;--tx3:#6b7280;--tx4:#9ca3af}
        body{background:var(--bg0);color:var(--tx0)}*{box-sizing:border-box;margin:0;padding:0}
      `}</style>

      <div style={{ background: "var(--bg2)", borderBottom: "1px solid var(--bdr)", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 29, height: 29, borderRadius: 7, background: "#3730a320", border: "1px solid #6366f140", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#818cf8", fontSize: 13 }}>N</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--tx0)", lineHeight: 1.2 }}>NexUS — Product Backlog</div>
              <div style={{ fontSize: 10, color: "var(--tx4)" }}>Grupo 7 · ISPP 25/26</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 3, background: "var(--bg0)", border: "1px solid var(--bdr)", borderRadius: 9, padding: 3 }}>
            {["github", "project", "informe", "cal", "costes"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "5px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: tab === t ? "#6366f120" : "transparent",
                color: tab === t ? "#818cf8" : "var(--tx3)",
                border: tab === t ? "1px solid #6366f145" : "1px solid transparent",
                transition: "all .12s"
              }}>
                {t === "github" && "🐙 GitHub"}
                {t === "project" && "📋 Project"}
                {t === "informe" && "⏱️ Clockify"}
                {t === "cal" && "📅 Calendar"}
                {t === "costes" && "💰 Costs"}
              </button>
            ))}
          </div>

          <button onClick={() => setLightMode(lm => !lm)} style={{
            marginLeft: "auto",
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

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 16px 32px" }}>
        {tab === "project" && (
          <div>
            <div style={{ display: "flex", gap: 3, background: "var(--bg0)", border: "1px solid var(--bdr)", borderRadius: 9, padding: 3, marginBottom: 16, width: "fit-content" }}>
              {["s1", "s2", "s3"].map(s => (
                <button key={s} onClick={() => setSprintTab(s)} style={{
                  padding: "5px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: sprintTab === s ? "#34d39920" : "transparent",
                  color: sprintTab === s ? "#34d399" : "var(--tx3)",
                  border: sprintTab === s ? "1px solid #34d39945" : "1px solid transparent"
                }}>Sprint {s.slice(1)}</button>
              ))}
            </div>
            {sprintTab === "s1" && <BacklogPane sprint={1} />}
            {sprintTab === "s2" && <BacklogPane sprint={2} />}
            {sprintTab === "s3" && <BacklogPane sprint={3} />}
          </div>
        )}
        {tab === "github" && <GitHubPane />}
        {tab === "informe" && <InformePane />}
        {tab === "cal" && <CalendarPane />}
        {tab === "costes" && <CostesPane />}
      </div>
    </div>
  );
}
