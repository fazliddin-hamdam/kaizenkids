import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { haptic } from '../lib/telegram';
import type { ChildSummary } from '../types';
import { genderStyle } from './genderStyle';
import { SplashScreen } from './SplashScreen';

interface Props {
  /** Seçilen çocuk ve toplam çocuk sayısı (tek çocukta "Değiştir" butonu gizlenir). */
  onPick: (child: ChildSummary, childCount: number) => void;
}


/**
 * "Bugün kim oynuyor?" — uygulama her açıldığında çocuk seçilir.
 * Tek çocuk varsa ekran gösterilmeden doğrudan onun paneline geçilir.
 */
export function ChildPicker({ onPick }: Props) {
  const [children, setChildren] = useState<ChildSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { children: list } = await api.getChildren();
      if (list.length === 1) onPick(list[0], 1);
      else setChildren(list);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [onPick]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!children) return <SplashScreen error={error} onRetry={load} />;

  if (children.length === 0) {
    return (
      <div className="grid min-h-dvh place-items-center p-8 text-center">
        <div>
          <div className="animate-float text-8xl">👋</div>
          <p className="mt-4 text-3xl font-extrabold text-fuchsia-600">Merhaba!</p>
          <p className="mt-2 text-xl font-bold text-slate-600">Henüz kimse eklenmemiş.</p>
          <p className="mt-4 rounded-2xl bg-white/80 px-5 py-4 text-lg font-bold text-slate-600 shadow">
            Annen ya da baban botta
            <br />
            <code className="text-fuchsia-600">/isim Ali</code>
            <br />
            yazarak seni ekleyebilir.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-6 h-14 rounded-2xl bg-sky-500 px-8 text-xl font-extrabold text-white shadow-[0_5px_0_#0369a1] active:translate-y-1"
          >
            Yenile 🔄
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pt-8 pb-10">
      <header className="text-center">
        <div className="animate-wiggle inline-block text-7xl">⭐</div>
        <h1 className="mt-2 text-4xl font-extrabold text-fuchsia-600">Bugün kim oynuyor?</h1>
        <p className="text-xl font-bold text-slate-500">Adına dokun!</p>
      </header>

      <ul className="flex flex-col gap-4">
        {children.map((child, i) => {
          const color = genderStyle(child.gender);
          return (
            <li key={child.id} className="animate-pop" style={{ animationDelay: `${i * 80}ms` }}>
              <button
                type="button"
                onClick={() => {
                  haptic.tap();
                  onPick(child, children.length);
                }}
                className={`flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left transition active:translate-y-1 ${color.shadow}`}
              >
                <span
                  className={`grid size-20 shrink-0 place-items-center rounded-full text-5xl ${color.avatar}`}
                >
                  {child.avatar}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-3xl leading-tight font-extrabold text-slate-800">
                    {child.name}
                  </span>
                  <span className="block text-lg font-bold text-amber-500">
                    ⭐ {child.totalPoints} puan
                    {child.todayPoints > 0 && <span className="text-lime-600"> · bugün +{child.todayPoints}</span>}
                  </span>
                  <span className="block text-base font-bold text-slate-400">
                    Bugün {child.doneToday}/{child.totalToday} görev
                    {child.availableBigBoxes > 0 ? (
                      <span className="text-amber-600"> · 👑 büyük hediye!</span>
                    ) : (
                      child.availableBoxes > 0 && <span className="text-pink-500"> · 🎁 kutu var!</span>
                    )}
                  </span>
                </span>
                <span className="text-3xl text-slate-300">➜</span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
