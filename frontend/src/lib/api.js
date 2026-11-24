// API mijoz: access token xotirada saqlanadi (XSS orqali localStorage'dan o'g'irlanmasligi uchun),
// refresh token — httpOnly cookie'da. 401 bo'lsa avtomatik yangilanadi.
let accessToken = null;
let refreshing = null;
let onAuthLost = () => {};

export const setAccessToken = (t) => { accessToken = t; };
export const setOnAuthLost = (fn) => { onAuthLost = fn; };

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || 'Xatolik');
    this.status = status;
    this.body = body;
  }
}

export async function refreshSession() {
  if (!refreshing) {
    refreshing = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then(async (r) => {
        if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => ({})));
        const data = await r.json();
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(path, { method = 'GET', body, form, retry = true } = {}) {
  const headers = { 'X-Requested-With': 'XMLHttpRequest' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401 && retry && accessToken) {
    try {
      await refreshSession();
      return api(path, { method, body, form, retry: false });
    } catch {
      accessToken = null;
      onAuthLost();
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const fmt = (n) => `${Number(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ')} so'm`;

export const STATUS = {
  accepted: { label: 'Qabul qilindi', color: 'bg-blue-100 text-blue-700', icon: '📝' },
  preparing: { label: 'Tayyorlanmoqda', color: 'bg-amber-100 text-amber-700', icon: '👨‍🍳' },
  on_the_way: { label: "Yo'lda", color: 'bg-violet-100 text-violet-700', icon: '🛵' },
  delivered: { label: 'Yetkazildi', color: 'bg-green-100 text-green-700', icon: '✅' },
  cancelled: { label: 'Bekor qilindi', color: 'bg-gray-200 text-gray-600', icon: '✖️' },
};
export const PAY_STATUS = {
  pending: { label: 'Kutilmoqda', color: 'text-amber-600' },
  paid: { label: "To'langan", color: 'text-green-600' },
  failed: { label: "To'lanmadi", color: 'text-red-600' },
  refunded: { label: 'Qaytarildi', color: 'text-gray-500' },
};
export const PAY_METHODS = {
  payme: { label: 'Payme', color: '#00CCCC' },
  click: { label: 'Click', color: '#0066FF' },
  card: { label: 'Bank kartasi', color: '#111827' },
  cash: { label: 'Naqd (yetkazishda)', color: '#16a34a' },
};
export const fmtDate = (d) => new Date(d).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
