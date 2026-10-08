// Veritabanı satırları ve API yanıt tipleri.
// Not: API tipleri apps/web/src/types.ts ile aynı tutulmalıdır.

export type Period = 'morning' | 'school' | 'afternoon' | 'evening';
export type LogStatus = 'pending' | 'approved' | 'rejected';
export type TaskStatus = 'todo' | LogStatus;

export interface Family {
  id: number;
  telegram_id: number;
  parent_name: string | null;
  created_at: string;
}

export interface Child {
  id: number;
  family_id: number;
  name: string;
  avatar: string;
  total_points: number;
  boxes_opened: number;
  is_active: number;
  created_at: string;
}

export interface Task {
  id: number;
  code: string;
  title: string;
  emoji: string;
  period: Period;
  points: number;
  sort_order: number;
  school_days_only: number;
  is_active: number;
}

export interface DailyLog {
  id: number;
  child_id: number;
  task_id: number;
  log_date: string;
  status: LogStatus;
  points_awarded: number;
  approval_message_id: number | null;
  requested_at: string;
  decided_at: string | null;
}

export interface Reward {
  id: number;
  family_id: number;
  title: string;
  is_active: number;
  created_at: string;
}

// ---------- API ----------

export interface TaskView {
  id: number;
  title: string;
  emoji: string;
  period: Period;
  points: number;
  status: TaskStatus;
}

/** Çocuk seçim ekranındaki kart. */
export interface ChildSummary {
  id: number;
  name: string;
  avatar: string;
  totalPoints: number;
  availableBoxes: number;
  doneToday: number;
  totalToday: number;
}

export interface ChildrenResponse {
  children: ChildSummary[];
}

export interface DashboardState {
  childId: number;
  childName: string;
  avatar: string;
  today: string;
  /** Hafta içi mi? Hafta sonu okul görevleri gösterilmez. */
  isSchoolDay: boolean;
  currentPeriod: Period;
  streak: number;
  points: {
    total: number;
    /** Bir sonraki kutuya doğru biriken puan (0..threshold-1). */
    inCycle: number;
    threshold: number;
    /** Kazanılmış ama henüz açılmamış kutu sayısı. */
    availableBoxes: number;
  };
  hasRewards: boolean;
  tasks: TaskView[];
}

export interface OpenBoxResponse {
  reward: { title: string };
  state: DashboardState;
}
