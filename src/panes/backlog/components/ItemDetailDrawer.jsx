import { useState, useRef, useEffect } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { SizeBadge, StatusBadge } from '../../../components/badges.jsx';
import { STATUSES } from '../hooks/useBacklogItems.js';
import AssigneePicker from './AssigneePicker.jsx';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const fmtDate = d => d ? `${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}` : '—';

function FieldRow({ label, children }) {
  return (
    <div className="drawer-field-row">
      <span className="drawer-field-label">{label}</span>
      <div className="drawer-field-value">{children}</div>
    </div>
  );
}

function SelectField({ value, options, onChange, renderOption }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button className="drawer-select-btn" onClick={() => setOpen(!open)}>
        {renderOption ? renderOption(value) : (value || '—')}
        <span style={{ marginLeft: 4, fontSize: 8, opacity: 0.6 }}>▼</span>
      </button>
      {open && (
        <div className="dropdown-menu" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, minWidth: 120, maxHeight: 200, overflowY: 'auto' }}>
          {options.map(opt => (
            <button key={opt || '_empty'} className={`dropdown-item ${opt === value ? 'active' : ''}`}
              onClick={() => { onChange(opt); setOpen(false); }}>
              {renderOption ? renderOption(opt) : (opt || '—')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const FIELD_LABELS = {
  status: 'Estado', size: 'Talla', equipo: 'Equipo', tipo: 'Tipo',
  title: 'Título', startDate: 'Inicio', targetDate: 'Fin', estimate: 'Estimación',
};

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

export default function ItemDetailDrawer({ item, onClose, editProps, allEquipos, allTipos, areaColor, activityEntries }) {
  const { getVal, commitEdit, editValRef, edits, setEdits, syncing, setSyncing, syncErr, setSyncErr } = editProps;

  const [localTitle, setLocalTitle] = useState(getVal(item, 'title') || '');
  const titleTimeout = useRef(null);
  const [localBody, setLocalBody] = useState(getVal(item, 'body') || item.body || '');
  const bodyTimeout = useRef(null);

  const val = (field) => getVal(item, field);

  const changeField = (field, value) => {
    editValRef.current = value ?? '';
    commitEdit(item.id, field);
  };

  const handleTitleChange = (e) => {
    const v = e.target.value;
    setLocalTitle(v);
    clearTimeout(titleTimeout.current);
    titleTimeout.current = setTimeout(() => changeField('title', v), 600);
  };

  const handleDateChange = (field, value) => {
    changeField(field, value || null);
  };

  const handleEstimateChange = (value) => {
    changeField('estimate', value === '' ? '' : value);
  };

  const handleBodyChange = (e) => {
    const v = e.target.value;
    setLocalBody(v);
    clearTimeout(bodyTimeout.current);
    bodyTimeout.current = setTimeout(() => changeField('body', v), 800);
  };

  return (
    <Drawer onClose={onClose}>
      <div className="drawer-header">
        <div className="drawer-header-top">
          <div className="drawer-item-id">
            {item.url
              ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.id}</a>
              : <span>{item.id}</span>}
          </div>
          <button className="drawer-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-area-tag" style={{ color: areaColor?.[item.area] }}>
          <div className="drawer-area-dot" style={{ background: areaColor?.[item.area] }} />
          {item.area}
        </div>
      </div>

      <div className="drawer-body">
        {/* Title */}
        <input
          className="drawer-title-input"
          value={localTitle}
          onChange={handleTitleChange}
          placeholder="Título de la tarea"
        />

        {/* Body */}
        <div style={{ marginBottom: 12 }}>
          <div className="drawer-field-label" style={{ marginBottom: 4 }}>Descripción</div>
          <textarea
            className="drawer-date-input"
            style={{ width: '100%', minHeight: 80, resize: 'vertical', fontFamily: 'inherit', fontSize: 12 }}
            value={localBody}
            onChange={handleBodyChange}
            placeholder="Descripción de la tarea…"
          />
        </div>

        {/* Status */}
        <FieldRow label="Estado">
          <SelectField
            value={val('status')}
            options={STATUSES}
            onChange={v => changeField('status', v)}
            renderOption={v => <StatusBadge s={v} />}
          />
        </FieldRow>

        {/* Size */}
        <FieldRow label="Talla">
          <SelectField
            value={val('size')}
            options={['', ...SIZES]}
            onChange={v => changeField('size', v)}
            renderOption={v => v ? <SizeBadge s={v} /> : <span style={{ color: 'var(--tx4)' }}>—</span>}
          />
        </FieldRow>

        {/* Equipo */}
        <FieldRow label="Equipo">
          <SelectField
            value={val('equipo') || ''}
            options={['', ...allEquipos]}
            onChange={v => changeField('equipo', v)}
          />
        </FieldRow>

        {/* Tipo */}
        <FieldRow label="Tipo">
          <SelectField
            value={val('tipo') || ''}
            options={['', ...allTipos]}
            onChange={v => changeField('tipo', v)}
          />
        </FieldRow>

        {/* Dates */}
        <FieldRow label="Inicio">
          <input
            type="date"
            className="drawer-date-input"
            value={val('startDate') || ''}
            onChange={e => handleDateChange('startDate', e.target.value)}
          />
        </FieldRow>

        <FieldRow label="Fin">
          <input
            type="date"
            className="drawer-date-input"
            value={val('targetDate') || ''}
            onChange={e => handleDateChange('targetDate', e.target.value)}
          />
        </FieldRow>

        {/* Estimate */}
        <FieldRow label="Estimación">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number"
              className="drawer-date-input"
              style={{ width: 70 }}
              value={val('estimate') ?? ''}
              onChange={e => handleEstimateChange(e.target.value)}
              min="0"
              step="0.5"
            />
            <span style={{ color: 'var(--tx4)', fontSize: 11 }}>horas</span>
          </div>
        </FieldRow>

        {/* Assignees */}
        <FieldRow label="Asignados">
          <AssigneePicker
            item={item}
            getVal={getVal}
            edits={edits}
            setEdits={setEdits}
            syncing={syncing}
            setSyncing={setSyncing}
            syncErr={syncErr}
            setSyncErr={setSyncErr}
          />
        </FieldRow>

        {/* Sprint */}
        <FieldRow label="Sprint">
          <span style={{ color: 'var(--tx3)', fontSize: 12 }}>S{item.sprint}</span>
        </FieldRow>

        {/* Subtasks */}
        {item.subtasks?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="drawer-section-title">Subtareas ({item.subtasks.length})</div>
            <div className="drawer-subtasks">
              {item.subtasks.map((sub, i) => (
                <div key={i} className="drawer-subtask-item">
                  <span style={{ color: 'var(--tx4)', marginRight: 6 }}>└</span>
                  {sub.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity log */}
        {activityEntries?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="drawer-section-title">Historial de cambios</div>
            <div className="drawer-activity-log">
              {activityEntries.slice(0, 20).map(e => (
                <div key={e.id} className="drawer-activity-entry">
                  <span className="drawer-activity-field">{FIELD_LABELS[e.field] || e.field}</span>
                  <span className="drawer-activity-values">
                    <span className="drawer-activity-old">{e.oldValue ?? '—'}</span>
                    <span style={{ color: 'var(--tx4)', margin: '0 4px' }}>→</span>
                    <span className="drawer-activity-new">{e.newValue ?? '—'}</span>
                  </span>
                  <span className="drawer-activity-time">{timeAgo(e.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open in GitHub */}
        {item.url && (
          <div style={{ marginTop: 20 }}>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="drawer-github-link">
              Abrir en GitHub →
            </a>
          </div>
        )}
      </div>
    </Drawer>
  );
}
