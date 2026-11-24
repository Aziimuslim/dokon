import { Link } from 'react-router-dom';
import { fmt } from '../lib/api';
import { useCart } from '../context/CartContext';
import { QtyControl } from './ui';

export default function ProductCard({ p }) {
  const { add, qtyOf, setQty } = useCart();
  const qty = qtyOf(p.id);
  return (
    <div className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={`/product/${p.id}`} className="relative block aspect-[4/3] overflow-hidden bg-gray-100">
        <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        {p.discount > 0 && <span className="absolute left-3 top-3 rounded-lg bg-accent-500 px-2 py-1 text-xs font-bold text-white">−{p.discount}%</span>}
        {!p.available && <span className="absolute inset-0 flex items-center justify-center bg-white/70 font-semibold text-gray-700">Mavjud emas</span>}
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <Link to={`/product/${p.id}`} className="line-clamp-2 font-semibold leading-snug hover:text-brand-600">{p.name}</Link>
        <p className="mt-1 line-clamp-2 hidden text-sm text-gray-500 sm:block">{p.description}</p>
        <div className="mt-auto pt-3">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-gray-900">{fmt(p.final_price)}</span>
            {p.discount > 0 && <span className="text-sm text-gray-400 line-through">{fmt(p.price)}</span>}
          </div>
          {qty > 0 ? (
            <div className="flex justify-center"><QtyControl value={qty} onChange={(v) => setQty(p.id, v)} size="sm" /></div>
          ) : (
            <button className="btn-primary w-full !py-2" disabled={!p.available} onClick={() => add(p)}>Savatga</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => <ProductCard key={p.id} p={p} />)}
    </div>
  );
}

export function ProductSkeleton({ n = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card animate-pulse overflow-hidden">
          <div className="aspect-[4/3] bg-gray-200" />
          <div className="space-y-2 p-4"><div className="h-4 w-3/4 rounded bg-gray-200" /><div className="h-4 w-1/2 rounded bg-gray-200" /><div className="h-9 rounded-xl bg-gray-200" /></div>
        </div>
      ))}
    </div>
  );
}
