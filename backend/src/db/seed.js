import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { migrate } from './migrate.js';
import { UPLOAD_DIR } from '../paths.js';

const categories = [
  { name: 'Fastfud', slug: 'fastfud', icon: '🍔', sort: 1 },
  { name: 'Shirinliklar', slug: 'shirinliklar', icon: '🍰', sort: 2 },
  { name: 'Ichimliklar', slug: 'ichimliklar', icon: '🥤', sort: 3 },
];

// [nomi, kategoriya, narx, chegirma, emoji, rang1, rang2, tavsif, tarkib, sotilgan]
const products = [
  ['Klassik burger', 'fastfud', 32000, 0, '🍔', '#fb923c', '#dc2626', "Mol go'shtidan suvli kotlet, yangi sabzavotlar va maxsus sous bilan.", "Bulochka, mol go'shti kotleti, pomidor, salat bargi, tuzlangan bodring, piyoz, sous", 120],
  ['Cheeseburger', 'fastfud', 36000, 10, '🍔', '#fbbf24', '#ea580c', 'Ikki qavat cheddar pishlog\'i bilan klassik burger.', "Bulochka, mol go'shti kotleti, cheddar pishlog'i, bodring, ketchup, gorchitsa", 98],
  ['Lavash (mol go\'shti)', 'fastfud', 34000, 0, '🌯', '#f59e0b', '#b45309', "Yupqa lavashga o'ralgan qovurilgan go'sht, kartoshka fri va sous.", "Lavash, mol go'shti, kartoshka fri, pomidor, bodring, sarimsoqli sous", 150],
  ['Tovuqli lavash', 'fastfud', 30000, 0, '🌯', '#fcd34d', '#d97706', 'Grilda pishirilgan tovuq go\'shti bilan yengil lavash.', "Lavash, tovuq filesi, karam, pomidor, bodring, oq sous", 132],
  ['Pepperoni pizza', 'fastfud', 75000, 15, '🍕', '#f87171', '#b91c1c', 'Achchiq pepperoni kolbasasi va mozzarella bilan 30 sm pizza.', "Xamir, pomidor sousi, mozzarella, pepperoni", 87],
  ['Margarita pizza', 'fastfud', 62000, 0, '🍕', '#fca5a5', '#dc2626', 'Pomidor, mozzarella va rayhon — italyan klassikasi.', "Xamir, pomidor sousi, mozzarella, pomidor, rayhon", 54],
  ['Hot-dog', 'fastfud', 18000, 0, '🌭', '#fdba74', '#c2410c', 'Yumshoq bulochkada sosiska, karamellangan piyoz bilan.', "Bulochka, sosiska, piyoz, ketchup, gorchitsa", 76],
  ['Kartoshka fri', 'fastfud', 15000, 0, '🍟', '#fde047', '#ca8a04', 'Tilla rang, qarsildoq kartoshka fri. Ketchup sovg\'a.', "Kartoshka, o'simlik yog'i, tuz", 210],
  ['Chicken nuggets (9 dona)', 'fastfud', 28000, 20, '🍗', '#fdba74', '#9a3412', 'Qarsildoq qobiqdagi tovuq bo\'laklari, 2 xil sous bilan.', "Tovuq filesi, panirovka, ziravorlar", 64],
  ['Shokoladli tort', 'shirinliklar', 120000, 0, '🎂', '#a16207', '#451a03', "Uch qavatli shokoladli biskvit va ganash kremi. 1.2 kg.", "Un, kakao, tuxum, shakar, sariyog', qaymoq, qora shokolad", 22],
  ['Napoleon (bo\'lak)', 'shirinliklar', 22000, 0, '🍰', '#fde68a', '#d97706', 'Ko\'p qavatli qatlamali xamir va vanilli krem.', "Un, sariyog', sut, tuxum, shakar, vanilin", 58],
  ['Cheesecake', 'shirinliklar', 28000, 10, '🍰', '#fef3c7', '#f59e0b', 'Nyu-York uslubidagi yumshoq cheesecake, qulupnay sousi bilan.', "Krem-pishloq, pechenye, sariyog', tuxum, qulupnay", 47],
  ['Pirojniy "Kartoshka"', 'shirinliklar', 9000, 0, '🧁', '#92400e', '#422006', 'Bolalikdan tanish ta\'m — kakao va yong\'oqli pirojniy.', "Biskvit, kakao, sariyog', quyultirilgan sut, yong'oq", 89],
  ['Donut (glazurli)', 'shirinliklar', 12000, 0, '🍩', '#f9a8d4', '#db2777', 'Yumshoq donut, pushti glazur va rangli sepma.', "Un, sut, tuxum, shakar, glazur", 73],
  ['Shokolad plitka', 'shirinliklar', 16000, 0, '🍫', '#78350f', '#1c0a00', '70% kakaoli achchiq shokolad, 100 g.', "Kakao massasi, kakao yog'i, shakar", 41],
  ['Muzqaymoq (3 shar)', 'shirinliklar', 20000, 0, '🍨', '#bae6fd', '#0284c7', 'Vanil, shokolad va qulupnay sharlari.', "Sut, qaymoq, shakar, tabiiy aromatizatorlar", 66],
  ['Coca-Cola 0.5 L', 'ichimliklar', 9000, 0, '🥤', '#f87171', '#7f1d1d', 'Salqin gazli ichimlik.', "Gazlangan suv, shakar, aromatizatorlar", 240],
  ['Fresh apelsin sharbati', 'ichimliklar', 18000, 0, '🍊', '#fdba74', '#ea580c', 'Yangi siqilgan apelsin sharbati, 0.4 L.', "Apelsin", 52],
  ['Muzli kofe (Ice latte)', 'ichimliklar', 22000, 15, '🧋', '#d6d3d1', '#57534e', 'Espresso, sut va muz — yozgi tetiklik.', "Espresso, sut, muz, shakar siropi", 61],
  ['Limonad (uy usulida)', 'ichimliklar', 14000, 0, '🍋', '#fef08a', '#65a30d', 'Limon, yalpiz va asal bilan tayyorlangan limonad.', "Suv, limon, yalpiz, asal", 38],
  ['Choy (ko\'k/qora)', 'ichimliklar', 6000, 0, '🍵', '#bbf7d0', '#15803d', 'Choynakda damlangan issiq choy.', "Choy bargi, suv", 95],
];

