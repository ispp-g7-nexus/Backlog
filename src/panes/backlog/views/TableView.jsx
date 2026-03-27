import { Fragment, useMemo } from 'react';
import { SizeBadge, StatusBadge } from '../../../components/badges.jsx';
import EditableCell from '../components/EditableCell.jsx';
import AssigneePicker from '../components/AssigneePicker.jsx';
import RiskBadge from '../components/RiskBadge.jsx';

const fmtDate = d => d ? `${d.slice(8,10)}/${d.slice(5,7)}` : null;

const COLS = [
  { key: 'id', label: 'ID', align: 'left' },
  { key: 'title', label: 'Historia de usuario', align: 'left' },
  { key: 'assignees', label: 'Asignados', align: 'center', sortable: false },
  { key: 'equipo', label: 'Equipo', align: 'center' },
  { key: 'tipo', label: 'Tipo', align: 'center' },
  { key: 'status', label: 'Estado', align: 'center' },
  { key: 'size', label: 'Talla', align: 'center' },
  { key: 'startDate', label: 'Inicio', align: 'center' },
  { key: 'targetDate', label: 'Fin', align: 'center' },
  { key: 'estimate', label: 'Est.', align: 'center' },
];

const SIZE_ORDER = { XS: 1, S: 2, M: 3, L: 4, XL: 5 };
const STATUS_ORDER = { Backlog: 1, Ready: 2, 'In progress': 3, 'In review': 4, Done: 5 };

