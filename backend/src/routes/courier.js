import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notFound } from '../utils/errors.js';
import { changeStatus } from '../services/orders.js';
import { orderDetails } from './orders.js';

const r = Router();
r.use('/courier', requireAuth, requireRole('courier'));

r.get('/courier/orders', async (req, res) => {
  const { rows } = await query(
    `SELECT o.id, o.status, o.total, o.address, o.phone, o.comment, o.delivery_time, o.payment_method, o.payment_status,
            o.created_at, u.name AS customer_name,
            (SELECT json_agg(json_build_object('name',name,'quantity',quantity)) FROM order_items WHERE order_id=o.id) AS items
     FROM orders o JOIN users u ON u.id=o.user_id
     WHERE o.courier_id=$1 ORDER BY (o.status IN ('delivered','cancelled')), o.id DESC LIMIT 100`, [req.user.id]);
  res.json(rows);
});

r.put('/courier/orders/:id', validate(z.object({ status: z.enum(['on_the_way', 'delivered']) })), async (req, res) => {
  await tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM orders WHERE id=$1 AND courier_id=$2 FOR UPDATE', [Number(req.params.id) || 0, req.user.id]);
    if (!rows[0]) throw notFound('Buyurtma topilmadi yoki sizga tayinlanmagan');
    await changeStatus(c, rows[0], req.body.status, req.user);
  });
  res.json(await orderDetails(Number(req.params.id)));
});

export default r;
