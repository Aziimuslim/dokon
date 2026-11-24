import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query, tx } from '../db/pool.js';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { signAccessToken, requireAuth } from '../middleware/auth.js';
import { csrfGuard } from '../middleware/csrf.js';
import { badRequest, unauthorized, conflict } from '../utils/errors.js';
import { sha256 } from '../utils/signature.js';
import { clean } from '../utils/sanitize.js';

const r = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Juda ko\'p urinish. Keyinroq qayta urinib ko\'ring.' },
});

const phoneRe = /^\+998\d{9}$/;
export const normalizePhone = (p) => {
  if (!p) return p;
  const digits = p.replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  return p;
};

const passwordSchema = z.string().min(8, 'Parol kamida 8 ta belgi').max(72)
  .regex(/[A-Za-z]/, 'Parolda harf bo\'lishi kerak').regex(/\d/, 'Parolda raqam bo\'lishi kerak');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Ism kamida 2 ta belgi').max(100).transform(clean),
  phone: z.string().trim().optional().transform(normalizePhone)
    .refine((v) => !v || phoneRe.test(v), 'Telefon formati: +998XXXXXXXXX'),
  email: z.string().trim().toLowerCase().email('Email noto\'g\'ri').max(150).optional().or(z.literal('').transform(() => undefined)),
  password: passwordSchema,
}).refine((d) => d.phone || d.email, { message: 'Telefon yoki email kiriting', path: ['phone'] });

const loginSchema = z.object({
  login: z.string().trim().min(3).max(150),
  password: z.string().min(1).max(72),
});

const publicUser = (u) => ({ id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role });

async function issueTokens(res, user, client = { query }) {
  const refresh = crypto.randomBytes(48).toString('hex');
  const expires = new Date(Date.now() + config.refreshDays * 86400_000);
  await client.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)', [user.id, sha256(refresh), expires]);
  res.cookie('rt', refresh, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',
    path: '/api/auth',
    expires,
  });
  return { accessToken: signAccessToken(user), user: publicUser(user) };
}

r.post(['/register', '/auth/register'], authLimiter, validate(registerSchema), async (req, res) => {
  const { name, phone, email, password } = req.body;
  const exists = await query('SELECT 1 FROM users WHERE ($1::text IS NOT NULL AND phone=$1) OR ($2::text IS NOT NULL AND email=$2)', [phone || null, email || null]);
  if (exists.rowCount) throw conflict('Bu telefon yoki email bilan foydalanuvchi mavjud');
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (name, phone, email, password_hash) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, phone || null, email || null, hash]);
  res.status(201).json(await issueTokens(res, rows[0]));
});

// Taymingga asoslangan foydalanuvchi aniqlashning oldini olish uchun soxta xesh
const DUMMY_HASH = bcrypt.hashSync('dummy-password-1', 12);

r.post(['/login', '/auth/login'], authLimiter, validate(loginSchema), async (req, res) => {
  const { login, password } = req.body;
  const isEmail = login.includes('@');
  const value = isEmail ? login.toLowerCase() : normalizePhone(login);
  const { rows } = await query(`SELECT * FROM users WHERE ${isEmail ? 'email' : 'phone'}=$1`, [value]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Login yoki parol noto\'g\'ri');
  if (!user.is_active) throw unauthorized('Hisob bloklangan');
  res.json(await issueTokens(res, user));
});

/** Refresh token rotatsiyasi: eski token bekor qilinadi, yangisi beriladi */
r.post('/auth/refresh', csrfGuard, async (req, res) => {
  const token = req.cookies?.rt;
  if (!token) throw unauthorized('Sessiya topilmadi');
  const result = await tx(async (c) => {
    const { rows } = await c.query(
      `SELECT rt.*, u.id AS uid, u.name, u.phone, u.email, u.role, u.is_active
       FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id WHERE token_hash=$1 FOR UPDATE`, [sha256(token)]);
    const row = rows[0];
    if (!row) throw unauthorized('Sessiya yaroqsiz');
    if (row.revoked) {
      // Qayta ishlatilgan token — o'g'irlangan bo'lishi mumkin: barcha sessiyalarni bekor qilamiz
      await c.query('UPDATE refresh_tokens SET revoked=TRUE WHERE user_id=$1', [row.user_id]);
      throw unauthorized('Sessiya bekor qilingan');
    }
    if (new Date(row.expires_at) < new Date() || !row.is_active) throw unauthorized('Sessiya muddati tugagan');
    await c.query('UPDATE refresh_tokens SET revoked=TRUE WHERE id=$1', [row.id]);
    return issueTokens(res, { id: row.uid, name: row.name, phone: row.phone, email: row.email, role: row.role }, c);
  });
  res.json(result);
});

r.post('/auth/logout', csrfGuard, async (req, res) => {
  const token = req.cookies?.rt;
  if (token) await query('UPDATE refresh_tokens SET revoked=TRUE WHERE token_hash=$1', [sha256(token)]);
  res.clearCookie('rt', { path: '/api/auth' });
  res.json({ ok: true });
});

r.get('/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

const changePwSchema = z.object({
  old_password: z.string().min(1).max(72),
  new_password: passwordSchema,
});
r.put('/auth/password', requireAuth, validate(changePwSchema), async (req, res) => {
  const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!(await bcrypt.compare(req.body.old_password, rows[0].password_hash))) throw badRequest('Eski parol noto\'g\'ri');
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(req.body.new_password, 12), req.user.id]);
  await query('UPDATE refresh_tokens SET revoked=TRUE WHERE user_id=$1', [req.user.id]);
  res.json({ ok: true });
});

export default r;
