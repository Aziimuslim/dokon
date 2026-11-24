import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { UPLOAD_DIR, FRONTEND_DIST } from './paths.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payment.js';
import profileRoutes from './routes/profile.js';
import adminRoutes from './routes/admin.js';
import courierRoutes from './routes/courier.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Nginx ortida ishlaganda haqiqiy IP va protokol
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: { 'img-src': ["'self'", 'data:', 'https:'] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }));
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (process.env.NODE_ENV !== 'test') app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.use('/api', rateLimit({ windowMs: 60_000, limit: process.env.NODE_ENV === 'test' ? 100000 : 300, standardHeaders: true, legacyHeaders: false }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  for (const routes of [authRoutes, catalogRoutes, cartRoutes, orderRoutes, paymentRoutes, profileRoutes, adminRoutes, courierRoutes]) {
    app.use('/api', routes);
  }
  app.use('/api', notFoundHandler);

  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));

  // Production: frontend build'ini shu serverning o'zi ham bera oladi (Render/Railway uchun qulay)
  if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
    app.use(express.static(FRONTEND_DIST, { maxAge: '1h', index: false }));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
