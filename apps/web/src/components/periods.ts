import type { Period } from '../types';

interface PeriodMeta {
  label: string;
  emoji: string;
  active: string;
  soft: string;
}

/** Günün bölümlerine ait etiketler ve renkler (Tailwind sınıfları tam yazılmalı ki derleyici bulsun). */
export const PERIODS: Record<Period, PeriodMeta> = {
  morning: {
    label: 'Sabah',
    emoji: '☀️',
    active: 'bg-linear-to-b from-amber-300 to-orange-400 text-white shadow-[0_5px_0_#c2410c]',
    soft: 'bg-amber-50 text-amber-700',
  },
  school: {
    label: 'Okulda',
    emoji: '🏫',
    active: 'bg-linear-to-b from-rose-300 to-pink-500 text-white shadow-[0_5px_0_#be185d]',
    soft: 'bg-rose-50 text-rose-700',
  },
  afternoon: {
    label: 'Okul Sonrası',
    emoji: '🎒',
    active: 'bg-linear-to-b from-sky-300 to-cyan-500 text-white shadow-[0_5px_0_#0e7490]',
    soft: 'bg-sky-50 text-sky-700',
  },
  evening: {
    label: 'Akşam',
    emoji: '🌙',
    active: 'bg-linear-to-b from-indigo-400 to-violet-500 text-white shadow-[0_5px_0_#5b21b6]',
    soft: 'bg-violet-50 text-violet-700',
  },
};

/** Hafta sonu okul olmadığı için öğle dilimi "Öğlen" olarak gösterilir. */
export function periodMeta(period: Period, isSchoolDay: boolean): PeriodMeta {
  if (period === 'school' && !isSchoolDay) return { ...PERIODS.school, label: 'Öğlen', emoji: '🍽️' };
  return PERIODS[period];
}

export const PERIOD_ORDER: Period[] = ['morning', 'school', 'afternoon', 'evening'];
