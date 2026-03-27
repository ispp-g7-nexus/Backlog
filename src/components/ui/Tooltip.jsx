export function Tooltip({ children, content, className = '' }) {
  return (
    <span className={`tooltip-trigger ${className}`}>
      {children}
      <span className="tooltip-content">{content}</span>
    </span>
  );
}
