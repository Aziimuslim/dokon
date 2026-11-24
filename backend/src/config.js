import 'dotenv/config';

const env = process.env;
const isProd = env.NODE_ENV === 'production';

function secret(name, fallback) {
  const v = env[name];
  if (!v || v.startsWith('change-me')) {
    if (isProd) throw new Error(`${name} production muhitida o'rnatilishi shart`);
    return fallback;
  }
  return v;
}

export const config = {
  isProd,
  port: Number(env.PORT || 4000),
  databaseUrl: env.DATABASE_URL || 'postgres://dokon:dokon123@localhost:5432/dokon',
  jwtAccessSecret: secret('JWT_ACCESS_SECRET', 'dev-access-secret'),
  jwtRefreshSecret: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  orderSignSecret: secret('ORDER_SIGN_SECRET', 'dev-order-secret'),
  paymentSecret: secret('PAYMENT_PROVIDER_SECRET', 'dev-payment-secret'),
  clientOrigin: (env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  accessTtl: env.ACCESS_TOKEN_TTL || '15m',
  refreshDays: Number(env.REFRESH_TOKEN_DAYS || 7),
  deliveryFee: Number(env.DELIVERY_FEE || 10000),
  freeDeliveryFrom: Number(env.FREE_DELIVERY_FROM || 100000),
  quoteTtlMs: 15 * 60 * 1000,
};