function svg(emoji, c1, c2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
<defs>
  <radialGradient id="g" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
  <radialGradient id="s" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<rect width="600" height="450" fill="url(#g)"/>
<g fill="#fff" opacity=".10"><circle cx="70" cy="80" r="40"/><circle cx="540" cy="90" r="24"/><circle cx="520" cy="380" r="60"/><circle cx="90" cy="390" r="18"/></g>
<ellipse cx="300" cy="370" rx="170" ry="26" fill="url(#s)"/>
<text x="300" y="250" font-size="230" text-anchor="middle" dominant-baseline="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${emoji}</text>
</svg>`;
}

export async function seed({ reset = false } = {}) {
  await migrate();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (reset) {
      await client.query(`TRUNCATE notifications, payments, order_status_history, order_items, orders, cart, promotions,
        products, categories, addresses, refresh_tokens, users RESTART IDENTITY CASCADE`);
    }
    const has = await client.query('SELECT COUNT(*)::int AS n FROM products');
    if (has.rows[0].n > 0 && !reset) {
      await client.query('ROLLBACK');
      console.log('Ma\'lumotlar allaqachon bor — seed o\'tkazib yuborildi (qayta yuklash: npm run seed -- --reset)');
      return;
    }
    const catIds = {};
    for (const c of categories) {
      const { rows } = await client.query('INSERT INTO categories (name, slug, icon, sort) VALUES ($1,$2,$3,$4) RETURNING id', [c.name, c.slug, c.icon, c.sort]);
      catIds[c.slug] = rows[0].id;
    }
    let i = 0;
    for (const [name, cat, price, discount, emoji, c1, c2, desc, ingr, sold] of products) {
      i += 1;
      const file = `seed-${i}.svg`;
      fs.writeFileSync(path.join(UPLOAD_DIR, file), svg(emoji, c1, c2));
      await client.query(
        `INSERT INTO products (name, description, ingredients, price, discount, image, category_id, sold_count, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() - ($9 || ' hours')::interval)`,
        [name, desc, ingr, price, discount, `/uploads/${file}`, catIds[cat], sold, String(i * 7)]);
    }
    await client.query(`INSERT INTO promotions (title, subtitle, color, emoji, category_id) VALUES
      ('Pitsalarga -15%', 'Har kuni 11:00 dan 16:00 gacha barcha pitsalarga chegirma', '#dc2626', '🍕', $1),
      ('100 000 so''mdan bepul yetkazish', 'Buyurtmangiz 100 000 so''mdan oshsa — yetkazish tekin', '#f97316', '🛵', NULL),
      ('Shirin juma', 'Shirinliklar bo''limida yangi ta''mlar', '#db2777', '🍰', $2)`,
      [catIds.fastfud, catIds.shirinliklar]);

    const hash = (p) => bcrypt.hashSync(p, 12);
    await client.query(
      `INSERT INTO users (name, phone, email, password_hash, role) VALUES
       ('Administrator', '+998900000001', 'admin@dokon.uz', $1, 'admin'),
       ('Kuryer Sardor', '+998900000002', 'courier@dokon.uz', $2, 'courier'),
       ('Test Mijoz', '+998900000003', 'user@dokon.uz', $3, 'customer')`,
      [hash('Admin12345'), hash('Courier12345'), hash('User12345')]);
    await client.query('COMMIT');
    console.log('✔ Seed: 3 kategoriya, %d mahsulot, 3 aksiya, 3 foydalanuvchi', products.length);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed({ reset: process.argv.includes('--reset') })
    .then(() => pool.end())
    .catch((e) => { console.error(e); process.exit(1); });
}
