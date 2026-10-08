import type { TaskView } from '../types';

interface Props {
  task: TaskView;
  busy: boolean;
  onDone: (task: TaskView) => void;
}

const CARD_STYLE: Record<TaskView['status'], string> = {
  todo: 'bg-white border-white',
  pending: 'bg-amber-50 border-amber-300',
  approved: 'bg-lime-50 border-lime-400',
  rejected: 'bg-orange-50 border-orange-300',
};

/** 3D görünümlü büyük buton tabanı: basınca aşağı "çöker". */
const BIG_BUTTON =
  'flex h-16 w-full items-center justify-center gap-2 rounded-2xl text-2xl font-extrabold transition active:translate-y-1';

/**
 * Tek bir görev kartı. Durumlar:
 *  todo     → yeşil "Yaptım!" butonu
 *  pending  → sarı "Onay bekleniyor" (puan HENÜZ verilmedi)
 *  approved → "Tamamlandı" rozeti
 *  rejected → turuncu "Tekrar Dene" butonu
 */
export function TaskCard({ task, busy, onDone }: Props) {
  return (
    <li className={`animate-pop rounded-3xl border-4 p-4 shadow-lg ${CARD_STYLE[task.status]}`}>
      <div className="flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-sky-100 text-4xl">
          <span className={task.status === 'approved' ? 'animate-float' : ''}>{task.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-xl leading-tight font-extrabold ${
              task.status === 'approved' ? 'text-lime-700' : 'text-slate-800'
            }`}
          >
            {task.title}
          </p>
          <p className="text-lg font-bold text-amber-500">+{task.points} ⭐</p>
        </div>
      </div>

      <div className="mt-3">{renderAction(task, busy, onDone)}</div>
    </li>
  );
}

function renderAction(task: TaskView, busy: boolean, onDone: (task: TaskView) => void) {
  if (busy) {
    return (
      <div className={`${BIG_BUTTON} bg-slate-200 text-slate-500`}>
        <span className="animate-spin">🌀</span> Gönderiliyor...
      </div>
    );
  }

  switch (task.status) {
    case 'todo':
      return (
        <button
          type="button"
          onClick={() => onDone(task)}
          className={`${BIG_BUTTON} bg-linear-to-b from-lime-400 to-green-500 text-white shadow-[0_6px_0_#15803d] active:shadow-[0_2px_0_#15803d]`}
        >
          Yaptım! ✋
        </button>
      );

    case 'pending':
      return (
        <div className="rounded-2xl bg-amber-200/70 px-4 py-3 text-center">
          <p className="flex items-center justify-center gap-2 text-xl font-extrabold text-amber-800">
            <span className="animate-shake inline-block">⏳</span> Onay bekleniyor...
          </p>
          <p className="text-sm font-bold text-amber-700">Annen ya da baban Telegram'dan onaylayacak.</p>
        </div>
      );

    case 'approved':
      return (
        <div className={`${BIG_BUTTON} cursor-default bg-lime-200 text-lime-800 active:translate-y-0`}>
          Tamamlandı! 🌟
        </div>
      );

    case 'rejected':
      return (
        <div className="space-y-2">
          <p className="text-center text-base font-bold text-orange-700">Henüz onaylanmadı. Bir daha dene! 💪</p>
          <button
            type="button"
            onClick={() => onDone(task)}
            className={`${BIG_BUTTON} bg-linear-to-b from-orange-300 to-orange-500 text-white shadow-[0_6px_0_#c2410c] active:shadow-[0_2px_0_#c2410c]`}
          >
            Tekrar Dene 🔁
          </button>
        </div>
      );
  }
}
