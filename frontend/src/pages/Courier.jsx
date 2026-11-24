import { useEffect, useState } from 'react';
import { api, fmt, fmtDate, PAY_METHODS, PAY_STATUS, STATUS } from '../lib/api';
import { Empty, PageLoader } from '../components/ui';
import { useToast } from '../context/ToastContext';

export default function Courier() {
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState('active');
  const toast = useToast();
  const load = () => api('/courier/orders').then(setList).catch(() => setList([]));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  async function update(id, status) {
    try { await api(`/courier/orders/${id}`, { method: 'PUT', body: { status } }); toast(`#${id}: ${STATUS[status].label}`); load(); }
    catch (e) { toast(e.message, 'error'); }
  }
  if (!list) return <PageLoader />;
  const shown = list.filter((o) => (filter === 'active' ? !['delivered', 'cancelled'].includes(o.status) : ['delivered', 'cancelled'].includes(o.status)));

  return (
    <div className="container-x max-w-3xl pt-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">🛵 Kuryer paneli</h1>
      <div className="my-4 flex gap-2">
        <button className={filter === 'active' ? 'chip-on' : 'chip-off'} onClick={() => setFilter('active')}>Faol ({list.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length})</button>
        <button className={filter === 'done' ? 'chip-on' : 'chip-off'} onClick={() => setFilter('done')}>Yakunlangan</button>
      </div>
      {shown.length === 0 ? <Empty icon="🛵" title="Buyurtmalar yo'q" text="Admin sizga buyurtma tayinlaganda shu yerda ko'rinadi." /> : (
        <div className="space-y-4">
          {shown.map((o) => (
            <div key={o.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-lg font-bold">#{o.id} · {o.customer_name}</div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[o.status].color}`}>{STATUS[o.status].label}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <a className="block font-medium text-brand-700" href={`https://maps.google.com/?q=${encodeURIComponent(o.address)}`} target="_blank" rel="noreferrer">📍 {o.address}</a>
                <a className="block" href={`tel:${o.phone}`}>📞 {o.phone}</a>
                <div>🕒 {o.delivery_time === 'asap' ? 'Imkon qadar tez' : o.delivery_time} · {fmtDate(o.created_at)}</div>
                {o.comment && <div>💬 {o.comment}</div>}
                <div className="text-gray-600">🧾 {o.items?.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</div>
                <div className="pt-1 font-semibold">{fmt(o.total)} · {PAY_METHODS[o.payment_method].label} · <span className={PAY_STATUS[o.payment_status].color}>{PAY_STATUS[o.payment_status].label}</span></div>
                {o.payment_method === 'cash' && o.payment_status !== 'paid' && <div className="rounded-lg bg-amber-50 p-2 text-amber-800">💵 Mijozdan {fmt(o.total)} naqd oling</div>}
              </div>
              <div className="mt-4 flex gap-2">
                {o.status === 'preparing' && <button className="btn-primary flex-1" onClick={() => update(o.id, 'on_the_way')}>🛵 Yo'lga chiqdim</button>}
                {o.status === 'on_the_way' && <button className="btn flex-1 bg-green-600 text-white hover:bg-green-700" onClick={() => update(o.id, 'delivered')}>✅ Yetkazildi</button>}
                {o.status === 'accepted' && <p className="text-sm text-gray-500">Buyurtma hali tayyorlanmoqda...</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
