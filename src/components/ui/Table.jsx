import { useState, useMemo } from 'react';

export function Table({ columns, data, sortable = true, stickyCol, onRowClick, className = '' }) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  const sorted = useMemo(() => {
    if (!sort.key || !sortable) return data;
    const col = columns.find(c => c.key === sort.key);
    const getter = col?.sortValue || (row => row[sort.key]);
    return [...data].sort((a, b) => {
      const va = getter(a), vb = getter(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [data, sort, sortable, columns]);

  function toggleSort(key) {
    if (!sortable) return;
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }

  return (
    <div className={`table-wrapper ${className}`}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={col.key} onClick={() => col.sortable !== false && toggleSort(col.key)}
                  style={col.width ? { width: col.width } : undefined}>
                {col.label}
                {sortable && sort.key === col.key && (
                  <span className="sort-icon">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, ri) => (
            <tr key={row.id ?? ri} onClick={() => onRowClick?.(row)} style={onRowClick ? { cursor: 'pointer' } : undefined}>
              {columns.map((col, ci) => (
                <td key={col.key} className={stickyCol === ci ? 'sticky-col' : ''}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
