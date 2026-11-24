import crypto from 'node:crypto';
import { tx } from '../db/pool.js';
import { config } from '../config.js';
import { hmac, safeEqual, paymentString } from '../utils/signature.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { notify } from './notify.js';

export const checkoutToken = (p) => hmac(config.paymentSecret, `checkout|${p.id}|${p.order_id}|${p.amount}`);

export function signCallback(payload) {
  return hmac(config.paymentSecret, paymentString(payload));
}

/**
 * To'lov provayderidan kelgan callback'ni qayta ishlash.
 * 1) imzo tekshiriladi  2) summa bazadagi buyurtma summasi bilan solishtiriladi  3) idempotent
 */
export async function handleCallback(payload) {
  const expected = signCallback(payload);
  if (!safeEqual(expected, payload.sign)) throw forbidden('To\'lov imzosi noto\'g\'ri');

  return tx(async (c) => {
    const { rows } = await c.query(
      `SELECT p.*, o.total, o.user_id, o.status AS order_status FROM payments p
       JOIN orders o ON o.id=p.order_id WHERE p.id=$1 FOR UPDATE OF p`, [payload.payment_id]);
    const p = rows[0];
    if (!p || p.order_id !== Number(payload.order_id)) throw notFound('To\'lov topilmadi');
    if (Number(payload.amount) !== p.amount || p.amount !== p.total) throw badRequest('To\'lov summasi buyurtma summasiga mos emas');
    if (p.status === 'paid') return { status: 'paid', order_id: p.order_id, duplicate: true };
    if (p.status !== 'created') throw badRequest('To\'lov allaqachon yakunlangan');

    if (payload.status === 'paid') {
      await c.query(`UPDATE payments SET status='paid', provider_txn=$1, paid_at=NOW() WHERE id=$2`, [payload.provider_txn, p.id]);
      await c.query(`UPDATE orders SET payment_status='paid', updated_at=NOW() WHERE id=$1`, [p.order_id]);
      await notify(p.user_id, `Buyurtma #${p.order_id} to'landi`, `${p.amount.toLocaleString('ru-RU')} so'm qabul qilindi`, c);
    } else {
      await c.query(`UPDATE payments SET status='failed', provider_txn=$1 WHERE id=$2`, [payload.provider_txn, p.id]);
      await c.query(`UPDATE orders SET payment_status='failed', updated_at=NOW() WHERE id=$1`, [p.order_id]);
    }
    return { status: payload.status, order_id: p.order_id };
  });
}

/**
 * SANDBOX provayder: Payme/Click test muhitini simulyatsiya qiladi.
 * Test kartalar:
 *   8600 0000 0000 0000  — muvaffaqiyatli
 *   4000 0000 0000 0002  — mablag' yetarli emas
 */
export const TEST_CARDS = { success: '8600000000000000', insufficient: '4000000000000002' };

export function sandboxCharge(payment, card) {
  const number = String(card.number || '').replace(/\s/g, '');
  if (!/^\d{16}$/.test(number)) throw badRequest('Karta raqami 16 ta raqamdan iborat bo\'lishi kerak');
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry || '')) throw badRequest('Amal qilish muddati MM/YY formatida');
  if (card.code !== '666666') throw badRequest('SMS kod noto\'g\'ri (sandbox: 666666)');
  const status = number === TEST_CARDS.success ? 'paid' : 'failed';
  const payload = {
    payment_id: payment.id,
    order_id: payment.order_id,
    amount: payment.amount,
    status,
    provider_txn: `${payment.provider}-${crypto.randomBytes(6).toString('hex')}`,
  };
  return { ...payload, sign: signCallback(payload) };
}
