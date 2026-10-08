import type { Gender } from '../types';

/** Cinsiyete göre sade renkler: erkek mavi, kız pembe; seçilmemişse nötr (Tailwind sınıfları tam yazılmalı). */
export const GENDER_STYLE: Record<Gender | 'none', { avatar: string; shadow: string }> = {
  boy: { avatar: 'bg-linear-to-br from-sky-100 to-blue-300', shadow: 'shadow-[0_6px_0_#93c5fd]' },
  girl: { avatar: 'bg-linear-to-br from-pink-100 to-pink-300', shadow: 'shadow-[0_6px_0_#f9a8d4]' },
  none: { avatar: 'bg-linear-to-br from-slate-100 to-slate-300', shadow: 'shadow-[0_6px_0_#cbd5e1]' },
};

export const genderStyle = (gender: Gender | null) => GENDER_STYLE[gender ?? 'none'];
