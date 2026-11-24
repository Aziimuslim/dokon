import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { badRequest, notFound } from '../utils/errors.js';
import { calcTotals, unitPrice } from '../utils/pricing.js';

const r = Router();
r.use('/cart', requireAuth);

export async function loadCart(userId, db = { query }) {
  const { rows } = await db.query(
    `SELECT c.product_id, c.quantity, p.name, p.price, p.discount, p.image, p.available, p.is_deleted
     FROM cart c JOIN products p ON p.id=c.product_id WHERE c.user_id=$1 ORDER BY c.id`, [userId]);
  return rows;
}

async function cartResponse(userId) {
  const rows = await loadCart(userId);
  const valid = rows.filter((r) => r.available && !r.is_deleted);
  const totals = calcTotals(valid);
  return {
    items: rows.map((r) => ({
      product_id: r.product_id,
      name: r.name,
      image: r.image,
      quantity: r.quantity,
      price: r.price,
      discount: r.discount,
      final_price: unitPrice(r.price, r.discount),
      available: r.available && !r.is_deleted,
    })),
    subtotal: totals.subtotal,
    delivery_fee: totals.delivery_fee,
    total: totals.total,
  };
}

const itemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

async function assertProduct(id) {
  const { rows } = await query('SELECT available, is_deleted FROM products WHERE id=$1', [id]);
  if (!rows[0] || rows[0].is_deleted) throw notFound('Mahsulot topilmadi');
  if (!rows[0].available) throw badRequest('Mahsulot hozircha mavjud emas');
}

r.get('/cart', async (req, res) => res.json(await cartResponse(req.user.id)));

// Savatga qo'shish (miqdor qo'shiladi)
r.post('/cart', validate(itemSchema), async (req, res) => {
  await assertProduct(req.body.product_id);
  await query(
    `INSERT INTO cart (user_id, product_id, quantity) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = LEAST(cart.quantity + EXCLUDED.quantity, 99)`,
    [req.user.id, req.body.product_id, req.body.quantity]);
  res.status(201).json(await cartResponse(req.user.id));
});

// Miqdorni aniq qiymatga o'rnatish
r.put('/cart/:productId', validate(itemSchema.pick({ quantity: true })), async (req, res) => {
  const { rowCount } = await query('UPDATE cart SET quantity=$1 WHERE user_id=$2 AND product_id=$3',
    [req.body.quantity, req.user.id, Number(req.params.productId) || 0]);
  if (!rowCount) throw notFound('Savatda bunday mahsulot yo\'q');
  res.json(await cartResponse(req.user.id));
});

r.delete('/cart/:productId', async (req, res) => {
  await query('DELETE FROM cart WHERE user_id=$1 AND product_id=$2', [req.user.id, Number(req.params.productId) || 0]);
  res.json(await cartResponse(req.user.id));
});

r.delete('/cart', async (req, res) => {
  await query('DELETE FROM cart WHERE user_id=$1', [req.user.id]);
  res.json(await cartResponse(req.user.id));
});

// Mehmon sifatida yig'ilgan savatni kirgandan keyin birlashtirish
r.post('/cart/merge', validate(z.object({ items: z.array(itemSchema).max(50) })), async (req, res) => {
  await tx(async (c) => {
    for (const it of req.body.items) {
      const { rows } = await c.query('SELECT 1 FROM products WHERE id=$1 AND available AND NOT is_deleted', [it.product_id]);
      if (!rows.length) continue;
      await c.query(
        `INSERT INTO cart (user_id, product_id, quantity) VALUES ($1,$2,$3)
         ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = LEAST(GREATEST(cart.quantity, EXCLUDED.quantity), 99)`,
        [req.user.id, it.product_id, it.quantity]);
    }
  });
  res.json(await cartResponse(req.user.id));
});

export default r;
