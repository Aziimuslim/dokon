import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { query, tx } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { badRequest, notFound } from '../utils/errors.js';
import { clean } from '../utils/sanitize.js';
import { changeStatus } from '../services/orders.js';
import { notify } from '../services/notify.js';
import { productView } from './catalog.js';
import { orderDetails } from './orders.js';
import { UPLOAD_DIR } from '../paths.js';

const r = Router();
r.use('/admin', requireAuth, requireRole('admin'));

// ---------- Rasm yuklash ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      && ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : badRequest('Faqat JPG, PNG yoki WEBP rasm'), ok);
  },
});
r.post('/admin/upload', upload.single('image'), (req, res) => {
  if (!req.file) throw badRequest('Rasm tanlanmagan');
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

// ---------- Mahsulotlar ----------
const productSchema = z.object({
  name: z.string().trim().min(2).max(150).transform(clean),
  description: z.string().trim().max(2000).default('').transform(clean),
  ingredients: z.string().trim().max(1000).default('').transform(clean),
  price: z.coerce.number().int().min(0).max(100_000_000),
  discount: z.coerce.number().int().min(0).max(90).default(0),
  image: z.string().trim().max(300).regex(/^(\/uploads\/[\w.-]+|https:\/\/[^\s"'<>]+)?$/, 'Rasm manzili noto\'g\'ri').default(''),
  category_id: z.coerce.number().int().positive().nullable(),
  available: z.boolean().default(true),
});

r.get('/admin/products', async (_req, res) => {
  const { rows } = await query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p
     LEFT JOIN categories c ON c.id=p.category_id WHERE NOT p.is_deleted ORDER BY p.id DESC`);
  res.json(rows.map(productView));
});
r.post('/admin/products', validate(productSchema), async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    `INSERT INTO products (name, description, ingredients, price, discount, image, category_id, available)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [b.name, b.description, b.ingredients, b.price, b.discount, b.image, b.category_id, b.available]);
  res.status(201).json(productView(rows[0]));
});
r.put('/admin/products/:id', validate(productSchema.partial()), async (req, res) => {
  const fields = Object.keys(req.body).filter((k) => req.body[k] !== undefined);
  if (!fields.length) throw badRequest('O\'zgartirish uchun maydon yo\'q');
  const set = fields.map((k, i) => `${k}=$${i + 1}`).join(', ');  // kalitlar zod sxemasidan — xavfsiz
  const { rows } = await query(`UPDATE products SET ${set} WHERE id=$${fields.length + 1} AND NOT is_deleted RETURNING *`,
    [...fields.map((k) => req.body[k]), Number(req.params.id) || 0]);
  if (!rows[0]) throw notFound('Mahsulot topilmadi');
  res.json(productView(rows[0]));
});
r.delete('/admin/products/:id', async (req, res) => {
  // Yumshoq o'chirish: eski buyurtmalar tarixi saqlanib qoladi
  const { rowCount } = await query('UPDATE products SET is_deleted=TRUE, available=FALSE WHERE id=$1', [Number(req.params.id) || 0]);
  if (!rowCount) throw notFound('Mahsulot topilmadi');
  await query('DELETE FROM cart WHERE product_id=$1', [Number(req.params.id)]);
  res.json({ ok: true });
});

// ---------- Kategoriyalar ----------
const catSchema = z.object({
  name: z.string().trim().min(2).max(100).transform(clean),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,100}$/, 'Slug: lotin harflari, raqam va "-"'),
  icon: z.string().trim().max(10).default('🍽️'),
  sort: z.coerce.number().int().default(0),
});
r.post('/admin/categories', validate(catSchema), async (req, res) => {
  const b = req.body;
  const { rows } = await query('INSERT INTO categories (name, slug, icon, sort) VALUES ($1,$2,$3,$4) RETURNING *', [b.name, b.slug, b.icon, b.sort]);
  res.status(201).json(rows[0]);
});
r.put('/admin/categories/:id', validate(catSchema), async (req, res) => {
  const b = req.body;
  const { rows } = await query('UPDATE categories SET name=$1, slug=$2, icon=$3, sort=$4 WHERE id=$5 RETURNING *',
    [b.name, b.slug, b.icon, b.sort, Number(req.params.id) || 0]);
  if (!rows[0]) throw notFound();
  res.json(rows[0]);
});
r.delete('/admin/categories/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM categories WHERE id=$1', [Number(req.params.id) || 0]);
  if (!rowCount) throw notFound();
  res.json({ ok: true });
});

