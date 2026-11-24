import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function AdminCategories() {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  const toast = useToast();
  const load = () => api('/categories').then(setList);
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    const body = { name: edit.name, slug: edit.slug, icon: edit.icon || '🍽️', sort: Number(edit.sort) || 0 };
    try {
      await api(edit.id ? `/admin/categories/${edit.id}` : '/admin/categories', { method: edit.id ? 'PUT' : 'POST', body });
      setEdit(null); load(); toast('Saqlandi');
    } catch (err) { toast(err.body?.details?.[0]?.message || err.message, 'error'); }
  }
  async function del(c) {
    if (!confirm(`«${c.name}» o'chirilsinmi? Mahsulotlar kategoriyasiz qoladi.`)) return;
    await api(`/admin/categories/${c.id}`, { method: 'DELETE' }); load();
  }
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-extrabold">Kategoriyalar</h1><button className="btn-primary" onClick={() => setEdit({ name: '', slug: '', icon: '🍽️', sort: list.length + 1 })}>+ Qo'shish</button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <div key={c.id} className="card flex items-center gap-3 p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">{c.icon}</span>
            <div className="flex-1"><div className="font-bold">{c.name}</div><div className="text-xs text-gray-500">/{c.slug} · {c.product_count} mahsulot</div></div>
            <button className="btn-ghost !px-2" onClick={() => setEdit(c)}>✏️</button>
            <button className="btn-ghost !px-2" onClick={() => del(c)}>🗑️</button>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Tahrirlash' : 'Yangi kategoriya'}>
        {edit && (
          <form onSubmit={save} className="grid grid-cols-[80px_1fr] gap-3">
            <input className="input text-center text-2xl" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} />
            <input className="input" required placeholder="Nomi" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <input className="input col-span-2" required placeholder="slug (masalan: salatlar)" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
            <input className="input col-span-2" type="number" placeholder="Tartib" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value })} />
            <button className="btn-primary col-span-2">Saqlash</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
