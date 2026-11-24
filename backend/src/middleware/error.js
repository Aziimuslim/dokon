import { HttpError } from '../utils/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Endpoint topilmadi' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON noto\'g\'ri' });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Fayl hajmi juda katta (max 3 MB)' });
  if (err?.code === '23505') return res.status(409).json({ error: 'Bunday yozuv allaqachon mavjud' });
  console.error(err);
  res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
}
