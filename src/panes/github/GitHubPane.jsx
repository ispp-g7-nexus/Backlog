import { useState } from 'react';
import { TEAM_MEMBERS } from '../../constants.js';
import { useGitHubStats } from '../../hooks/useGitHubStats.js';
import { useGitHubData } from './hooks/useGitHubData.js';
import { CommitsHeatmap, PRsHeatmap, LinesHeatmap } from './components/HeatmapSection.jsx';
import CommitsPersona from './views/CommitsPersona.jsx';
import CommitsEquipo from './views/CommitsEquipo.jsx';
import PRsPersona from './views/PRsPersona.jsx';
import PRsEquipo from './views/PRsEquipo.jsx';
import LineasPersona from './views/LineasPersona.jsx';
import LineasEquipo from './views/LineasEquipo.jsx';

function InfStatCard({ label, value, sub, color }) {
  return (
    <div style={{ background:"var(--bg2)", border:`1px solid ${color}30`, borderRadius:10, padding:"14px 18px", flex:"1 1 150px", minWidth:130 }}>
      <div style={{ color:"var(--tx4)", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{label}</div>
      <div style={{ color, fontSize:24, fontWeight:800, lineHeight:1.1 }}>{value}</div>
      {sub && <div style={{ color:"var(--tx3)", fontSize:10, marginTop:4 }}>{sub}</div>}
    </div>
  );
}

export default function GitHubPane() {
  const { stats, loading, error, refresh } = useGitHubStats();
  const [ghView, setGhView] = useState("persona");
  const [ghTab, setGhTab] = useState("commits");

  const data = useGitHubData(stats);
  const { totalCommits, totalPRs, totalRevs, totalAdded, activeMembers, hasData, teamAvgMerge, allMergeTimes, memberStats } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ color: "var(--tx0)", fontWeight: 600, fontSize: 15 }}>🐙 GitHub — Insights & Métricas</span>
        {loading
          ? <span style={{ color: "var(--tx4)", fontSize: 10 }}>⏳ actualizando métricas…</span>
          : stats?.fetchedAt && (
            <span style={{ color: "var(--tx4)", fontSize: 10 }}>
              Actualizado {new Date(stats.fetchedAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          )
        }
        <button onClick={refresh} disabled={loading} style={{
          marginLeft: "auto", padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
          cursor: loading ? "default" : "pointer",
          background: loading ? "transparent" : "#6366f115",
          color: loading ? "var(--tx4)" : "#818cf8",
          border: "1px solid " + (loading ? "var(--bdr)" : "#6366f140"),
          transition: "all .15s"
        }}>
          {loading ? "⏳ cargando…" : "↻ Actualizar métricas"}
        </button>
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

        {/* KPI Cards */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <InfStatCard label="Commits totales" value={totalCommits}
            sub={`${memberStats.filter(ms => ms.commits > 0).length}/${TEAM_MEMBERS.length} contribuidores`} color="#818cf8" />
          <InfStatCard label="PRs mergeadas" value={totalPRs}
            sub={`de ${memberStats.reduce((s, ms) => s + ms.pr.total, 0)} PRs totales`} color="#34d399" />
          <InfStatCard label="Code reviews" value={totalRevs}
            sub={`${memberStats.filter(ms => ms.revs > 0).length}/${TEAM_MEMBERS.length} revisores`} color="#f59e0b" />
          <InfStatCard label="Participación" value={`${Math.round(activeMembers / TEAM_MEMBERS.length * 100)}%`}
            sub={`${activeMembers}/${TEAM_MEMBERS.length} miembros activos`}
            color={activeMembers / TEAM_MEMBERS.length >= 0.8 ? "#22c55e" : activeMembers / TEAM_MEMBERS.length >= 0.5 ? "#f59e0b" : "#ef4444"} />
          <InfStatCard label="Líneas añadidas" value={totalAdded.toLocaleString()}
            sub="total proyecto" color="#38bdf8" />
          {teamAvgMerge !== null && (
            <InfStatCard label="Tiempo medio merge" value={`${teamAvgMerge}d`}
              sub={`de ${allMergeTimes.length} PRs con fecha`}
              color={teamAvgMerge <= 1 ? "#22c55e" : teamAvgMerge <= 3 ? "#f59e0b" : "#ef4444"} />
          )}
        </div>

        {/* Sidebar + Content */}
        <div style={{ display:"grid", gridTemplateColumns:"148px 1fr", gap:14, alignItems:"start" }}>

          {/* Left sidebar */}
          <div style={{ display:"flex", flexDirection:"column", gap:3, position:"sticky", top:72 }}>
            {[
              { id:"commits", label:"💻 Commits", color:"#818cf8" },
              { id:"prs", label:"🔀 Pull Requests", color:"#34d399" },
              { id:"lineas", label:"📦 Líneas", color:"#38bdf8" },
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

            {/* Heatmap sections per tab */}
            {ghTab === "commits" && <CommitsHeatmap stats={stats} />}
            {ghTab === "prs" && <PRsHeatmap stats={stats} />}
            {ghTab === "lineas" && <LinesHeatmap stats={stats} />}

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

            {/* Tab × View content */}
            {ghTab === "commits" && ghView === "persona" && <CommitsPersona data={data} stats={stats} />}
            {ghTab === "commits" && ghView === "equipo" && <CommitsEquipo data={data} stats={stats} />}
            {ghTab === "prs" && ghView === "persona" && <PRsPersona data={data} stats={stats} />}
            {ghTab === "prs" && ghView === "equipo" && <PRsEquipo data={data} stats={stats} />}
            {ghTab === "lineas" && ghView === "persona" && <LineasPersona data={data} stats={stats} />}
            {ghTab === "lineas" && ghView === "equipo" && <LineasEquipo data={data} stats={stats} />}

          </div>
        </div>

      </>)}
    </div>
  );
}
