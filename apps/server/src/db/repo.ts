import { config } from '../config.js';
import type { DailyLog, Family, LogStatus, Reward, Task } from '../types.js';
import { addDays, isSchoolDay } from '../utils/date.js';
import { db } from './index.js';
import { DEFAULT_REWARDS } from './schema.js';

// =====================================================================
//  Aileler
// =====================================================================

export function getFamilyById(id: number): Family | undefined {
  return db.prepare('SELECT * FROM families WHERE id = ?').get(id) as Family | undefined;
}

export function getFamilyByTelegramId(telegramId: number): Family | undefined {
  return db.prepare('SELECT * FROM families WHERE telegram_id = ?').get(telegramId) as Family | undefined;
}

/** Aileyi getirir; yoksa oluşturup örnek ödülleri ekler. */
export const getOrCreateFamily = db.transaction((telegramId: number, parentName?: string): Family => {
  const existing = getFamilyByTelegramId(telegramId);
  if (existing) return existing;

  const { lastInsertRowid } = db
    .prepare('INSERT INTO families (telegram_id, parent_name) VALUES (?, ?)')
    .run(telegramId, parentName ?? null);
  const familyId = Number(lastInsertRowid);

  const insertReward = db.prepare('INSERT INTO rewards (family_id, title) VALUES (?, ?)');
  for (const title of DEFAULT_REWARDS) insertReward.run(familyId, title);

  return getFamilyById(familyId)!;
});

export function listFamilies(): Family[] {
  return db.prepare('SELECT * FROM families ORDER BY id').all() as Family[];
}

export function setChildName(familyId: number, name: string): void {
  db.prepare('UPDATE families SET child_name = ? WHERE id = ?').run(name, familyId);
}

// =====================================================================
//  Görevler ve günlük kayıtlar
// =====================================================================

/** O gün yapılabilecek aktif görevler (hafta sonu okul görevleri hariç). */
export function listTasksForDate(date: string): Task[] {
  const tasks = db.prepare('SELECT * FROM tasks WHERE is_active = 1 ORDER BY sort_order').all() as Task[];
  return isSchoolDay(date) ? tasks : tasks.filter((t) => !t.school_days_only);
}

export function getTask(id: number): Task | undefined {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
}

export function getLogsForDate(familyId: number, date: string): DailyLog[] {
  return db.prepare('SELECT * FROM daily_logs WHERE family_id = ? AND log_date = ?').all(familyId, date) as DailyLog[];
}

export function getLog(id: number): DailyLog | undefined {
  return db.prepare('SELECT * FROM daily_logs WHERE id = ?').get(id) as DailyLog | undefined;
}

export type RequestResult =
  | { ok: true; log: DailyLog; previousStatus: LogStatus | null }
  | { ok: false; reason: 'ALREADY_PENDING' | 'ALREADY_APPROVED' };

/**
 * Çocuk "Yaptım!" dediğinde görevi "pending" durumuna alır.
 * - Kayıt yoksa oluşturur.
 * - Daha önce reddedildiyse tekrar denemeye izin verir.
 * - Zaten bekliyor/onaylandıysa reddeder (ebeveyne mükerrer mesaj gitmesin).
 */
