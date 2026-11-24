import { useEffect, useState } from 'react';
import { api, fmt, fmtDate, PAY_METHODS, PAY_STATUS, STATUS } from '../../lib/api';
import { Modal, PageLoader } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

const NEXT = { accepted: ['preparing', 'cancelled'], preparing: ['on_the_way', 'cancelled'], on_the_way: ['delivered', 'cancelled'], delivered: [], cancelled: [] };

function OrderModal({ id, couriers, onClose, onChanged }) {
  const [o, setO] = useState(null);
  const toast = useToast();
  useEffect(() => { api(`/admin/orders/${id}`).then(setO); }, [id]);
  async function patch(body) {
    try { const n = await api(`/admin/orders/${id}`, { method: 'PUT', body }); setO(n); onChanged(); toast('Yangilandi'); }
    catch (e) { toast(e.message, 'error'); }
  }
  return (
    <Modal open onClose={onClose} title={`Buyurtma #${id}`} wide>
      {!o ? <PageLoader /> : (
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-3"><b>{o.customer_name}</b><br />📞 {o.phone}<br />📍 {o.address}<br />🕒 {o.delivery_time === 'asap' ? 'Tez' : o.delivery_time}{o.comment && <><br />💬 {o.comment}</>}</div>
            <div className="rounded-xl bg-gray-50 p-3">{PAY_METHODS[o.payment_method].label} · <span className={PAY_STATUS[o.payment_status].color}>{PAY_STATUS[o.payment_status].label}</span><br />{fmtDate(o.created_at)}<br />
              <span className={o.signature_valid ? 'text-green-700' : 'text-red-600'}>{o.signature_valid ? '🔏 Imzo to\'g\'ri' : '⚠️ Imzo buzilgan!'}</span></div>
          </div>
          <table className="w-full">
            <tbody>{o.items.map((i, k) => <tr key={k} className="border-b border-gray-100"><td className="py-1.5">{i.name}</td><td className="text-right">{i.quantity} × {fmt(i.price)}</td><td className="text-right font-medium">{fmt(i.quantity * i.price)}</td></tr>)}</tbody>
            <tfoot><tr><td className="pt-2 text-gray-500">Yetkazish</td><td /><td className="pt-2 text-right">{fmt(o.delivery_fee)}</td></tr><tr className="text-base font-extrabold"><td>Jami</td><td /><td className="text-right">{fmt(o.total)}</td></tr></tfoot>
          </table>
          <div>
            <div className="label">Kuryer</div>
            <select className="input" value={o.courier_id || ''} onChange={(e) => patch({ courier_id: e.target.value ? Number(e.target.value) : null })} disabled={['delivered', 'cancelled'].includes(o.status)}>
              <option value="">— tayinlanmagan —</option>
              {couriers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>
          <div>
            <div className="label">Holat: <span className={`rounded-full px-2 py-0.5 ${STATUS[o.status].color}`}>{STATUS[o.status].label}</span></div>
            <div className="flex flex-wrap gap-2">
              {NEXT[o.status].map((s) => (
                <button key={s} className={s === 'cancelled' ? 'btn-danger' : 'btn-primary'} onClick={() => (s !== 'cancelled' || confirm('Bekor qilinsinmi?')) && patch({ status: s })}>
                  {STATUS[s].icon} {STATUS[s].label}
                </button>
              ))}
              {NEXT[o.status].length === 0 && <span className="text-gray-500">Buyurtma yakunlangan</span>}
            </div>
          </div>
          <div className="text-xs text-gray-500">{o.history.map((h) => `${STATUS[h.status].label} (${fmtDate(h.created_at)})`).join(' → ')}</div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminOrders() {
  const [list, setList] = useState(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [couriers, setCouriers] = useState([]);

  const load = () => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (q.trim()) p.set('q', q.trim());
    return api(`/admin/orders?${p}`).then(setList);
  };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); /* eslint-disable-next-line */ }, [status]);
  useEffect(() => { api('/admin/users?role=courier').then((u) => setCouriers(u.filter((x) => x.is_active))); }, []);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Buyurtmalar</h1>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <form className="flex-1" onSubmit={(e) => { e.preventDefault(); load(); }}><input className="input" placeholder="ID, mijoz ismi yoki telefon..." value={q} onChange={(e) => setQ(e.target.value)} /></form>
      </div>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        <button className={!status ? 'chip-on' : 'chip-off'} onClick={() => setStatus('')}>Barchasi</button>
        {Object.entries(STATUS).map(([k, v]) => <button key={k} className={status === k ? 'chip-on' : 'chip-off'} onClick={() => setStatus(k)}>{v.icon} {v.label}</button>)}
      </div>
      {!list ? <PageLoader /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="p-3">#</th><th className="p-3">Mijoz</th><th className="p-3">Sana</th><th className="p-3">Summa</th><th className="p-3">To'lov</th><th className="p-3">Kuryer</th><th className="p-3">Holat</th></tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-500">Buyurtmalar yo'q</td></tr>}
              {list.map((o) => (
                <tr key={o.id} className="cursor-pointer border-b border-gray-50 hover:bg-brand-50/50" onClick={() => setOpen(o.id)}>
                  <td className="p-3 font-bold">{o.id}</td>
                  <td className="p-3">{o.customer_name}<div className="text-xs text-gray-500">{o.phone}</div></td>
                  <td className="p-3 text-gray-600">{fmtDate(o.created_at)}</td>
                  <td className="p-3 font-semibold">{fmt(o.total)}</td>
                  <td className="p-3">{PAY_METHODS[o.payment_method].label}<div className={`text-xs ${PAY_STATUS[o.payment_status].color}`}>{PAY_STATUS[o.payment_status].label}</div></td>
                  <td className="p-3 text-gray-600">{o.courier_name || '—'}</td>
                  <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[o.status].color}`}>{STATUS[o.status].label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <OrderModal id={open} couriers={couriers} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
