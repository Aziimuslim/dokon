import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../../lib/api';
import { PageLoader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const ROLES = { customer: 'Mijoz', courier: 'Kuryer', admin: 'Admin' };

export default function AdminUsers() {
  const [list, setList] = useState(null);
  const [role, setRole] = useState('');
  const { user } = useAuth();
  const toast = useToast();
  const load = () => api(`/admin/users${role ? `?role=${role}` : ''}`).then(setList);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role]);

  async function patch(u, body) {
    try { await api(`/admin/users/${u.id}`, { method: 'PUT', body }); toast('Yangilandi'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Foydalanuvchilar</h1>
      <div className="mb-4 flex gap-2">
        <button className={!role ? 'chip-on' : 'chip-off'} onClick={() => setRole('')}>Barchasi</button>
        {Object.entries(ROLES).map(([k, v]) => <button key={k} className={role === k ? 'chip-on' : 'chip-off'} onClick={() => setRole(k)}>{v}</button>)}
      </div>
      {!list ? <PageLoader /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="p-3">Foydalanuvchi</th><th className="p-3">Ro'yxat</th><th className="p-3">Buyurtmalar</th><th className="p-3">Rol</th><th className="p-3">Holat</th></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-b border-gray-50">
                  <td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-gray-500">{u.phone} {u.email}</div></td>
                  <td className="p-3 text-gray-600">{fmtDate(u.created_at)}</td>
                  <td className="p-3">{u.orders} · <span className="text-gray-500">{fmt(u.spent)}</span></td>
                  <td className="p-3">
                    <select className="input !w-auto !py-1.5 text-sm" value={u.role} disabled={u.id === user.id} onChange={(e) => patch(u, { role: e.target.value })}>
                      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <button disabled={u.id === user.id} onClick={() => patch(u, { is_active: !u.is_active })} className={`rounded-full px-3 py-1 text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Faol' : 'Bloklangan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
