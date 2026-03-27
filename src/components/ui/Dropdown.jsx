import { useState, useRef, useEffect } from 'react';

export function Dropdown({ trigger, children, align = 'left', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className={`dropdown ${className}`} ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className="dropdown-menu" style={align === 'right' ? { right: 0, left: 'auto' } : undefined}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ children, active, onClick, ...props }) {
  return (
    <button className={`dropdown-item ${active ? 'active' : ''}`} onClick={onClick} {...props}>
      {children}
    </button>
  );
}
