import { Router, type Response } from 'express';
import * as repo from '../db/repo.js';
import { AppError, handleChildDone, notifyBoxOpened } from '../services/approval.js';
import type { DashboardState, Family, OpenBoxResponse } from '../types.js';
import { currentPeriod, todayKey } from '../utils/date.js';
import { telegramAuth, type AuthedLocals } from './auth.js';

type AuthedResponse<T> = Response<T, AuthedLocals>;

/** Çocuk ekranının ihtiyaç duyduğu tüm veriyi tek seferde hazırlar. */
function buildDashboardState(familyId: number): DashboardState {
  const family = repo.getFamilyById(familyId) as Family;
  const today = todayKey();
  const statusByTask = new Map(repo.getLogsForDate(family.id, today).map((l) => [l.task_id, l.status]));

  return {
    childName: family.child_name ?? 'Kahraman',
    today,
    currentPeriod: currentPeriod(),
    streak: repo.getStreak(family.id, today),
    points: repo.getPointsSummary(family),
    hasRewards: repo.listActiveRewards(family.id).length > 0,
    tasks: repo.listTasks().map((t) => ({
      id: t.id,
      title: t.title,
      emoji: t.emoji,
      period: t.period,
      points: t.points,
      status: statusByTask.get(t.id) ?? 'todo',
    })),
  };
}

export const apiRouter = Router();

apiRouter.use(telegramAuth);

/** Gösterge paneli durumu (frontend bunu periyodik olarak yokluyor). */
apiRouter.get('/state', (_req, res: AuthedResponse<DashboardState>) => {
  res.json(buildDashboardState(res.locals.family.id));
});

/** Çocuk "Yaptım!" dedi → ebeveyne onay mesajı gider, görev "bekliyor" olur. */
apiRouter.post('/tasks/:taskId/done', async (req, res: AuthedResponse<DashboardState>) => {
  const taskId = Number(req.params.taskId);
  if (!Number.isInteger(taskId)) throw new AppError(400, 'Geçersiz görev.');

  await handleChildDone(res.locals.family, taskId);
  res.json(buildDashboardState(res.locals.family.id));
});

/** Sürpriz Kutuyu aç → rastgele ödül + ebeveyne bildirim. */
apiRouter.post('/box/open', async (_req, res: AuthedResponse<OpenBoxResponse>) => {
  const result = repo.openSurpriseBox(res.locals.family.id);
  if (!result.ok) {
    throw new AppError(
      409,
      result.reason === 'NO_BOX'
        ? 'Henüz açılacak kutu yok. Görevlerini yapmaya devam et! 💪'
        : 'Kutunun içi boş! Annenden/babandan bota ödül eklemesini iste. 🎁',
    );
  }

  await notifyBoxOpened(result.family, result.reward.title);
  res.json({ reward: { title: result.reward.title }, state: buildDashboardState(result.family.id) });
});
