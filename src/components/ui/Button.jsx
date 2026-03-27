export function Button({ children, variant = 'default', size, icon, disabled, className = '', ...props }) {
  const cls = [
    icon ? 'btn-icon' : 'btn',
    variant !== 'default' && `btn-${variant}`,
    size && `btn-${size}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
