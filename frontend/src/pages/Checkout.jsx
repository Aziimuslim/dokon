import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fmt, PAY_METHODS } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { Empty, Field, PageLoader, fieldErrors } from '../components/ui';

const count = (c) => c.items.reduce((s, i) => s + i.quantity, 0);

function slots() {
  const now = new Date();
  const out = [];
  for (let h = Math.max(now.getHours() + 1, 10); h < 23; h++) {
    const p = (n) => String(n).padStart(2, '0');
    out.push(`${p(h)}:00-${p(h + 1)}:00`);
  }
  return out;
}

const PayIcon = ({ m }) => (
  <span className="flex h-10 w-14 items-center justify-center rounded-lg text-xs font-extrabold text-white" style={{ background: PAY_METHODS[m].color }}>
    {m === 'cash' ? '💵' : m === 'card' ? '💳' : PAY_METHODS[m].label}
  </span>
);

export default function Checkout() {
  const { user } = useAuth();
  const { cart, reload, synced } = useCart();
  const toast = useToast();
  const nav = useNavigate();
  const [quote, setQuote] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState({ address: '', phone: user?.phone || '', delivery_time: 'asap', payment_method: 'payme', comment: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const timeSlots = useMemo(slots, []);
  const placed = useRef(false);

  const loadQuote = () => api('/orders/preview', { method: 'POST' }).then(setQuote).catch(() => setQuote({ items: [] }));

  useEffect(() => {
    if (!synced || placed.current) return;
    if (!cart.items.length) { setQuote({ items: [] }); return; }
    loadQuote();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synced, cart.total, count(cart)]);

  useEffect(() => {
    api('/profile/addresses').then((a) => {
      setAddresses(a);
      if (a[0]) setForm((f) => ({ ...f, address: f.address || a[0].address }));
    }).catch(() => {});
  }, []);

  if (!quote) return <PageLoader />;
  if (!quote.items?.length) {
    return <div className="container-x pt-6"><Empty icon="🛒" title="Savat bo'sh" action={<Link to="/catalog" className="btn-primary">Katalog</Link>} /></div>;
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target ? e.target.value : e });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErrors({}); setNotice('');
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: { ...form, quote: { expires_at: quote.expires_at, signature: quote.signature } },
      });
      placed.current = true;
      if (form.saveAddress && !addresses.some((a) => a.address === form.address)) {
        api('/profile/addresses', { method: 'POST', body: { label: 'Uy', address: form.address } }).catch(() => {});
      }
      await reload();
      if (order.payment_method === 'cash') {
        toast('Buyurtma qabul qilindi!');
        nav(`/orders/${order.id}`);
      } else {
        const pay = await api('/payment', { method: 'POST', body: { order_id: order.id } });
        nav(pay.checkout_url);
      }
    } catch (err) {
      if (err.status === 409) {
        setNotice(err.message);
        await loadQuote();
      } else {
        setErrors(fieldErrors(err));
        toast(err.message, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-x pt-6">
      <h1 className="mb-5 text-2xl font-extrabold sm:text-3xl">Buyurtmani rasmiylashtirish</h1>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-sm text-white">1</span> Yetkazish manzili</h2>
            {addresses.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {addresses.map((a) => (
                  <button type="button" key={a.id} className={form.address === a.address ? 'chip-on' : 'chip-off'} onClick={() => setForm({ ...form, address: a.address })}>📍 {a.label}</button>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Manzil" error={errors.address}>
                  <input className="input" required minLength={5} placeholder="Shahar, tuman, ko'cha, uy, xonadon" value={form.address} onChange={set('address')} />
                </Field>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" className="accent-brand-500" checked={!!form.saveAddress} onChange={(e) => setForm({ ...form, saveAddress: e.target.checked })} /> Manzilni saqlash
                </label>
              </div>
              <Field label="Telefon" error={errors.phone}>
                <input className="input" required type="tel" placeholder="+998 90 123 45 67" value={form.phone} onChange={set('phone')} />
              </Field>
              <Field label="Izoh (ixtiyoriy)">
                <input className="input" maxLength={500} placeholder="Podyezd, qavat, domofon..." value={form.comment} onChange={set('comment')} />
              </Field>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-sm text-white">2</span> Yetkazish vaqti</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={form.delivery_time === 'asap' ? 'chip-on' : 'chip-off'} onClick={() => set('delivery_time')('asap')}>⚡ Imkon qadar tez</button>
              {timeSlots.map((s) => (
                <button type="button" key={s} className={form.delivery_time === s ? 'chip-on' : 'chip-off'} onClick={() => set('delivery_time')(s)}>{s}</button>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-sm text-white">3</span> To'lov usuli</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.keys(PAY_METHODS).map((m) => (
                <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition ${form.payment_method === m ? 'border-brand-500 bg-brand-50' : 'border-gray-100 hover:border-gray-200'}`}>
                  <input type="radio" name="pm" className="sr-only" checked={form.payment_method === m} onChange={() => set('payment_method')(m)} />
                  <PayIcon m={m} />
                  <span className="font-medium">{PAY_METHODS[m].label}</span>
                </label>
              ))}
            </div>
            {form.payment_method !== 'cash' && <p className="mt-3 text-xs text-gray-500">🔒 To'lov sahifasiga yo'naltirilasiz (sandbox/test rejimi).</p>}
          </section>
        </div>

        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="mb-3 text-lg font-bold">Buyurtmangiz</h2>
          <ul className="mb-4 max-h-64 space-y-2 overflow-y-auto text-sm">
            {quote.items.map((i) => (
              <li key={i.product_id} className="flex justify-between gap-2"><span className="text-gray-600">{i.name} × {i.quantity}</span><span className="shrink-0 font-medium">{fmt(i.line_total)}</span></li>
            ))}
          </ul>
          <div className="space-y-2 border-t pt-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Mahsulotlar</span><span>{fmt(quote.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Yetkazish</span><span>{quote.delivery_fee ? fmt(quote.delivery_fee) : 'Bepul'}</span></div>
          </div>
          <div className="mt-3 flex justify-between border-t pt-3 text-xl font-extrabold"><span>Jami</span><span>{fmt(quote.total)}</span></div>
          {notice && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">⚠️ {notice} Yangilangan summa ko'rsatildi.</div>}
          <button className="btn-primary mt-4 w-full !py-3 text-lg" disabled={busy}>{busy ? 'Yuborilmoqda...' : form.payment_method === 'cash' ? 'Buyurtma berish' : "To'lovga o'tish"}</button>
          <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-gray-400">🔏 Summa server tomonidan hisoblangan va imzolangan</p>
        </aside>
      </form>
    </div>
  );
}
