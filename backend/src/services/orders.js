import { forbidden, badRequest } from '../utils/errors.js';
import { notify, STATUS_LABELS } from './notify.js';

/** Ruxsat etilgan holat o'tishlari */
export const TRANSITIONS = {
  accepted: ['preparing', 'cancelled'],
  preparing: ['on_the_way', 'cancelled'],
  on_the_way: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

/** Buyurtma holatini o'zgartirish (tranzaksiya client'i ichida) */
export async function changeStatus(client, order, to, actor) {
  if (order.status === to) return order;
  if (!canTransition(order.status, to)) {
    throw badRequest(`Holatni "${STATUS_LABELS[order.status]}" dan "${STATUS_LABELS[to] || to}" ga o'zgartirib bo'lmaydi`);
  }
  if (actor.role === 'courier' && !['on_the_way', 'delivered'].includes(to)) throw forbidden();

  const extra = [];
  // Naqd to'lov yetkazilganda to'langan deb belgilanadi
  if (to === 'delivered' && order.payment_method === 'cash') extra.push(`payment_status='paid'`);
  if (to === 'cancelled' && order.payment_status === 'paid') extra.push(`payment_status='refunded'`);
  const set = [`status=$1`, `updated_at=NOW()`, ...extra].join(', ');
  const { rows } = await client.query(`UPDATE orders SET ${set} WHERE id=$2 RETURNING *`, [to, order.id]);
  await client.query('INSERT INTO order_status_history (order_id, status, changed_by) VALUES ($1,$2,$3)', [order.id, to, actor.id]);
  if (to === 'cancelled') {
    await client.query(
      `UPDATE products p SET sold_count = GREATEST(sold_count - oi.quantity, 0)
       FROM order_items oi WHERE oi.order_id=$1 AND oi.product_id=p.id`, [order.id]);
  }
  await notify(order.user_id, `Buyurtma #${order.id}: ${STATUS_LABELS[to]}`, 'Buyurtmangiz holati yangilandi', client);
  return rows[0];
}
