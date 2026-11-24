import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, fmt, fmtDate, PAY_METHODS, PAY_STATUS, STATUS } from '../lib/api';
import StatusStepper from '../components/StatusStepper';
import { Empty, PageLoader } from '../components/ui';
import { useToast } from '../context/ToastContext';

export default function Order() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const [o, setO] = useState(null);
  const [err, setErr] = useState(false);
  const toast = useToast();
  const nav = useNavigate();

  const load = () => api(`/orders/${id}`).then(setO).catch(() => setErr(true));
  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // holatni avtomatik yangilash
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function pay() {
    try { nav((await api('/payment', { method: 'POST', body: { order_id: o.id } })).checkout_url); }
    catch (e) { toast(e.message, 'error'); }
  }
  useEffect(() => { if (o && sp.get('repay') && o.payment_status !== 'paid') pay(); /* eslint-disable-next-line */ }, [o?.id]);

  async function cancel() {
    if (!confirm('Buyurtmani bekor qilasizmi?')) return;
    try { await api(`/orders/${id}/cancel`, { method: 'POST' }); toast('Buyurtma bekor qilindi'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  if (err) return <div className="container-x pt-6"><Empty icon="😕" title="Buyurtma topilmadi" /></div>;
  if (!o) return <PageLoader />;
  const needsPay = o.payment_method !== 'cash' && o.payment_status !== 'paid' && o.status !== 'cancelled';

  return (
    <div className="container-x max-w-3xl pt-6">
      <Link to="/profile?tab=orders" className="text-sm text-gray-500 hover:text-brand-600">← Buyurtmalarim</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Buyurtma #{o.id}</h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS[o.status].color}`}>{STATUS[o.status].label}</span>
      </div>
      <p className="text-sm text-gray-500">{fmtDate(o.created_at)}</p>

      <div className="card mt-5 p-5 sm:p-6"><StatusStepper status={o.status} />
        {o.courier_name && o.status === 'on_the_way' && <div className="mt-5 rounded-xl bg-violet-50 p-3 text-sm text-violet-800">🛵 Kuryer: <b>{o.courier_name}</b> · {o.courier_phone}</div>}
      </div>

      {needsPay && (
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-amber-200 p-4">
          <div><div className="font-semibold">To'lov {o.payment_status === 'failed' ? 'amalga oshmadi' : 'kutilmoqda'}</div><div className="text-sm text-gray-500">{PAY_METHODS[o.payment_method].label} orqali {fmt(o.total)}</div></div>
          <button className="btn-primary" onClick={pay}>To'lash</button>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="card p-5 text-sm">
          <h3 className="mb-3 font-bold">Yetkazish</h3>
          <p>📍 {o.address}</p>
          <p className="mt-1">📞 {o.phone}</p>
          <p className="mt-1">🕒 {o.delivery_time === 'asap' ? 'Imkon qadar tez' : o.delivery_time}</p>
          {o.comment && <p className="mt-1">💬 {o.comment}</p>}
        </div>
        <div className="card p-5 text-sm">
          <h3 className="mb-3 font-bold">To'lov</h3>
          <p>{PAY_METHODS[o.payment_method].label}</p>
          <p className={`mt-1 font-semibold ${PAY_STATUS[o.payment_status].color}`}>{PAY_STATUS[o.payment_status].label}</p>
          <p className="mt-2 text-xs text-gray-400">{o.signature_valid ? '🔏 Buyurtma imzosi tasdiqlangan' : '⚠️ Imzo mos emas'}</p>
        </div>
      </div>

      <div className="card mt-4 divide-y divide-gray-100">
        {o.items.map((i, k) => (
          <div key={k} className="flex items-center gap-3 p-4">
            {i.image && <img src={i.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
            <div className="flex-1"><div className="font-medium">{i.name}</div><div className="text-sm text-gray-500">{i.quantity} × {fmt(i.price)}</div></div>
            <div className="font-semibold">{fmt(i.quantity * i.price)}</div>
          </div>
        ))}
        <div className="space-y-1 p-4 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Mahsulotlar</span><span>{fmt(o.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Yetkazish</span><span>{o.delivery_fee ? fmt(o.delivery_fee) : 'Bepul'}</span></div>
          <div className="flex justify-between pt-2 text-lg font-extrabold"><span>Jami</span><span>{fmt(o.total)}</span></div>
        </div>
      </div>

      {o.history?.length > 0 && (
        <div className="card mt-4 p-5">
          <h3 className="mb-3 font-bold">Tarix</h3>
          <ul className="space-y-2 text-sm">
            {o.history.map((h, k) => <li key={k} className="flex justify-between"><span>{STATUS[h.status]?.icon} {STATUS[h.status]?.label}</span><span className="text-gray-500">{fmtDate(h.created_at)}</span></li>)}
          </ul>
        </div>
      )}

      {o.status === 'accepted' && <button className="btn-danger mt-4 w-full" onClick={cancel}>Buyurtmani bekor qilish</button>}
    </div>
  );
}
