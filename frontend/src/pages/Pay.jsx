import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, fmt, PAY_METHODS } from '../lib/api';
import { PageLoader } from '../components/ui';

/** Payme/Click to'lov sahifasini simulyatsiya qiluvchi SANDBOX sahifa */
export default function Pay() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const t = sp.get('t');
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [step, setStep] = useState('card');
  const [card, setCard] = useState({ number: '', expiry: '', code: '' });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api(`/payment/sandbox/${id}?t=${encodeURIComponent(t || '')}`).then(setInfo).catch((e) => setErr(e.message)); }, [id, t]);

  if (err && !info) return <div className="container-x pt-10 text-center text-red-600">{err}</div>;
  if (!info) return <PageLoader />;
  const brand = PAY_METHODS[info.provider] || PAY_METHODS.card;

  const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
  const fmtExp = (v) => v.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2');

  async function confirm(e) {
    e.preventDefault();
    if (step === 'card') { setStep('sms'); return; }
    setBusy(true); setErr('');
    try {
      setResult(await api(`/payment/sandbox/${id}/confirm`, { method: 'POST', body: { t, ...card } }));
    } catch (e2) {
      setErr(e2.message);
    } finally { setBusy(false); }
  }

  if (info.status !== 'created' && !result) {
    return (
      <div className="container-x max-w-md pt-10 text-center">
        <div className="card p-8"><div className="text-5xl">ℹ️</div><p className="mt-3">Bu to'lov allaqachon yakunlangan.</p>
          <Link to={`/orders/${info.order_id}`} className="btn-primary mt-5">Buyurtmaga qaytish</Link></div>
      </div>
    );
  }

  return (
    <div className="container-x max-w-md pt-8">
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="p-6 text-white" style={{ background: brand.color }}>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-extrabold">{brand.label}</span>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold uppercase">Sandbox</span>
          </div>
          <div className="mt-6 text-sm opacity-80">Online do'kon · Buyurtma #{info.order_id}</div>
          <div className="text-3xl font-extrabold">{fmt(info.amount)}</div>
        </div>

        {result ? (
          <div className="p-6 text-center">
            <div className="text-6xl">{result.status === 'paid' ? '✅' : '❌'}</div>
            <h2 className="mt-3 text-xl font-bold">{result.message}</h2>
            <div className="mt-6 flex flex-col gap-2">
              <Link to={`/orders/${result.order_id}`} className="btn-primary">Buyurtmani kuzatish</Link>
              {result.status !== 'paid' && <Link to={`/orders/${result.order_id}?repay=1`} className="btn-outline">Qayta to'lash</Link>}
            </div>
          </div>
        ) : (
          <form onSubmit={confirm} className="space-y-4 p-6">
            {step === 'card' ? (
              <>
                <label className="block"><span className="label">Karta raqami</span>
                  <input className="input font-mono tracking-wider" required inputMode="numeric" placeholder="8600 0000 0000 0000" value={card.number} onChange={(e) => setCard({ ...card, number: fmtCard(e.target.value) })} />
                </label>
                <label className="block"><span className="label">Amal qilish muddati</span>
                  <input className="input w-32 font-mono" required inputMode="numeric" placeholder="MM/YY" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: fmtExp(e.target.value) })} />
                </label>
              </>
            ) : (
              <label className="block"><span className="label">SMS kod ({card.number.slice(-4)} karta egasining telefoniga yuborildi)</span>
                <input className="input text-center font-mono text-2xl tracking-[.5em]" required autoFocus inputMode="numeric" maxLength={6} value={card.code} onChange={(e) => setCard({ ...card, code: e.target.value.replace(/\D/g, '') })} />
              </label>
            )}
            {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
            <button className="btn w-full !py-3 text-white" style={{ background: brand.color }} disabled={busy}>{busy ? 'Tekshirilmoqda...' : step === 'card' ? 'Davom etish' : `${fmt(info.amount)} to'lash`}</button>
            <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
              <b>Test ma'lumotlari:</b><br />
              ✅ {fmtCard(info.test_cards.success)} — muvaffaqiyatli<br />
              ❌ {fmtCard(info.test_cards.insufficient)} — mablag' yetarli emas<br />
              Muddat: istalgan (masalan 12/29) · SMS kod: <b>{info.test_sms_code}</b>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
