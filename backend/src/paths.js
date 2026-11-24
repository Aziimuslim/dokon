import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(root, 'uploads');
export const FRONTEND_DIST = process.env.FRONTEND_DIST || path.resolve(root, '..', 'frontend', 'dist');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
