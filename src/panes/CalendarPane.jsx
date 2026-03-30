import { useMemo } from 'react';
import { BACKLOG } from '../data.js';

export default function CalendarPane() {
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
    return { label:title, color:"var(--tx2)", dot:"#64748b" };
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
      <div key={label} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, overflow:"hidden" }}>
        <div style={{ background:"var(--bg0)", borderBottom:"1px solid var(--bdr)", padding:"10px 16px" }}>
          <span style={{ color:"var(--tx0)", fontWeight:700, fontSize:13 }}>{label}</span>
        </div>
        <div style={{ padding:12 }}>
          {/* Day headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign:"center", color:"var(--tx4)", fontSize:10, fontWeight:700, padding:"4px 0", letterSpacing:".05em" }}>{d}</div>
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
                    background: dayEvents.length || endSprint ? "var(--cal-day)" : "transparent",
                    border: isToday ? "1px solid #818cf840" : (dayEvents.length || endSprint) ? "1px solid var(--bdr)" : "1px solid transparent",
                    position:"relative",
                  }}>
                    <div style={{
                      fontSize:11, fontWeight: dayEvents.length || endSprint ? 700 : 400,
                      color: isToday ? "#818cf8" : (dayEvents.length || endSprint) ? "var(--tx0)" : "var(--bdr2)",
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
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"12px 18px", marginBottom:12, display:"flex", flexWrap:"wrap", gap:14, alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
            <span style={{ color:"#38bdf8", fontWeight:700, fontSize:13 }}>📅 Calendario de Asistencia</span>
            <span style={{ fontSize:9, color:'var(--tx4)', background:'var(--bg0)', border:'1px solid var(--bdr)', borderRadius:4, padding:'1px 6px', fontWeight:600 }}>Datos fijos</span>
          </div>
          <div style={{ color:"var(--tx3)", fontSize:11 }}>Clases y ceremonias Scrum · Feb – Abr 2026</div>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {legend.map(l => (
            <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:l.dot }} />
              <span style={{ color:"var(--tx2)", fontSize:10 }}>{l.label}</span>
            </div>
          ))}
          {[1,2,3].map(s => (
            <div key={s} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:2, background:SC_COLOR[s] }} />
              <span style={{ color:"var(--tx2)", fontSize:10 }}>S{s}</span>
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
