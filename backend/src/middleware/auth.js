import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { unauthorized, forbidden } from '../utils/errors.js';

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtAccessSecret, {
    expiresIn: config.accessTtl,
    algorithm: 'HS256',
  });
}

/** Authorization: Bearer <token> — majburiy */
export async function requireAuth(req, _res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) throw unauthorized();
    let payload;
    try {
      payload = jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'] });
    } catch {
      throw unauthorized('Token yaroqsiz yoki muddati o\'tgan');
    }
    // Rol va faollik har safar bazadan olinadi (token ichidagi rolga ko'r-ko'rona ishonilmaydi)
    const { rows } = await query('SELECT id, name, phone, email, role, is_active FROM users WHERE id=$1', [payload.sub]);
    const user = rows[0];
    if (!user || !user.is_active) throw unauthorized('Foydalanuvchi faol emas');
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
  next();
};
