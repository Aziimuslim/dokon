import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, fmt } from '../lib/api';
import { useCart } from '../context/CartContext';
import { Breadcrumbs, Empty, PageLoader, QtyControl } from '../components/ui';
import { ProductGrid } from '../components/ProductCard';

export default function Product() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [err, setErr] = useState(false);
  const [qty, setQtyLocal] = useState(1);
  const { add, qtyOf } = useCart();

  useEffect(() => {
    setP(null); setErr(false); setQtyLocal(1);
    api(`/products/${id}`).then(setP).catch(() => setErr(true));
  }, [id]);

  if (err) return <div className="container-x pt-6"><Empty icon="😕" title="Mahsulot topilmadi" /></div>;
  if (!p) return <PageLoader />;
  const inCart = qtyOf(p.id);

  return (
    <div className="container-x pt-6">
      <Breadcrumbs items={[{ label: 'Bosh sahifa', to: '/' }, { label: p.category_name, to: `/catalog?category=${p.category_slug}` }, { label: p.name }]} />
      <div className="grid gap-6 md:grid-cols-2 lg:gap-10">
        <div className="relative overflow-hidden rounded-3xl bg-gray-100">
          <img src={p.image} alt={p.name} className="aspect-[4/3] h-full w-full object-cover" />
          {p.discount > 0 && <span className="absolute left-4 top-4 rounded-xl bg-accent-500 px-3 py-1.5 font-bold text-white">−{p.discount}%</span>}
        </div>
        <div className="flex flex-col">
          <span className="mb-2 w-fit rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">{p.category_name}</span>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{p.name}</h1>
          <p className="mt-3 text-gray-600">{p.description}</p>
          {p.ingredients && (
            <div className="mt-5">
              <div className="mb-2 font-bold">Tarkibi</div>
              <div className="flex flex-wrap gap-2">
                {p.ingredients.split(',').map((s) => <span key={s} className="rounded-lg bg-gray-100 px-2.5 py-1 text-sm text-gray-700">{s.trim()}</span>)}
              </div>
            </div>
          )}
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold">{fmt(p.final_price)}</span>
            {p.discount > 0 && <span className="text-lg text-gray-400 line-through">{fmt(p.price)}</span>}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QtyControl value={qty} onChange={(v) => setQtyLocal(Math.max(1, Math.min(99, v)))} />
            <button className="btn-primary flex-1 !py-3 text-lg sm:flex-none sm:px-10" disabled={!p.available} onClick={() => add(p, qty)}>
              {p.available ? `Savatga · ${fmt(p.final_price * qty)}` : 'Mavjud emas'}
            </button>
          </div>
          {inCart > 0 && <p className="mt-3 text-sm text-green-700">✓ Savatda: {inCart} dona</p>}
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-100 p-3">🛵 <b>35 daqiqa</b><br /><span className="text-gray-500">o'rtacha yetkazish</span></div>
            <div className="rounded-xl bg-gray-100 p-3">🔥 <b>{p.sold_count} ta</b><br /><span className="text-gray-500">buyurtma qilingan</span></div>
          </div>
        </div>
      </div>
      {p.related?.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-extrabold">O'xshash mahsulotlar</h2>
          <ProductGrid items={p.related} />
        </section>
      )}
    </div>
  );
}
