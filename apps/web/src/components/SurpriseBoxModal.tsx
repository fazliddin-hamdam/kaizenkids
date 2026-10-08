import { useState } from 'react';
import { fireworks } from '../lib/confetti';
import { haptic } from '../lib/telegram';
import type { RewardKind } from '../types';

interface Props {
  kind: RewardKind;
  onOpen: () => Promise<{ title: string }>;
  onClose: () => void;
}

/** Sürpriz Kutu (pembe) ve Büyük Hediye (altın) görünümleri. */
const LOOK: Record<RewardKind, { backdrop: string; card: string; title: string; emoji: string; prize: string }> = {
  small: {
    backdrop: 'bg-fuchsia-900/50',
    card: 'bg-white',
    title: 'Sürpriz Kutu!',
    emoji: '🎁',
    prize: 'Kutudan çıkan ödül:',
  },
  big: {
    backdrop: 'bg-amber-900/60',
    card: 'bg-linear-to-b from-yellow-50 to-amber-100 ring-4 ring-amber-300',
    title: '👑 Büyük Hediye Kutusu!',
    emoji: '🎁',
    prize: 'BÜYÜK ödülün:',
  },
};

type Phase = 'closed' | 'opening' | 'revealed' | 'error';

/** Kutu sallanır → çocuk dokunur → ödül konfetiyle ortaya çıkar. */
export function SurpriseBoxModal({ kind, onOpen, onClose }: Props) {
  const look = LOOK[kind];
  const [phase, setPhase] = useState<Phase>('closed');
  const [text, setText] = useState('');

  const open = async () => {
    if (phase !== 'closed') return;
    haptic.tap();
    setPhase('opening');
    try {
      // Biraz heyecan: istek hızlı dönse bile kutu kısa bir süre sallansın.
      const [reward] = await Promise.all([onOpen(), new Promise((r) => setTimeout(r, 1200))]);
      setText(reward.title);
      setPhase('revealed');
      haptic.success();
      fireworks();
      if (kind === 'big') setTimeout(fireworks, 900); // büyük hediye: ikinci dalga
    } catch (error) {
      setText((error as Error).message);
      setPhase('error');
      haptic.error();
    }
  };

  return (
    <div className={`animate-fade-in fixed inset-0 z-40 grid place-items-center p-6 backdrop-blur-sm ${look.backdrop}`}>
      <div className={`animate-pop w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl ${look.card}`}>
        {phase === 'revealed' ? (
          <>
            <div className="animate-float text-8xl">{kind === 'big' ? '👑' : '🏆'}</div>
            <p className="mt-2 text-2xl font-extrabold text-fuchsia-500">{look.prize}</p>
            <p className="mt-3 rounded-2xl bg-amber-100 px-4 py-4 text-3xl leading-tight font-extrabold text-amber-600">
              {text}
            </p>
            <p className="mt-4 text-lg font-bold text-slate-500">Bu ekranı annene ya da babana göster! 😊</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 h-16 w-full rounded-2xl bg-linear-to-b from-lime-400 to-green-500 text-2xl font-extrabold text-white shadow-[0_6px_0_#15803d] transition active:translate-y-1"
            >
              Yaşasın! 🎉
            </button>
          </>
        ) : phase === 'error' ? (
          <>
            <div className="text-8xl">🙈</div>
            <p className="mt-4 text-xl font-bold text-slate-600">{text}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 h-16 w-full rounded-2xl bg-slate-200 text-2xl font-extrabold text-slate-600 transition active:translate-y-1"
            >
              Tamam
            </button>
          </>
        ) : (
          <>
            <p className={`text-3xl font-extrabold ${kind === 'big' ? 'text-amber-600' : 'text-fuchsia-500'}`}>
              {look.title}
            </p>
            <button
              type="button"
              onClick={open}
              aria-label="Kutuyu aç"
              className={`my-4 leading-none ${kind === 'big' ? 'text-[11rem]' : 'text-[9rem]'} ${
                phase === 'opening' ? 'animate-shake' : 'animate-wiggle'
              }`}
            >
              {look.emoji}
            </button>
            <p className="text-xl font-bold text-slate-500">
              {phase === 'opening' ? 'Açılıyor...' : 'Açmak için kutuya dokun!'}
            </p>
            {phase === 'closed' && (
              <button type="button" onClick={onClose} className="mt-4 text-lg font-bold text-slate-400 underline">
                Sonra açarım
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
