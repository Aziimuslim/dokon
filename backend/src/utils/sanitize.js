/** Matndan HTML teglarini olib tashlash (XSS himoyasining qo'shimcha qatlami; React ham escape qiladi) */
export function clean(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}
