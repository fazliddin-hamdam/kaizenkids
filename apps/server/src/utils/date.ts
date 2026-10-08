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

/** Hafta içi (Pazartesi–Cuma) mi? Resmî tatiller MVP'de dikkate alınmaz. */
export function isSchoolDay(dateKey: string): boolean {
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0 = Pazar, 6 = Cumartesi
  return weekday >= 1 && weekday <= 5;
}

/** Saate göre günün bölümü: 08'e kadar sabah, 15'e kadar okul/öğlen, 19'a kadar okul sonrası, sonrası akşam. */
export function currentPeriod(now = new Date()): Period {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', hourCycle: 'h23' }).format(now),
  );
  if (hour < 8) return 'morning';
  if (hour < 15) return 'school';
  if (hour < 19) return 'afternoon';
  return 'evening';
}
