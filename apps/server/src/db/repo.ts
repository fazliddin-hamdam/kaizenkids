import { config } from '../config.js';
import type { Child, DailyLog, Family, Gender, LogStatus, Reward, RewardKind, Task } from '../types.js';
import { addDays, isSchoolDay } from '../utils/date.js';
import { db } from './index.js';
import { AVATARS, DEFAULT_AVATAR, DEFAULT_BIG_REWARDS, DEFAULT_REWARDS, MAX_CHILDREN } from './schema.js';

// =====================================================================
//  Aileler (ebeveyn = Telegram kullanıcısı)
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

  const insertReward = db.prepare('INSERT INTO rewards (family_id, title, kind) VALUES (?, ?, ?)');
  for (const title of DEFAULT_REWARDS) insertReward.run(familyId, title, 'small');
  for (const title of DEFAULT_BIG_REWARDS) insertReward.run(familyId, title, 'big');

  return getFamilyById(familyId)!;
});

export function listFamilies(): Family[] {
  return db.prepare('SELECT * FROM families ORDER BY id').all() as Family[];
}

// =====================================================================
//  Çocuklar
// =====================================================================

/** Ailenin aktif çocukları, eklenme sırasına göre. */
export function listChildren(familyId: number): Child[] {
  return db
    .prepare('SELECT * FROM children WHERE family_id = ? AND is_active = 1 ORDER BY id')
    .all(familyId) as Child[];
}

export function getChild(id: number): Child | undefined {
  return db.prepare('SELECT * FROM children WHERE id = ?').get(id) as Child | undefined;
}

/** Çocuk bu aileye ait ve aktifse döndürür (API'de başka ailenin çocuğuna erişimi engeller). */
export function getActiveChildOfFamily(familyId: number, childId: number): Child | undefined {
  return db
    .prepare('SELECT * FROM children WHERE id = ? AND family_id = ? AND is_active = 1')
    .get(childId, familyId) as Child | undefined;
}

function findChildByName(familyId: number, name: string): Child | undefined {
  // Türkçe büyük/küçük harf farkını gözetmeden karşılaştır ("ali" = "Ali" = "ALİ").
  const key = name.toLocaleLowerCase('tr-TR');
  return (db.prepare('SELECT * FROM children WHERE family_id = ? ORDER BY id').all(familyId) as Child[]).find(
    (c) => c.name.toLocaleLowerCase('tr-TR') === key,
  );
}

export type AddChildResult =
  | { ok: true; child: Child; restored: boolean }
  | { ok: false; reason: 'DUPLICATE' | 'LIMIT' };

/** Ailede aynı cinsiyetten kaçıncı çocuk olduğuna göre avatar seçer (👦, 🦸‍♂️, 🤴 …). */
function pickAvatar(familyId: number, gender: Gender, exceptChildId = 0): string {
  const { n } = db
    .prepare('SELECT COUNT(*) AS n FROM children WHERE family_id = ? AND gender = ? AND id != ?')
    .get(familyId, gender, exceptChildId) as { n: number };
  const list = AVATARS[gender];
  return list[n % list.length];
}

/**
 * Yeni çocuk ekler. Aynı adla daha önce silinmiş bir çocuk varsa onu geri getirir
 * (puanları ve geçmişi kaldığı yerden devam eder). Cinsiyet verilmezse nötr avatarla eklenir;
 * bot ardından cinsiyeti sorar (setChildGender).
 */
export const addChild = db.transaction((familyId: number, name: string, gender?: Gender): AddChildResult => {
  const existing = findChildByName(familyId, name);
  if (existing?.is_active) return { ok: false, reason: 'DUPLICATE' };
  if (listChildren(familyId).length >= MAX_CHILDREN) return { ok: false, reason: 'LIMIT' };

  if (existing) {
    db.prepare('UPDATE children SET is_active = 1 WHERE id = ?').run(existing.id);
    const restored = gender ? setChildGender(familyId, existing.id, gender)! : getChild(existing.id)!;
    return { ok: true, child: restored, restored: true };
  }

  const avatar = gender ? pickAvatar(familyId, gender) : DEFAULT_AVATAR;
  const { lastInsertRowid } = db
    .prepare('INSERT INTO children (family_id, name, avatar, gender) VALUES (?, ?, ?, ?)')
    .run(familyId, name, avatar, gender ?? null);
  return { ok: true, child: getChild(Number(lastInsertRowid))!, restored: false };
});

