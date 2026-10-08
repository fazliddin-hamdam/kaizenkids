// apps/server/src/types.ts içindeki API tipleriyle aynı tutulmalıdır.

export type Period = 'morning' | 'afternoon' | 'evening';
export type TaskStatus = 'todo' | 'pending' | 'approved' | 'rejected';

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
