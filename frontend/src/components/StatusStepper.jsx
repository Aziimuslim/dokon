import { STATUS } from '../lib/api';

const STEPS = ['accepted', 'preparing', 'on_the_way', 'delivered'];

export default function StatusStepper({ status }) {
  if (status === 'cancelled') {
    return <div className="rounded-xl bg-gray-100 p-4 text-center font-semibold text-gray-600">✖️ Buyurtma bekor qilingan</div>;
  }
  const idx = STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1">
      {STEPS.map((s, i) => {
        const done = i <= idx;
        return (
          <li key={s} className="flex flex-col items-center text-center">
            <div className="relative flex w-full items-center justify-center">
              {i > 0 && <div className={`absolute right-1/2 top-1/2 h-1 w-full -translate-y-1/2 ${i <= idx ? 'bg-brand-500' : 'bg-gray-200'}`} />}
              <div className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full text-xl transition ${done ? 'bg-brand-500 shadow-lg shadow-brand-500/30' : 'bg-gray-200 grayscale'} ${i === idx ? 'ring-4 ring-brand-200' : ''}`}>
                {STATUS[s].icon}
              </div>
            </div>
            <span className={`mt-2 text-xs font-medium sm:text-sm ${done ? 'text-gray-900' : 'text-gray-400'}`}>{STATUS[s].label}</span>
          </li>
        );
      })}
    </ol>
  );
}
