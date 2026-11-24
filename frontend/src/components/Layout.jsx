import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api } from '../lib/api';

function CartIcon({ count }) {
  return (
    <span className="relative inline-flex">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
      {count > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white">{count > 99 ? '99+' : count}</span>}
    </span>
  );
}

function SearchBox({ className = '' }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState(new URLSearchParams(loc.search).get('q') || '');
  useEffect(() => { if (loc.pathname !== '/catalog') setQ(''); }, [loc.pathname]);
  return (
    <form className={`relative ${className}`} onSubmit={(e) => { e.preventDefault(); nav(`/catalog${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}>
      <input className="input !rounded-full !bg-gray-100 !py-2 pl-10 focus:!bg-white" placeholder="Burger, pitsa, tort..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidiruv" />
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    </form>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const ref = useRef();
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (!user) return;
    api('/profile/notifications').then((d) => setUnread(d.unread)).catch(() => {});
  }, [user, loc.pathname]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  if (!user) return <Link to="/login" className="btn-primary !px-4 !py-2">Kirish</Link>;
  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-2 rounded-full p-1 pr-3 hover:bg-gray-100" onClick={() => setOpen(!open)}>
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
          {user.name[0]?.toUpperCase()}
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-accent-500" />}
        </span>
        <span className="hidden max-w-[8rem] truncate text-sm font-medium lg:block">{user.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-100 bg-white py-1 shadow-xl" onClick={() => setOpen(false)}>
          <Link to="/profile" className="block px-4 py-2.5 hover:bg-gray-50">👤 Profil</Link>
          <Link to="/profile?tab=orders" className="block px-4 py-2.5 hover:bg-gray-50">📦 Buyurtmalarim</Link>
          <Link to="/profile?tab=notifications" className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">🔔 Bildirishnomalar {unread > 0 && <span className="rounded-full bg-accent-500 px-2 text-xs font-bold text-white">{unread}</span>}</Link>
          {user.role === 'admin' && <Link to="/admin" className="block px-4 py-2.5 font-medium text-brand-700 hover:bg-gray-50">⚙️ Admin panel</Link>}
          {user.role === 'courier' && <Link to="/courier" className="block px-4 py-2.5 font-medium text-brand-700 hover:bg-gray-50">🛵 Kuryer paneli</Link>}
          <button className="block w-full border-t px-4 py-2.5 text-left text-red-600 hover:bg-gray-50" onClick={async () => { await logout(); nav('/'); }}>Chiqish</button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { count } = useCart();
  const navCls = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'text-brand-600' : 'text-gray-600 hover:text-gray-900'}`;
  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 text-xl shadow-md shadow-brand-500/30">🍔</span>
          <span className="hidden text-lg font-extrabold tracking-tight sm:block">Online<span className="text-brand-500">do'kon</span></span>
        </Link>
        <nav className="ml-2 hidden items-center md:flex">
          <NavLink to="/" end className={navCls}>Bosh sahifa</NavLink>
          <NavLink to="/catalog" className={navCls}>Katalog</NavLink>
        </nav>
        <SearchBox className="mx-auto hidden w-full max-w-md sm:block" />
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <Link to="/cart" className="hidden items-center gap-2 rounded-full p-2 text-gray-700 hover:bg-gray-100 hover:text-brand-600 md:inline-flex" aria-label="Savat">
            <CartIcon count={count} />
          </Link>
          <UserMenu />
        </div>
      </div>
      <div className="container-x pb-3 sm:hidden"><SearchBox /></div>
    </header>
  );
}

function BottomNav() {
  const { count } = useCart();
  const { user } = useAuth();
  const cls = ({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-brand-600' : 'text-gray-500'}`;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-100 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      <NavLink to="/" end className={cls}><span className="text-xl">🏠</span>Bosh</NavLink>
      <NavLink to="/catalog" className={cls}><span className="text-xl">📋</span>Katalog</NavLink>
      <NavLink to="/cart" className={cls}><span className="relative text-xl">🛒{count > 0 && <span className="absolute -right-3 -top-1 rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">{count}</span>}</span>Savat</NavLink>
      <NavLink to={user ? '/profile' : '/login'} className={cls}><span className="text-xl">👤</span>{user ? 'Profil' : 'Kirish'}</NavLink>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-100 bg-white pb-20 md:pb-0">
      <div className="container-x grid gap-8 py-10 text-sm text-gray-600 sm:grid-cols-3">
        <div>
          <div className="mb-2 text-lg font-extrabold text-gray-900">Online<span className="text-brand-500">do'kon</span></div>
          <p>Fastfud, shirinliklar va ichimliklar — uyingizgacha tez va xavfsiz yetkazib beramiz.</p>
        </div>
        <div>
          <div className="mb-2 font-semibold text-gray-900">Bo'limlar</div>
          <ul className="space-y-1">
            <li><Link to="/catalog?category=fastfud" className="hover:text-brand-600">🍔 Fastfud</Link></li>
            <li><Link to="/catalog?category=shirinliklar" className="hover:text-brand-600">🍰 Shirinliklar</Link></li>
            <li><Link to="/catalog?category=ichimliklar" className="hover:text-brand-600">🥤 Ichimliklar</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-2 font-semibold text-gray-900">Aloqa</div>
          <p>📞 +998 71 200 00 00</p>
          <p>🕘 Har kuni 09:00 — 23:00</p>
          <p className="mt-2">💳 Payme · Click · Karta · Naqd</p>
        </div>
      </div>
      <div className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">© {new Date().getFullYear()} Online do'kon · TATU, RVI002-3</div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-6"><Outlet /></main>
      <Footer />
      <BottomNav />
    </div>
  );
}
