import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  ['/admin', '📊', 'Hisobotlar', true],
  ['/admin/orders', '📦', 'Buyurtmalar'],
  ['/admin/products', '🍔', 'Mahsulotlar'],
  ['/admin/categories', '🗂️', 'Kategoriyalar'],
  ['/admin/promotions', '🔥', 'Aksiyalar'],
  ['/admin/users', '👥', 'Foydalanuvchilar'],
];

export default function AdminLayout() {
  return (
    <div className="container-x pt-6">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside>
          <div className="mb-3 hidden text-xs font-bold uppercase tracking-wider text-gray-400 lg:block">Admin panel</div>
          <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:px-0">
            {LINKS.map(([to, i, l, end]) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${isActive ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 shadow-card hover:text-brand-600'}`}>
                <span>{i}</span>{l}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </div>
  );
}
