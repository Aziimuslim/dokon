import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function AdminPromotions() {
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [edit, setEdit] = useState(null);
  const toast = useToast();
  const load = () => api('/admin/promotions').then(setList);
  useEffect(() => { load(); api('/categories').then(setCats); }, []);

  async function save(e) {
    e.preventDefault();
    const body = { title: edit.title, subtitle: edit.subtitle, color: edit.color, emoji: edit.emoji, category_id: edit.category_id ? Number(edit.category_id) : null, active: !!edit.active };
    try {
      await api(edit.id ? `/admin/promotions/${edit.id}` : '/admin/promotions', { method: edit.id ? 'PUT' : 'POST', body });
      setEdit(null); load(); toast('Saqlandi');
    } catch (err) { toast(err.message, 'error'); }
  }
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-extrabold">Aksiyalar</h1>
        <button className="btn-primary" onClick={() => setEdit({ title: '', subtitle: '', color: '#f97316', emoji: '🔥', category_id: '', active: true })}>+ Aksiya</button></div>
      <p className="mb-4 text-sm text-gray-500">Aksiyalar bosh sahifadagi bannerda ko'rinadi. Mahsulot chegirmasini «Mahsulotlar» bo'limida foizda belgilang.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((p) => (
          <div key={p.id} className={`relative overflow-hidden rounded-2xl p-5 text-white ${p.active ? '' : 'opacity-50 grayscale'}`} style={{ background: `linear-gradient(120deg, ${p.color}, #111827)` }}>
            <div className="absolute -right-2 -top-2 text-7xl">{p.emoji}</div>
            <div className="relative max-w-[75%]"><div className="text-lg font-extrabold">{p.title}</div><div className="text-sm opacity-90">{p.subtitle}</div></div>
            <div className="relative mt-4 flex gap-2">
              <button className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium backdrop-blur hover:bg-white/30" onClick={() => setEdit({ ...p, category_id: p.category_id || '' })}>Tahrirlash</button>
              <button className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium backdrop-blur hover:bg-white/30" onClick={async () => { if (confirm("O'chirilsinmi?")) { await api(`/admin/promotions/${p.id}`, { method: 'DELETE' }); load(); } }}>O'chirish</button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Aksiyani tahrirlash' : 'Yangi aksiya'}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            <input className="input" required placeholder="Sarlavha" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            <input className="input" placeholder="Qisqa matn" value={edit.subtitle} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} />
            <div className="grid grid-cols-[80px_80px_1fr] gap-3">
              <input className="input text-center text-2xl" value={edit.emoji} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} />
              <input type="color" className="h-full w-full cursor-pointer rounded-xl border" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} />
              <select className="input" value={edit.category_id} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })}>
                <option value="">Havola: butun katalog</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-brand-500" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Faol</label>
            <button className="btn-primary w-full">Saqlash</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
