import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { SCHEMA_SQL, SEED_TASKS } from './schema.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

/** Uygulama genelinde tek SQLite bağlantısı (better-sqlite3 senkron çalışır). */
export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(SCHEMA_SQL);

// Sabit görevleri ekle / güncelle (code alanı benzersiz anahtar).
const upsertTask = db.prepare(`
  INSERT INTO tasks (code, title, emoji, period, points, sort_order)
  VALUES (@code, @title, @emoji, @period, @points, @sort_order)
  ON CONFLICT (code) DO UPDATE SET
    title = excluded.title, emoji = excluded.emoji, period = excluded.period,
    points = excluded.points, sort_order = excluded.sort_order
`);
db.transaction(() => {
  SEED_TASKS.forEach((task, index) => upsertTask.run({ ...task, sort_order: index }));
})();
