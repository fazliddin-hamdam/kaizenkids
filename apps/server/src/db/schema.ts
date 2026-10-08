/**
 * SQLite şeması. Tablolar "IF NOT EXISTS" ile oluşturulur; uygulama her açılışta güvenle çalıştırır.
 * Yeni veritabanı bu şemayla kurulur; eskiler db/index.ts'deki migration'larla buraya getirilir.
 *
 *  families       → Bir ebeveyn (Telegram kullanıcısı) = bir aile.
 *  children       → Ailenin çocukları; puanlar, kutular ve seri her çocukta ayrı tutulur.
 *  tasks          → Sabit görev listesi (seed ile doldurulur).
 *  daily_logs     → Her çocuk/görev/gün için tek kayıt: bekliyor / onaylandı / reddedildi.
 *  rewards        → Ebeveynin tanımladığı gerçek dünya ödülleri (tüm çocuklar için ortak Sürpriz Kutu içeriği).
 *  reward_claims  → Açılan kutuların geçmişi (ödül adı anlık olarak kopyalanır).
 */

/** tasks tablosu tanımı (migration'da geçici adla yeniden oluşturmak için fonksiyon). */
export function tasksTableSql(name: string): string {
  return /* sql */ `
CREATE TABLE IF NOT EXISTS ${name} (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  code              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  emoji             TEXT NOT NULL,
  period            TEXT NOT NULL CHECK (period IN ('morning', 'school', 'afternoon', 'evening')),
  points            INTEGER NOT NULL CHECK (points > 0),
  sort_order        INTEGER NOT NULL,
  school_days_only  INTEGER NOT NULL DEFAULT 0,   -- 1: yalnızca hafta içi (okul günleri) gösterilir
  is_active         INTEGER NOT NULL DEFAULT 1    -- 0: listeden kaldırıldı (eski kayıtlar için saklanır)
);`;
}

export function childrenTableSql(name: string): string {
  return /* sql */ `
CREATE TABLE IF NOT EXISTS ${name} (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id     INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  avatar        TEXT NOT NULL,
  total_points  INTEGER NOT NULL DEFAULT 0,
  boxes_opened  INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,      -- 0: /cocuksil ile kaldırıldı (veriler saklanır)
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);`;
}

export function dailyLogsTableSql(name: string): string {
  return /* sql */ `
CREATE TABLE IF NOT EXISTS ${name} (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id             INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  task_id              INTEGER NOT NULL REFERENCES tasks(id),
  log_date             TEXT NOT NULL,             -- YYYY-MM-DD (APP_TIMEZONE'a göre)
  status               TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  points_awarded       INTEGER NOT NULL DEFAULT 0,
  approval_message_id  INTEGER,                   -- ebeveyne giden onay mesajının ID'si
  requested_at         TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at           TEXT,
  UNIQUE (child_id, task_id, log_date)
);`;
}

export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS families (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id   INTEGER NOT NULL UNIQUE,          -- ebeveynin Telegram ID'si (= özel sohbet chat_id)
  parent_name   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

${childrenTableSql('children')}
CREATE INDEX IF NOT EXISTS idx_children_family ON children (family_id);

${tasksTableSql('tasks')}

${dailyLogsTableSql('daily_logs')}
CREATE INDEX IF NOT EXISTS idx_daily_logs_child_date ON daily_logs (child_id, log_date);

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
  child_id      INTEGER REFERENCES children(id) ON DELETE SET NULL,
  reward_id     INTEGER REFERENCES rewards(id) ON DELETE SET NULL,
  reward_title  TEXT NOT NULL,
  opened_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/**
 * Sabit görevler. Sıra ve puanlar burada değiştirilebilir; açılışta veritabanına yansır.
 * Listeden çıkarılan görevler silinmez, pasif yapılır (geçmiş kayıtlar bozulmasın).
 *
 * Puan dağılımı: tam bir okul günü = 100 puan (sabah 15 · okulda 35 · okul sonrası 30 · akşam 20).
 * Hafta sonu okul görevleri gizlenir (en fazla 70 puan).
 */
export const SEED_TASKS = [
  // ☀️ Sabah — 15
  { code: 'make_bed', title: 'Yatağını Topla', emoji: '🛏️', period: 'morning', points: 5 },
  { code: 'brush_teeth', title: 'Dişlerini Fırçala', emoji: '🪥', period: 'morning', points: 5 },
  { code: 'finish_breakfast', title: 'Kahvaltını Vaktinde Yap', emoji: '🥣', period: 'morning', points: 5 },
  // 🏫 Okulda — 35
  { code: 'go_school', title: 'Okula Git', emoji: '🏫', period: 'school', points: 10, schoolDaysOnly: true },
  { code: 'listen_class', title: 'Dersleri İyi Dinle', emoji: '👂', period: 'school', points: 10, schoolDaysOnly: true },
  { code: 'school_star', title: 'Okulda 5 Puan Al (Not/Yıldız)', emoji: '🌟', period: 'school', points: 10, schoolDaysOnly: true },
  { code: 'lunch', title: 'Öğle Yemeğini Vaktinde Ye', emoji: '🍽️', period: 'school', points: 5 },
  // 🎒 Okul Sonrası — 30
  { code: 'school_bag', title: 'Okul Çantanı Düzenle', emoji: '🎒', period: 'afternoon', points: 5 },
  { code: 'homework', title: 'Ödevlerini Yap', emoji: '✏️', period: 'afternoon', points: 15 },
  { code: 'sport', title: '15 Dakika Spor Yap', emoji: '⚽', period: 'afternoon', points: 10 },
  // 🌙 Akşam — 20
  { code: 'dinner', title: 'Akşam Yemeğini Vaktinde Ye', emoji: '🍲', period: 'evening', points: 5 },
  { code: 'tidy_toys', title: 'Oyuncaklarını Topla', emoji: '🧸', period: 'evening', points: 5 },
  { code: 'sleep_early', title: 'Erken Uyu (21:30)', emoji: '😴', period: 'evening', points: 10 },
] as const;

/** Çocuklara sırayla verilen avatarlar. */
export const CHILD_AVATARS = ['🦸', '🧚', '🦖', '🦄', '🐼', '🚀', '🐯', '🐬'];

/** Bir ailede en fazla kaç aktif çocuk olabilir. */
export const MAX_CHILDREN = 6;

/** Yeni bir aile oluşturulduğunda eklenen örnek ödüller (ebeveyn botla değiştirebilir). */
export const DEFAULT_REWARDS = [
  'Parkta yarım saat ekstra oyun',
  'Sinema gecesi',
  'En sevdiğin tatlı',
  'Yatmadan önce ekstra bir masal',
];
