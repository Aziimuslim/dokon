import { query } from '../db/pool.js';

/**
 * Bildirishnoma moduli. Ilova ichidagi xabar bazaga yoziladi;
 * SMS/email provayderi ulanmagan bo'lsa — log'ga chiqariladi (sandbox rejimi).
 */
export async function notify(userId, title, body = '', db = { query }) {
  await db.query('INSERT INTO notifications (user_id, title, body) VALUES ($1,$2,$3)', [userId, title, body]);
  if (process.env.NODE_ENV !== 'test') console.log(`[SMS-sandbox] user=${userId}: ${title} — ${body}`);
}

export const STATUS_LABELS = {
  accepted: 'Qabul qilindi',
  preparing: 'Tayyorlanmoqda',
  on_the_way: "Yo'lda",
  delivered: 'Yetkazildi',
  cancelled: 'Bekor qilindi',
};
