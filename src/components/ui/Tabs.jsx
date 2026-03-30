export function Tabs({ tabs, active, onChange, variant, className = '' }) {
  return (
    <div className={`tab-group ${className}`} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className={`tab-btn ${active === tab.id ? (variant === 'green' ? 'active-green' : 'active') : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
