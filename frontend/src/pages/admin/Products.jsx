import { useEffect, useState } from 'react';
import { api, fmt } from '../../lib/api';
import { Field, Modal, PageLoader, fieldErrors } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

const EMPTY = { name: '', description: '', ingredients: '', price: '', discount: 0, image: '', category_id: '', available: true };

function ProductForm({ initial, cats, onClose, onSaved }) {
  const [f, setF] = useState(initial ? { ...EMPTY, ...initial, category_id: initial.category_id || '' } : EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try { const r = await api('/admin/upload', { method: 'POST', form }); setF((x) => ({ ...x, image: r.url })); }
    catch (err) { toast(err.message, 'error'); }
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setErrors({});
    const body = {
      name: f.name, description: f.description, ingredients: f.ingredients, image: f.image,
      price: Number(f.price), discount: Number(f.discount) || 0, category_id: f.category_id ? Number(f.category_id) : null, available: f.available,
    };
    try {
      await api(initial ? `/admin/products/${initial.id}` : '/admin/products', { method: initial ? 'PUT' : 'POST', body });
      toast('Saqlandi'); onSaved(); onClose();
    } catch (err) { setErrors(fieldErrors(err)); toast(err.message, 'error'); }
    finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={initial ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'} wide>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nomi" error={errors.name}><input className="input" required value={f.name} onChange={set('name')} /></Field></div>
        <Field label="Narx (so'm)" error={errors.price}><input className="input" required type="number" min="0" value={f.price} onChange={set('price')} /></Field>
        <Field label="Chegirma (%)" error={errors.discount}><input className="input" type="number" min="0" max="90" value={f.discount} onChange={set('discount')} /></Field>
        <Field label="Kategoriya" error={errors.category_id}>
          <select className="input" required value={f.category_id} onChange={set('category_id')}>
            <option value="">Tanlang</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-3"><input type="checkbox" className="h-5 w-5 accent-brand-500" checked={f.available} onChange={set('available')} /> Sotuvda mavjud</label>
        <div className="sm:col-span-2"><Field label="Tavsif" error={errors.description}><textarea className="input" rows={2} value={f.description} onChange={set('description')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Tarkibi (vergul bilan)" error={errors.ingredients}><input className="input" value={f.ingredients} onChange={set('ingredients')} /></Field></div>
        <div className="sm:col-span-2">
          <span className="label">Rasm</span>
          <div className="flex items-center gap-3">
            {f.image ? <img src={f.image} alt="" className="h-20 w-24 rounded-xl object-cover" /> : <div className="flex h-20 w-24 items-center justify-center rounded-xl bg-gray-100 text-3xl">🖼️</div>}
            <div className="flex-1 space-y-2">
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-medium file:text-brand-700" />
              <input className="input !py-2 text-sm" placeholder="yoki https://... havola" value={f.image} onChange={set('image')} />
              {errors.image && <span className="text-sm text-red-600">{errors.image}</span>}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-ghost" onClick={onClose}>Bekor</button><button className="btn-primary" disabled={busy}>Saqlash</button></div>
      </form>
    </Modal>
  );
}

export default function AdminProducts() {
  const [list, setList] = useState(null);
  const [cats, setCats] = useState([]);
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const toast = useToast();
  const load = () => api('/admin/products').then(setList);
  useEffect(() => { load(); api('/categories').then(setCats); }, []);

  async function toggle(p) {
    await api(`/admin/products/${p.id}`, { method: 'PUT', body: { available: !p.available } });
    load();
  }
  async function del(p) {
    if (!confirm(`«${p.name}» o'chirilsinmi?`)) return;
    await api(`/admin/products/${p.id}`, { method: 'DELETE' }); toast("O'chirildi"); load();
  }
  const shown = (list || []).filter((p) => (!cat || String(p.category_id) === cat) && p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Mahsulotlar {list && <span className="text-base font-normal text-gray-500">({list.length})</span>}</h1>
        <button className="btn-primary" onClick={() => setEdit({})}>+ Mahsulot qo'shish</button>
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input className="input" placeholder="Qidirish..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input sm:w-56" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Barcha kategoriyalar</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      {!list ? <PageLoader /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="p-3">Mahsulot</th><th className="p-3">Kategoriya</th><th className="p-3">Narx</th><th className="p-3">Sotilgan</th><th className="p-3">Mavjud</th><th className="p-3" /></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id} className="border-b border-gray-50">
                  <td className="p-3"><div className="flex items-center gap-3"><img src={p.image} alt="" className="h-11 w-11 rounded-lg object-cover" /><span className="font-medium">{p.name}</span></div></td>
                  <td className="p-3 text-gray-600">{p.category_name || '—'}</td>
                  <td className="p-3"><b>{fmt(p.final_price)}</b>{p.discount > 0 && <span className="ml-1 rounded bg-red-50 px-1 text-xs text-red-600">−{p.discount}%</span>}</td>
                  <td className="p-3 text-gray-600">{p.sold_count}</td>
                  <td className="p-3">
                    <button onClick={() => toggle(p)} className={`relative h-6 w-11 rounded-full transition ${p.available ? 'bg-green-500' : 'bg-gray-300'}`} aria-label="Mavjudlik">
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${p.available ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <button className="btn-ghost !px-2 !py-1" onClick={() => setEdit(p)}>✏️</button>
                    <button className="btn-ghost !px-2 !py-1" onClick={() => del(p)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <ProductForm initial={edit.id ? edit : null} cats={cats} onClose={() => setEdit(null)} onSaved={load} />}
    </div>
  );
}
