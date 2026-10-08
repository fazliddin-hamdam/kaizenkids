import type { DashboardState, RewardKind } from '../types';

interface Props {
  points: DashboardState['points'];
  onOpenBox: (kind: RewardKind) => void;
}

/**
 * Puan kartı: toplam + bugünkü puan, Sürpriz Kutu çubuğu (her 100 puan) ve
 * Büyük Hediye çubuğu (her 1000 puan). Eşik dolunca ilgili kutu sallanarak "beni aç" der.
 */
export function ProgressCard({ points, onOpenBox }: Props) {
  const { total, today, inCycle, threshold, availableBoxes, big } = points;

  return (
    <section className="rounded-3xl bg-white/90 p-5 shadow-lg">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl font-extrabold text-slate-700">Puanların</h2>
        <p className="text-3xl font-extrabold text-amber-500">
          {total} <span className="text-2xl">⭐</span>
        </p>
      </div>
      <p className="mt-1 inline-flex rounded-full bg-lime-100 px-3 py-0.5 text-base font-extrabold text-lime-700">
        {today > 0 ? `Bugün +${today} puan kazandın! 🚀` : 'Bugün ilk puanını kazanmaya hazır mısın? 💪'}
      </p>

      {/* 🎁 Sürpriz Kutu */}
      <ProgressBar
        value={inCycle}
        max={threshold}
        full={availableBoxes > 0}
        barClass="bg-linear-to-r from-yellow-300 via-amber-400 to-pink-400"
        trackClass="bg-slate-200"
      />
      {availableBoxes > 0 ? (
        <OpenButton
          onClick={() => onOpenBox('small')}
          count={availableBoxes}
          emoji="🎁"
          label="Sürpriz Kutuyu Aç!"
          className="bg-linear-to-b from-fuchsia-400 to-pink-500 shadow-[0_6px_0_#be185d] active:shadow-[0_2px_0_#be185d]"
        />
      ) : (
        <p className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-500">
          <span className="text-2xl grayscale">🎁</span>
          Sürpriz Kutuya <span className="text-pink-500">{threshold - inCycle} puan</span> kaldı!
        </p>
      )}

      {/* 👑 Büyük Hediye Kutusu */}
      <div className="mt-4 rounded-2xl bg-linear-to-br from-amber-50 to-yellow-100 p-3 ring-2 ring-amber-300">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-amber-700">👑 Büyük Hediye</h3>
          <span className="text-base font-extrabold text-amber-600">
            {big.availableBoxes > 0 ? 'Hazır!' : `${big.inCycle} / ${big.threshold}`}
          </span>
        </div>
        <ProgressBar
          value={big.inCycle}
          max={big.threshold}
          full={big.availableBoxes > 0}
          barClass="bg-linear-to-r from-amber-400 via-yellow-400 to-orange-500"
          trackClass="bg-amber-100"
          small
        />
        {big.availableBoxes > 0 ? (
          <OpenButton
            onClick={() => onOpenBox('big')}
            count={big.availableBoxes}
            emoji="👑"
            label="Büyük Hediyeyi Aç!"
            className="bg-linear-to-b from-amber-400 to-orange-500 shadow-[0_6px_0_#c2410c] active:shadow-[0_2px_0_#c2410c]"
          />
        ) : (
          <p className="mt-1 text-base font-bold text-amber-700">
            Büyük hediyeye <span className="text-orange-600">{big.threshold - big.inCycle} puan</span> kaldı! 🌟
          </p>
        )}
      </div>
    </section>
  );
}

function ProgressBar(props: {
  value: number;
  max: number;
  full: boolean;
  barClass: string;
  trackClass: string;
  small?: boolean;
}) {
  const percent = props.full ? 100 : Math.round((props.value / props.max) * 100);
  return (
    <div
      className={`relative mt-3 overflow-hidden rounded-full shadow-inner ${props.trackClass} ${props.small ? 'h-5' : 'h-8'}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${props.barClass}`}
        style={{ width: `${Math.max(percent, 4)}%` }}
      />
      {!props.small && (
        <span className="absolute inset-0 grid place-items-center text-base font-extrabold text-slate-700">
          {props.full ? 'Doldu! 🎉' : `${props.value} / ${props.max}`}
        </span>
      )}
    </div>
  );
}

function OpenButton(props: { onClick: () => void; count: number; emoji: string; label: string; className: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`mt-3 flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-2xl font-extrabold text-white transition active:translate-y-1 ${props.className}`}
    >
      <span className="animate-wiggle inline-block text-4xl">{props.emoji}</span>
      {props.label}
      {props.count > 1 && <span className="rounded-full bg-white px-2 text-lg text-pink-500">×{props.count}</span>}
    </button>
  );
}
