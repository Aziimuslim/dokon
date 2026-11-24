import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ProductGrid, ProductSkeleton } from '../components/ProductCard';
import { Empty } from '../components/ui';

const SORTS = [
  ['popular', 'Mashhurlik'],
  ['price_asc', 'Arzonroq'],
  ['price_desc', 'Qimmatroq'],
  ['new', 'Yangi'],
  ['discount', 'Chegirma'],
];

export default function Catalog() {
  const [sp, setSp] = useSearchParams();
  const [cats, setCats] = useState([]);
  const [data, setData] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [min, setMin] = useState(sp.get('min_price') || '');
  const [max, setMax] = useState(sp.get('max_price') || '');

  const category = sp.get('category') || '';
  const sort = sp.get('sort') || 'popular';
  const q = sp.get('q') || '';
  const page = Number(sp.get('page') || 1);

  const update = (patch) => {
    const next = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in patch)) next.delete('page');
    setSp(next);
  };

  useEffect(() => { api('/categories').then(setCats).catch(() => {}); }, []);
  useEffect(() => {
    setData(null);
    const params = new URLSearchParams(sp);
    params.set('limit', '12');
    api(`/products?${params}`).then(setData).catch(() => setData({ items: [], total: 0, pages: 0 }));
  }, [sp]);

  const activeCat = cats.find((c) => c.slug === category);

  return (
    <div className="container-x pt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{q ? `«${q}» bo'yicha qidiruv` : activeCat ? `${activeCat.icon} ${activeCat.name}` : 'Katalog'}</h1>
          {data && <p className="mt-1 text-sm text-gray-500">{data.total} ta mahsulot topildi</p>}
        </div>
        <button className="btn-outline md:hidden" onClick={() => setShowFilters(!showFilters)}>⚙️ Filtr</button>
      </div>

      {/* Kategoriya tablari */}
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <button className={!category ? 'chip-on' : 'chip-off'} onClick={() => update({ category: '' })}>🍽️ Barchasi</button>
        {cats.map((c) => (
          <button key={c.id} className={category === c.slug ? 'chip-on' : 'chip-off'} onClick={() => update({ category: c.slug })}>{c.icon} {c.name}</button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className={`${showFilters ? 'block' : 'hidden'} space-y-5 md:block`}>
          <div className="card p-4">
            <div className="mb-3 font-bold">Saralash</div>
            <div className="space-y-1">
              {SORTS.map(([v, l]) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                  <input type="radio" name="sort" className="accent-brand-500" checked={sort === v} onChange={() => update({ sort: v === 'popular' ? '' : v })} />
                  <span className="text-sm">{l}</span>
                </label>
              ))}
            </div>
          </div>
          <form className="card p-4" onSubmit={(e) => { e.preventDefault(); update({ min_price: min, max_price: max }); setShowFilters(false); }}>
            <div className="mb-3 font-bold">Narx (so'm)</div>
            <div className="flex gap-2">
              <input className="input !px-2.5 !py-2 text-sm" inputMode="numeric" placeholder="dan" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} />
              <input className="input !px-2.5 !py-2 text-sm" inputMode="numeric" placeholder="gacha" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} />
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-brand-500" checked={!!sp.get('discounted')} onChange={(e) => update({ discounted: e.target.checked ? '1' : '' })} />
              Faqat chegirmadagilar
            </label>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="accent-brand-500" checked={!!sp.get('available')} onChange={(e) => update({ available: e.target.checked ? '1' : '' })} />
              Faqat mavjudlari
            </label>
            <button className="btn-primary mt-4 w-full !py-2">Qo'llash</button>
            {(sp.toString() && sp.toString() !== `category=${category}`) && (
              <button type="button" className="btn-ghost mt-1 w-full !py-2 text-sm" onClick={() => { setMin(''); setMax(''); setSp(category ? { category } : {}); }}>Tozalash</button>
            )}
          </form>
        </aside>

        <div>
          {!data ? <ProductSkeleton n={6} /> : data.items.length === 0 ? (
            <Empty icon="🔍" title="Hech narsa topilmadi" text="Boshqa so'z bilan qidirib ko'ring yoki filtrlarni o'zgartiring." />
          ) : (
            <>
              <ProductGrid items={data.items} />
              {data.pages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                  {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
                    <button key={n} className={`h-10 w-10 rounded-xl font-semibold ${n === page ? 'bg-brand-500 text-white' : 'bg-white shadow-card hover:text-brand-600'}`} onClick={() => update({ page: n === 1 ? '' : String(n) })}>{n}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
