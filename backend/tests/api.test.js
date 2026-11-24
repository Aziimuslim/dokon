import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, seed, pool, request, login, auth } from './helpers.js';
import { signCallback } from '../src/services/payment.js';

let userT, adminT, courierT;

before(async () => {
  await seed({ reset: true });
  userT = await login('user@dokon.uz', 'User12345');
  adminT = await login('+998900000001', 'Admin12345');
  courierT = await login('900000002', 'Courier12345');
});
after(() => pool.end());

test('ro\'yxatdan o\'tish: parol xeshlanadi, takror ro\'yxat rad etiladi', async () => {
  const res = await request(app).post('/api/register').send({ name: 'Ali', phone: '+998 91 123 45 67', password: 'Parol1234' });
  assert.equal(res.status, 201);
  assert.ok(res.body.accessToken);
  assert.equal(res.body.user.phone, '+998911234567');
  assert.match(res.headers['set-cookie'][0], /HttpOnly/);
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE phone=$1', ['+998911234567']);
  assert.match(rows[0].password_hash, /^\$2[aby]\$12\$/);
  const dup = await request(app).post('/api/register').send({ name: 'Ali', phone: '+998911234567', password: 'Parol1234' });
  assert.equal(dup.status, 409);
  const weak = await request(app).post('/api/register').send({ name: 'Vali', email: 'v@x.uz', password: '123' });
  assert.equal(weak.status, 400);
});

test('login xato parol bilan 401', async () => {
  const res = await request(app).post('/api/login').send({ login: 'user@dokon.uz', password: 'xato12345' });
  assert.equal(res.status, 401);
});

test('refresh token rotatsiyasi va qayta ishlatishni aniqlash', async () => {
  const lr = await request(app).post('/api/login').send({ login: 'user@dokon.uz', password: 'User12345' });
  const cookie = lr.headers['set-cookie'][0].split(';')[0];
  const noCsrf = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
  assert.equal(noCsrf.status, 403);
  const r1 = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set('X-Requested-With', 'XMLHttpRequest');
  assert.equal(r1.status, 200);
  assert.ok(r1.body.accessToken);
  const reuse = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set('X-Requested-With', 'XMLHttpRequest');
  assert.equal(reuse.status, 401);
});

test('token yo\'q yoki soxta bo\'lsa himoyalangan endpoint 401', async () => {
  assert.equal((await request(app).get('/api/cart')).status, 401);
  assert.equal((await request(app).get('/api/cart').set(auth('abc.def.ghi'))).status, 401);
});

test('mijoz admin panelga kira olmaydi', async () => {
  assert.equal((await request(app).get('/api/admin/orders').set(auth(userT))).status, 403);
  assert.equal((await request(app).post('/api/admin/products').set(auth(courierT)).send({})).status, 403);
});

