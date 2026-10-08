// apps/server/src/types.ts içindeki API tipleriyle aynı tutulmalıdır.

export type Period = 'morning' | 'school' | 'afternoon' | 'evening';
export type TaskStatus = 'todo' | 'pending' | 'approved' | 'rejected';
export type RewardKind = 'small' | 'big';
export type Gender = 'boy' | 'girl';

export interface TaskView {
  id: number;
  title: string;
  emoji: string;
  period: Period;
  points: number;
  status: TaskStatus;
}

export interface ChildSummary {
  id: number;
  name: string;
  avatar: string;
  gender: Gender | null;
  totalPoints: number;
  todayPoints: number;
  availableBoxes: number;
  availableBigBoxes: number;
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
  gender: Gender | null;
  today: string;
  isSchoolDay: boolean;
  currentPeriod: Period;
  streak: number;
  points: {
    total: number;
    inCycle: number;
    threshold: number;
    availableBoxes: number;
    today: number;
    big: { inCycle: number; threshold: number; availableBoxes: number };
  };
  tasks: TaskView[];
}

export interface OpenBoxResponse {
  reward: { title: string; kind: RewardKind };
  state: DashboardState;
}