/** Cinsiyeti kaydeder ve avatarı ona göre yeniler. Çocuk bu aileye ait değilse undefined döner. */
export function setChildGender(familyId: number, childId: number, gender: Gender): Child | undefined {
  const child = getChild(childId);
  if (!child || child.family_id !== familyId) return undefined;
  if (child.gender === gender) return child; // aynı seçim: avatar değişmesin
  db.prepare('UPDATE children SET gender = ?, avatar = ? WHERE id = ?').run(
    gender,
    pickAvatar(familyId, gender, childId),
    childId,
  );
  return getChild(childId);
}

export function renameChild(familyId: number, childId: number, name: string): 'OK' | 'DUPLICATE' {
  const other = findChildByName(familyId, name);
  if (other && other.id !== childId) return 'DUPLICATE';
  db.prepare('UPDATE children SET name = ? WHERE id = ? AND family_id = ?').run(name, childId, familyId);
  return 'OK';
}

/** Çocuğu listeden kaldırır; veriler silinmez (aynı adla /isim yazılırsa geri gelir). */
export function deactivateChild(familyId: number, childId: number): void {
  db.prepare('UPDATE children SET is_active = 0 WHERE id = ? AND family_id = ?').run(childId, familyId);
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

export function getLogsForDate(childId: number, date: string): DailyLog[] {
  return db.prepare('SELECT * FROM daily_logs WHERE child_id = ? AND log_date = ?').all(childId, date) as DailyLog[];
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
export const requestApproval = db.transaction((childId: number, taskId: number, date: string): RequestResult => {
  const existing = db
    .prepare('SELECT * FROM daily_logs WHERE child_id = ? AND task_id = ? AND log_date = ?')
    .get(childId, taskId, date) as DailyLog | undefined;

  if (!existing) {
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO daily_logs (child_id, task_id, log_date, status) VALUES (?, ?, ?, 'pending')`)
      .run(childId, taskId, date);
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
  | {
      ok: true;
      approved: boolean;
      log: DailyLog;
      task: Task;
      child: Child;
      boxUnlocked: boolean;
      bigBoxUnlocked: boolean;
    }
  | { ok: false; reason: 'NOT_FOUND' | 'ALREADY_DECIDED'; log?: DailyLog };

/**
 * Ebeveynin kararını işler. Onaylanırsa puanlar aynı transaction içinde çocuğa eklenir;
 * böylece aynı butona iki kez basılsa bile puan yalnızca bir kez verilir.
 */
export const decideLog = db.transaction((logId: number, approve: boolean): DecisionResult => {
  const log = getLog(logId);
  if (!log) return { ok: false, reason: 'NOT_FOUND' };
  if (log.status !== 'pending') return { ok: false, reason: 'ALREADY_DECIDED', log };

  const task = getTask(log.task_id)!;
  const before = getChild(log.child_id)!;

  if (approve) {
    db.prepare(
      `UPDATE daily_logs SET status = 'approved', points_awarded = ?, decided_at = datetime('now') WHERE id = ?`,
    ).run(task.points, logId);
    db.prepare('UPDATE children SET total_points = total_points + ? WHERE id = ?').run(task.points, log.child_id);
  } else {
    db.prepare(`UPDATE daily_logs SET status = 'rejected', decided_at = datetime('now') WHERE id = ?`).run(logId);
  }

  const child = getChild(log.child_id)!;
  const crossed = (threshold: number) =>
    Math.floor(child.total_points / threshold) > Math.floor(before.total_points / threshold);

  return {
    ok: true,
    approved: approve,
    log: getLog(logId)!,
    task,
    child,
    boxUnlocked: crossed(config.boxThreshold),
    bigBoxUnlocked: crossed(config.bigBoxThreshold),
  };
});

/**
 * "Zinciri kırma" serisi: art arda en az bir görevi onaylanmış gün sayısı.
 * Bugün henüz onay yoksa seri dünden itibaren sayılır (gün içinde sıfırlanmış görünmesin).
 */
export function getStreak(childId: number, today: string): number {
  const rows = db
    .prepare(
      `SELECT DISTINCT log_date FROM daily_logs
        WHERE child_id = ? AND status = 'approved' AND log_date <= ?
        ORDER BY log_date DESC LIMIT 400`,
    )
    .all(childId, today) as { log_date: string }[];
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
//  Ödüller (aile geneli) ve kutular (çocuk bazında)
// =====================================================================

export function listActiveRewards(familyId: number, kind: RewardKind = 'small'): Reward[] {
  return db
    .prepare('SELECT * FROM rewards WHERE family_id = ? AND kind = ? AND is_active = 1 ORDER BY id')
    .all(familyId, kind) as Reward[];
}

export function addReward(familyId: number, title: string, kind: RewardKind = 'small'): void {
  db.prepare('INSERT INTO rewards (family_id, title, kind) VALUES (?, ?, ?)').run(familyId, title, kind);
}

export function deactivateReward(familyId: number, rewardId: number): boolean {
  return db.prepare('UPDATE rewards SET is_active = 0 WHERE id = ? AND family_id = ?').run(rewardId, familyId).changes > 0;
}

/** Bugün onaylanan görevlerden gelen toplam puan. */
export function getPointsForDate(childId: number, date: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(points_awarded), 0) AS total FROM daily_logs
        WHERE child_id = ? AND log_date = ? AND status = 'approved'`,
    )
    .get(childId, date) as { total: number };
  return row.total;
}

/** Bir eşik için ilerleme: döngüdeki puan ve açılmayı bekleyen kutu sayısı. */
function cycle(total: number, threshold: number, opened: number) {
  const earned = Math.floor(total / threshold);
  return { inCycle: total - earned * threshold, threshold, availableBoxes: Math.max(0, earned - opened) };
}

/**
 * Puan durumu. Her iki kutu da aynı toplam puandan beslenir:
 * her BOX_THRESHOLD puanda bir Sürpriz Kutu, her BIG_BOX_THRESHOLD puanda bir Büyük Hediye.
 */
export function getPointsSummary(child: Child) {
  return {
    total: child.total_points,
    ...cycle(child.total_points, config.boxThreshold, child.boxes_opened),
    big: cycle(child.total_points, config.bigBoxThreshold, child.big_boxes_opened),
  };
}

export type OpenBoxResult =
  | { ok: true; reward: Reward; child: Child }
  | { ok: false; reason: 'NO_BOX' | 'NO_REWARDS' };

/** Çocuğun bir kutusunu açar: ailenin o türdeki aktif ödüllerinden rastgele birini seçer ve kaydeder. */
export const openSurpriseBox = db.transaction((childId: number, kind: RewardKind): OpenBoxResult => {
  const child = getChild(childId)!;
  const summary = getPointsSummary(child);
  const available = kind === 'big' ? summary.big.availableBoxes : summary.availableBoxes;
  if (available <= 0) return { ok: false, reason: 'NO_BOX' };

  const rewards = listActiveRewards(child.family_id, kind);
  if (rewards.length === 0) return { ok: false, reason: 'NO_REWARDS' };

  const reward = rewards[Math.floor(Math.random() * rewards.length)];
  const counter = kind === 'big' ? 'big_boxes_opened' : 'boxes_opened';
  db.prepare(`UPDATE children SET ${counter} = ${counter} + 1 WHERE id = ?`).run(childId);
  db.prepare(
    'INSERT INTO reward_claims (family_id, child_id, reward_id, reward_title, kind) VALUES (?, ?, ?, ?, ?)',
  ).run(child.family_id, childId, reward.id, reward.title, kind);
  return { ok: true, reward, child: getChild(childId)! };
});
