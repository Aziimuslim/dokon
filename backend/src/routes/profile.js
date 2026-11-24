import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notFound } from '../utils/errors.js';
import { clean } from '../utils/sanitize.js';
import { normalizePhone } from './auth.js';

const r = Router();
r.use('/profile', requireAuth);

r.get('/profile', async (req, res) => {
  const stats = await query(
    `SELECT COUNT(*)::int AS orders, COALESCE(SUM(total) FILTER (WHERE status<>'cancelled'),0)::int AS spent
     FROM orders WHERE user_id=$1`, [req.user.id]);
  res.json({ user: req.user, stats: stats.rows[0] });
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).transform(clean),
  phone: z.string().trim().optional().transform(normalizePhone)
    .refine((v) => !v || /^\+998\d{9}$/.test(v), 'Telefon formati: +998XXXXXXXXX'),
  email: z.string().trim().toLowerCase().email().max(150).optional().or(z.literal('').transform(() => undefined)),
});
r.put('/profile', validate(profileSchema), async (req, res) => {
  const { name, phone, email } = req.body;
  const { rows } = await query(
    `UPDATE users SET name=$1, phone=COALESCE($2, phone), email=COALESCE($3, email) WHERE id=$4
     RETURNING id, name, phone, email, role`, [name, phone || null, email || null, req.user.id]);
  res.json({ user: rows[0] });
});

r.get('/profile/addresses', async (req, res) => {
  const { rows } = await query('SELECT * FROM addresses WHERE user_id=$1 ORDER BY id DESC', [req.user.id]);
  res.json(rows);
});
const addrSchema = z.object({
  label: z.string().trim().min(1).max(50).default('Uy').transform(clean),
  address: z.string().trim().min(5).max(300).transform(clean),
});
r.post('/profile/addresses', validate(addrSchema), async (req, res) => {
  const { rows } = await query('INSERT INTO addresses (user_id, label, address) VALUES ($1,$2,$3) RETURNING *',
    [req.user.id, req.body.label, req.body.address]);
  res.status(201).json(rows[0]);
});
r.delete('/profile/addresses/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM addresses WHERE id=$1 AND user_id=$2', [Number(req.params.id) || 0, req.user.id]);
  if (!rowCount) throw notFound();
  res.json({ ok: true });
});

r.get('/profile/notifications', async (req, res) => {
  const { rows } = await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [req.user.id]);
  res.json({ items: rows, unread: rows.filter((n) => !n.is_read).length });
});
r.post('/profile/notifications/read', async (req, res) => {
  await query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1', [req.user.id]);
  res.json({ ok: true });
});

export default r;
