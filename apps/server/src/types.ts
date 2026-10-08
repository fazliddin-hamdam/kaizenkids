// Veritabanı satırları ve API yanıt tipleri.
// Not: API tipleri apps/web/src/types.ts ile aynı tutulmalıdır.

export type Period = 'morning' | 'afternoon' | 'evening';
export type LogStatus = 'pending' | 'approved' | 'rejected';
export type TaskStatus = 'todo' | LogStatus;

export interface Family {
  id: number;
  telegram_id: number;
  parent_name: string | null;
  child_name: string | null;
  total_points: number;
  boxes_opened: number;
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
}

export interface DailyLog {
  id: number;
  family_id: number;
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

export interface DashboardState {
  childName: string;
  today: string;
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