// ---------- Aksiyalar ----------
const promoSchema = z.object({
  title: z.string().trim().min(2).max(150).transform(clean),
  subtitle: z.string().trim().max(300).default('').transform(clean),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#f97316'),
  emoji: z.string().trim().max(10).default('🔥'),
  category_id: z.coerce.number().int().positive().nullable().default(null),
  active: z.boolean().default(true),
});
r.get('/admin/promotions', async (_req, res) => res.json((await query('SELECT * FROM promotions ORDER BY id DESC')).rows));
r.post('/admin/promotions', validate(promoSchema), async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    'INSERT INTO promotions (title, subtitle, color, emoji, category_id, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [b.title, b.subtitle, b.color, b.emoji, b.category_id, b.active]);
  res.status(201).json(rows[0]);
});
r.put('/admin/promotions/:id', validate(promoSchema), async (req, res) => {
  const b = req.body;
  const { rows } = await query(
    'UPDATE promotions SET title=$1, subtitle=$2, color=$3, emoji=$4, category_id=$5, active=$6 WHERE id=$7 RETURNING *',
    [b.title, b.subtitle, b.color, b.emoji, b.category_id, b.active, Number(req.params.id) || 0]);
  if (!rows[0]) throw notFound();
  res.json(rows[0]);
});
r.delete('/admin/promotions/:id', async (req, res) => {
  await query('DELETE FROM promotions WHERE id=$1', [Number(req.params.id) || 0]);
  res.json({ ok: true });
});

// ---------- Buyurtmalar ----------
r.get('/admin/orders', validate(z.object({
  status: z.enum(['accepted', 'preparing', 'on_the_way', 'delivered', 'cancelled']).optional(),
  q: z.string().trim().max(50).optional(),
}), 'query'), async (req, res) => {
  const { status, q } = req.validQuery;
  const params = [];
  const where = [];
  if (status) { params.push(status); where.push(`o.status=$${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(o.id::text ILIKE $${params.length} OR u.name ILIKE $${params.length} OR o.phone ILIKE $${params.length})`); }
  const { rows } = await query(
    `SELECT o.*, u.name AS customer_name, cu.name AS courier_name,
            (SELECT COUNT(*)::int FROM order_items WHERE order_id=o.id) AS item_count
     FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN users cu ON cu.id=o.courier_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.id DESC LIMIT 200`, params);
  res.json(rows);
});
r.get('/admin/orders/:id', async (req, res) => {
  const o = await orderDetails(Number(req.params.id) || 0);
  if (!o) throw notFound('Buyurtma topilmadi');
  res.json(o);
});
r.put(['/admin/orders/:id', '/admin/orders/:id/status'], validate(z.object({
  status: z.enum(['accepted', 'preparing', 'on_the_way', 'delivered', 'cancelled']).optional(),
  courier_id: z.coerce.number().int().positive().nullable().optional(),
})), async (req, res) => {
  const id = Number(req.params.id) || 0;
  await tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id]);
    if (!rows[0]) throw notFound('Buyurtma topilmadi');
    let order = rows[0];
    if (req.body.courier_id !== undefined) {
      if (req.body.courier_id !== null) {
        const cr = await c.query(`SELECT id FROM users WHERE id=$1 AND role='courier' AND is_active`, [req.body.courier_id]);
        if (!cr.rowCount) throw badRequest('Kuryer topilmadi');
        await notify(req.body.courier_id, `Yangi yetkazish: #${id}`, order.address, c);
      }
      order = (await c.query('UPDATE orders SET courier_id=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [req.body.courier_id, id])).rows[0];
    }
    if (req.body.status) await changeStatus(c, order, req.body.status, req.user);
  });
  res.json(await orderDetails(id));
});

