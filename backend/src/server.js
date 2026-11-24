import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';

await migrate();
createApp().listen(config.port, () => {
  console.log(`🍔 Online do'kon API: http://localhost:${config.port}`);
});
