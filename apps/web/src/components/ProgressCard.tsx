import type { DashboardState } from '../types';

interface Props {
  points: DashboardState['points'];
  onOpenBox: () => void;
}

/** Puan ilerleme çubuğu + Sürpriz Kutu. Eşik dolunca kutu sallanarak "beni aç" der. */
export function ProgressCard({ points, onOpenBox }: Props) {
  const { total, inCycle, threshold, availableBoxes } = points;
  const boxReady = availableBoxes > 0;
  const percent = boxReady ? 100 : Math.round((inCycle / threshold) * 100);
  const remaining = threshold - inCycle;

  return (
    <section className="rounded-3xl bg-white/90 p-5 shadow-lg">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-extrabold text-slate-700">Puanların</h2>
        <p className="text-3xl font-extrabold text-amber-500">
          {total} <span className="text-2xl">⭐</span>
        </p>
      </div>

      {/* İlerleme çubuğu */}
      <div className="relative mt-3 h-8 overflow-hidden rounded-full bg-slate-200 shadow-inner">
        <div
          className="h-full rounded-full bg-linear-to-r from-yellow-300 via-amber-400 to-pink-400 transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(percent, 6)}%` }}
        />
        <span className="absolute inset-0 grid place-items-center text-base font-extrabold text-slate-700">
          {boxReady ? 'Doldu! 🎉' : `${inCycle} / ${threshold}`}
        </span>
      </div>

      {boxReady ? (
        <button
          type="button"
          onClick={onOpenBox}
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-linear-to-b from-fuchsia-400 to-pink-500 py-4 text-2xl font-extrabold text-white shadow-[0_6px_0_#be185d] transition active:translate-y-1 active:shadow-[0_2px_0_#be185d]"
        >
          <span className="animate-wiggle inline-block text-4xl">🎁</span>
          Sürpriz Kutuyu Aç!
          {availableBoxes > 1 && (
            <span className="rounded-full bg-white px-2 text-lg text-pink-500">×{availableBoxes}</span>
          )}
        </button>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-lg font-bold text-slate-500">
          <span className="text-2xl grayscale">🎁</span>
          Sürpriz Kutuya <span className="text-pink-500">{remaining} puan</span> kaldı!
        </p>
      )}
    </section>
  );
}
