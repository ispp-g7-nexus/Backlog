export default function EditableCell({ item, field, displayEl, center, editing, editVal, setEditVal, getVal, startEdit, commitEdit, setEditing, saved, hovered, setHovered, syncing, syncErr }) {
  const isEditing = editing?.id === item.id && editing?.field === field;
  const val = getVal(item, field);

  if (isEditing) {
    const base = {
      autoFocus: true, value: editVal,
      onBlur: () => commitEdit(item.id, field),
      onKeyDown: e => { if (e.key === 'Enter') commitEdit(item.id, field); if (e.key === 'Escape') setEditing(null); },
      onClick: e => e.stopPropagation(),
      style: { width:'100%', background:'var(--bg0)', border:'1px solid #6366f1', borderRadius:4, padding:'2px 5px', fontSize:11, color:'var(--tx0)', outline:'none', fontFamily:'inherit' },
    };
    if (field === 'startDate' || field === 'targetDate') return <input type="date" {...base} onChange={e => setEditVal(e.target.value)} />;
    if (field === 'estimate') return <input type="number" step="0.5" min="0" {...base} onChange={e => setEditVal(e.target.value)} />;
    return <input {...base} onChange={e => setEditVal(e.target.value)} />;
  }

  const isSaved = saved?.id === item.id && saved?.field === field;
  const isHov = hovered?.id === item.id && hovered?.field === field;
  const isSyncing = syncing?.id === item.id && syncing?.field === field;
  const isErr = syncErr?.id === item.id && syncErr?.field === field;
  const isSelect = ['status','size','equipo','tipo'].includes(field);

  return (
    <span
      onMouseEnter={() => setHovered({ id: item.id, field })}
      onMouseLeave={() => setHovered(p => p?.id === item.id && p?.field === field ? null : p)}
      onClick={e => { if (!isSelect) { startEdit(e, item.id, field, val != null ? String(val) : ''); } }}
      style={{ cursor: isSelect ? 'pointer' : 'text', display:'flex', alignItems:'center', justifyContent: center ? 'center' : 'flex-start', width:'100%', position: center ? 'relative' : undefined, borderRadius:3, background: isSaved ? '#052e1650' : 'transparent', transition:'background 1s' }}
    >
      <span style={{ flex: center ? 'unset' : 1, minWidth:0, textAlign: center ? 'center' : undefined }}>
        {displayEl !== undefined ? displayEl : (val != null ? String(val) : '—')}
      </span>
      {isSelect && <span style={{ color: isHov ? '#6366f199' : 'transparent', fontSize:9, flexShrink: center ? undefined : 0, transition:'color .12s', ...(center ? { position:'absolute', right:3 } : { marginLeft:2 }) }}>▾</span>}
      {isSyncing && <span style={{ marginLeft:4, color:'#94a3b8', fontSize:9, flexShrink:0 }} title="Sincronizando con GitHub…">⟳</span>}
      {!isSyncing && isSaved && !isErr && <span style={{ marginLeft:4, color:'#34d399', fontSize:9, fontWeight:700, flexShrink:0 }}>✓</span>}
      {isErr && <span style={{ marginLeft:4, color:'#f87171', fontSize:9, fontWeight:700, flexShrink:0 }} title={syncErr.msg}>✗</span>}
    </span>
  );
}
