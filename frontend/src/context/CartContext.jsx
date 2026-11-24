import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const CartCtx = createContext(null);
const KEY = 'guest_cart_v1';
const DELIVERY_FEE = 10000;
const FREE_FROM = 100000;

const readGuest = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const writeGuest = (items) => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* */ } };

/** Mehmon savati uchun faqat ko'rsatish maqsadida hisob. Haqiqiy summa har doim serverda hisoblanadi. */
function guestTotals(items) {
  const subtotal = items.reduce((s, i) => s + i.final_price * i.quantity, 0);
  const delivery_fee = subtotal === 0 || subtotal >= FREE_FROM ? 0 : DELIVERY_FEE;
  return { items, subtotal, delivery_fee, total: subtotal + delivery_fee };
}

export function CartProvider({ children }) {
  const { user, ready } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState(guestTotals(readGuest()));
  const [loading, setLoading] = useState(false);
  // true — savat serverdan yuklangan (mehmon savati birlashtirilgan)
  const [syncedKey, setSyncedKey] = useState(null);
  const key = user ? `u${user.id}` : 'guest';
  const synced = ready && syncedKey === key;

  const reload = useCallback(async () => {
    if (!user) { setCart(guestTotals(readGuest())); return; }
    setCart(await api('/cart'));
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    if (user) {
      const guest = readGuest();
      const p = guest.length
        ? api('/cart/merge', { method: 'POST', body: { items: guest.map(({ product_id, quantity }) => ({ product_id, quantity })) } })
            .then((c) => { writeGuest([]); return c; })
        : api('/cart');
      p.then(setCart).catch(() => {}).finally(() => setSyncedKey(`u${user.id}`));
    } else {
      setCart(guestTotals(readGuest()));
      setSyncedKey('guest');
    }
  }, [user, ready]);

  const add = useCallback(async (product, quantity = 1) => {
    setLoading(true);
    try {
      if (user) {
        setCart(await api('/cart', { method: 'POST', body: { product_id: product.id, quantity } }));
      } else {
        const items = readGuest();
        const ex = items.find((i) => i.product_id === product.id);
        if (ex) ex.quantity = Math.min(ex.quantity + quantity, 99);
        else items.push({ product_id: product.id, name: product.name, image: product.image, price: product.price, discount: product.discount, final_price: product.final_price, quantity, available: true });
        writeGuest(items);
        setCart(guestTotals(items));
      }
      toast(`«${product.name}» savatga qo'shildi`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const setQty = useCallback(async (productId, quantity) => {
    if (quantity < 1) return remove(productId);
    if (user) setCart(await api(`/cart/${productId}`, { method: 'PUT', body: { quantity } }));
    else {
      const items = readGuest().map((i) => (i.product_id === productId ? { ...i, quantity: Math.min(quantity, 99) } : i));
      writeGuest(items);
      setCart(guestTotals(items));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const remove = useCallback(async (productId) => {
    if (user) setCart(await api(`/cart/${productId}`, { method: 'DELETE' }));
    else {
      const items = readGuest().filter((i) => i.product_id !== productId);
      writeGuest(items);
      setCart(guestTotals(items));
    }
  }, [user]);

  const count = useMemo(() => cart.items.reduce((s, i) => s + i.quantity, 0), [cart]);
  const qtyOf = useCallback((id) => cart.items.find((i) => i.product_id === id)?.quantity || 0, [cart]);

  return (
    <CartCtx.Provider value={{ cart, count, add, setQty, remove, reload, loading, qtyOf, synced }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => useContext(CartCtx);
