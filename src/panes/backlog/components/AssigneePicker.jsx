import { useState, useRef, useEffect } from 'react';
import { TEAM_MEMBERS } from '../../../team.js';
import { addAssignee, removeAssignee } from '../../../api/github.js';

export default function AssigneePicker({ item, getVal, edits, setEdits, syncing, setSyncing, syncErr, setSyncErr }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const [hoveredAssignee, setHoveredAssignee] = useState(null);
  const hoverTimerRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = () => setPickerOpen(false);
    setTimeout(() => document.addEventListener('click', close), 0);
    window.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [pickerOpen]);

  const current = getVal(item, 'assignees') || [];
  const currentLogins = current.map(a => a.login.toLowerCase());
  const isSyncing = syncing?.id === item.id && syncing?.field === 'assignees';
  const isErr = syncErr?.id === item.id && syncErr?.field === 'assignees';

  const toggleAssignee = (member) => {
    const isAssigned = currentLogins.includes(member.login.toLowerCase());
    const newAssignees = isAssigned
      ? current.filter(a => a.login.toLowerCase() !== member.login.toLowerCase())
      : [...current, { login: member.login, name: member.name, avatarUrl: `https://github.com/${member.login}.png` }];
    const next = { ...edits, [item.id]: { ...(edits[item.id] || {}), assignees: newAssignees } };
    setEdits(next);
    try { localStorage.setItem('nexus_edits_v1', JSON.stringify(next)); } catch {}
    const token = localStorage.getItem('nexus_gh_token');
    if (token && item.url) {
      setSyncing({ id: item.id, field: 'assignees' });
      setSyncErr(null);
      (isAssigned ? removeAssignee : addAssignee)(token, item.url, member.login)
        .then(() => setSyncing(null))
        .catch(err => {
          setSyncing(null);
          setSyncErr({ id: item.id, field: 'assignees', msg: err.message });
          setTimeout(() => setSyncErr(p => p?.id === item.id ? null : p), 4000);
        });
    }
  };

  return (
    <div style={{ position:'relative', display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}
      onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); if (!pickerOpen) { const r = e.currentTarget.getBoundingClientRect(); setPickerPos({ top: r.bottom + 4, left: r.left }); } setPickerOpen(!pickerOpen); }}
        style={{ width:18, height:18, borderRadius:'50%', border:'1px dashed #6366f180', background:'transparent',
          color:'#818cf8', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          padding:0, lineHeight:1, flexShrink:0 }}>+</button>
      {current.slice(0, 5).map(a => {
        const isHov = hoveredAssignee === a.login;
        return (
          <div key={a.login} style={{ position:'relative', width:18, height:18, flexShrink:0 }}
            onMouseEnter={() => { hoverTimerRef.current = setTimeout(() => setHoveredAssignee(a.login), 1500); }}
            onMouseLeave={() => { clearTimeout(hoverTimerRef.current); setHoveredAssignee(null); }}>
            <img src={a.avatarUrl || `https://github.com/${a.login}.png`} title={a.login}
              style={{ width:18, height:18, borderRadius:'50%', border:'1px solid var(--bdr2)', display:'block' }} />
            {isHov && (
              <div onClick={e => { e.stopPropagation(); setHoveredAssignee(null); toggleAssignee(a); }}
                style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#dc262690',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', fontSize:11, color:'#fff', fontWeight:700, lineHeight:1 }}>✕</div>
            )}
          </div>
        );
      })}
      {current.length > 5 && (
        <span style={{ fontSize:9, color:'var(--tx3)', background:'var(--bg0)', border:'1px solid var(--bdr)',
          borderRadius:9, padding:'1px 4px', flexShrink:0, lineHeight:'16px' }}>+{current.length - 5}</span>
      )}
      {isSyncing && <span style={{ fontSize:9, color:'#94a3b8' }}>⟳</span>}
      {isErr && <span style={{ fontSize:9, color:'#f87171' }} title={syncErr.msg}>✗</span>}
      {pickerOpen && (
        <div onClick={e => e.stopPropagation()}
          style={{ position:'fixed', top: pickerPos.top, left: pickerPos.left, zIndex:9999,
            background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:8,
            padding:'4px 0', minWidth:200, maxHeight:220, overflowY:'auto',
            boxShadow:'0 8px 24px #00000040' }}>
          {TEAM_MEMBERS.map(m => {
            const assigned = currentLogins.includes(m.login.toLowerCase());
            return (
              <div key={m.login} onClick={() => toggleAssignee(m)}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 10px',
                  cursor:'pointer', background: assigned ? '#6366f115' : 'transparent',
                  transition:'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = assigned ? '#6366f125' : '#ffffff08'}
                onMouseLeave={e => e.currentTarget.style.background = assigned ? '#6366f115' : 'transparent'}>
                <img src={`https://github.com/${m.login}.png?size=28`}
                  style={{ width:18, height:18, borderRadius:'50%', flexShrink:0 }} />
                <span style={{ fontSize:10, color: assigned ? '#818cf8' : 'var(--tx2)', flex:1 }}>{m.name}</span>
                <span style={{ fontSize:9, color:'var(--tx4)', flexShrink:0 }}>{m.team}</span>
                {assigned && <span style={{ fontSize:9, color:'#34d399', flexShrink:0 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
