import { badRequest } from '../utils/errors.js';

/** zod sxemasi bilan req.body / req.query ni tekshirish */
export const validate = (schema, where = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[where] ?? {});
  if (!r.success) {
    const details = r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(badRequest('Ma\'lumotlar noto\'g\'ri', details));
  }
  if (where === 'query') req.validQuery = r.data;
  else req[where] = r.data;
  next();
};
