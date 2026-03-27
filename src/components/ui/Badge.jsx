import { MOSCOW_META, SIZE_META, STATUS_META } from '../../constants.js';

const STATUS_CLASS = {
  'Backlog': 'badge-status-backlog',
  'Ready': 'badge-status-ready',
  'In progress': 'badge-status-progress',
  'In review': 'badge-status-review',
  'Done': 'badge-status-done',
};

const SIZE_CLASS = { XS: 'badge-size-xs', S: 'badge-size-s', M: 'badge-size-m', L: 'badge-size-l', XL: 'badge-size-xl' };

export function StatusBadge({ s }) {
  return <span className={`badge ${STATUS_CLASS[s] || 'badge-status-backlog'}`}>{s || 'Backlog'}</span>;
}

export function SizeBadge({ s }) {
  return <span className={`badge ${SIZE_CLASS[s] || ''}`} style={{ minWidth: 26, textAlign: 'center' }}>{s}</span>;
}

export function MoscowBadge({ m }) {
  const meta = MOSCOW_META[m];
  return <span className="badge" style={{ background: meta.bg, color: meta.text }}>{m}</span>;
}

export function Badge({ children, variant = 'info', className = '' }) {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>;
}
