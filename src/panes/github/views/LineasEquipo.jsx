import React from "react";
import MemberCards from "../components/MemberCards.jsx";

export default function LineasEquipo({ data, stats }) {
  const { memberStats, teamTotals, maxTA } = data;
  const sorted = [...teamTotals].sort((a, b) => b.added - a.added);

  return (
    <>
      {/* Highlight cards — líneas añadidas por equipo */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(128px,1fr))", gap:8 }}>
        {sorted.map(({ team, color, added }) => (
          <div key={team} style={{ background:"var(--bg2)", border:`1px solid ${color}20`, borderRadius:10, padding:"10px 12px" }}>
            <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>Equipo {team}</div>
            <div style={{ color, fontSize:14, fontWeight:800 }}>+{added>999?`${(added/1000).toFixed(1)}k`:added}</div>
            <div style={{ color:"var(--tx4)", fontSize:8, marginTop:2 }}>líneas añadidas</div>
          </div>
        ))}
      </div>

      {/* Comparativa — Líneas por equipo */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:10, padding:"14px" }}>
        <div style={{ color:"var(--tx2)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>📊 Comparativa — Líneas por equipo</div>
        {(() => {
          const maxDel = Math.max(...teamTotals.map(({ team }) =>
            memberStats.filter(ms => ms.m.team === team).reduce((s, ms) => s + ms.lns.deleted, 0)), 1);
          return teamTotals.map(({ team, color, added, members, active }) => {
            const deleted = memberStats.filter(ms => ms.m.team === team).reduce((s, ms) => s + ms.lns.deleted, 0);
            const net = added - deleted;
            return (
              <div key={team} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ background:`${color}20`, color, fontWeight:800, fontSize:9, textTransform:"uppercase", letterSpacing:2, padding:"2px 8px", borderRadius:4 }}>Equipo {team}</span>
                  <span style={{ color:"var(--tx4)", fontSize:8.5 }}>{active}/{members} activos · net {net>0?"+":""}{net>999?`${(net/1000).toFixed(1)}k`:net}</span>
                </div>
                {[
                  { label:"+Líneas", val:added, max:maxTA, col:"#38bdf8" },
                  { label:"-Líneas", val:deleted, max:maxDel, col:"#f43f5e" },
                ].map(({ label, val, max, col }) => (
                  <div key={label} style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                    <span style={{ color:"var(--tx4)", fontSize:7.5, width:38, flexShrink:0 }}>{label}</span>
                    <div style={{ flex:1, height:5, background:"var(--bdr)", borderRadius:3, overflow:"hidden" }}>
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

      {/* Member cards */}
      <MemberCards
        memberStats={memberStats}
        teamTotals={teamTotals}
        ghTab="lineas"
        maxCommits={data.maxCommits}
        maxPRs={data.maxPRs}
        maxRevs={data.maxRevs}
        maxAdded={data.maxAdded}
        totalCommits={data.totalCommits}
      />
    </>
  );
}
