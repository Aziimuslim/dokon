import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export function Spinner({ className = '' }) {
  return <div className={`h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500 ${className}`} />;
}

export function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center"><Spinner /></div>;
}

export function Empty({ icon = '🍽️', title, text, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 text-6xl">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-gray-500">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function QtyControl({ value, onChange, size = 'md' }) {
  const s = size === 'sm' ? 'h-8 w-8 text-base' : 'h-10 w-10 text-lg';
  return (
    <div className="inline-flex items-center rounded-xl bg-gray-100 p-1">
      <button type="button" aria-label="Kamaytirish" className={`${s} rounded-lg font-bold text-gray-700 hover:bg-white`} onClick={() => onChange(value - 1)}>−</button>
      <span className="min-w-[2rem] text-center font-semibold tabular-nums">{value}</span>
      <button type="button" aria-label="Ko'paytirish" className={`${s} rounded-lg font-bold text-gray-700 hover:bg-white`} onClick={() => onChange(value + 1)} disabled={value >= 99}>+</button>
    </div>
  );
}

export function Field({ label, error, children }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {children}
      {error && <span className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-gray-500">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span>/</span>}
          {it.to ? <Link to={it.to} className="hover:text-brand-600">{it.label}</Link> : <span className="text-gray-800">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="btn-ghost h-9 w-9 !p-0" onClick={onClose} aria-label="Yopish">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Server validatsiya xatolarini maydonlar bo'yicha ajratish */
export const fieldErrors = (e) => Object.fromEntries((e?.body?.details || []).map((d) => [d.field, d.message]));
