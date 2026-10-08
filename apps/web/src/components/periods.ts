import type { Period } from '../types';

/** Günün bölümlerine ait etiketler ve renkler (Tailwind sınıfları tam yazılmalı ki derleyici bulsun). */
export const PERIODS: Record<Period, { label: string; emoji: string; active: string; soft: string }> = {
  morning: {
    label: 'Sabah',
    emoji: '☀️',
    active: 'bg-linear-to-b from-amber-300 to-orange-400 text-white shadow-[0_5px_0_#c2410c]',
    soft: 'bg-amber-50 text-amber-700',
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

export const PERIOD_ORDER: Period[] = ['morning', 'afternoon', 'evening'];
