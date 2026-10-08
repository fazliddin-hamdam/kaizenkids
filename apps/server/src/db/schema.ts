/**
 * SQLite şeması. Tablolar "IF NOT EXISTS" ile oluşturulur; uygulama her açılışta güvenle çalıştırır.
 *
 *  families       → Bir ebeveyn (Telegram kullanıcısı) = bir aile. Puanlar aile üzerinde tutulur.
 *  tasks          → MVP'de sabit görev listesi (seed ile doldurulur).
 *  daily_logs     → Her aile/görev/gün için tek kayıt: bekliyor / onaylandı / reddedildi.
 *  rewards        → Ebeveynin tanımladığı gerçek dünya ödülleri (Sürpriz Kutu içeriği).
 *  reward_claims  → Açılan kutuların geçmişi (ödül adı anlık olarak kopyalanır).
 */
export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS families (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id   INTEGER NOT NULL UNIQUE,          -- ebeveynin Telegram ID'si (= özel sohbet chat_id)
  parent_name   TEXT,
  child_name    TEXT,
  total_points  INTEGER NOT NULL DEFAULT 0,
  boxes_opened  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  period      TEXT NOT NULL CHECK (period IN ('morning', 'afternoon', 'evening')),
  points      INTEGER NOT NULL CHECK (points > 0),
  sort_order  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id            INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  task_id              INTEGER NOT NULL REFERENCES tasks(id),
  log_date             TEXT NOT NULL,             -- YYYY-MM-DD (APP_TIMEZONE'a göre)
  status               TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  points_awarded       INTEGER NOT NULL DEFAULT 0,
  approval_message_id  INTEGER,                   -- ebeveyne giden onay mesajının ID'si
  requested_at         TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at           TEXT,
  UNIQUE (family_id, task_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_logs_family_date ON daily_logs (family_id, log_date);

CREATE TABLE IF NOT EXISTS rewards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id   INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rewards_family ON rewards (family_id);

CREATE TABLE IF NOT EXISTS reward_claims (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id     INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  reward_id     INTEGER REFERENCES rewards(id) ON DELETE SET NULL,
  reward_title  TEXT NOT NULL,
  opened_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** MVP v1 sabit görevleri. Sıra ve puanlar burada değiştirilebilir; açılışta veritabanına yansır. */
export const SEED_TASKS = [
  { code: 'make_bed', title: 'Yatağını Topla', emoji: '🛏️', period: 'morning', points: 5 },
  { code: 'brush_teeth', title: 'Dişlerini Fırçala', emoji: '🪥', period: 'morning', points: 5 },
  { code: 'finish_breakfast', title: 'Kahvaltını Bitir', emoji: '🥣', period: 'morning', points: 5 },
  { code: 'school_bag', title: 'Okul Çantanı Düzenle', emoji: '🎒', period: 'afternoon', points: 5 },
  { code: 'read_book', title: '15 Dakika Kitap Oku', emoji: '📚', period: 'afternoon', points: 10 },
  { code: 'tidy_toys', title: 'Oyuncaklarını Topla', emoji: '🧸', period: 'evening', points: 5 },
  { code: 'sleep_early', title: 'Erken Uyu (21:30)', emoji: '😴', period: 'evening', points: 10 },
] as const;

/** Yeni bir aile oluşturulduğunda eklenen örnek ödüller (ebeveyn botla değiştirebilir). */
export const DEFAULT_REWARDS = [
  'Parkta yarım saat ekstra oyun',
  'Sinema gecesi',
  'En sevdiğin tatlı',
  'Yatmadan önce ekstra bir masal',
];
