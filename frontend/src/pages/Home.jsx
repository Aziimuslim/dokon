import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ProductGrid, ProductSkeleton } from '../components/ProductCard';

export default function Home() {
  const [promos, setPromos] = useState([]);
  const [cats, setCats] = useState([]);
  const [popular, setPopular] = useState(null);
  const [deals, setDeals] = useState(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    api('/promotions').then(setPromos).catch(() => {});
    api('/categories').then(setCats).catch(() => {});
    api('/products?sort=popular&limit=8').then((d) => setPopular(d.items)).catch(() => setPopular([]));
    api('/products?discounted=1&sort=discount&limit=4').then((d) => setDeals(d.items)).catch(() => setDeals([]));
  }, []);
  useEffect(() => {
    if (promos.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % promos.length), 5000);
    return () => clearInterval(t);
  }, [promos.length]);

  return (
    <div className="container-x pt-4 sm:pt-6">
      {/* Aksiyalar slayderi */}
      <section className="relative overflow-hidden rounded-3xl">
        {promos.length === 0 ? (
          <div className="h-48 animate-pulse rounded-3xl bg-brand-100 sm:h-72" />
        ) : (
          <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {promos.map((p) => (
              <Link key={p.id} to={p.category_slug ? `/catalog?category=${p.category_slug}` : '/catalog'}
                className="relative flex h-48 w-full shrink-0 items-center overflow-hidden px-6 sm:h-72 sm:px-14"
                style={{ background: `linear-gradient(120deg, ${p.color}, ${p.color}cc 55%, #111827)` }}>
                <div className="relative z-10 max-w-lg text-white">
                  <span className="mb-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur">Aksiya</span>
                  <h2 className="text-2xl font-extrabold leading-tight sm:text-5xl">{p.title}</h2>
                  <p className="mt-2 text-sm text-white/90 sm:text-lg">{p.subtitle}</p>
                  <span className="mt-4 hidden rounded-xl bg-white px-5 py-2.5 font-semibold text-gray-900 sm:inline-block">Buyurtma berish →</span>
                </div>
                <div className="absolute -right-4 bottom-0 select-none text-[9rem] leading-none drop-shadow-2xl sm:right-10 sm:text-[14rem]">{p.emoji}</div>
              </Link>
            ))}
          </div>
        )}
        {promos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {promos.map((_, i) => (
              <button key={i} aria-label={`Slayd ${i + 1}`} onClick={() => setSlide(i)} className={`h-2 rounded-full transition-all ${i === slide ? 'w-6 bg-white' : 'w-2 bg-white/50'}`} />
            ))}
          </div>
        )}
      </section>

      {/* Kategoriyalar */}
      <section className="mt-8">
        <h2 className="mb-4 text-xl font-extrabold sm:text-2xl">Kategoriyalar</h2>
        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          {cats.map((c) => (
            <Link key={c.id} to={`/catalog?category=${c.slug}`} className="card group flex flex-col items-center gap-2 p-4 text-center transition hover:-translate-y-0.5 hover:shadow-lg sm:flex-row sm:p-6 sm:text-left">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-3xl transition group-hover:scale-110 sm:h-16 sm:w-16 sm:text-4xl">{c.icon}</span>
              <span>
                <span className="block font-bold sm:text-lg">{c.name}</span>
                <span className="text-xs text-gray-500 sm:text-sm">{c.product_count} ta mahsulot</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {deals?.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-extrabold sm:text-2xl">🔥 Chegirmalar</h2>
            <Link to="/catalog?discounted=1" className="text-sm font-semibold text-brand-600 hover:underline">Barchasi →</Link>
          </div>
          <ProductGrid items={deals} />
        </section>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-extrabold sm:text-2xl">⭐ Mashhur mahsulotlar</h2>
          <Link to="/catalog" className="text-sm font-semibold text-brand-600 hover:underline">Katalog →</Link>
        </div>
        {popular ? <ProductGrid items={popular} /> : <ProductSkeleton />}
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          ['🛵', 'Tez yetkazish', "O'rtacha 35 daqiqada eshigingizgacha"],
          ['💳', 'Qulay to\'lov', 'Payme, Click, karta yoki naqd'],
          ['🔒', 'Xavfsiz', "Ma'lumotlaringiz shifrlangan holda himoyalangan"],
        ].map(([i, t, d]) => (
          <div key={t} className="card flex items-center gap-4 p-5">
            <span className="text-4xl">{i}</span>
            <div><div className="font-bold">{t}</div><div className="text-sm text-gray-500">{d}</div></div>
          </div>
        ))}
      </section>
    </div>
  );
}
