export function Avatar({ src, alt = '', size = 'md', fallback, className = '' }) {
  const sizeClass = size !== 'md' ? `avatar-${size}` : '';
  const cls = `avatar ${sizeClass} ${className}`.trim();

  if (!src && fallback) {
    return (
      <div className={cls} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)', color: 'var(--tx3)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
        {fallback}
      </div>
    );
  }

  return <img className={cls} src={src} alt={alt} loading="lazy" />;
}
