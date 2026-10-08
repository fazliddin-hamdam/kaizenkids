import { Router, type Request, type Response } from 'express';
import * as repo from '../db/repo.js';
import { AppError, handleChildDone, notifyBoxOpened } from '../services/approval.js';
import type { Child, ChildrenResponse, ChildSummary, DashboardState, Family, OpenBoxResponse } from '../types.js';
import { currentPeriod, isSchoolDay, todayKey } from '../utils/date.js';
import { telegramAuth, type AuthedLocals } from './auth.js';

type AuthedResponse<T> = Response<T, AuthedLocals>;

/** Çocuk seçim ekranı için kısa özet. */
function buildChildSummary(child: Child, today: string): ChildSummary {
  const tasks = repo.listTasksForDate(today);
  const approved = new Set(
    repo
      .getLogsForDate(child.id, today)
      .filter((l) => l.status === 'approved')
      .map((l) => l.task_id),
  );
  return {
    id: child.id,
    name: child.name,
    avatar: child.avatar,
    totalPoints: child.total_points,
    availableBoxes: repo.getPointsSummary(child).availableBoxes,
    doneToday: tasks.filter((t) => approved.has(t.id)).length,
    totalToday: tasks.length,
  };
}

/** Çocuk ekranının ihtiyaç duyduğu tüm veriyi tek seferde hazırlar. */
function buildDashboardState(childId: number): DashboardState {
  const child = repo.getChild(childId)!;
  const today = todayKey();
  const statusByTask = new Map(repo.getLogsForDate(child.id, today).map((l) => [l.task_id, l.status]));

  return {
    childId: child.id,
    childName: child.name,
    avatar: child.avatar,
    today,
    isSchoolDay: isSchoolDay(today),
    currentPeriod: currentPeriod(),
    streak: repo.getStreak(child.id, today),
    points: repo.getPointsSummary(child),
    hasRewards: repo.listActiveRewards(child.family_id).length > 0,
    tasks: repo.listTasksForDate(today).map((t) => ({
      id: t.id,
      title: t.title,
      emoji: t.emoji,
      period: t.period,
      points: t.points,
      status: statusByTask.get(t.id) ?? 'todo',
    })),
  };
}

/** URL'deki çocuğun bu ebeveyne ait olduğunu doğrular (başka ailenin verisine erişilemesin). */
function childFromRequest(req: Request, family: Family): Child {
  const child = repo.getActiveChildOfFamily(family.id, Number(req.params.childId));
  if (!child) throw new AppError(404, 'Bu çocuk bulunamadı. Listeden tekrar seç.');
  return child;
}

export const apiRouter = Router();

apiRouter.use(telegramAuth);

/** "Bugün kim oynuyor?" ekranı. */
apiRouter.get('/children', (_req, res: AuthedResponse<ChildrenResponse>) => {
  const today = todayKey();
  res.json({ children: repo.listChildren(res.locals.family.id).map((c) => buildChildSummary(c, today)) });
});

/** Seçilen çocuğun gösterge paneli (frontend bunu periyodik olarak yokluyor). */
apiRouter.get('/children/:childId/state', (req, res: AuthedResponse<DashboardState>) => {
  res.json(buildDashboardState(childFromRequest(req, res.locals.family).id));
});

/** Çocuk "Yaptım!" dedi → ebeveyne onay mesajı gider, görev "bekliyor" olur. */
apiRouter.post('/children/:childId/tasks/:taskId/done', async (req, res: AuthedResponse<DashboardState>) => {
  const child = childFromRequest(req, res.locals.family);
  const taskId = Number(req.params.taskId);
  if (!Number.isInteger(taskId)) throw new AppError(400, 'Geçersiz görev.');

  await handleChildDone(res.locals.family, child, taskId);
  res.json(buildDashboardState(child.id));
});

/** Sürpriz Kutuyu aç → rastgele ödül + ebeveyne bildirim. */
apiRouter.post('/children/:childId/box/open', async (req, res: AuthedResponse<OpenBoxResponse>) => {
  const result = repo.openSurpriseBox(childFromRequest(req, res.locals.family).id);
  if (!result.ok) {
    throw new AppError(
      409,
      result.reason === 'NO_BOX'
        ? 'Henüz açılacak kutu yok. Görevlerini yapmaya devam et! 💪'
        : 'Kutunun içi boş! Annenden/babandan bota ödül eklemesini iste. 🎁',
    );
  }

  await notifyBoxOpened(res.locals.family, result.child, result.reward.title);
  res.json({ reward: { title: result.reward.title }, state: buildDashboardState(result.child.id) });
});
