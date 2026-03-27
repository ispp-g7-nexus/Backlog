import { useState } from 'react';
import { StatusBadge, SizeBadge } from '../../../components/badges.jsx';

const STATUSES = ['Backlog', 'Ready', 'In progress', 'In review', 'Done'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

export default function BulkActionBar({ count, onChangeField, onDelete, onClear }) {
  const [openMenu, setOpenMenu] = useState(null);

  const toggle = (menu) => setOpenMenu(prev => prev === menu ? null : menu);

  return (
    <div className="bulk-action-bar">
      <span className="bulk-count">{count} seleccionado{count > 1 ? 's' : ''}</span>

      <div className="bulk-actions">
        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm" onClick={() => toggle('status')}>Estado</button>
          {openMenu === 'status' && (
            <div className="dropdown-menu bulk-dropdown">
              {STATUSES.map(s => (
                <button key={s} className="dropdown-item" onClick={() => { onChangeField('status', s); setOpenMenu(null); }}>
                  <StatusBadge s={s} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm" onClick={() => toggle('size')}>Talla</button>
          {openMenu === 'size' && (
            <div className="dropdown-menu bulk-dropdown">
              {SIZES.map(s => (
                <button key={s} className="dropdown-item" onClick={() => { onChangeField('size', s); setOpenMenu(null); }}>
                  <SizeBadge s={s} />
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-sm btn-danger" onClick={onDelete}
          style={{ background: '#dc262620', color: '#f87171', borderColor: '#dc262640' }}>
          Eliminar
        </button>
      </div>

      <button className="btn btn-sm" onClick={onClear} style={{ color: 'var(--tx4)' }}>
        Deseleccionar
      </button>
    </div>
  );
}
