import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field, fieldErrors } from '../components/ui';

function Shell({ title, subtitle, children }) {
  return (
    <div className="container-x flex justify-center pt-8 sm:pt-14">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-accent-500 text-3xl">🍔</div>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

const homeFor = (u, next) => next || (u.role === 'admin' ? '/admin' : u.role === 'courier' ? '/courier' : '/');

export function Login() {
  const { login, user } = useAuth();
  const [sp] = useSearchParams();
  const next = sp.get('next')?.startsWith('/') ? sp.get('next') : '';
  const nav = useNavigate();
  const [f, setF] = useState({ login: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user, next)} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try { const u = await login(f.login, f.password); nav(homeFor(u, next), { replace: true }); }
    catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }
  return (
    <Shell title="Xush kelibsiz!" subtitle="Hisobingizga kiring">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Telefon yoki email"><input className="input" required autoComplete="username" placeholder="+998 90 123 45 67 yoki email" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} /></Field>
        <Field label="Parol"><input className="input" required type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? 'Kirilmoqda...' : 'Kirish'}</button>
      </form>
      <p className="mt-5 text-center text-sm text-gray-600">Hisobingiz yo'qmi? <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-brand-600">Ro'yxatdan o'ting</Link></p>
      <details className="mt-5 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
        <summary className="cursor-pointer font-medium">Demo hisoblar</summary>
        <div className="mt-2 space-y-1">
          {[['admin@dokon.uz', 'Admin12345', 'Admin'], ['courier@dokon.uz', 'Courier12345', 'Kuryer'], ['user@dokon.uz', 'User12345', 'Mijoz']].map(([l, p, r]) => (
            <button key={l} type="button" className="block w-full rounded-lg px-2 py-1 text-left hover:bg-white" onClick={() => setF({ login: l, password: p })}>{r}: {l} / {p}</button>
          ))}
        </div>
      </details>
    </Shell>
  );
}

export function Register() {
  const { register, user } = useAuth();
  const [sp] = useSearchParams();
  const next = sp.get('next')?.startsWith('/') ? sp.get('next') : '';
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '', password2: '' });
  const [errors, setErrors] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user, next)} replace />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (f.password !== f.password2) { setErrors({ password2: 'Parollar mos emas' }); return; }
    setBusy(true); setErr(''); setErrors({});
    try {
      const { password2, ...data } = f; // eslint-disable-line no-unused-vars
      if (!data.email) delete data.email;
      if (!data.phone) delete data.phone;
      const u = await register(data);
      nav(homeFor(u, next), { replace: true });
    } catch (e2) { setErrors(fieldErrors(e2)); setErr(e2.message); }
    finally { setBusy(false); }
  }
  return (
    <Shell title="Ro'yxatdan o'tish" subtitle="Bir daqiqada hisob yarating">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Ismingiz" error={errors.name}><input className="input" required minLength={2} autoComplete="name" value={f.name} onChange={set('name')} /></Field>
        <Field label="Telefon" error={errors.phone}><input className="input" type="tel" autoComplete="tel" placeholder="+998 90 123 45 67" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Email (ixtiyoriy)" error={errors.email}><input className="input" type="email" autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Parol" error={errors.password}><input className="input" required type="password" minLength={8} autoComplete="new-password" placeholder="Kamida 8 belgi, harf va raqam" value={f.password} onChange={set('password')} /></Field>
        <Field label="Parolni takrorlang" error={errors.password2}><input className="input" required type="password" autoComplete="new-password" value={f.password2} onChange={set('password2')} /></Field>
        {err && !Object.keys(errors).length && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <button className="btn-primary w-full !py-3" disabled={busy}>{busy ? 'Yuborilmoqda...' : "Ro'yxatdan o'tish"}</button>
      </form>
      <p className="mt-5 text-center text-sm text-gray-600">Hisobingiz bormi? <Link to="/login" className="font-semibold text-brand-600">Kirish</Link></p>
    </Shell>
  );
}