// ---------- Foydalanuvchilar ----------
r.get('/admin/users', validate(z.object({ role: z.enum(['customer', 'admin', 'courier']).optional() }), 'query'), async (req, res) => {
  const params = req.validQuery.role ? [req.validQuery.role] : [];
  const { rows } = await query(
    `SELECT u.id, u.name, u.phone, u.email, u.role, u.is_active, u.created_at,
            COUNT(o.id)::int AS orders, COALESCE(SUM(o.total) FILTER (WHERE o.status<>'cancelled'),0)::int AS spent
     FROM users u LEFT JOIN orders o ON o.user_id=u.id
     ${params.length ? 'WHERE u.role=$1' : ''} GROUP BY u.id ORDER BY u.id DESC`, params);
  res.json(rows);
});
r.put('/admin/users/:id', validate(z.object({
  role: z.enum(['customer', 'admin', 'courier']).optional(),
  is_active: z.boolean().optional(),
})), async (req, res) => {
  const id = Number(req.params.id) || 0;
  if (id === req.user.id) throw badRequest('O\'z hisobingizni o\'zgartira olmaysiz');
  const { rows } = await query(
    `UPDATE users SET role=COALESCE($1, role), is_active=COALESCE($2, is_active) WHERE id=$3
     RETURNING id, name, phone, email, role, is_active`, [req.body.role ?? null, req.body.is_active ?? null, id]);
  if (!rows[0]) throw notFound();
  if (req.body.is_active === false || req.body.role) await query('UPDATE refresh_tokens SET revoked=TRUE WHERE user_id=$1', [id]);
  res.json(rows[0]);
});

// ---------- Hisobotlar ----------
r.get('/admin/reports', validate(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }), 'query'), async (req, res) => {
  const days = req.validQuery.days;
  const [summary, daily, top, byStatus, byCategory, byPayment] = await Promise.all([
    query(`SELECT COUNT(*)::int AS orders,
                  COALESCE(SUM(total) FILTER (WHERE status<>'cancelled'),0)::int AS revenue,
                  COALESCE(SUM(total) FILTER (WHERE payment_status='paid'),0)::int AS paid_revenue,
                  COALESCE(ROUND(AVG(total) FILTER (WHERE status<>'cancelled')),0)::int AS avg_check,
                  COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled,
                  COUNT(DISTINCT user_id)::int AS customers
           FROM orders WHERE created_at >= NOW() - ($1 || ' days')::interval`, [days]),
    query(`SELECT to_char(d, 'YYYY-MM-DD') AS day,
                  COALESCE(SUM(o.total) FILTER (WHERE o.status<>'cancelled'),0)::int AS revenue,
                  COUNT(o.id)::int AS orders
           FROM generate_series(date_trunc('day', NOW()) - ($1 || ' days')::interval + interval '1 day', date_trunc('day', NOW()), interval '1 day') d
           LEFT JOIN orders o ON date_trunc('day', o.created_at)=d
           GROUP BY d ORDER BY d`, [days]),
    query(`SELECT oi.name, SUM(oi.quantity)::int AS quantity, SUM(oi.quantity*oi.price)::int AS revenue
           FROM order_items oi JOIN orders o ON o.id=oi.order_id
           WHERE o.status<>'cancelled' AND o.created_at >= NOW() - ($1 || ' days')::interval
           GROUP BY oi.name ORDER BY quantity DESC LIMIT 10`, [days]),
    query(`SELECT status, COUNT(*)::int AS n FROM orders WHERE created_at >= NOW() - ($1 || ' days')::interval GROUP BY status`, [days]),
    query(`SELECT COALESCE(c.name,'Boshqa') AS category, SUM(oi.quantity*oi.price)::int AS revenue
           FROM order_items oi JOIN orders o ON o.id=oi.order_id
           LEFT JOIN products p ON p.id=oi.product_id LEFT JOIN categories c ON c.id=p.category_id
           WHERE o.status<>'cancelled' AND o.created_at >= NOW() - ($1 || ' days')::interval
           GROUP BY 1 ORDER BY 2 DESC`, [days]),
    query(`SELECT payment_method, COUNT(*)::int AS n, COALESCE(SUM(total),0)::int AS revenue FROM orders
           WHERE status<>'cancelled' AND created_at >= NOW() - ($1 || ' days')::interval GROUP BY 1`, [days]),
  ]);
  res.json({ days, summary: summary.rows[0], daily: daily.rows, top_products: top.rows, by_status: byStatus.rows, by_category: byCategory.rows, by_payment: byPayment.rows });
});

export default r;