function sortItems(items, col, dir, getVal) {
  if (!col) return items;
  const sorted = [...items].sort((a, b) => {
    let va = getVal(a, col), vb = getVal(b, col);
    if (col === 'size') { va = SIZE_ORDER[va] || 0; vb = SIZE_ORDER[vb] || 0; }
    else if (col === 'status') { va = STATUS_ORDER[va] || 0; vb = STATUS_ORDER[vb] || 0; }
    else if (col === 'estimate') { va = va ?? -1; vb = vb ?? -1; }
    else { va = (va ?? '').toString().toLowerCase(); vb = (vb ?? '').toString().toLowerCase(); }
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

export default function TableView({ byArea, areaMinId, areaColor, editProps, setCreateModal, sprint,
  open, toggleOpen, hoveredRow, setHoveredRow, deleteConfirm, setDeleteConfirm, sf, tf, ef, toggle, setSf, setTf, setEf, onRowClick,
  selected, toggleSelect, selectAll, sortCol, sortDir, onSort }) {

  const { getVal, edits, setEdits, syncing, setSyncing, syncErr, setSyncErr, setFieldDropdown, setFieldDropPos } = editProps;

  function renderEditable(item, field, displayEl, center = false) {
    return (
      <span onClick={e => {
        e.stopPropagation();
        if (['status','size','equipo','tipo'].includes(field)) {
          const r = e.currentTarget.getBoundingClientRect();
          setFieldDropPos({ top: r.bottom + 2, left: r.left });
          setFieldDropdown({ id: item.id, field });
        }
      }}>
        <EditableCell item={item} field={field} displayEl={displayEl} center={center} {...editProps} />
      </span>
    );
  }

  const allItemIds = useMemo(() => {
    const ids = [];
    Object.values(byArea).forEach(its => its.forEach(i => ids.push(i.id)));
    return ids;
  }, [byArea]);

  const allSelected = selected && allItemIds.length > 0 && allItemIds.every(id => selected.has(id));
  const someSelected = selected && selected.size > 0;

  return (
    <div className="flex-col gap-2">
      {Object.entries(byArea).sort(([a], [b]) => (areaMinId[a] ?? 9999) - (areaMinId[b] ?? 9999)).map(([area, rawIts]) => {
        const its = sortItems(rawIts, sortCol, sortDir, getVal);
        return (
        <div key={area} className="card card-flush" style={{ overflow:"hidden" }}>
          <div style={{ background:"var(--bg0)", borderBottom:"1px solid var(--bdr)", padding:"8px 16px", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:4, height:14, borderRadius:3, background:areaColor[area] }} />
            <span style={{ color:areaColor[area], fontWeight:700, fontSize:12 }}>{area}</span>
            <span style={{ color:"var(--bdr2)", fontSize:10 }}>({its.length} HU)</span>
            <button
              onClick={e => { e.stopPropagation(); setCreateModal({ area, sprint: sprint ?? 3 }); }}
              className="btn btn-sm" style={{ marginLeft:'auto', borderColor:'#6366f140', color:'#818cf8' }}>
              + Nueva
            </button>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, tableLayout:"fixed" }}>
              <colgroup>
                <col style={{ width:30 }} />
                <col style={{ width:82 }} /><col style={{ width:230 }} /><col style={{ width:130 }} />
                <col style={{ width:110 }} /><col style={{ width:76 }} /><col style={{ width:100 }} />
                <col style={{ width:50 }} /><col style={{ width:60 }} /><col style={{ width:60 }} />
                <col style={{ width:46 }} /><col style={{ width:32 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--bdr)" }}>
                  <th style={{ padding:"7px 4px 7px 10px", width:30 }}>
                    <input type="checkbox" checked={allSelected} onChange={selectAll}
                      style={{ cursor:'pointer', accentColor:'#818cf8' }} />
                  </th>
                  {COLS.map(col => {
                    const sortable = col.sortable !== false;
                    const isActive = sortCol === col.key;
                    return (
                      <th key={col.key}
                        onClick={sortable ? () => onSort(col.key) : undefined}
                        className={sortable ? 'sortable-th' : ''}
                        style={{
                          textAlign: col.align, padding: "7px 6px", color: isActive ? 'var(--tx2)' : 'var(--tx4)',
                          fontWeight:700, fontSize:9, textTransform:"uppercase", letterSpacing:".07em",
                          whiteSpace:"nowrap", cursor: sortable ? 'pointer' : 'default', userSelect: 'none',
                        }}>
                        {col.label}
                        {isActive && <span style={{ marginLeft:3, fontSize:8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </th>
                    );
                  })}
                  <th style={{ width:32 }} />
                </tr>
              </thead>
              <tbody>
                {its.map((item, idx) => {
                  const rowBg = idx % 2 === 0 ? "transparent" : "#0f0f1108";
                  const hasSubs = item.subtasks?.length > 0;
                  const isOpen = !!open[item.id];
                  const isSelected = selected?.has(item.id);
                  return (
                    <Fragment key={item.id}>
                      <tr
                        onClick={hasSubs ? () => toggleOpen(item.id) : undefined}
                        onDoubleClick={() => onRowClick?.(item)}
                        onMouseEnter={() => setHoveredRow(item.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{ background: isSelected ? '#818cf812' : (hoveredRow === item.id ? '#ffffff0a' : rowBg), borderBottom: (!isOpen && idx < its.length - 1) ? "1px solid #1c1c1e" : "none", cursor: hasSubs ? "pointer" : "default" }}>
                        <td style={{ padding:"9px 4px 9px 10px" }}>
                          <input type="checkbox" checked={isSelected || false}
                            onChange={e => { e.stopPropagation(); toggleSelect(item.id); }}
                            onClick={e => e.stopPropagation()}
                            style={{ cursor:'pointer', accentColor:'#818cf8' }} />
                        </td>
                        <td style={{ padding:"9px 6px", whiteSpace:"nowrap" }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            {item.url
                              ? <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color:"#6b7280", fontSize:10, fontFamily:"monospace", fontWeight:600, textDecoration:"none" }}
                                  onMouseEnter={e => e.currentTarget.style.color="#818cf8"} onMouseLeave={e => e.currentTarget.style.color="#6b7280"}>{item.id}</a>
                              : <span style={{ color:"#6b7280", fontSize:10, fontFamily:"monospace", fontWeight:600 }}>{item.id}</span>}
                            <RiskBadge item={item} />
                          </div>
                        </td>
                        <td style={{ padding:"9px 6px", overflow:"hidden" }}>
                          <div style={{ overflow:"hidden", color:"var(--tx1)", fontSize:12 }}>
                            {renderEditable(item, 'title', <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{getVal(item, 'title') || '—'}</span>)}
                          </div>
                        </td>
                        <td style={{ padding:"6px 6px", textAlign:"center" }}>
                          <AssigneePicker item={item} getVal={getVal} edits={edits} setEdits={setEdits} syncing={syncing} setSyncing={setSyncing} syncErr={syncErr} setSyncErr={setSyncErr} />
                        </td>
                        <td style={{ padding:"9px 6px", whiteSpace:"nowrap", fontSize:11 }}>
                          {renderEditable(item, 'equipo', <span style={{ color:"var(--tx3)" }}>{getVal(item, 'equipo') || '—'}</span>, true)}
                        </td>
                        <td style={{ padding:"9px 6px", whiteSpace:"nowrap" }}>
                          {renderEditable(item, 'tipo', (() => { const t = getVal(item, 'tipo'); return t ? <span style={{ fontSize:10, color: tf.includes(t) ? "#fff7ed" : "var(--tx3)", background: tf.includes(t) ? "#f97316" : "var(--bg0)", border:"1px solid #f9731640", borderRadius:4, padding:"1px 6px" }}>{t}</span> : <span style={{ color:"var(--tx4)", fontSize:10 }}>—</span>; })(), true)}
                        </td>
                        <td style={{ padding:"9px 6px" }}>
                          {renderEditable(item, 'status', <StatusBadge s={getVal(item, 'status')} />, true)}
                        </td>
                        <td style={{ padding:"9px 4px" }}>
                          {renderEditable(item, 'size', getVal(item, 'size') ? <SizeBadge s={getVal(item, 'size')} /> : <span style={{ color:"var(--tx4)", fontSize:10 }}>—</span>, true)}
                        </td>
                        <td style={{ padding:"9px 4px", color:"var(--tx4)", fontSize:10, whiteSpace:"nowrap" }}>
                          {renderEditable(item, 'startDate', <span>{fmtDate(getVal(item, 'startDate')) ?? '—'}</span>, true)}
                        </td>
                        <td style={{ padding:"9px 4px", color:"var(--tx4)", fontSize:10, whiteSpace:"nowrap" }}>
                          {renderEditable(item, 'targetDate', <span>{fmtDate(getVal(item, 'targetDate')) ?? '—'}</span>, true)}
                        </td>
                        <td style={{ padding:"9px 4px", color:"var(--tx4)", fontSize:10, whiteSpace:"nowrap" }}>
                          {renderEditable(item, 'estimate', <span>{getVal(item, 'estimate') != null ? `${getVal(item, 'estimate')}h` : '—'}</span>, true)}
                        </td>
                        <td style={{ padding:"0 4px", textAlign:"center", verticalAlign:"middle" }}>
                          {hoveredRow === item.id && (
                            <button onClick={e => { e.stopPropagation(); setDeleteConfirm(item); }}
                              className="btn btn-danger btn-sm" style={{ padding:'2px 5px', fontSize:10 }}>✕</button>
                          )}
                        </td>
                      </tr>
                      {hasSubs && isOpen && item.subtasks.map((sub, si) => (
                        <tr key={`${item.id}-${si}`} style={{ background:"#0a0a14", borderBottom: (si < item.subtasks.length - 1 || idx < its.length - 1) ? "1px solid #18181f" : "none" }}>
                          <td />
                          <td style={{ padding:"6px 6px 6px 24px", color:"var(--bdr2)", fontSize:11, whiteSpace:"nowrap" }}>└</td>
                          <td style={{ padding:"6px 6px", color:"var(--tx3)", fontSize:11, fontStyle:"italic" }}>{sub.title}</td>
                          <td colSpan={9} style={{ padding:"6px 6px" }} />
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );})}
    </div>
  );
}
