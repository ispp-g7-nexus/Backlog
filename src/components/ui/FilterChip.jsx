export function FilterChip({ children, active, onClick, className = '' }) {
  return (
    <button className={`filter-chip ${active ? 'active' : ''} ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}
