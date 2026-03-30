import { useState, useEffect } from 'react';
import { SC } from '../../constants.js';
import { detectCurrentSprint } from '../../lib/utils.js';
import { useApp } from '../../context/AppContext.jsx';
import { fetchRetro, saveRetro } from '../../api/backend.js';

const COLUMNS = [
  { id: 'good', label: 'Fue bien', color: '#34d399', icon: '+' },
  { id: 'improve', label: 'Mejorar', color: '#fbbf24', icon: '~' },
  { id: 'actions', label: 'Acciones', color: '#818cf8', icon: '!' },
];

const STORAGE_KEY = 'nexus_retro_v1';

function loadRetros() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function saveRetros(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export default function RetroPane() {
  const { project, activeSprint: globalSprint } = useApp();
  const activeSprint = globalSprint || detectCurrentSprint();
  const [retros, setRetros] = useState(loadRetros);
  const [newText, setNewText] = useState({ good: '', improve: '', actions: '' });

  // Load from backend when project is available
  useEffect(() => {
    if (!project?.id) return;
    fetchRetro(project.id, activeSprint)
      .then(items => {
        setRetros(prev => ({ ...prev, [`sprint_${activeSprint}`]: items }));
      })
      .catch(() => { /* usar localStorage como fallback */ });
  }, [project?.id, activeSprint]);

  const sprintKey = `sprint_${activeSprint}`;
  const items = retros[sprintKey] || { good: [], improve: [], actions: [] };

  const updateItems = (col, newItems) => {
    const next = { ...retros, [sprintKey]: { ...items, [col]: newItems } };
    setRetros(next);
    saveRetros(next);
    if (project?.id) {
      saveRetro(project.id, activeSprint, next[sprintKey]).catch(() => {});
    }
  };

  const addItem = (col) => {
    const text = newText[col].trim();
    if (!text) return;
    const item = { id: Date.now().toString(36), text, votes: 0, done: false, createdAt: new Date().toISOString() };
    updateItems(col, [...(items[col] || []), item]);
    setNewText(prev => ({ ...prev, [col]: '' }));
  };

  const vote = (col, id) => {
    updateItems(col, (items[col] || []).map(i => i.id === id ? { ...i, votes: i.votes + 1 } : i));
  };

  const toggleDone = (col, id) => {
    updateItems(col, (items[col] || []).map(i => i.id === id ? { ...i, done: !i.done } : i));
  };

  const removeItem = (col, id) => {
    updateItems(col, (items[col] || []).filter(i => i.id !== id));
  };

  const totalItems = (items.good?.length || 0) + (items.improve?.length || 0) + (items.actions?.length || 0);
  const actionsDone = (items.actions || []).filter(i => i.done).length;
  const actionsTotal = items.actions?.length || 0;

  const exportMarkdown = () => {
    const sc = SC[activeSprint];
    const lines = [`# Retrospectiva — ${sc.label}`, `**Fecha:** ${new Date().toLocaleDateString('es-ES')}`, ''];

    COLUMNS.forEach(col => {
      lines.push(`## ${col.label}`, '');
      const colItems = items[col.id] || [];
      if (colItems.length === 0) lines.push('_Sin elementos_', '');
      else {
        [...colItems].sort((a, b) => b.votes - a.votes).forEach(i => {
          const check = col.id === 'actions' ? (i.done ? '[x]' : '[ ]') : '-';
          lines.push(`${check} ${i.text}${i.votes > 0 ? ` (${i.votes} votos)` : ''}`);
        });
        lines.push('');
      }
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retro-sprint-${activeSprint}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <div className="card mb-3" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, color: SC[activeSprint]?.color }}>{SC[activeSprint]?.label}</div>
          <div style={{ color: 'var(--tx4)', fontSize: 11 }}>
            {totalItems} elemento{totalItems !== 1 ? 's' : ''}
            {actionsTotal > 0 && ` · ${actionsDone}/${actionsTotal} acciones completadas`}
          </div>
        </div>
        <button onClick={exportMarkdown} className="btn btn-sm" style={{ color: '#818cf8', borderColor: '#818cf840' }}>
          Exportar Markdown
        </button>
      </div>

      {/* 3-column board */}
      <div className="grid grid-3 gap-2" style={{ alignItems: 'start' }}>
        {COLUMNS.map(col => {
          const colItems = [...(items[col.id] || [])].sort((a, b) => b.votes - a.votes);
          return (
            <div key={col.id} className="card card-flush" style={{ borderTop: `3px solid ${col.color}` }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: col.color, fontWeight: 800, fontSize: 13 }}>{col.label}</span>
                <span style={{ color: 'var(--tx4)', fontSize: 10 }}>({colItems.length})</span>
              </div>

              <div style={{ padding: '10px 14px' }}>
                {/* Add input */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  <input
                    className="input"
                    style={{ fontSize: 11, padding: '5px 8px' }}
                    placeholder={`Añadir a "${col.label}"…`}
                    value={newText[col.id]}
                    onChange={e => setNewText(prev => ({ ...prev, [col.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addItem(col.id)}
                  />
                  <button onClick={() => addItem(col.id)} className="btn btn-sm" style={{ color: col.color, borderColor: `${col.color}40`, flexShrink: 0 }}>+</button>
                </div>

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {colItems.map(item => (
                    <div key={item.id} className="retro-card" style={{ borderColor: `${col.color}20` }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {col.id === 'actions' && (
                          <input type="checkbox" checked={item.done} onChange={() => toggleDone(col.id, item.id)}
                            style={{ accentColor: col.color, cursor: 'pointer', marginTop: 2 }} />
                        )}
                        <span style={{ flex: 1, fontSize: 11, color: item.done ? 'var(--tx4)' : 'var(--tx2)', textDecoration: item.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
                          {item.text}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <button onClick={() => vote(col.id, item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.votes > 0 ? col.color : 'var(--tx4)', fontSize: 10, padding: 0 }}>
                          ▲ {item.votes}
                        </button>
                        <button onClick={() => removeItem(col.id, item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bdr2)', fontSize: 9, padding: 0, marginLeft: 'auto' }}>
                          eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                  {colItems.length === 0 && (
                    <div style={{ color: 'var(--tx4)', fontSize: 10, textAlign: 'center', padding: 16, border: '1px dashed var(--bdr)', borderRadius: 8 }}>
                      Sin elementos
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
