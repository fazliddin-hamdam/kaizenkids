import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import {
  CHILD_AVATARS,
  SCHEMA_SQL,
  SEED_TASKS,
  childrenTableSql,
  dailyLogsTableSql,
  tasksTableSql,
} from './schema.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

/** Uygulama genelinde tek SQLite bağlantısı (better-sqlite3 senkron çalışır). */
export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Mevcut veritabanlarını güncel şemaya taşıyan adımlar. Sıra önemlidir; yalnızca sona ekleyin.
 * Hangi adımda olunduğu PRAGMA user_version'da tutulur.
 */
const MIGRATIONS: Array<() => void> = [
  // 1) tasks: 'school' dilimi + school_days_only + is_active (CHECK kısıtı değiştiği için tablo yeniden kurulur)
  () => {
    db.exec(tasksTableSql('tasks_new'));
    db.exec(`
      INSERT INTO tasks_new (id, code, title, emoji, period, points, sort_order)
        SELECT id, code, title, emoji, period, points, sort_order FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
    `);
  },

  // 2) Çoklu çocuk: aile üzerindeki çocuk verisi children tablosuna taşınır, kayıtlar çocuğa bağlanır.
  //    Taşınan çocuğun id'si aile id'siyle aynı verilir; böylece eski kayıtlar doğrudan eşlenir.
  () => {
    db.exec(childrenTableSql('children'));
    db.exec(`
      INSERT INTO children (id, family_id, name, avatar, total_points, boxes_opened, created_at)
        SELECT f.id, f.id, COALESCE(f.child_name, 'Çocuğum'), '${CHILD_AVATARS[0]}',
               f.total_points, f.boxes_opened, f.created_at
          FROM families f
         WHERE f.child_name IS NOT NULL OR f.total_points > 0 OR f.boxes_opened > 0
            OR EXISTS (SELECT 1 FROM daily_logs l WHERE l.family_id = f.id);
    `);
    db.exec(dailyLogsTableSql('daily_logs_new'));
    db.exec(`
      INSERT INTO daily_logs_new (id, child_id, task_id, log_date, status, points_awarded,
                                  approval_message_id, requested_at, decided_at)
        SELECT id, family_id, task_id, log_date, status, points_awarded,
               approval_message_id, requested_at, decided_at FROM daily_logs;
      DROP TABLE daily_logs;
      ALTER TABLE daily_logs_new RENAME TO daily_logs;

      ALTER TABLE reward_claims ADD COLUMN child_id INTEGER REFERENCES children(id) ON DELETE SET NULL;
      UPDATE reward_claims SET child_id = family_id WHERE family_id IN (SELECT id FROM children);

      ALTER TABLE families DROP COLUMN child_name;
      ALTER TABLE families DROP COLUMN total_points;
      ALTER TABLE families DROP COLUMN boxes_opened;
    `);
  },
];

function migrate(): void {
  const version = db.pragma('user_version', { simple: true }) as number;
  if (version >= MIGRATIONS.length) return;

  // Tablo yeniden kurulurken yabancı anahtarlar geçici olarak kapatılır (SQLite önerisi).
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (let v = version; v < MIGRATIONS.length; v++) {
        MIGRATIONS[v]();
        console.log(`🗄️  Veritabanı güncellendi: sürüm ${v + 1}`);
      }
      const broken = db.pragma('foreign_key_check') as unknown[];
      if (broken.length) throw new Error(`Migration sonrası ${broken.length} bozuk yabancı anahtar`);
      db.pragma(`user_version = ${MIGRATIONS.length}`);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

const isFreshDatabase = !db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tasks'`).get();
if (isFreshDatabase) {
  db.exec(SCHEMA_SQL);
  db.pragma(`user_version = ${MIGRATIONS.length}`);
} else {
  migrate();
  db.exec(SCHEMA_SQL); // eksik tablo/indeks varsa ekler (IF NOT EXISTS)
}

// Sabit görevleri ekle / güncelle (code alanı benzersiz anahtar); listede olmayanları pasif yap.
const upsertTask = db.prepare(`
  INSERT INTO tasks (code, title, emoji, period, points, sort_order, school_days_only, is_active)
  VALUES (@code, @title, @emoji, @period, @points, @sort_order, @school_days_only, 1)
  ON CONFLICT (code) DO UPDATE SET
    title = excluded.title, emoji = excluded.emoji, period = excluded.period, points = excluded.points,
    sort_order = excluded.sort_order, school_days_only = excluded.school_days_only, is_active = 1
`);
db.transaction(() => {
  SEED_TASKS.forEach((task, index) =>
    upsertTask.run({
      code: task.code,
      title: task.title,
      emoji: task.emoji,
      period: task.period,
      points: task.points,
      sort_order: index,
      school_days_only: 'schoolDaysOnly' in task && task.schoolDaysOnly ? 1 : 0,
    }),
  );
  const codes = SEED_TASKS.map((t) => t.code);
  db.prepare(`UPDATE tasks SET is_active = 0 WHERE code NOT IN (${codes.map(() => '?').join(',')})`).run(...codes);
})();
