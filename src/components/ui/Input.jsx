export function Input({ label, size, className = '', ...props }) {
  const cls = ['input', size === 'sm' && 'input-sm', className].filter(Boolean).join(' ');
  return label ? (
    <div>
      <label className="input-label">{label}</label>
      <input className={cls} {...props} />
    </div>
  ) : (
    <input className={cls} {...props} />
  );
}

export function Textarea({ label, className = '', ...props }) {
  return label ? (
    <div>
      <label className="input-label">{label}</label>
      <textarea className={`textarea ${className}`} {...props} />
    </div>
  ) : (
    <textarea className={`textarea ${className}`} {...props} />
  );
}
