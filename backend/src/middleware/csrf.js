import { config } from '../config.js';
import { forbidden } from '../utils/errors.js';

/**
 * Cookie orqali ishlaydigan endpointlar (refresh/logout) uchun CSRF himoyasi:
 *  1) cookie SameSite=Strict
 *  2) maxsus sarlavha X-Requested-With talab etiladi (oddiy forma yubora olmaydi)
 *  3) Origin sarlavhasi bo'lsa — ruxsat etilganlar ro'yxatida bo'lishi kerak
 */
export function csrfGuard(req, _res, next) {
  if (req.get('x-requested-with') !== 'XMLHttpRequest') return next(forbidden('CSRF tekshiruvi'));
  const origin = req.get('origin');
  if (origin && !config.clientOrigin.includes(origin) && origin !== `${req.protocol}://${req.get('host')}`) {
    return next(forbidden('Origin ruxsat etilmagan'));
  }
  next();
}
