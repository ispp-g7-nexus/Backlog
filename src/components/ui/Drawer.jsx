export function Drawer({ children, onClose, className = '' }) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className={`drawer ${className}`}>
        {children}
      </div>
    </>
  );
}
