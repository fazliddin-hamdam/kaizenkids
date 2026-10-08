import { config } from '../config.js';
import type { Period } from '../types.js';

/** Uygulama saat dilimine göre bugünün tarihi: "YYYY-MM-DD". */
export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "YYYY-MM-DD" tarihine gün ekler/çıkarır. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Saate göre günün bölümü: 12'ye kadar sabah, 17'ye kadar öğle, sonrası akşam. */
export function currentPeriod(now = new Date()): Period {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', hourCycle: 'h23' }).format(now),
  );
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
