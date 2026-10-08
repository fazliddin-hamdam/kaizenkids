// apps/server/src/types.ts içindeki API tipleriyle aynı tutulmalıdır.

export type Period = 'morning' | 'school' | 'afternoon' | 'evening';
export type TaskStatus = 'todo' | 'pending' | 'approved' | 'rejected';

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
  isSchoolDay: boolean;
  currentPeriod: Period;
  streak: number;
  points: {
    total: number;
    inCycle: number;
    threshold: number;
    availableBoxes: number;
  };
  hasRewards: boolean;
  tasks: TaskView[];
}

export interface OpenBoxResponse {
  reward: { title: string };
  state: DashboardState;
}
