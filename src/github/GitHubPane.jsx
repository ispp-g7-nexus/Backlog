import { useState, useEffect } from "react";
import { SC } from '../constants.js';
import { TEAM_MEMBERS } from '../team.js';
import { fetchGitHubStats, GH_STATS_KEY } from './fetch.js';
import InfStatCard from '../components/InfStatCard.jsx';

export default function GitHubPane() {
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
    const wp      = stats?.weeklyPRs?.[ll]    || [];
    // Custom metrics
    const collabScore   = Math.min(Math.round(revs / (commits + 1) * 50), 100);
    const prEfficiency  = pr.total > 0 ? Math.round(pr.merged / pr.total * 100) : null;
    const codeImpact    = lns.added + lns.deleted;
    const codeChurn     = codeImpact > 0 ? Math.round(lns.deleted / codeImpact * 100) : null;
    const avgPRSize     = pr.merged > 0 ? Math.round((pr.additions + pr.deletions) / pr.merged) : null;
    return { m, commits, pr, revs, lns, cons, amt, wc, wp, collabScore, prEfficiency, codeImpact, codeChurn, avgPRSize };
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
          <span style={{ color: "#94a3b8", fontSize: 8.5, width: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
            {ms.m.name.split(" ")[0]}
          </span>
          <div style={{ flex: 1, height: 6, background: "#27272a", borderRadius: 3, overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: `${mv > 0 ? v / mv * 100 : 0}%`, background: TC[ms.m.team], borderRadius: 3 }} />
            {avgPct !== null && <div style={{ position:"absolute", top:0, bottom:0, left:`${avgPct}%`, width:1, background:"#94a3b8", opacity:0.6 }}/>}
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
            <span style={{ color:"#52525b", fontSize:10 }}>
              {ghTab === "commits"
                ? `${tt.commits} commits`
                : `${tt.commits} commits · ${tt.prs} PRs · ${tt.reviews} reviews · +${(tt.added/1000).toFixed(1)}k líneas`}
            </span>
            <div style={{ flex:1, height:1, background:"#27272a" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {rows.map(({ m, commits, pr, revs, lns, cons, amt, collabScore, prEfficiency }) => (
              <div key={m.login} style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"10px 14px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:160 }}>
                    <img src={`https://github.com/${m.login}.png?size=36`} alt={m.name}
                      style={{ width:32, height:32, borderRadius:"50%", border:`2px solid ${tc}50`, flexShrink:0 }} />
                    <div>
                      <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:12 }}>{m.name}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <a href={`https://github.com/${m.login}`} target="_blank" rel="noreferrer"
                          style={{ display:"inline-flex", alignItems:"center", gap:3, color:"#52525b", fontSize:9, textDecoration:"none" }}>
                          <svg viewBox="0 0 16 16" width={10} height={10} fill="#52525b">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                          </svg>
                          @{m.login}
                        </a>
                        <span style={{ color:"#3f3f46", fontSize:9 }}>· {m.role}{m.coord?" · Coord":""}</span>
                      </div>
                    </div>
                  </div>
                  {ghTab === "commits" ? (
                    <div style={{ display:"flex", gap:16, flex:1, flexWrap:"wrap", alignItems:"center" }}>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ color:"#818cf8", fontWeight:800, fontSize:20, lineHeight:1.1 }}>{commits}</div>
                        <div style={{ color:"#52525b", fontSize:8, textTransform:"uppercase", letterSpacing:1 }}>Commits</div>
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
                            {value}{sub && <span style={{ color:"#52525b", fontSize:10, fontWeight:400 }}>{sub}</span>}
                          </div>
                          <div style={{ color:"#52525b", fontSize:8, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {ghTab !== "commits" && (
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                      {cons!==null && <span title={`${cons}% semanas con ≥1 commit`} style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:cons>=50?"#38bdf820":"#27272a", color:cons>=70?"#38bdf8":cons>=40?"#94a3b8":"#52525b", border:`1px solid ${cons>=50?"#38bdf840":"#3f3f46"}` }}>📅 {cons}%</span>}
                      <span title="Score colaboración" style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:collabScore>=60?"#a855f720":"#27272a", color:collabScore>=60?"#a855f7":collabScore>=30?"#94a3b8":"#52525b", border:`1px solid ${collabScore>=60?"#a855f740":"#3f3f46"}` }}>🤝 {collabScore}</span>
                      {prEfficiency!==null && <span title={`${prEfficiency}% PRs mergeadas`} style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:prEfficiency>=70?"#34d39920":"#27272a", color:prEfficiency>=70?"#34d399":"#94a3b8", border:`1px solid ${prEfficiency>=70?"#34d39940":"#3f3f46"}` }}>🔀 {prEfficiency}%</span>}
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
                          <span style={{ color:"#52525b", fontSize:7.5, textTransform:"uppercase", letterSpacing:0.8 }}>Commits</span>
                          <span style={{ color:"#818cf8", fontSize:7.5, fontWeight:700 }}>{commits}</span>
                        </div>
                        <div style={{ height:4, background:"#27272a", borderRadius:2, overflow:"hidden", position:"relative" }}>
                          <div style={{ height:"100%", width:`${maxCommits>0?commits/maxCommits*100:0}%`, background:"#818cf8", borderRadius:2 }} />
                          {globalAvg > 0 && <div title={`Media global: ${Math.round(globalAvg)}`} style={{ position:"absolute", top:0, bottom:0, left:`${maxCommits>0?globalAvg/maxCommits*100:0}%`, width:1, background:"#94a3b8", opacity:0.7 }}/>}
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
                        <span style={{ color:"#52525b", fontSize:7.5, textTransform:"uppercase", letterSpacing:0.8 }}>{label}</span>
                        <span style={{ color:col, fontSize:7.5, fontWeight:700 }}>{val>999?`${(val/1000).toFixed(1)}k`:val}</span>
                      </div>
                      <div style={{ height:3, background:"#27272a", borderRadius:2, overflow:"hidden" }}>
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
        <span style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 15 }}>🐙 GitHub — Insights & Métricas</span>
        {loading
          ? <span style={{ color: "#52525b", fontSize: 10 }}>⏳ actualizando métricas…</span>
          : stats?.fetchedAt && (
            <span style={{ color: "#52525b", fontSize: 10 }}>
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
        <div style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 10, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🐙</div>
          <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>No hay datos de GitHub cargados</div>
          <div style={{ color: "#52525b", fontSize: 11, marginTop: 4 }}>Sincroniza el backlog con tu token y pulsa «Actualizar métricas»</div>
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
                    border: active ? `1px solid ${t.color}45` : "1px solid #27272a",
                    background: active ? `${t.color}15` : "#111113",
                    color: active ? t.color : "#71717a", transition:"all .12s" }}>
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
                  <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ color:"#94a3b8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>📈 Actividad — últimas 52 semanas</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {DAYS.map((d,i)=><text key={d} x={14} y={20+i*step+cellSize/2} textAnchor="middle" fontSize={5} fill="#52525b">{d}</text>)}
                      {weeks.map((w,wi)=>w.days.map((count,di)=>(
                        <rect key={`${wi}-${di}`} x={22+wi*step} y={16+di*step} width={cellSize} height={cellSize} rx={2} fill={col(count)} opacity={0.95}>
                          <title>{`Sem ${wi+1}, ${DAYS[di]}: ${count} commits`}</title>
                        </rect>
                      )))}
                      {[0,4,8,13,17,21,26,30,34,39,43,47].map((wi,mi)=>{
                        const months=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                        return <text key={mi} x={22+wi*step+cellSize/2} y={11} textAnchor="middle" fontSize={4.5} fill="#3f3f46">{months[mi]}</text>;
                      })}
                    </svg>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
                      <span style={{ color:"#52525b", fontSize:8 }}>Menos</span>
                      {["#1a1a2e","#1e3a5f","#2563eb","#3b82f6","#93c5fd"].map(c=><span key={c} style={{ width:8, height:8, borderRadius:1, background:c, display:"inline-block" }}/>)}
                      <span style={{ color:"#52525b", fontSize:8 }}>Más</span>
                    </div>
                  </div>
                );
              })()}
              {Array.isArray(stats?.punchCard) && stats.punchCard.length > 0 && (() => {
                const data=stats.punchCard, maxV=Math.max(...data.map(([,,c])=>c),1);
                const DAYS=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"], cellW=20,cellH=18,padL=30,padT=20;
                const W=padL+24*cellW+10, H=padT+7*cellH+10;
                return (
                  <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ color:"#94a3b8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>⏰ Patrón temporal — commits por hora y día</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {DAYS.map((d,i)=><text key={d} x={padL-3} y={padT+i*cellH+cellH/2+1.5} textAnchor="end" fontSize={5} fill="#52525b">{d}</text>)}
                      {Array.from({length:24},(_,h)=><text key={h} x={padL+h*cellW+cellW/2} y={padT-3} textAnchor="middle" fontSize={4.5} fill="#52525b">{h%3===0?`${h}h`:""}</text>)}
                      {data.map(([day,hour,count])=>{
                        const r=count>0?Math.sqrt(count/maxV)*(cellH/2-1.5):0;
                        const cx=padL+hour*cellW+cellW/2, cy=padT+day*cellH+cellH/2;
                        const c=day===0||day===6?"#f59e0b":"#818cf8";
                        return r>0?<circle key={`${day}-${hour}`} cx={cx} cy={cy} r={r} fill={c} opacity={0.7}><title>{`${DAYS[day]} ${hour}:00 — ${count} commits`}</title></circle>:<rect key={`${day}-${hour}`} x={cx-1} y={cy-1} width={2} height={2} fill="#1f2937"/>;
                      })}
                    </svg>
                    <div style={{ display:"flex", gap:12, marginTop:4 }}>
                      <span style={{ fontSize:8.5, color:"#52525b" }}><span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:"#818cf8", marginRight:3 }}/>Días laborables</span>
                      <span style={{ fontSize:8.5, color:"#52525b" }}><span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:"#f59e0b", marginRight:3 }}/>Fines de semana</span>
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
                const color = pct === null ? "#94a3b8" : pct > 10 ? "#22c55e" : pct < -10 ? "#ef4444" : "#f59e0b";
                const w8    = acts.slice(-8);
                const mx    = Math.max(...w8.map(w => w.total), 1);
                return (
                  <div style={{ background:"#111113", border:`1px solid ${color}25`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>📈 Tendencia — últimas 4 semanas</div>
                      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                        <span style={{ color, fontSize:24, fontWeight:800, lineHeight:1 }}>{pct !== null ? `${up?"+":""}${pct}%` : "—"}</span>
                        <span style={{ color, fontSize:16 }}>{pct !== null ? (up ? "↑" : "↓") : ""}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:20, alignItems:"center" }}>
                      <div>
                        <div style={{ color:"#52525b", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ult. 4 sem</div>
                        <div style={{ color:"#e2e8f0", fontWeight:800, fontSize:15 }}>{last4}</div>
                      </div>
                      <div style={{ width:1, height:28, background:"#27272a" }}/>
                      <div>
                        <div style={{ color:"#52525b", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ant. 4 sem</div>
                        <div style={{ color:"#52525b", fontWeight:700, fontSize:15 }}>{prev4}</div>
                      </div>
                    </div>
                    <svg viewBox="0 0 88 28" style={{ width:88, height:28, flexShrink:0 }}>
                      {w8.map((w, i) => {
                        const bh = (w.total / mx) * 24;
                        const bx = i * 11;
                        return <rect key={i} x={bx} y={28 - bh} width={9} height={bh} rx={1.5}
                          fill={i >= 4 ? color : "#27272a"} opacity={i >= 4 ? 0.9 : 0.6}/>;
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
                  <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ color:"#94a3b8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
                      📊 Actividad PRs — últimas 52 semanas
                      {!stats?.prActivity && <span style={{color:"#52525b",fontWeight:400,marginLeft:8,fontSize:8}}>(pulsa Actualizar para ver datos)</span>}
                    </div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {DAYS.map((d,i)=><text key={d} x={14} y={20+i*step+cellS/2} textAnchor="middle" fontSize={5} fill="#52525b">{d}</text>)}
                      {mnLbls.map(({wi,m})=><text key={m} x={22+wi*step+cellS/2} y={11} textAnchor="middle" fontSize={4.5} fill="#3f3f46">{MN[m]}</text>)}
                      {weeks.map((w,wi)=>w.days.map((count,di)=>(
                        <rect key={`${wi}-${di}`} x={22+wi*step} y={16+di*step} width={cellS} height={cellS} rx={2} fill={col(count)} opacity={0.95}>
                          <title>{`Sem ${wi+1}, ${DAYS[di]}: ${count} PRs`}</title>
                        </rect>
                      )))}
                    </svg>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
                      <span style={{ color:"#52525b", fontSize:8 }}>Menos</span>
                      {["#1a1a2e","#1e3a5f","#6d28d9","#7c3aed","#a78bfa"].map(c=><span key={c} style={{ width:8,height:8,borderRadius:1,background:c,display:"inline-block" }}/>)}
                      <span style={{ color:"#52525b", fontSize:8 }}>Más</span>
                    </div>
                  </div>
                );
              })()}
              {Array.isArray(stats?.prPunch) && stats.prPunch.some(([,,c])=>c>0) && (() => {
                const data=stats.prPunch, maxV=Math.max(...data.map(([,,c])=>c),1);
                const DAYS=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"], cellW=20,cellH=18,padL=30,padT=20;
                const W=padL+24*cellW+10, H=padT+7*cellH+10;
                return (
                  <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ color:"#94a3b8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>⏰ Patrón temporal — PRs por hora y día</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {DAYS.map((d,i)=><text key={d} x={padL-3} y={padT+i*cellH+cellH/2+1.5} textAnchor="end" fontSize={5} fill="#52525b">{d}</text>)}
                      {Array.from({length:24},(_,h)=><text key={h} x={padL+h*cellW+cellW/2} y={padT-3} textAnchor="middle" fontSize={4.5} fill="#52525b">{h%3===0?`${h}h`:""}</text>)}
                      {data.map(([day,hour,count])=>{
                        const r=count>0?Math.sqrt(count/maxV)*(cellH/2-1.5):0;
                        const cx=padL+hour*cellW+cellW/2, cy=padT+day*cellH+cellH/2;
                        const c=day===0||day===6?"#f59e0b":"#7c3aed";
                        return r>0?<circle key={`${day}-${hour}`} cx={cx} cy={cy} r={r} fill={c} opacity={0.7}><title>{`${DAYS[day]} ${hour}:00 — ${count} PRs`}</title></circle>:<rect key={`${day}-${hour}`} x={cx-1} y={cy-1} width={2} height={2} fill="#1f2937"/>;
                      })}
                    </svg>
                    <div style={{ display:"flex", gap:12, marginTop:4 }}>
                      <span style={{ fontSize:8.5, color:"#52525b" }}><span style={{ display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#7c3aed",marginRight:3 }}/>Días laborables</span>
                      <span style={{ fontSize:8.5, color:"#52525b" }}><span style={{ display:"inline-block",width:7,height:7,borderRadius:"50%",background:"#f59e0b",marginRight:3 }}/>Fines de semana</span>
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
                const color=pct===null?"#94a3b8":pct>10?"#22c55e":pct<-10?"#ef4444":"#f59e0b";
                const w8=acts.slice(-8), mx=Math.max(...w8.map(w=>w.total),1);
                return (
                  <div style={{ background:"#111113", border:`1px solid ${color}25`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>📈 Tendencia PRs — últimas 4 semanas</div>
                      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                        <span style={{ color, fontSize:24, fontWeight:800, lineHeight:1 }}>{pct!==null?`${up?"+":""}${pct}%`:"—"}</span>
                        <span style={{ color, fontSize:16 }}>{pct!==null?(up?"↑":"↓"):""}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:20, alignItems:"center" }}>
                      <div><div style={{ color:"#52525b", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ult. 4 sem</div><div style={{ color:"#e2e8f0", fontWeight:800, fontSize:15 }}>{last4}</div></div>
                      <div style={{ width:1, height:28, background:"#27272a" }}/>
                      <div><div style={{ color:"#52525b", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ant. 4 sem</div><div style={{ color:"#52525b", fontWeight:700, fontSize:15 }}>{prev4}</div></div>
                    </div>
                    <svg viewBox="0 0 88 28" style={{ width:88, height:28, flexShrink:0 }}>
                      {w8.map((w,i)=>{ const bh=(w.total/mx)*24; return <rect key={i} x={i*11} y={28-bh} width={9} height={bh} rx={1.5} fill={i>=4?color:"#27272a"} opacity={i>=4?0.9:0.6}/>; })}
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
                  <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ color:"#94a3b8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>{label}</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {mnLbls.map(({wi,m})=><text key={m} x={22+wi*step+cellS/2} y={11} textAnchor="middle" fontSize={4.5} fill="#3f3f46">{MN[m]}</text>)}
                      {vals.map((v,wi)=>(
                        <rect key={wi} x={22+wi*step} y={16} width={cellS} height={cellS} rx={2} fill={col(v)} opacity={0.95}>
                          <title>{titleFmt(v, wks52[wi].ts)}</title>
                        </rect>
                      ))}
                    </svg>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
                      <span style={{ color:"#52525b", fontSize:8 }}>Menos</span>
                      {palette.map(c=><span key={c} style={{ width:8,height:8,borderRadius:1,background:c,display:"inline-block" }}/>)}
                      <span style={{ color:"#52525b", fontSize:8 }}>Más</span>
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
                const color=pct===null?"#94a3b8":pct>10?"#22c55e":pct<-10?"#ef4444":"#f59e0b";
                const w8=acts.slice(-8), mx=Math.max(...w8.map(tot),1);
                const fmt=(n)=>n>=1000?`${(n/1000).toFixed(1)}k`:String(n);
                return (
                  <div style={{ background:"#111113", border:`1px solid ${color}25`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>📈 Tendencia líneas — últimas 4 semanas</div>
                      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                        <span style={{ color, fontSize:24, fontWeight:800, lineHeight:1 }}>{pct!==null?`${up?"+":""}${pct}%`:"—"}</span>
                        <span style={{ color, fontSize:16 }}>{pct!==null?(up?"↑":"↓"):""}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:20, alignItems:"center" }}>
                      <div><div style={{ color:"#52525b", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ult. 4 sem</div><div style={{ color:"#e2e8f0", fontWeight:800, fontSize:15 }}>{fmt(last4)}</div></div>
                      <div style={{ width:1, height:28, background:"#27272a" }}/>
                      <div><div style={{ color:"#52525b", fontSize:8, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Ant. 4 sem</div><div style={{ color:"#52525b", fontWeight:700, fontSize:15 }}>{fmt(prev4)}</div></div>
                    </div>
                    <svg viewBox="0 0 88 28" style={{ width:88, height:28, flexShrink:0 }}>
                      {w8.map((w,i)=>{ const bh=(tot(w)/mx)*24; return <rect key={i} x={i*11} y={28-bh} width={9} height={bh} rx={1.5} fill={i>=4?color:"#27272a"} opacity={i>=4?0.9:0.6}/>; })}
                    </svg>
                  </div>
                );
              })()}
            </>)}

            {/* Persona / Equipo toggle */}
            <div style={{ display:"flex", gap:3, background:"#09090b", border:"1px solid #27272a", borderRadius:9, padding:3, alignSelf:"flex-start" }}>
              {[{ id:"persona", label:"👥 Persona" }, { id:"equipo", label:"👤 Equipo" }].map(vt => {
                const active = ghView === vt.id;
                return (
                  <button key={vt.id} onClick={() => setGhView(vt.id)}
                    style={{ padding:"5px 14px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer",
                      border: active ? "1px solid #94a3b845" : "1px solid transparent",
                      background: active ? "#94a3b820" : "transparent",
                      color: active ? "#94a3b8" : "#71717a", transition:"all .12s" }}>
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
                      { label:"📊 Media / persona",name: null,                                                 val:`${avg}`,                                          color:"#94a3b8" },
                      { label:"🎯 Más regular",    name: mostReg?.ms.m.name.split(" ").slice(0,2).join(" "),  val:`${mostReg?.avg.toFixed(1)} c/sem`,                color:"#22c55e" },
                      { label:"📉 Menos regular",  name: leastReg?.ms.m.name.split(" ").slice(0,2).join(" "), val:`${leastReg?.avg.toFixed(1)} c/sem`,               color:"#f97316" },
                    ].map(({ label, name, val, color }) => (
                      <div key={label} style={{ background:"#111113", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>{label}</div>
                        {name && <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:11, marginBottom:2 }}>{name}</div>}
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
                  <div style={{ background:"#111113", border:"1px solid #818cf820", borderRadius:10, padding:"12px 14px 8px" }}>
                    <div style={{ color:"#818cf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📅 Commits por semana</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {[maxW, Math.round(maxW/2), 0].map(v => {
                        const y = yOf(v);
                        return (
                          <g key={v}>
                            <line x1={padL - 2} y1={y} x2={padL} y2={y} stroke="#3f3f46" strokeWidth={0.5}/>
                            <text x={padL - 4} y={y + 1.5} textAnchor="end" fontSize={4} fill="#52525b">{v}</text>
                          </g>
                        );
                      })}
                      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#3f3f46" strokeWidth={0.5}/>
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
                            {lbls[i] && <text x={bx + barW/2} y={H - 2} textAnchor="middle" fontSize={4.5} fill="#52525b">{lbls[i]}</text>}
                          </g>
                        );
                      })}
                      {avgW > 0 && (() => {
                        const ly = yOf(avgW);
                        return (
                          <g>
                            <line x1={padL} y1={ly} x2={W - 2} y2={ly} stroke="#94a3b8" strokeWidth={0.7} strokeDasharray="3,2" opacity={0.5}/>
                            <text x={W - 3} y={ly - 2} textAnchor="end" fontSize={4} fill="#94a3b8" opacity={0.7}>ø {Math.round(avgW)}</text>
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                );
              })()}
              {/* Commits bar chart */}
              <div style={{ background:"#111113", border:"1px solid #818cf820", borderRadius:10, padding:"12px 12px 8px" }}>
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
                  <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px" }}>
                    <div style={{ color:"#818cf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>💡 Recomendaciones — Persona</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                      {tips.map(({ sev, icon, title, msg }) => (
                        <div key={title} style={{ background:SB[sev], borderLeft:`3px solid ${SC[sev]}`, borderRadius:6, padding:"8px 12px", display:"flex", gap:9, alignItems:"flex-start" }}>
                          <span style={{ fontSize:12, flexShrink:0, lineHeight:1.5 }}>{icon}</span>
                          <div>
                            <div style={{ color:SC[sev], fontWeight:700, fontSize:9.5, marginBottom:2 }}>{title}</div>
                            <div style={{ color:"#94a3b8", fontSize:9, lineHeight:1.55 }}>{msg}</div>
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
                      { label:"📊 Media / equipo", name: null,                       val:`${avg}`,                            color:"#94a3b8" },
                      { label:"🎯 Más regular",    name:`Equipo ${mostReg?.team}`,  val:`${mostReg?.avg.toFixed(1)} c/sem`,  color:"#22c55e" },
                      { label:"📉 Menos regular",  name:`Equipo ${leastReg?.team}`, val:`${leastReg?.avg.toFixed(1)} c/sem`, color:"#f97316" },
                    ].map(({ label, name, val, color }) => (
                      <div key={label} style={{ background:"#111113", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>{label}</div>
                        {name && <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:11, marginBottom:2 }}>{name}</div>}
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
                  <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"12px 14px 8px" }}>
                    <div style={{ color:"#94a3b8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>📅 Commits por semana — por equipo</div>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
                      {[maxW, Math.round(maxW/2), 0].map(v => {
                        const y = yOf(v);
                        return (
                          <g key={v}>
                            <line x1={padL - 2} y1={y} x2={padL} y2={y} stroke="#3f3f46" strokeWidth={0.5}/>
                            <text x={padL - 4} y={y + 1.5} textAnchor="end" fontSize={4} fill="#52525b">{v}</text>
                          </g>
                        );
                      })}
                      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="#3f3f46" strokeWidth={0.5}/>
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
                            {lbls[i] && <text x={bx + barW/2} y={H - 2} textAnchor="middle" fontSize={4.5} fill="#52525b">{lbls[i]}</text>}
                          </g>
                        );
                      })}
                      {avgW > 0 && (() => {
                        const ly = yOf(avgW);
                        return (
                          <g>
                            <line x1={padL} y1={ly} x2={W - 2} y2={ly} stroke="#94a3b8" strokeWidth={0.7} strokeDasharray="3,2" opacity={0.5}/>
                            <text x={W - 3} y={ly - 2} textAnchor="end" fontSize={4} fill="#94a3b8" opacity={0.7}>ø {Math.round(avgW)}</text>
                          </g>
                        );
                      })()}
                    </svg>
                    <div style={{ display:"flex", gap:12, marginTop:4, flexWrap:"wrap" }}>
                      {teamsArr.map(t => (
                        <div key={t} style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:TC[t] }}/>
                          <span style={{ color:"#71717a", fontSize:9 }}>Equipo {t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Team commits bar */}
              <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"12px 12px 8px" }}>
                <div style={{ color:"#94a3b8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>💻 Commits por equipo</div>
                {teamTotals.map(({ team, color, commits }) => (
                  <div key={team} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
                    <span style={{ color:"#94a3b8", fontSize:9, width:52, flexShrink:0 }}>Equipo {team}</span>
                    <div style={{ flex:1, height:8, background:"#27272a", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${maxTC>0?commits/maxTC*100:0}%`, background:color, borderRadius:3 }}/>
                    </div>
                    <span style={{ color, fontSize:9, fontWeight:700, width:32, textAlign:"right", flexShrink:0 }}>{commits}</span>
                  </div>
                ))}
              </div>
              <MemberCards />
            </>)}

            {/* ── PRs / PERSONA ──────────────────────────────── */}
            {ghTab === "prs" && ghView === "persona" && (<>
              <div style={{ background:"#111113", border:"1px solid #34d39920", borderRadius:10, padding:"12px 12px 8px" }}>
                <div style={{ color:"#34d399", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>🔀 PRs mergeadas</div>
                <HBar sorted={byPRs} getValue={ms=>ms.pr.merged} getLabel={ms=>`${ms.pr.merged}/${ms.pr.total}`} maxVal={maxPRs} color="#34d399" showMax />
              </div>
              <div style={{ background:"#111113", border:"1px solid #f59e0b20", borderRadius:10, padding:"12px 12px 8px" }}>
                <div style={{ color:"#f59e0b", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>👁️ Code reviews</div>
                <HBar sorted={byRevs} getValue={ms=>ms.revs} maxVal={maxRevs} color="#f59e0b" showMax />
              </div>
              {byMerge.length > 0 && (
                <div style={{ background:"#111113", border:"1px solid #22c55e20", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#22c55e", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>⚡ Tiempo medio hasta merge (↓ mejor)</div>
                  <div style={{ color:"#52525b", fontSize:8, marginBottom:8 }}>Días desde la apertura del PR hasta el merge.</div>
                  <HBar sorted={byMerge} getValue={ms=>ms.amt??0} getLabel={ms=>`${ms.amt}d`} maxVal={Math.max(...byMerge.map(ms=>ms.amt),1)} color="#22c55e" showMax />
                </div>
              )}
              {byCollab.length > 0 && (
                <div style={{ background:"#111113", border:"1px solid #a855f720", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#a855f7", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>🤝 Score de colaboración</div>
                  <div style={{ color:"#52525b", fontSize:8, marginBottom:8 }}>Basado en reviews/commits. Refleja cuánto contribuye al equipo más allá de su propio código.</div>
                  <HBar sorted={byCollab} getValue={ms=>ms.collabScore} getLabel={ms=>`${ms.collabScore}`} maxVal={100} color="#a855f7" showMax />
                </div>
              )}
              {byPRSize.length > 0 && (
                <div style={{ background:"#111113", border:"1px solid #f59e0b20", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#f59e0b", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>📏 Tamaño medio de PR (líneas)</div>
                  <div style={{ color:"#52525b", fontSize:8, marginBottom:8 }}>PRs grandes pueden ser difíciles de revisar.</div>
                  <HBar sorted={byPRSize} getValue={ms=>ms.avgPRSize??0} getLabel={ms=>`${ms.avgPRSize}`} maxVal={maxPRSize} color="#f59e0b" showMax />
                </div>
              )}
            </>)}

            {/* ── PRs / EQUIPO ───────────────────────────────── */}
            {ghTab === "prs" && ghView === "equipo" && (<>
              <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px" }}>
                <div style={{ color:"#94a3b8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>📊 Comparativa — PRs y reviews por equipo</div>
                {teamTotals.map(({ team, color, prs, reviews, members, active }) => (
                  <div key={team} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ background:`${color}20`, color, fontWeight:800, fontSize:9, textTransform:"uppercase", letterSpacing:2, padding:"2px 8px", borderRadius:4 }}>Equipo {team}</span>
                      <span style={{ color:"#52525b", fontSize:8.5 }}>{active}/{members} activos</span>
                    </div>
                    {[
                      { label:"PRs merged", val:prs,     max:maxTPR, col:"#34d399" },
                      { label:"Reviews",    val:reviews, max:maxTRV, col:"#f59e0b" },
                    ].map(({ label, val, max, col }) => (
                      <div key={label} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                        <span style={{ color:"#52525b", fontSize:7.5, width:52, flexShrink:0 }}>{label}</span>
                        <div style={{ flex:1, height:5, background:"#27272a", borderRadius:3, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${max>0?val/max*100:0}%`, background:col, borderRadius:3, opacity:0.9 }}/>
                        </div>
                        <span style={{ color:col, fontSize:8.5, fontWeight:700, width:24, textAlign:"right", flexShrink:0 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <MemberCards />
            </>)}

            {/* ── LÍNEAS / PERSONA ───────────────────────────── */}
            {ghTab === "lineas" && ghView === "persona" && (<>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div style={{ background:"#111113", border:"1px solid #38bdf820", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#38bdf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>➕ Líneas añadidas</div>
                  <HBar sorted={byLines} getValue={ms=>ms.lns.added} getLabel={ms=>ms.lns.added>999?`${(ms.lns.added/1000).toFixed(1)}k`:ms.lns.added}
                    maxVal={maxAdded} color="#38bdf8" showMax />
                </div>
                <div style={{ background:"#111113", border:"1px solid #f43f5e20", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#f43f5e", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>🗑️ Líneas borradas</div>
                  <HBar sorted={byDeleted} getValue={ms=>ms.lns.deleted} getLabel={ms=>ms.lns.deleted>999?`${(ms.lns.deleted/1000).toFixed(1)}k`:ms.lns.deleted}
                    maxVal={maxDeleted} color="#f43f5e" showMax />
                </div>
              </div>
              {byChurn.length > 0 && (
                <div style={{ background:"#111113", border:"1px solid #a855f720", borderRadius:10, padding:"12px 12px 8px" }}>
                  <div style={{ color:"#a855f7", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>♻️ Code churn — % líneas borradas (↓ mejor)</div>
                  <div style={{ color:"#52525b", fontSize:8, marginBottom:8 }}>Bajo churn = código estable. Alto churn = mucho refactor o reescritura.</div>
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
                  <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px" }}>
                    <div style={{ color:"#38bdf8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>💡 Recomendaciones — Líneas</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                      {tips.map(({ sev, icon, title, msg }) => (
                        <div key={title} style={{ background:SBg[sev], borderLeft:`3px solid ${SCol[sev]}`, borderRadius:6, padding:"8px 12px", display:"flex", gap:9, alignItems:"flex-start" }}>
                          <span style={{ fontSize:12, flexShrink:0, lineHeight:1.5 }}>{icon}</span>
                          <div>
                            <div style={{ color:SCol[sev], fontWeight:700, fontSize:9.5, marginBottom:2 }}>{title}</div>
                            <div style={{ color:"#94a3b8", fontSize:9, lineHeight:1.55 }}>{msg}</div>
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
                      <div key={team} style={{ background:"#111113", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ color:"#52525b", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>Equipo {team}</div>
                        <div style={{ color, fontSize:14, fontWeight:800 }}>+{added>999?`${(added/1000).toFixed(1)}k`:added}</div>
                        <div style={{ color:"#52525b", fontSize:8, marginTop:2 }}>líneas añadidas</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div style={{ background:"#111113", border:"1px solid #27272a", borderRadius:10, padding:"14px" }}>
                <div style={{ color:"#94a3b8", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>📊 Comparativa — Líneas por equipo</div>
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
                          <span style={{ color:"#52525b", fontSize:8.5 }}>{active}/{members} activos · net {net>0?"+":""}{net>999?`${(net/1000).toFixed(1)}k`:net}</span>
                        </div>
                        {[
                          { label:"+Líneas", val:added,   max:maxTA,  col:"#38bdf8" },
                          { label:"-Líneas", val:deleted, max:maxDel, col:"#f43f5e" },
                        ].map(({ label, val, max, col }) => (
                          <div key={label} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                            <span style={{ color:"#52525b", fontSize:7.5, width:38, flexShrink:0 }}>{label}</span>
                            <div style={{ flex:1, height:5, background:"#27272a", borderRadius:3, overflow:"hidden" }}>
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
