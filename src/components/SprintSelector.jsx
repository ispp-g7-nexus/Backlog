import { SC } from '../constants.js';

/**
 * SprintSelector — pill buttons for Todos / S1 / S2 / S3
 * Props: value (null=Todos | 1 | 2 | 3), onChange(value)
 */
export default function SprintSelector({ value, onChange, showAll = true }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {showAll && (
        <button
          onClick={() => onChange(null)}
          className={`btn btn-sm ${value === null ? 'btn-active' : ''}`}
        >
          Todos
        </button>
      )}
      {[1, 2, 3].map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`btn btn-sm ${value === s ? 'btn-active' : ''}`}
          style={value === s ? { background: `${SC[s].color}20`, color: SC[s].color, borderColor: `${SC[s].color}50` } : {}}
        >
          {SC[s].label}
        </button>
      ))}
    </div>
  );
}
