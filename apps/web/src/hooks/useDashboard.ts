import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { DashboardState, RewardKind, TaskStatus, TaskView } from '../types';

/** Bekleyen görev varken ebeveyn kararını hızlı yakalamak için sık, yoksa seyrek yokla. */
const FAST_POLL_MS = 3000;
const SLOW_POLL_MS = 20000;

export interface Transitions {
  approved: TaskView[];
  rejected: TaskView[];
}

/**
 * Gösterge paneli verisini yönetir:
 *  - ilk yükleme + periyodik yoklama (ebeveyn Telegram'da onayladığında ekran güncellensin)
 *  - "pending → approved/rejected" geçişlerini yakalayıp kutlama/uyarı için bildirir
 */
export function useDashboard(childId: number, onTransitions: (t: Transitions) => void) {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

  const previous = useRef(new Map<number, TaskStatus>());
  const callback = useRef(onTransitions);
  callback.current = onTransitions;

  /** Yeni durumu uygula ve önceki duruma göre değişen görevleri bul. */
  const apply = useCallback((next: DashboardState) => {
    const wasPending = (t: TaskView) => previous.current.get(t.id) === 'pending';
    const approved = next.tasks.filter((t) => t.status === 'approved' && wasPending(t));
    const rejected = next.tasks.filter((t) => t.status === 'rejected' && wasPending(t));

    previous.current = new Map(next.tasks.map((t) => [t.id, t.status]));
    setState(next);
    if (approved.length || rejected.length) callback.current({ approved, rejected });
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await api.getState(childId));
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }, [apply, childId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasPending = state?.tasks.some((t) => t.status === 'pending') ?? false;
  useEffect(() => {
    const id = setInterval(refresh, hasPending ? FAST_POLL_MS : SLOW_POLL_MS);
    return () => clearInterval(id);
  }, [hasPending, refresh]);

  // Uygulamaya geri dönüldüğünde (ör. ebeveyn sohbetinden) hemen yenile.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  /** "Yaptım!" — hata olursa fırlatır, çağıran taraf mesaj gösterir. */
  const markDone = useCallback(
    async (taskId: number) => {
      setBusyTaskId(taskId);
      try {
        apply(await api.markDone(childId, taskId));
      } finally {
        setBusyTaskId(null);
      }
    },
    [apply, childId],
  );

  const openBox = useCallback(
    async (kind: RewardKind) => {
      const { reward, state: next } = await api.openBox(childId, kind);
      apply(next);
      return reward;
    },
    [apply, childId],
  );

  return { state, loadError, busyTaskId, refresh, markDone, openBox };
}
