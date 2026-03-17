export type Habit = {
  id: number;
  name: string;
  todaySeconds: number;
  totalSeconds: number;
  streak: number;
  activeTimer: {
    startTime: string;
    targetDurationSeconds: number | null;
  } | null;
};

export type AutoStoppedSession = {
  habitName: string;
  durationSeconds: number;
};

export type Session = {
  id: number;
  habitName: string;
  habitId: number;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  timerMode: string;
};
