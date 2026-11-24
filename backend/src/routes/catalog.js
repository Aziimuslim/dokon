import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { validate } from '../middleware/validate.js';
import { notFound } from '../utils/errors.js';
import { unitPrice } from '../utils/pricing.js';

const r = Router();

export const productView = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  ingredients: p.ingredients,
  price: p.price,
  discount: p.discount,
  final_price: unitPrice(p.price, p.discount),
  image: p.image,
  category_id: p.category_id,
  category_name: p.category_name,
  category_slug: p.category_slug,
  available: p.available,
  sold_count: p.sold_count,
  created_at: p.created_at,
});

r.get('/categories', async (_req, res) => {
  const { rows } = await query(
    `SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id=c.id AND NOT p.is_deleted) AS product_count
     FROM categories c ORDER BY sort, id`);
  res.json(rows);
});

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),   // id yoki slug
  min_price: z.coerce.number().int().min(0).optional(),
  max_price: z.coerce.number().int().min(0).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'new', 'discount']).default('popular'),
  discounted: z.enum(['1', 'true']).optional(),
  available: z.enum(['1', 'true']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

const FINAL = 'ROUND(p.price * (100 - p.discount) / 100.0)';
const ORDER = {
  popular: 'p.sold_count DESC, p.id',
  price_asc: `${FINAL} ASC, p.id`,
  price_desc: `${FINAL} DESC, p.id`,
  new: 'p.created_at DESC, p.id DESC',
  discount: 'p.discount DESC, p.id',
};

r.get('/products', validate(listSchema, 'query'), async (req, res) => {
  const f = req.validQuery;
  const where = ['NOT p.is_deleted'];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  // Barcha qiymatlar parametr sifatida uzatiladi — SQL-injection'dan himoya
  if (f.q) add('(p.name ILIKE ? OR p.description ILIKE $' + (params.length + 1) + ')', `%${f.q.replace(/[%_\\]/g, '\\$&')}%`);
  if (f.category) {
    if (/^\d+$/.test(f.category)) add('p.category_id = ?', Number(f.category));
    else add('c.slug = ?', f.category);
  }
  if (f.min_price != null) add(`${FINAL} >= ?`, f.min_price);
  if (f.max_price != null) add(`${FINAL} <= ?`, f.max_price);
  if (f.discounted) where.push('p.discount > 0');
  if (f.available) where.push('p.available');

  const base = `FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE ${where.join(' AND ')}`;
  const total = (await query(`SELECT COUNT(*)::int AS n ${base}`, params)).rows[0].n;
  const offset = (f.page - 1) * f.limit;
  const { rows } = await query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug ${base}
     ORDER BY ${ORDER[f.sort]} LIMIT ${f.limit} OFFSET ${offset}`, params);
  res.json({ items: rows.map(productView), total, page: f.page, pages: Math.ceil(total / f.limit) });
});

r.get('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw notFound('Mahsulot topilmadi');
  const { rows } = await query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=$1 AND NOT p.is_deleted`, [id]);
  if (!rows[0]) throw notFound('Mahsulot topilmadi');
  const related = await query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p
     LEFT JOIN categories c ON c.id=p.category_id
     WHERE p.category_id=$1 AND p.id<>$2 AND NOT p.is_deleted ORDER BY p.sold_count DESC LIMIT 4`,
    [rows[0].category_id, id]);
  res.json({ ...productView(rows[0]), related: related.rows.map(productView) });
});

r.get('/promotions', async (_req, res) => {
  const { rows } = await query(
    `SELECT pr.*, c.slug AS category_slug FROM promotions pr
     LEFT JOIN categories c ON c.id=pr.category_id WHERE pr.active ORDER BY pr.id DESC`);
  res.json(rows);
});

export default r;
