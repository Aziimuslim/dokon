import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitPrice, calcTotals } from '../src/utils/pricing.js';
import { signQuote, safeEqual, hmac } from '../src/utils/signature.js';
import { canTransition } from '../src/services/orders.js';
import { clean } from '../src/utils/sanitize.js';

test('unitPrice chegirmani to\'g\'ri hisoblaydi', () => {
  assert.equal(unitPrice(36000, 10), 32400);
  assert.equal(unitPrice(10000, 0), 10000);
  assert.equal(unitPrice(10000, 200), 1000); // max 90%
  assert.equal(unitPrice(9999, 15), 8499);
});

test('calcTotals: yetkazish narxi va bepul yetkazish chegarasi', () => {
  const t1 = calcTotals([{ product_id: 1, name: 'a', price: 30000, discount: 0, quantity: 2 }], { deliveryFee: 10000, freeDeliveryFrom: 100000 });
  assert.equal(t1.subtotal, 60000);
  assert.equal(t1.delivery_fee, 10000);
  assert.equal(t1.total, 70000);
  const t2 = calcTotals([{ product_id: 1, name: 'a', price: 50000, discount: 0, quantity: 2 }], { deliveryFee: 10000, freeDeliveryFrom: 100000 });
  assert.equal(t2.delivery_fee, 0);
  assert.equal(calcTotals([]).total, 0);
});

test('signQuote: narx o\'zgarsa imzo o\'zgaradi', () => {
  const t = calcTotals([{ product_id: 1, name: 'a', price: 30000, discount: 0, quantity: 1 }]);
  const s1 = signQuote('k', 5, t, 123);
  assert.equal(s1, signQuote('k', 5, t, 123));
  const tampered = { ...t, total: 1 };
  assert.notEqual(s1, signQuote('k', 5, tampered, 123));
  assert.notEqual(s1, signQuote('k', 6, t, 123));
  assert.notEqual(s1, signQuote('other', 5, t, 123));
});

test('safeEqual', () => {
  assert.ok(safeEqual(hmac('a', 'b'), hmac('a', 'b')));
  assert.ok(!safeEqual('abc', 'abd'));
  assert.ok(!safeEqual('abc', undefined));
});

test('holat o\'tishlari', () => {
  assert.ok(canTransition('accepted', 'preparing'));
  assert.ok(canTransition('on_the_way', 'delivered'));
  assert.ok(!canTransition('delivered', 'accepted'));
  assert.ok(!canTransition('accepted', 'delivered'));
});

test('clean HTML teglarini olib tashlaydi', () => {
  assert.equal(clean('<script>alert(1)</script>Salom'), 'alert(1)Salom');
});
