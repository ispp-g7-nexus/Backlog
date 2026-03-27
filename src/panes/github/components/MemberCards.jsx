import { TC } from '../hooks/useGitHubData.js';

export default function MemberCards({ memberStats, teamTotals, ghTab, maxCommits, maxPRs, maxRevs, maxAdded, totalCommits }) {
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
                  const mc = Math.max(...memberStats.map(ms => ms.commits), 1);
                  return (
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                        <span style={{ color:"var(--tx4)", fontSize:7.5, textTransform:"uppercase", letterSpacing:0.8 }}>Commits</span>
                        <span style={{ color:"#818cf8", fontSize:7.5, fontWeight:700 }}>{commits}</span>
                      </div>
                      <div style={{ height:4, background:"var(--bdr)", borderRadius:2, overflow:"hidden", position:"relative" }}>
                        <div style={{ height:"100%", width:`${mc>0?commits/mc*100:0}%`, background:"#818cf8", borderRadius:2 }} />
                        {globalAvg > 0 && <div title={`Media global: ${Math.round(globalAvg)}`} style={{ position:"absolute", top:0, bottom:0, left:`${mc>0?globalAvg/mc*100:0}%`, width:1, background:"var(--tx2)", opacity:0.7 }}/>}
                        {teamAvg > 0 && <div title={`Media equipo ${team}: ${Math.round(teamAvg)}`} style={{ position:"absolute", top:0, bottom:0, left:`${mc>0?teamAvg/mc*100:0}%`, width:1, background:tc, opacity:0.9 }}/>}
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
