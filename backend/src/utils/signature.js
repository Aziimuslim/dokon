import crypto from 'node:crypto';

/** HMAC-SHA256 imzo (hex) */
export function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/** Vaqtga bog'liq bo'lmagan (timing-safe) taqqoslash */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Buyurtma "kotirovkasi" uchun kanonik satr: tartib aniq va o'zgarmas */
export function quoteString(userId, totals, expiresAt) {
  const items = [...totals.items]
    .sort((a, b) => a.product_id - b.product_id)
    .map((i) => `${i.product_id}:${i.quantity}:${i.price}`)
    .join(',');
  return `quote|${userId}|${items}|${totals.subtotal}|${totals.delivery_fee}|${totals.total}|${expiresAt}`;
}

export function signQuote(secret, userId, totals, expiresAt) {
  return hmac(secret, quoteString(userId, totals, expiresAt));
}

/** Saqlangan buyurtma yaxlitligi uchun imzo */
export function orderString(o) {
  return `order|${o.id}|${o.user_id}|${o.total}|${o.payment_method}`;
}

/** To'lov provayderi callback imzosi */
export function paymentString(p) {
  return `payment|${p.payment_id}|${p.order_id}|${p.amount}|${p.status}|${p.provider_txn}`;
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
