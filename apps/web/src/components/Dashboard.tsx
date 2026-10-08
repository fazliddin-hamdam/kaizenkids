import { useCallback, useState } from 'react';
import { useDashboard, type Transitions } from '../hooks/useDashboard';
import { burst } from '../lib/confetti';
import { haptic } from '../lib/telegram';
import type { Period, RewardKind, TaskView } from '../types';
import { Celebration } from './Celebration';
import { PeriodTabs } from './PeriodTabs';
import { periodMeta } from './periods';
import { ProgressCard } from './ProgressCard';
import { SurpriseBoxModal } from './SurpriseBoxModal';
import { TaskCard } from './TaskCard';
import { SplashScreen } from './SplashScreen';
import { Toast, type ToastMessage } from './Toast';

const GREETING: Record<Period, string> = {
  morning: 'Günaydın',
  school: 'İyi günler',
  afternoon: 'İyi günler',
  evening: 'İyi akşamlar',
};

interface Props {
  childId: number;
  /** Verilirse başlıkta "Değiştir" butonu çıkar (birden fazla çocuk varsa). */
  onSwitchChild?: () => void;
}

/** Çocuğun ana ekranı: selamlama + seri, puan/kutu, gün bölümü sekmeleri ve görev kartları. */
export function Dashboard({ childId, onSwitchChild }: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; points: number } | null>(null);
  const [openingBox, setOpeningBox] = useState<RewardKind | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string, tone: ToastMessage['tone']) => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  // Ebeveyn Telegram'da karar verdiğinde (yoklama ile yakalanır) tepki ver.
  const onTransitions = useCallback(
    ({ approved, rejected }: Transitions) => {
      if (approved.length > 0) {
        haptic.success();
        burst();
        setCelebration({
          title: approved.length === 1 ? `"${approved[0].title}"` : `${approved.length} görev`,
          points: approved.reduce((sum, t) => sum + t.points, 0),
        });
      }
      if (rejected.length > 0) {
        haptic.warning();
        showToast(`"${rejected[0].title}" henüz onaylanmadı. Bir daha dene! 💪`, 'warn');
      }
    },
    [showToast],
  );

  const { state, loadError, busyTaskId, refresh, markDone, openBox } = useDashboard(childId, onTransitions);

  const handleDone = async (task: TaskView) => {
    haptic.tap();
    try {
      await markDone(task.id);
      showToast('Harika! Annene/babana haber verdim. 📨', 'info');
    } catch (error) {
      haptic.error();
      showToast((error as Error).message, 'error');
      void refresh();
    }
  };

  if (!state) return <SplashScreen error={loadError} onRetry={refresh} />;

  const activePeriod = selectedPeriod ?? state.currentPeriod;
  const activeMeta = periodMeta(activePeriod, state.isSchoolDay);
  const visibleTasks = state.tasks.filter((t) => t.period === activePeriod);
  const approvedToday = state.tasks.filter((t) => t.status === 'approved').length;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-5 pb-10">
      {/* Selamlama */}
      <header className="flex items-center gap-4 rounded-3xl bg-white/90 p-4 shadow-lg">
        <div className="animate-float grid size-16 shrink-0 place-items-center rounded-full bg-linear-to-br from-yellow-200 to-pink-300 text-4xl">
          {state.avatar}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-slate-500">{GREETING[state.currentPeriod]},</p>
          <h1 className="truncate text-3xl leading-tight font-extrabold text-fuchsia-600">{state.childName}!</h1>
          {onSwitchChild && (
            <button
              type="button"
              onClick={() => {
                haptic.tap();
                onSwitchChild();
              }}
              className="mt-1 rounded-full bg-sky-100 px-3 py-0.5 text-sm font-extrabold text-sky-700 active:translate-y-0.5"
            >
              🔄 Değiştir
            </button>
          )}
        </div>
        <div className="flex flex-col items-center rounded-2xl bg-orange-100 px-3 py-2" title="Zinciri kırma!">
          <span className="text-3xl leading-none">🔥</span>
          <span className="text-base font-extrabold text-orange-600">{state.streak} gün</span>
        </div>
      </header>

      <ProgressCard points={state.points} onOpenBox={setOpeningBox} />

      <PeriodTabs
        active={activePeriod}
        tasks={state.tasks}
        isSchoolDay={state.isSchoolDay}
        onChange={setSelectedPeriod}
      />

      {/* Görevler */}
      <section>
        <h2 className={`mb-3 inline-block rounded-full px-4 py-1 text-lg font-extrabold ${activeMeta.soft}`}>
          {activeMeta.emoji} {activeMeta.label} Görevleri
        </h2>
        <ul className="flex flex-col gap-4">
          {visibleTasks.map((task) => (
            <TaskCard key={task.id} task={task} busy={busyTaskId === task.id} onDone={handleDone} />
          ))}
        </ul>
      </section>

      <footer className="text-center text-lg font-bold text-slate-500">
        {approvedToday === state.tasks.length
          ? 'Bugünün tüm görevleri tamam! Sen bir yıldızsın! 🌟'
          : 'Her gün %1 daha iyi! 🌱'}
      </footer>

      {celebration && (
        <Celebration title={celebration.title} points={celebration.points} onClose={() => setCelebration(null)} />
      )}
      {openingBox && (
        <SurpriseBoxModal kind={openingBox} onOpen={() => openBox(openingBox)} onClose={() => setOpeningBox(null)} />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </main>
  );
}
