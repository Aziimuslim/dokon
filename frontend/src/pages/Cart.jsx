import { Link, useNavigate } from 'react-router-dom';
import { fmt } from '../lib/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Empty, QtyControl } from '../components/ui';

export default function Cart() {
  const { cart, setQty, remove } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const hasUnavailable = cart.items.some((i) => i.available === false);

  if (!cart.items.length) {
    return (
      <div className="container-x pt-6">
        <Empty icon="🛒" title="Savat bo'sh" text="Katalogdan mazali taomlarni tanlang." action={<Link to="/catalog" className="btn-primary">Katalogga o'tish</Link>} />
      </div>
    );
  }
  const left = 100000 - cart.subtotal;

  return (
    <div className="container-x pt-6">
      <h1 className="mb-5 text-2xl font-extrabold sm:text-3xl">Savat</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card divide-y divide-gray-100">
          {cart.items.map((i) => (
            <div key={i.product_id} className={`flex gap-3 p-3 sm:gap-4 sm:p-4 ${i.available === false ? 'opacity-50' : ''}`}>
              <Link to={`/product/${i.product_id}`} className="shrink-0"><img src={i.image} alt="" className="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24" /></Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/product/${i.product_id}`} className="font-semibold leading-snug hover:text-brand-600">{i.name}</Link>
                  <button className="text-gray-400 hover:text-red-500" onClick={() => remove(i.product_id)} aria-label="O'chirish">✕</button>
                </div>
                <div className="text-sm text-gray-500">{fmt(i.final_price)} {i.discount > 0 && <span className="line-through">{fmt(i.price)}</span>}</div>
                {i.available === false && <div className="text-sm font-medium text-red-600">Hozircha mavjud emas</div>}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <QtyControl size="sm" value={i.quantity} onChange={(v) => setQty(i.product_id, v)} />
                  <span className="font-bold">{fmt(i.final_price * i.quantity)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 text-lg font-bold">Buyurtma</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Mahsulotlar</span><span>{fmt(cart.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Yetkazish</span><span>{cart.delivery_fee ? fmt(cart.delivery_fee) : <span className="font-medium text-green-600">Bepul</span>}</span></div>
          </div>
          {left > 0 && (
            <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
              Bepul yetkazish uchun yana <b>{fmt(left)}</b>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-100"><div className="h-full bg-brand-500" style={{ width: `${Math.min(100, (cart.subtotal / 100000) * 100)}%` }} /></div>
            </div>
          )}
          <div className="mt-4 flex justify-between border-t pt-4 text-lg font-extrabold"><span>Jami</span><span>{fmt(cart.total)}</span></div>
          <button className="btn-primary mt-4 w-full !py-3" disabled={hasUnavailable && cart.items.every((i) => i.available === false)}
            onClick={() => nav(user ? '/checkout' : '/login?next=/checkout')}>
            {user ? 'Rasmiylashtirish' : 'Kirish va rasmiylashtirish'}
          </button>
          {!user && <p className="mt-2 text-center text-xs text-gray-500">Buyurtma berish uchun ro'yxatdan o'tish kerak</p>}
          {hasUnavailable && <p className="mt-2 text-center text-xs text-red-600">Mavjud bo'lmagan mahsulotlar buyurtmaga kiritilmaydi</p>}
        </aside>
      </div>
    </div>
  );
}