test('katalog: filtr, qidiruv, saralash, SQL-injection', async () => {
  const all = await request(app).get('/api/products?limit=100');
  assert.equal(all.body.total, 21);
  const fast = await request(app).get('/api/products?category=fastfud&limit=100');
  assert.ok(fast.body.items.every((p) => p.category_slug === 'fastfud'));
  const cheap = await request(app).get('/api/products?max_price=10000&sort=price_asc');
  assert.ok(cheap.body.items.every((p) => p.final_price <= 10000));
  const prices = cheap.body.items.map((p) => p.final_price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  const inj = await request(app).get(`/api/products?q=${encodeURIComponent("' OR 1=1 --")}`);
  assert.equal(inj.status, 200);
  assert.equal(inj.body.total, 0);
  const bad = await request(app).get('/api/products?sort=id;DROP TABLE users');
  assert.equal(bad.status, 400);
});

test('to\'liq oqim: savat → kotirovka → buyurtma → to\'lov → yetkazish', async () => {
  await request(app).delete('/api/cart').set(auth(userT));
  let cart = await request(app).post('/api/cart').set(auth(userT)).send({ product_id: 2, quantity: 2 }); // 32400 x2
  assert.equal(cart.status, 201);
  cart = await request(app).post('/api/cart').set(auth(userT)).send({ product_id: 17, quantity: 1 }); // 9000
  assert.equal(cart.body.subtotal, 73800);
  assert.equal(cart.body.delivery_fee, 10000);
  assert.equal(cart.body.total, 83800);

  const quote = await request(app).post('/api/orders/preview').set(auth(userT));
  assert.equal(quote.body.total, 83800);

  // Imzoni soxtalashtirish urinishlari rad etiladi
  const order = { address: 'Toshkent, Chilonzor 9-kvartal, 12-uy', phone: '+998901112233', payment_method: 'payme' };
  const forged = await request(app).post('/api/orders').set(auth(userT))
    .send({ ...order, total: 1, quote: { expires_at: quote.body.expires_at + 1000, signature: quote.body.signature } });
  assert.equal(forged.status, 409);

  const created = await request(app).post('/api/orders').set(auth(userT))
    .send({ ...order, total: 1, quote: { expires_at: quote.body.expires_at, signature: quote.body.signature } });
  assert.equal(created.status, 201);
  assert.equal(created.body.total, 83800, 'mijoz yuborgan total e\'tiborga olinmaydi');
  const orderId = created.body.id;
  assert.equal((await request(app).get('/api/cart').set(auth(userT))).body.items.length, 0);

  // Boshqa foydalanuvchi buyurtmani ko'ra olmaydi
  assert.equal((await request(app).get(`/api/orders/${orderId}`).set(auth(courierT))).status, 404);

  // To'lov
  const pay = await request(app).post('/api/payment').set(auth(userT)).send({ order_id: orderId });
  assert.equal(pay.status, 201);
  assert.equal(pay.body.amount, 83800);
  const [, pid, t] = pay.body.checkout_url.match(/\/pay\/(\d+)\?t=([a-f0-9]+)/);

  // Soxta callback (imzosiz / summa o'zgartirilgan) rad etiladi
  const fake = { payment_id: Number(pid), order_id: orderId, amount: 100, status: 'paid', provider_txn: 'x' };
  assert.equal((await request(app).post('/api/payment/callback').send({ ...fake, sign: 'deadbeef' })).status, 403);
  assert.equal((await request(app).post('/api/payment/callback').send({ ...fake, sign: signCallback(fake) })).status, 400);
  assert.equal((await request(app).get(`/api/payment/sandbox/${pid}?t=bad`)).status, 403);

  const failed = await request(app).post(`/api/payment/sandbox/${pid}/confirm`).send({ t, number: '4000 0000 0000 0002', expiry: '12/29', code: '666666' });
  assert.equal(failed.body.status, 'failed');
  const pay2 = await request(app).post('/api/payment').set(auth(userT)).send({ order_id: orderId });
  const [, pid2, t2] = pay2.body.checkout_url.match(/\/pay\/(\d+)\?t=([a-f0-9]+)/);
  const ok = await request(app).post(`/api/payment/sandbox/${pid2}/confirm`).send({ t: t2, number: '8600 0000 0000 0000', expiry: '12/29', code: '666666' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'paid');

  let o = await request(app).get(`/api/orders/${orderId}`).set(auth(userT));
  assert.equal(o.body.payment_status, 'paid');
  assert.equal(o.body.signature_valid, true);

  // Admin: noto'g'ri o'tish rad etiladi, kuryer tayinlanadi
  assert.equal((await request(app).put(`/api/admin/orders/${orderId}`).set(auth(adminT)).send({ status: 'delivered' })).status, 400);
  const adm = await request(app).put(`/api/admin/orders/${orderId}`).set(auth(adminT)).send({ status: 'preparing', courier_id: 2 });
  assert.equal(adm.status, 200);
  assert.equal(adm.body.status, 'preparing');

  // Kuryer
  const list = await request(app).get('/api/courier/orders').set(auth(courierT));
  assert.ok(list.body.some((x) => x.id === orderId));
  assert.equal((await request(app).put(`/api/courier/orders/${orderId}`).set(auth(courierT)).send({ status: 'on_the_way' })).status, 200);
  assert.equal((await request(app).put(`/api/courier/orders/${orderId}`).set(auth(courierT)).send({ status: 'delivered' })).status, 200);

  o = await request(app).get(`/api/orders/${orderId}`).set(auth(userT));
  assert.equal(o.body.status, 'delivered');
  assert.deepEqual(o.body.history.map((h) => h.status), ['accepted', 'preparing', 'on_the_way', 'delivered']);

  const notes = await request(app).get('/api/profile/notifications').set(auth(userT));
  assert.ok(notes.body.items.length >= 4);

  const rep = await request(app).get('/api/admin/reports?days=7').set(auth(adminT));
  assert.equal(rep.status, 200);
  assert.ok(rep.body.summary.revenue >= 83800);
  assert.equal(rep.body.daily.length, 7);
});

test('narx o\'zgarsa eski kotirovka bilan buyurtma berib bo\'lmaydi', async () => {
  await request(app).post('/api/cart').set(auth(userT)).send({ product_id: 1, quantity: 1 });
  const quote = await request(app).post('/api/orders/preview').set(auth(userT));
  await request(app).put('/api/admin/products/1').set(auth(adminT)).send({ price: 40000 });
  const res = await request(app).post('/api/orders').set(auth(userT)).send({
    address: 'Toshkent, Yunusobod 4', phone: '+998901112233', payment_method: 'cash',
    quote: { expires_at: quote.body.expires_at, signature: quote.body.signature },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.details.totals.total, 50000);
});

test('admin mahsulot CRUD va XSS tozalash', async () => {
  const c = await request(app).post('/api/admin/products').set(auth(adminT))
    .send({ name: '<img src=x onerror=alert(1)>Somsa', price: 8000, category_id: 1, description: '<b>issiq</b>' });
  assert.equal(c.status, 201);
  assert.equal(c.body.name, 'Somsa');
  assert.equal(c.body.description, 'issiq');
  const u = await request(app).put(`/api/admin/products/${c.body.id}`).set(auth(adminT)).send({ available: false });
  assert.equal(u.body.available, false);
  assert.equal((await request(app).post('/api/cart').set(auth(userT)).send({ product_id: c.body.id })).status, 400);
  assert.equal((await request(app).delete(`/api/admin/products/${c.body.id}`).set(auth(adminT))).status, 200);
  assert.equal((await request(app).get(`/api/products/${c.body.id}`)).status, 404);
  const badImg = await request(app).post('/api/admin/products').set(auth(adminT)).send({ name: 'X', price: 1, category_id: 1, image: 'javascript:alert(1)' });
  assert.equal(badImg.status, 400);
});

test('mijoz faqat qabul qilingan buyurtmani bekor qila oladi', async () => {
  await request(app).delete('/api/cart').set(auth(userT));
  await request(app).post('/api/cart').set(auth(userT)).send({ product_id: 3, quantity: 1 });
  const q = await request(app).post('/api/orders/preview').set(auth(userT));
  const o = await request(app).post('/api/orders').set(auth(userT)).send({
    address: 'Toshkent, Sergeli 5', phone: '+998901112233', payment_method: 'cash', delivery_time: '18:00-19:00',
    quote: { expires_at: q.body.expires_at, signature: q.body.signature },
  });
  assert.equal(o.status, 201);
  const c = await request(app).post(`/api/orders/${o.body.id}/cancel`).set(auth(userT));
  assert.equal(c.body.status, 'cancelled');
  assert.equal((await request(app).post(`/api/orders/${o.body.id}/cancel`).set(auth(userT))).status, 400);
});