export const requestApproval = db.transaction((familyId: number, taskId: number, date: string): RequestResult => {
  const existing = db
    .prepare('SELECT * FROM daily_logs WHERE family_id = ? AND task_id = ? AND log_date = ?')
    .get(familyId, taskId, date) as DailyLog | undefined;

  if (!existing) {
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO daily_logs (family_id, task_id, log_date, status) VALUES (?, ?, ?, 'pending')`)
      .run(familyId, taskId, date);
    return { ok: true, log: getLog(Number(lastInsertRowid))!, previousStatus: null };
  }

  if (existing.status === 'rejected') {
    db.prepare(
      `UPDATE daily_logs
         SET status = 'pending', requested_at = datetime('now'), decided_at = NULL, approval_message_id = NULL
       WHERE id = ?`,
    ).run(existing.id);
    return { ok: true, log: getLog(existing.id)!, previousStatus: 'rejected' };
  }

  return { ok: false, reason: existing.status === 'pending' ? 'ALREADY_PENDING' : 'ALREADY_APPROVED' };
});

/** Ebeveyne mesaj gönderilemezse isteği geri alır (çocuk tekrar deneyebilsin). */
export function revertApprovalRequest(logId: number, previousStatus: LogStatus | null): void {
  if (previousStatus === null) {
    db.prepare(`DELETE FROM daily_logs WHERE id = ? AND status = 'pending'`).run(logId);
  } else {
    db.prepare(`UPDATE daily_logs SET status = ? WHERE id = ? AND status = 'pending'`).run(previousStatus, logId);
  }
}

export function setApprovalMessageId(logId: number, messageId: number): void {
  db.prepare('UPDATE daily_logs SET approval_message_id = ? WHERE id = ?').run(messageId, logId);
}

export type DecisionResult =
  | { ok: true; approved: boolean; log: DailyLog; task: Task; family: Family; boxUnlocked: boolean }
  | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_DECIDED'; log?: DailyLog };

/**
 * Ebeveynin kararını işler. Onaylanırsa puanlar aynı transaction içinde aileye eklenir;
 * böylece aynı butona iki kez basılsa bile puan yalnızca bir kez verilir.
 */
export const decideLog = db.transaction((logId: number, approve: boolean): DecisionResult => {
  const log = getLog(logId);
  if (!log) return { ok: false, reason: 'NOT_FOUND' };
  if (log.status !== 'pending') return { ok: false, reason: 'ALREADY_DECIDED', log };

  const task = getTask(log.task_id)!;
  const before = getFamilyById(log.family_id)!;

  if (approve) {
    db.prepare(
      `UPDATE daily_logs SET status = 'approved', points_awarded = ?, decided_at = datetime('now') WHERE id = ?`,
    ).run(task.points, logId);
    db.prepare('UPDATE families SET total_points = total_points + ? WHERE id = ?').run(task.points, log.family_id);
  } else {
    db.prepare(`UPDATE daily_logs SET status = 'rejected', decided_at = datetime('now') WHERE id = ?`).run(logId);
  }

  const family = getFamilyById(log.family_id)!;
  const t = config.boxThreshold;
  const boxUnlocked = Math.floor(family.total_points / t) > Math.floor(before.total_points / t);

  return { ok: true, approved: approve, log: getLog(logId)!, task, family, boxUnlocked };
});

/**
 * "Zinciri kırma" serisi: art arda en az bir görevi onaylanmış gün sayısı.
 * Bugün henüz onay yoksa seri dünden itibaren sayılır (gün içinde sıfırlanmış görünmesin).
 */
export function getStreak(familyId: number, today: string): number {
  const rows = db
    .prepare(
      `SELECT DISTINCT log_date FROM daily_logs
        WHERE family_id = ? AND status = 'approved' AND log_date <= ?
        ORDER BY log_date DESC LIMIT 400`,
    )
    .all(familyId, today) as { log_date: string }[];
  const days = new Set(rows.map((r) => r.log_date));

  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// =====================================================================
//  Ödüller ve Sürpriz Kutu
// =====================================================================

export function listActiveRewards(familyId: number): Reward[] {
  return db
    .prepare('SELECT * FROM rewards WHERE family_id = ? AND is_active = 1 ORDER BY id')
    .all(familyId) as Reward[];
}

export function addReward(familyId: number, title: string): void {
  db.prepare('INSERT INTO rewards (family_id, title) VALUES (?, ?)').run(familyId, title);
}

export function deactivateReward(familyId: number, rewardId: number): boolean {
  return db.prepare('UPDATE rewards SET is_active = 0 WHERE id = ? AND family_id = ?').run(rewardId, familyId).changes > 0;
}

/** Puan durumunu hesaplar: kaç kutu kazanıldı, kaç tanesi açılmayı bekliyor, sonraki kutuya ne kadar kaldı. */
export function getPointsSummary(family: Family) {
  const threshold = config.boxThreshold;
  const earned = Math.floor(family.total_points / threshold);
  return {
    total: family.total_points,
    inCycle: family.total_points - earned * threshold,
    threshold,
    availableBoxes: Math.max(0, earned - family.boxes_opened),
  };
}

export type OpenBoxResult =
  | { ok: true; reward: Reward; family: Family }
  | { ok: false; reason: 'NO_BOX' | 'NO_REWARDS' };

/** Bir Sürpriz Kutu açar: ebeveynin aktif ödüllerinden rastgele birini seçer ve kaydeder. */
export const openSurpriseBox = db.transaction((familyId: number): OpenBoxResult => {
  const family = getFamilyById(familyId)!;
  if (getPointsSummary(family).availableBoxes <= 0) return { ok: false, reason: 'NO_BOX' };

  const rewards = listActiveRewards(familyId);
  if (rewards.length === 0) return { ok: false, reason: 'NO_REWARDS' };

  const reward = rewards[Math.floor(Math.random() * rewards.length)];
  db.prepare('UPDATE families SET boxes_opened = boxes_opened + 1 WHERE id = ?').run(familyId);
  db.prepare('INSERT INTO reward_claims (family_id, reward_id, reward_title) VALUES (?, ?, ?)').run(
    familyId,
    reward.id,
    reward.title,
  );
  return { ok: true, reward, family: getFamilyById(familyId)! };
});
