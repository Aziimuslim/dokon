export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const badRequest = (m, d) => new HttpError(400, m, d);
export const unauthorized = (m = 'Avtorizatsiya talab etiladi') => new HttpError(401, m);
export const forbidden = (m = 'Ruxsat yo\'q') => new HttpError(403, m);
export const notFound = (m = 'Topilmadi') => new HttpError(404, m);
export const conflict = (m, d) => new HttpError(409, m, d);
