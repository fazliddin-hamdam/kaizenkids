import { haptic } from '../lib/telegram';
import type { Period, TaskView } from '../types';
import { PERIOD_ORDER, PERIODS } from './periods';

interface Props {
  active: Period;
  tasks: TaskView[];
  onChange: (period: Period) => void;
}

/** Sabah / Okul Sonrası / Akşam sekmeleri — büyük, dokunması kolay butonlar. */
export function PeriodTabs({ active, tasks, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {PERIOD_ORDER.map((period) => {
        const meta = PERIODS[period];
        const inPeriod = tasks.filter((t) => t.period === period);
        const done = inPeriod.filter((t) => t.status === 'approved').length;
        const allDone = inPeriod.length > 0 && done === inPeriod.length;
        const isActive = period === active;

        return (
          <button
            key={period}
            type="button"
            onClick={() => {
              haptic.tap();
              onChange(period);
            }}
            className={`flex flex-col items-center rounded-3xl px-2 py-3 transition active:translate-y-1 ${
              isActive ? meta.active : `bg-white/80 text-slate-600 shadow-[0_5px_0_#cbd5e1]`
            }`}
          >
            <span className="text-3xl leading-none">{allDone ? '🏆' : meta.emoji}</span>
            <span className="mt-1 text-base leading-tight font-extrabold">{meta.label}</span>
            <span className={`text-sm font-bold ${isActive ? 'text-white/90' : 'text-slate-400'}`}>
              {done}/{inPeriod.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}
