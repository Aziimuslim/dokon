import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { safeEqual } from '../utils/signature.js';
import { checkoutToken, handleCallback, sandboxCharge, TEST_CARDS } from '../services/payment.js';

const r = Router();

/** To'lovni boshlash: summa bazadagi buyurtmadan olinadi */
r.post('/payment', requireAuth, validate(z.object({ order_id: z.coerce.number().int().positive() })), async (req, res) => {
  const { rows } = await query('SELECT * FROM orders WHERE id=$1 AND user_id=$2', [req.body.order_id, req.user.id]);
  const o = rows[0];
  if (!o) throw notFound('Buyurtma topilmadi');
  if (o.payment_method === 'cash') throw badRequest('Bu buyurtma naqd to\'lanadi');
  if (o.payment_status === 'paid') throw badRequest('Buyurtma allaqachon to\'langan');
  if (o.status === 'cancelled') throw badRequest('Buyurtma bekor qilingan');
  await query(`UPDATE payments SET status='cancelled' WHERE order_id=$1 AND status='created'`, [o.id]);
  const p = (await query(
    `INSERT INTO payments (order_id, provider, amount) VALUES ($1,$2,$3) RETURNING *`,
    [o.id, o.payment_method, o.total])).rows[0];
  if (o.payment_status === 'failed') await query(`UPDATE orders SET payment_status='pending' WHERE id=$1`, [o.id]);
  const token = checkoutToken(p);
  res.status(201).json({ payment_id: p.id, amount: p.amount, provider: p.provider, checkout_url: `/pay/${p.id}?t=${token}` });
});

async function loadCheckout(id, token) {
  const { rows } = await query('SELECT * FROM payments WHERE id=$1', [Number(id) || 0]);
  const p = rows[0];
  if (!p) throw notFound('To\'lov topilmadi');
  if (!safeEqual(checkoutToken(p), String(token || ''))) throw forbidden('To\'lov havolasi yaroqsiz');
  return p;
}

// ---- Sandbox to'lov sahifasi API (provayder tomonini simulyatsiya qiladi) ----
r.get('/payment/sandbox/:id', async (req, res) => {
  const p = await loadCheckout(req.params.id, req.query.t);
  res.json({ id: p.id, order_id: p.order_id, provider: p.provider, amount: p.amount, status: p.status, test_cards: TEST_CARDS, test_sms_code: '666666' });
});

const chargeSchema = z.object({
  t: z.string(),
  number: z.string().max(25),
  expiry: z.string().max(5),
  code: z.string().max(6),
});
r.post('/payment/sandbox/:id/confirm', validate(chargeSchema), async (req, res) => {
  const p = await loadCheckout(req.params.id, req.body.t);
  if (p.status !== 'created') throw badRequest('Bu to\'lov allaqachon yakunlangan');
  const callback = sandboxCharge(p, req.body);
  // Provayder serverimizga imzolangan callback yuboradi
  const result = await handleCallback(callback);
  res.json({ ...result, message: result.status === 'paid' ? 'To\'lov muvaffaqiyatli' : 'Kartada mablag\' yetarli emas' });
});

// ---- Provayder callback (webhook) — faqat imzo to'g'ri bo'lsa qabul qilinadi ----
const callbackSchema = z.object({
  payment_id: z.coerce.number().int(),
  order_id: z.coerce.number().int(),
  amount: z.coerce.number().int(),
  status: z.enum(['paid', 'failed']),
  provider_txn: z.string().max(100),
  sign: z.string().max(128),
});
r.post('/payment/callback', validate(callbackSchema), async (req, res) => {
  res.json(await handleCallback(req.body));
});

r.get('/payment/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.order_id, p.provider, p.amount, p.status, p.paid_at FROM payments p
     JOIN orders o ON o.id=p.order_id WHERE p.id=$1 AND o.user_id=$2`, [Number(req.params.id) || 0, req.user.id]);
  if (!rows[0]) throw notFound('To\'lov topilmadi');
  res.json(rows[0]);
});

export default r;
