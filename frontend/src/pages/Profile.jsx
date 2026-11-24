import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fmt, fmtDate, PAY_STATUS, STATUS } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Empty, Field, PageLoader, fieldErrors } from '../components/ui';

const TABS = [['info', '👤 Ma\'lumotlar'], ['orders', '📦 Buyurtmalar'], ['addresses', '📍 Manzillar'], ['notifications', '🔔 Xabarlar'], ['security', '🔒 Xavfsizlik']];

function Info() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', email: user.email || '' });
  const [stats, setStats] = useState(null);
  const [errors, setErrors] = useState({});
  useEffect(() => { api('/profile').then((d) => setStats(d.stats)).catch(() => {}); }, []);
  async function save(e) {
    e.preventDefault(); setErrors({});
    try { const d = await api('/profile', { method: 'PUT', body: f }); setUser(d.user); toast('Saqlandi'); }
    catch (err) { setErrors(fieldErrors(err)); toast(err.message, 'error'); }
  }
  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4"><div className="text-sm text-gray-500">Buyurtmalar</div><div className="text-2xl font-extrabold">{stats.orders}</div></div>
          <div className="card p-4"><div className="text-sm text-gray-500">Jami xarid</div><div className="text-2xl font-extrabold">{fmt(stats.spent)}</div></div>
        </div>
      )}
      <form onSubmit={save} className="card space-y-4 p-5">
        <Field label="Ism" error={errors.name}><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Telefon" error={errors.phone}><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email" error={errors.email}><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <button className="btn-primary">Saqlash</button>
      </form>
    </div>
  );
}

function Orders() {
  const [list, setList] = useState(null);
  useEffect(() => { api('/orders').then(setList).catch(() => setList([])); }, []);
  if (!list) return <PageLoader />;
  if (!list.length) return <Empty icon="📦" title="Hali buyurtma yo'q" action={<Link to="/catalog" className="btn-primary">Xarid qilish</Link>} />;
  return (
    <div className="space-y-3">
      {list.map((o) => (
        <Link key={o.id} to={`/orders/${o.id}`} className="card block p-4 transition hover:shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold">#{o.id} <span className="ml-2 text-sm font-normal text-gray-500">{fmtDate(o.created_at)}</span></div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[o.status].color}`}>{STATUS[o.status].icon} {STATUS[o.status].label}</span>
          </div>
          <div className="mt-2 line-clamp-1 text-sm text-gray-600">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</div>
          <div className="mt-2 flex justify-between text-sm"><span className={PAY_STATUS[o.payment_status].color}>{PAY_STATUS[o.payment_status].label}</span><span className="font-bold">{fmt(o.total)}</span></div>
        </Link>
      ))}
    </div>
  );
}

function Addresses() {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ label: 'Uy', address: '' });
  const toast = useToast();
  const load = () => api('/profile/addresses').then(setList);
  useEffect(() => { load(); }, []);
  async function add(e) {
    e.preventDefault();
    try { await api('/profile/addresses', { method: 'POST', body: f }); setF({ label: 'Uy', address: '' }); load(); }
    catch (err) { toast(err.message, 'error'); }
  }
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card grid gap-3 p-5 sm:grid-cols-[140px_1fr_auto]">
        <input className="input" placeholder="Nomi" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
        <input className="input" required minLength={5} placeholder="To'liq manzil" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <button className="btn-primary">Qo'shish</button>
      </form>
      {list.length === 0 ? <p className="text-center text-sm text-gray-500">Saqlangan manzillar yo'q</p> : list.map((a) => (
        <div key={a.id} className="card flex items-center justify-between gap-3 p-4">
          <div><div className="font-semibold">📍 {a.label}</div><div className="text-sm text-gray-600">{a.address}</div></div>
          <button className="btn-danger !px-3 !py-1.5 text-sm" onClick={async () => { await api(`/profile/addresses/${a.id}`, { method: 'DELETE' }); load(); }}>O'chirish</button>
        </div>
      ))}
    </div>
  );
}

function Notifications() {
  const [d, setD] = useState(null);
  useEffect(() => {
    api('/profile/notifications').then((x) => { setD(x); if (x.unread) api('/profile/notifications/read', { method: 'POST' }); });
  }, []);
  if (!d) return <PageLoader />;
  if (!d.items.length) return <Empty icon="🔔" title="Xabarlar yo'q" />;
  return (
    <div className="card divide-y divide-gray-100">
      {d.items.map((n) => (
        <div key={n.id} className={`flex gap-3 p-4 ${!n.is_read ? 'bg-brand-50/60' : ''}`}>
          <span className="text-xl">🔔</span>
          <div className="flex-1"><div className="font-semibold">{n.title}</div><div className="text-sm text-gray-600">{n.body}</div></div>
          <div className="shrink-0 text-xs text-gray-400">{fmtDate(n.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

function Security() {
  const toast = useToast();
  const { logout } = useAuth();
  const [f, setF] = useState({ old_password: '', new_password: '' });
  const [errors, setErrors] = useState({});
  async function save(e) {
    e.preventDefault(); setErrors({});
    try { await api('/auth/password', { method: 'PUT', body: f }); toast('Parol o\'zgartirildi. Qaytadan kiring.'); await logout(); }
    catch (err) { setErrors(fieldErrors(err)); toast(err.message, 'error'); }
  }
  return (
    <form onSubmit={save} className="card max-w-md space-y-4 p-5">
      <Field label="Joriy parol" error={errors.old_password}><input className="input" type="password" required value={f.old_password} onChange={(e) => setF({ ...f, old_password: e.target.value })} /></Field>
      <Field label="Yangi parol" error={errors.new_password}><input className="input" type="password" required minLength={8} value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} /></Field>
      <button className="btn-primary">Parolni o'zgartirish</button>
      <p className="text-xs text-gray-500">Parol o'zgarganda barcha qurilmalardagi sessiyalar yopiladi.</p>
    </form>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'info';
  const C = { info: Info, orders: Orders, addresses: Addresses, notifications: Notifications, security: Security }[tab] || Info;
  return (
    <div className="container-x pt-6">
      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">{user.name[0]?.toUpperCase()}</div>
        <div className="flex-1"><h1 className="text-2xl font-extrabold">{user.name}</h1><p className="text-sm text-gray-500">{user.phone || user.email}</p></div>
        <button className="btn-ghost text-red-600" onClick={logout}>Chiqish</button>
      </div>
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setSp({ tab: k })} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-left text-sm font-medium transition ${tab === k ? 'bg-brand-500 text-white' : 'bg-white text-gray-700 shadow-card hover:text-brand-600'}`}>{l}</button>
          ))}
        </nav>
        <div><C /></div>
      </div>
    </div>
  );
}
