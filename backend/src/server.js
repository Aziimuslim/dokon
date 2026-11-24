import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { seed, writeSeedImages } from './db/seed.js';

await migrate();
writeSeedImages();
// SEED_DEMO=true — baza bo'sh bo'lsa demo mahsulotlar va hisoblar yaratiladi (Render kabi shell'siz hostinglar uchun)
if (process.env.SEED_DEMO === 'true') await seed();

createApp().listen(config.port, () => {
  console.log(`🍔 Online do'kon API: http://localhost:${config.port}`);
});
