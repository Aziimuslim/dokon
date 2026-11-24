process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://dokon:dokon123@localhost:5432/dokon_test';

const { seed } = await import('../src/db/seed.js');
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');
const request = (await import('supertest')).default;

export { seed, pool, request };
export const app = createApp();

export async function login(login, password) {
  const res = await request(app).post('/api/login').send({ login, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}
export const auth = (t) => ({ Authorization: `Bearer ${t}` });
