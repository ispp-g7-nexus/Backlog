import { useState } from 'react';
import { TEAM_MEMBERS } from '../../team.js';

const MINUTES_KEY = 'nexus_minutes_v1';
const TYPES = ['Planning', 'Review', 'Retro', 'Daily', 'Ad-hoc'];

function load() {
  try { return JSON.parse(localStorage.getItem(MINUTES_KEY) || '[]'); } catch { return []; }
}
function save(data) {
  try { localStorage.setItem(MINUTES_KEY, JSON.stringify(data)); } catch {}
}

const EMPTY = {
  type: 'Planning', date: new Date().toISOString().slice(0, 10),
  attendees: [], notes: '', actionItems: [],
};

export default function MeetingMinutes({ activeSprint }) {
  const [minutes, setMinutes] = useState(load);
  const [editing, setEditing] = useState(null); // null=list, 'new'=new, id=edit
  const [form, setForm] = useState(EMPTY);
  const [newAction, setNewAction] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const sprintKey = `s${activeSprint}`;
  const sprintMin = minutes.filter(m => m.sprint === sprintKey)
    .sort((a, b) => b.date.localeCompare(a.date));

  function openNew() {
    setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) });
    setEditing('new');
  }

  function openEdit(m) {
    setForm({ ...m });
    setEditing(m.id);
  }

  function saveMeeting() {
    if (!form.notes?.trim() && form.actionItems.length === 0) return;
    const isNew = editing === 'new';
    const record = { ...form, sprint: sprintKey, id: isNew ? `MIN-${Date.now()}` : editing, updatedAt: new Date().toISOString() };
    const next = isNew ? [...minutes, record] : minutes.map(m => m.id === editing ? record : m);
    setMinutes(next);
    save(next);
    setEditing(null);
  }

  function remove(id) {
    const next = minutes.filter(m => m.id !== id);
    setMinutes(next);
    save(next);
  }

  function toggleAttendee(login) {
    setForm(f => ({
      ...f,
      attendees: f.attendees.includes(login)
        ? f.attendees.filter(l => l !== login)
        : [...f.attendees, login],
    }));
  }

  function addAction() {
    if (!newAction.trim()) return;
    setForm(f => ({ ...f, actionItems: [...f.actionItems, { text: newAction.trim(), done: false }] }));
    setNewAction('');
  }

  function toggleAction(i) {
    setForm(f => {
      const items = [...f.actionItems];
      items[i] = { ...items[i], done: !items[i].done };
      return { ...f, actionItems: items };
    });
  }

  function removeAction(i) {
    setForm(f => ({ ...f, actionItems: f.actionItems.filter((_, idx) => idx !== i) }));
  }

  const typeColor = { Planning: '#818cf8', Review: '#34d399', Retro: '#fbbf24', Daily: '#38bdf8', 'Ad-hoc': '#94a3b8' };

  if (editing !== null) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--tx0)' }}>
            {editing === 'new' ? 'Nueva acta' : 'Editar acta'}
          </div>
          <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--tx4)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--tx4)', textTransform: 'uppercase' }}>Tipo</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {TYPES.map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                  style={{ padding: '3px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                    background: form.type === t ? `${typeColor[t]}20` : 'transparent',
                    border: `1px solid ${form.type === t ? typeColor[t] + '60' : 'var(--bdr)'}`,
                    color: form.type === t ? typeColor[t] : 'var(--tx3)', fontWeight: form.type === t ? 700 : 400 }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--tx4)', textTransform: 'uppercase' }}>Fecha</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid var(--bdr)', background: 'var(--bg0)', color: 'var(--tx1)', fontSize: 11 }} />
          </div>
        </div>

        {/* Attendees */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: 'var(--tx4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Asistentes</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {TEAM_MEMBERS.map(m => {
              const sel = form.attendees.includes(m.login);
              return (
                <button key={m.login} onClick={() => toggleAttendee(m.login)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
                    background: sel ? '#6366f120' : 'transparent', border: `1px solid ${sel ? '#6366f150' : 'var(--bdr)'}`,
                    color: sel ? '#818cf8' : 'var(--tx3)' }}>
                  <img src={`https://github.com/${m.login}.png?size=28`} style={{ width: 14, height: 14, borderRadius: '50%' }} />
                  {m.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: 'var(--tx4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Notas</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Puntos tratados, decisiones, contexto…"
            style={{ width: '100%', minHeight: 100, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--bdr)', background: 'var(--bg0)', color: 'var(--tx1)', fontSize: 12, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>

        {/* Action items */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, color: 'var(--tx4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Action items</label>
          {form.actionItems.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <input type="checkbox" checked={a.done} onChange={() => toggleAction(i)} />
              <span style={{ flex: 1, color: a.done ? 'var(--tx4)' : 'var(--tx1)', textDecoration: a.done ? 'line-through' : 'none', fontSize: 11 }}>{a.text}</span>
              <button onClick={() => removeAction(i)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input value={newAction} onChange={e => setNewAction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAction()}
              placeholder="Nuevo action item…"
              style={{ flex: 1, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bdr)', background: 'var(--bg0)', color: 'var(--tx1)', fontSize: 11 }} />
            <button onClick={addAction} className="btn btn-sm">+ Añadir</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setEditing(null)} className="btn btn-sm">Cancelar</button>
          <button onClick={saveMeeting} className="btn btn-sm" style={{ background: '#6366f120', color: '#818cf8', border: '1px solid #6366f145' }}>
            Guardar acta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ color: 'var(--tx3)', fontSize: 12 }}>{sprintMin.length} actas en este sprint</div>
        <button onClick={openNew} className="btn btn-sm" style={{ background: '#6366f115', color: '#818cf8', border: '1px solid #6366f140' }}>
          + Nueva acta
        </button>
      </div>

      {sprintMin.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--tx4)' }}>
          Sin actas registradas en este sprint.
        </div>
      )}

      {sprintMin.map(m => {
        const isExp = expandedId === m.id;
        const pending = m.actionItems?.filter(a => !a.done).length || 0;
        return (
          <div key={m.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              onClick={() => setExpandedId(isExp ? null : m.id)}>
              <span style={{ fontSize: 18 }}>
                {{ Planning: '📋', Review: '🔍', Retro: '🔄', Daily: '☀️', 'Ad-hoc': '📝' }[m.type] || '📝'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: typeColor[m.type] || 'var(--tx2)', fontWeight: 700, fontSize: 12 }}>{m.type}</span>
                  <span style={{ color: 'var(--tx4)', fontSize: 11 }}>{new Date(m.date).toLocaleDateString('es-ES')}</span>
                  {m.attendees?.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--tx4)' }}>{m.attendees.length} asistentes</span>
                  )}
                  {pending > 0 && (
                    <span style={{ fontSize: 9, color: '#f87171', background: '#f8717115', border: '1px solid #f8717130', borderRadius: 9, padding: '1px 5px' }}>{pending} pendientes</span>
                  )}
                </div>
                {m.notes && !isExp && (
                  <div style={{ color: 'var(--tx4)', fontSize: 10, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.notes.slice(0, 80)}{m.notes.length > 80 ? '…' : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={e => { e.stopPropagation(); openEdit(m); }} className="btn btn-sm" style={{ fontSize: 10 }}>Editar</button>
                <button onClick={e => { e.stopPropagation(); remove(m.id); }} className="btn btn-sm" style={{ fontSize: 10, color: '#f87171' }}>✕</button>
                <span style={{ color: 'var(--tx4)', fontSize: 10, padding: '3px 5px' }}>{isExp ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExp && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--bdr)', paddingTop: 12 }}>
                {m.attendees?.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--tx4)' }}>Asistentes:</span>
                    {m.attendees.map(login => {
                      const tm = TEAM_MEMBERS.find(t => t.login === login);
                      return (
                        <div key={login} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <img src={`https://github.com/${login}.png?size=28`} style={{ width: 16, height: 16, borderRadius: '50%' }} />
                          <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{tm?.name?.split(' ')[0] || login}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {m.notes && (
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--tx2)', fontSize: 12, marginBottom: 10 }}>{m.notes}</div>
                )}
                {m.actionItems?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--tx4)', textTransform: 'uppercase', marginBottom: 6 }}>Action items</div>
                    {m.actionItems.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <input type="checkbox" checked={a.done} readOnly />
                        <span style={{ fontSize: 11, color: a.done ? 'var(--tx4)' : 'var(--tx1)', textDecoration: a.done ? 'line-through' : 'none' }}>{a.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
