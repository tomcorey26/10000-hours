export type Habit = {
  id: number;
  name: string;
  todaySeconds: number;
  streak: number;
  activeTimer: { startTime: string; targetDurationSeconds: number | null } | null;
};
