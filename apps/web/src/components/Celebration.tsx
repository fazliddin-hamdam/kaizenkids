import { useEffect, useMemo } from 'react';

interface Props {
  title: string;
  points: number;
  onClose: () => void;
}

const CHEERS = ['Süper İş!', 'Harikasın!', 'Muhteşem!', 'Bravo!', 'Aferin Sana!'];
const AUTO_CLOSE_MS = 2800;

/** Ebeveyn onayladığında ekranı kaplayan kısa kutlama (konfeti ayrıca tetiklenir). */
export function Celebration({ title, points, onClose }: Props) {
  const cheer = useMemo(() => CHEERS[Math.floor(Math.random() * CHEERS.length)], []);

  useEffect(() => {
    const id = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-40 grid place-items-center bg-sky-900/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="animate-pop w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-2xl">
        <div className="animate-wiggle text-8xl">🎉</div>
        <p className="mt-2 text-4xl font-extrabold text-fuchsia-500">{cheer}</p>
        <p className="mt-1 text-xl font-bold text-slate-600">{title} onaylandı!</p>
        <p className="mt-4 inline-block rounded-full bg-amber-100 px-6 py-2 text-3xl font-extrabold text-amber-500">
          +{points} ⭐
        </p>
      </div>
    </div>
  );
}
