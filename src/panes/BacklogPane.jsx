import { useState, useMemo, Fragment } from 'react';
import { BACKLOG, rawData } from '../data.js';
import { STATUS_META, AREA_COLORS, SIZE_META, SC } from '../constants.js';
import { SizeBadge, StatusBadge } from '../components/badges.jsx';

export default function BacklogPane({ sprint }) {
  const sc = SC[sprint];
  const [stf,   setStf]  = useState([]);
  const [sf,    setSf]   = useState([]);
  const [af,    setAf]   = useState([]);
  const [query, setQuery] = useState("");
  const [open,  setOpen]  = useState({});
  const toggleOpen = (id) => setOpen(p => ({ ...p, [id]: !p[id] }));
  const items = useMemo(() => BACKLOG.filter(i => i.sprint === sprint), [sprint]);
  const areas = useMemo(() => [...new Set(items.map(i => i.area))].sort(), [items]);
  const areaColor = useMemo(() => {
    const m = {};
    areas.forEach((a, i) => { m[a] = AREA_COLORS[i % AREA_COLORS.length]; });
    return m;
  }, [areas]);

  const toggle = (arr, set, v) => set(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);
  const filtered = useMemo(() => items.filter(item => {
    if (stf.length && !stf.includes(item.status)) return false;
    if (sf.length  && !sf.includes(item.size))    return false;
    if (af.length  && !af.includes(item.area))    return false;
    if (query) {
      const q = query.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [items, stf, sf, af, query]);

  const byArea = useMemo(() => {
    const m = {};
    filtered.forEach(i => { (m[i.area] ??= []).push(i); });
    return m;
  }, [filtered]);

  const areaMinId = useMemo(() => {
    const m = {};
    items.forEach(item => {
      const n = parseInt(item.id.match(/\.(\d+)$/)?.[1] ?? '9999', 10);
      if (!(item.area in m) || n < m[item.area]) m[item.area] = n;
    });
    return m;
  }, [items]);

  const stats = {
    total:      filtered.length,
    inProgress: filtered.filter(i => i.status === "In progress").length,
    inReview:   filtered.filter(i => i.status === "In review").length,
    done:       filtered.filter(i => i.status === "Done").length,
  };
  const hasFilters = stf.length || sf.length || af.length || query;
  const clearAll   = () => { setStf([]); setSf([]); setAf([]); setQuery(""); };

  function FilterBtn({ active, onClick, children, activeBg, activeColor }) {
    return (
      <button
        onClick={onClick}
        style={{
          padding:"3px 10px", borderRadius:5, fontSize:11, fontWeight:700, cursor:"pointer",
          background: active ? activeBg   : "transparent",
          color:      active ? activeColor : "var(--tx3)",
          border:     active ? `1px solid ${activeBg}` : "1px solid var(--bdr)",
          transition:"all .12s",
        }}
      >{children}</button>
    );
  }

  return (
    <div>
      {/* Banner */}
      <div style={{ background:"var(--bg2)", border:`1px solid ${sc.color}25`, borderRadius:12, padding:"13px 18px", marginBottom:12, display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:sc.color, boxShadow:`0 0 8px ${sc.color}` }} />
            <span style={{ color:sc.color, fontWeight:800, fontSize:14 }}>{sc.label}</span>
            <span style={{ color:"var(--tx3)", fontSize:11 }}>{sc.date}</span>
          </div>
          <div style={{ color:"var(--tx2)", fontSize:11 }}>
            {sprint === 1 && "Core del MVP + infraestructura base"}
            {sprint === 2 && "MVP v1 completo · ciclo de mejora continua · pilotaje"}
            {sprint === 3 && "MVP v2 · diferenciadores · matching IA · marketing"}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { l:"Total",       val:stats.total,      c:"var(--tx0)" },
            { l:"En curso",    val:stats.inProgress, c:"#6ee7b7" },
            { l:"En revisión", val:stats.inReview,   c:"#c4b5fd" },
            { l:"Hecho",       val:stats.done,       c:"#34d399" },
          ].map(s => (
            <div key={s.l} style={{ background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:8, padding:"6px 12px", textAlign:"center", minWidth:48 }}>
              <div style={{ color:s.c, fontSize:17, fontWeight:800, lineHeight:1 }}>{s.val}</div>
              <div style={{ color:"var(--tx4)", fontSize:9, marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"13px 18px", marginBottom:12 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por ID o título…"
          style={{ width:"100%", background:"var(--bg0)", border:"1px solid var(--bdr)", borderRadius:7, padding:"7px 10px", fontSize:12, color:"var(--tx0)", outline:"none", boxSizing:"border-box", marginBottom:9 }}
        />
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
          <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Estado</span>
          {rawData.statuses.map(s => {
            const meta = STATUS_META[s] || { bg:"var(--bdr)", text:"var(--tx3)" };
            return (
              <FilterBtn key={s} active={stf.includes(s)} onClick={() => toggle(stf, setStf, s)} activeBg={meta.bg} activeColor={meta.text}>
                {s}
              </FilterBtn>
            );
          })}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6, alignItems:"center" }}>
          <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Talla</span>
          {["XS","S","M","L","XL"].map(s => (
            <FilterBtn key={s} active={sf.includes(s)} onClick={() => toggle(sf, setSf, s)} activeBg={SIZE_META[s].bg} activeColor={SIZE_META[s].text}>{s}</FilterBtn>
          ))}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" }}>
          <span style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", width:46, flexShrink:0 }}>Área</span>
          {areas.map(a => (
            <FilterBtn key={a} active={af.includes(a)} onClick={() => toggle(af, setAf, a)} activeBg={`${areaColor[a]}35`} activeColor={areaColor[a]}>{a}</FilterBtn>
          ))}
        </div>
        {hasFilters && (
          <button onClick={clearAll} style={{ marginTop:7, background:"none", border:"none", color:"#f87171", fontSize:11, cursor:"pointer", padding:0 }}>
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {Object.keys(byArea).length === 0 ? (
        <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:48, textAlign:"center", color:"var(--tx4)" }}>
          Sin resultados para los filtros seleccionados
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {Object.entries(byArea).sort(([a], [b]) => (areaMinId[a] ?? 9999) - (areaMinId[b] ?? 9999)).map(([area, its]) => (
            <div key={area} style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, overflow:"hidden" }}>
              {/* Area header */}
              <div style={{ background:"var(--bg0)", borderBottom:"1px solid var(--bdr)", padding:"8px 16px", display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:4, height:14, borderRadius:3, background:areaColor[area] }} />
                <span style={{ color:areaColor[area], fontWeight:700, fontSize:12 }}>{area}</span>
                <span style={{ color:"var(--bdr2)", fontSize:10 }}>({its.length} HU)</span>
              </div>

              {/* Table */}
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, tableLayout:"fixed" }}>
                  <colgroup>
                    <col style={{ width:110 }} />
                    <col />
                    <col style={{ width:140 }} />
                    <col style={{ width:120 }} />
                    <col style={{ width:72 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ borderBottom:"1px solid var(--bdr)" }}>
                      {["ID","Historia de usuario","Equipo","Estado","Talla"].map(h => (
                        <th key={h} style={{ textAlign:"left", padding:"7px 14px", color:"var(--tx4)", fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:".07em", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {its.map((item, idx) => {
                      const rowBg  = idx % 2 === 0 ? "transparent" : "#0f0f1108";
                      const hasSubs = item.subtasks && item.subtasks.length > 0;
                      const isOpen  = !!open[item.id];
                      return (
                        <Fragment key={item.id}>
                          {/* Parent row */}
                          <tr
                            onClick={hasSubs ? () => toggleOpen(item.id) : undefined}
                            style={{
                              background: rowBg,
                              borderBottom: (!isOpen && idx < its.length - 1) ? "1px solid #1c1c1e" : "none",
                              cursor: hasSubs ? "pointer" : "default",
                            }}
                          >
                            <td style={{ padding:"9px 14px", whiteSpace:"nowrap" }}>
                              {item.url ? (
                                <a href={item.url} target="_blank" rel="noopener noreferrer"
                                  style={{ color:"#6b7280", fontSize:10, fontFamily:"monospace", fontWeight:600, textDecoration:"none" }}
                                  onMouseEnter={e => e.currentTarget.style.color="#818cf8"}
                                  onMouseLeave={e => e.currentTarget.style.color="#6b7280"}
                                >{item.id}</a>
                              ) : (
                                <span style={{ color:"#6b7280", fontSize:10, fontFamily:"monospace", fontWeight:600 }}>{item.id}</span>
                              )}
                            </td>
                            <td style={{ padding:"9px 14px", color:"var(--tx1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              <span>{item.title}</span>
                              {item.assignees && item.assignees.length > 0 && (
                                <span style={{ marginLeft:8, display:"inline-flex", gap:2, verticalAlign:"middle" }}>
                                  {item.assignees.map(a => (
                                    <img key={a.login} src={a.avatarUrl} title={a.name || a.login}
                                      style={{ width:16, height:16, borderRadius:"50%", border:"1px solid var(--bdr2)", verticalAlign:"middle" }}
                                    />
                                  ))}
                                </span>
                              )}
                            </td>
                            <td style={{ padding:"9px 14px", color:"var(--tx3)", whiteSpace:"nowrap", fontSize:11 }}>{item.equipo || "—"}</td>
                            <td style={{ padding:"9px 14px" }}><StatusBadge s={item.status} /></td>
                            <td style={{ padding:"9px 14px" }}>{item.size ? <SizeBadge s={item.size} /> : null}</td>
                          </tr>

                          {/* Subtask rows */}
                          {hasSubs && isOpen && item.subtasks.map((sub, si) => (
                            <tr
                              key={`${item.id}-${si}`}
                              style={{
                                background:"#0a0a14",
                                borderBottom: (si < item.subtasks.length - 1 || idx < its.length - 1) ? "1px solid #18181f" : "none",
                              }}
                            >
                              <td style={{ padding:"6px 14px 6px 36px", color:"var(--bdr2)", fontSize:11, whiteSpace:"nowrap" }}>└</td>
                              <td style={{ padding:"6px 14px", color:"var(--tx3)", fontSize:11, fontStyle:"italic" }}>{sub.title}</td>
                              <td colSpan={3} style={{ padding:"6px 14px" }} />
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
        <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"12px 16px" }}>
          <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", marginBottom:7 }}>Estado del Kanban</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {Object.keys(STATUS_META).map(k => (
              <StatusBadge key={k} s={k} />
            ))}
          </div>
        </div>
        <div style={{ background:"var(--bg2)", border:"1px solid var(--bdr)", borderRadius:12, padding:"12px 16px" }}>
          <div style={{ color:"var(--tx4)", fontSize:9, textTransform:"uppercase", letterSpacing:".07em", marginBottom:7 }}>Tallas (estimación orientativa)</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {[["XS","~2h"],["S","~4h"],["M","~8h"],["L","~16h"],["XL","~30h+"]].map(([s,h]) => (
              <div key={s} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <SizeBadge s={s} />
                <span style={{ color:"var(--tx2)", fontSize:10 }}>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
