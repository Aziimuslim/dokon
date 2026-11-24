import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db/pool.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { calcTotals } from '../utils/pricing.js';
import { signQuote, safeEqual, hmac, orderString } from '../utils/signature.js';
import { clean } from '../utils/sanitize.js';
import { notify } from '../services/notify.js';
import { changeStatus } from '../services/orders.js';
import { loadCart } from './cart.js';
import { normalizePhone } from './auth.js';

const r = Router();
r.use('/orders', requireAuth);

async function currentTotals(userId, db) {
  const rows = (await loadCart(userId, db)).filter((x) => x.available && !x.is_deleted);
  if (!rows.length) throw badRequest('Savat bo\'sh');
  return calcTotals(rows);
}

/**
 * 1-qadam: server narxlarni hisoblaydi va imzolangan "kotirovka" qaytaradi.
 * Mijoz faqat shu imzoni qaytarib yuboradi — summa mijozdan olinmaydi.
 */
r.post('/orders/preview', async (req, res) => {
  const totals = await currentTotals(req.user.id);
  const expires_at = Date.now() + config.quoteTtlMs;
  res.json({ ...totals, expires_at, signature: signQuote(config.orderSignSecret, req.user.id, totals, expires_at) });
});

const createSchema = z.object({
  address: z.string().trim().min(5, 'Manzilni to\'liq kiriting').max(300).transform(clean),
  phone: z.string().trim().transform(normalizePhone).refine((v) => /^\+998\d{9}$/.test(v), 'Telefon formati: +998XXXXXXXXX'),
  delivery_time: z.string().trim().regex(/^(asap|\d{2}:\d{2}-\d{2}:\d{2})$/, 'Yetkazish vaqti noto\'g\'ri').default('asap'),
  payment_method: z.enum(['payme', 'click', 'card', 'cash']),
  comment: z.string().trim().max(500).default('').transform(clean),
  quote: z.object({
    expires_at: z.number().int(),
    signature: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});

/** 2-qadam: buyurtma yaratish — imzo tekshiriladi va summa qayta hisoblanadi */
r.post('/orders', validate(createSchema), async (req, res) => {
  const b = req.body;
  if (b.quote.expires_at < Date.now()) throw conflict('Kotirovka muddati tugadi, qaytadan tasdiqlang');

  const order = await tx(async (c) => {
    // Savat qatorlarini qulflaymiz (bir vaqtda ikki marta buyurtma berishning oldini olish)
    await c.query('SELECT id FROM cart WHERE user_id=$1 FOR UPDATE', [req.user.id]);
    const totals = await currentTotals(req.user.id, c);
    const expected = signQuote(config.orderSignSecret, req.user.id, totals, b.quote.expires_at);
    if (!safeEqual(expected, b.quote.signature)) {
      throw conflict('Imzo mos kelmadi: narx yoki savat o\'zgargan. Qaytadan tasdiqlang.', { totals });
    }
    const { rows } = await c.query(
      `INSERT INTO orders (user_id, subtotal, delivery_fee, total, payment_method, address, phone, comment, delivery_time, signature)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'') RETURNING *`,
      [req.user.id, totals.subtotal, totals.delivery_fee, totals.total, b.payment_method, b.address, b.phone, b.comment, b.delivery_time]);
    const o = rows[0];
    o.signature = hmac(config.orderSignSecret, orderString(o));
    await c.query('UPDATE orders SET signature=$1 WHERE id=$2', [o.signature, o.id]);
    for (const it of totals.items) {
      await c.query('INSERT INTO order_items (order_id, product_id, name, quantity, price) VALUES ($1,$2,$3,$4,$5)',
        [o.id, it.product_id, it.name, it.quantity, it.price]);
      await c.query('UPDATE products SET sold_count = sold_count + $1 WHERE id=$2', [it.quantity, it.product_id]);
    }
    await c.query('INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1,$2,$3)', [o.id, 'accepted', req.user.id]);
    await c.query('DELETE FROM cart WHERE user_id=$1', [req.user.id]);
    await notify(req.user.id, `Buyurtma #${o.id} qabul qilindi`, `Jami: ${o.total.toLocaleString('ru-RU')} so'm`, c);
    return { ...o, items: totals.items };
  });
  res.status(201).json(order);
});

r.get('/orders', async (req, res) => {
  const { rows } = await query(
    `SELECT o.*, COALESCE(json_agg(json_build_object('product_id',oi.product_id,'name',oi.name,'quantity',oi.quantity,'price',oi.price)
       ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
     FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
     WHERE o.user_id=$1 GROUP BY o.id ORDER BY o.id DESC`, [req.user.id]);
  res.json(rows);
});

export async function orderDetails(id, db = { query }) {
  const { rows } = await db.query(
    `SELECT o.*, u.name AS customer_name, cu.name AS courier_name, cu.phone AS courier_phone
     FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN users cu ON cu.id=o.courier_id WHERE o.id=$1`, [id]);
  if (!rows[0]) return null;
  const items = await db.query(
    `SELECT oi.product_id, oi.name, oi.quantity, oi.price, p.image FROM order_items oi
     LEFT JOIN products p ON p.id=oi.product_id WHERE order_id=$1 ORDER BY oi.id`, [id]);
  const history = await db.query('SELECT status, created_at FROM order_status_history WHERE order_id=$1 ORDER BY id', [id]);
  const o = rows[0];
  o.signature_valid = safeEqual(o.signature, hmac(config.orderSignSecret, orderString(o)));
  return { ...o, items: items.rows, history: history.rows };
}

r.get('/orders/:id', async (req, res) => {
  const o = await orderDetails(Number(req.params.id) || 0);
  if (!o || o.user_id !== req.user.id) throw notFound('Buyurtma topilmadi');
  res.json(o);
});

// Mijoz faqat "qabul qilindi" holatidagi buyurtmani bekor qila oladi
r.post('/orders/:id/cancel', async (req, res) => {
  const updated = await tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE', [Number(req.params.id) || 0, req.user.id]);
    if (!rows[0]) throw notFound('Buyurtma topilmadi');
    if (rows[0].status !== 'accepted') throw badRequest('Buyurtma tayyorlanishni boshlagan, bekor qilib bo\'lmaydi');
    return changeStatus(c, rows[0], 'cancelled', req.user);
  });
  res.json(updated);
});

export default r;
