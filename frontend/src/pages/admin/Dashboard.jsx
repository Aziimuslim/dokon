import { useEffect, useState } from 'react';
import { api, fmt, PAY_METHODS, STATUS } from '../../lib/api';
import { PageLoader } from '../../components/ui';

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const [hover, setHover] = useState(null);
  return (
    <div>
      <div className="relative flex h-48 items-end gap-[2px] sm:gap-1">
        {data.map((d, i) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className={`w-full rounded-t-md transition ${hover === i ? 'bg-brand-600' : 'bg-brand-400'}`} style={{ height: `${Math.max(d.revenue ? 3 : 1, (d.revenue / max) * 100)}%`, opacity: d.revenue ? 1 : 0.25 }} />
            {hover === i && (
              <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow">
                <div className="font-semibold">{fmt(d.revenue)}</div><div className="text-gray-300">{d.day} · {d.orders} ta</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-400"><span>{data[0]?.day}</span><span>{data[data.length - 1]?.day}</span></div>
    </div>
  );
}

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const [r, setR] = useState(null);
  useEffect(() => { setR(null); api(`/admin/reports?days=${days}`).then(setR); }, [days]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Hisobotlar</h1>
        <div className="flex gap-2">{[7, 30, 90].map((d) => <button key={d} className={days === d ? 'chip-on' : 'chip-off'} onClick={() => setDays(d)}>{d} kun</button>)}</div>
      </div>
      {!r ? <PageLoader /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              ['Daromad', fmt(r.summary.revenue), '💰'],
              ["To'langan", fmt(r.summary.paid_revenue), '✅'],
              ['Buyurtmalar', r.summary.orders, '📦'],
              ["O'rtacha chek", fmt(r.summary.avg_check), '🧾'],
            ].map(([l, v, i]) => (
              <div key={l} className="card p-4"><div className="flex items-center justify-between text-sm text-gray-500">{l}<span>{i}</span></div><div className="mt-1 text-xl font-extrabold sm:text-2xl">{v}</div></div>
            ))}
          </div>
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Kunlik sotuv</h2><span className="text-sm text-gray-500">{r.summary.customers} mijoz · {r.summary.cancelled} bekor</span></div>
            <BarChart data={r.daily} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-3 font-bold">Top mahsulotlar</h2>
              {r.top_products.length === 0 ? <p className="text-sm text-gray-500">Ma'lumot yo'q</p> : (
                <table className="w-full text-sm"><tbody>
                  {r.top_products.map((p, i) => (
                    <tr key={p.name} className="border-t border-gray-100 first:border-0">
                      <td className="py-2 pr-2 text-gray-400">{i + 1}</td><td className="py-2">{p.name}</td>
                      <td className="py-2 text-right text-gray-500">{p.quantity} ta</td><td className="py-2 text-right font-semibold">{fmt(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody></table>
              )}
            </div>
            <div className="space-y-5">
              <div className="card p-5">
                <h2 className="mb-3 font-bold">Kategoriyalar bo'yicha</h2>
                {(() => { const tot = r.by_category.reduce((s, c) => s + c.revenue, 0) || 1; return r.by_category.map((c) => (
                  <div key={c.category} className="mb-2">
                    <div className="flex justify-between text-sm"><span>{c.category}</span><span className="font-medium">{fmt(c.revenue)}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(c.revenue / tot) * 100}%` }} /></div>
                  </div>
                )); })()}
              </div>
              <div className="card grid grid-cols-2 gap-4 p-5 text-sm">
                <div><h3 className="mb-2 font-bold">Holatlar</h3>{r.by_status.map((s) => <div key={s.status} className="flex justify-between"><span>{STATUS[s.status].label}</span><b>{s.n}</b></div>)}</div>
                <div><h3 className="mb-2 font-bold">To'lov turlari</h3>{r.by_payment.map((s) => <div key={s.payment_method} className="flex justify-between"><span>{PAY_METHODS[s.payment_method].label}</span><b>{s.n}</b></div>)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
