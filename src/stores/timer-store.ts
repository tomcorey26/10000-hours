import { create } from "zustand";

type ActiveTimer = {
  habitId: number;
  habitName: string;
  startTime: string;
  targetDurationSeconds: number | null;
};

type TimerView =
  | { type: "habits_list" }
  | { type: "timer_config"; habitId: number; habitName: string }
  | { type: "active_timer" }
  | { type: "success"; durationSeconds: number };

type TimerState = {
  activeTimer: ActiveTimer | null;
  view: TimerView;
  timerViewMounted: boolean;
  displayTime: string;
  isTimesUp: boolean;
  openConfig: (habitId: number, habitName: string) => void;
  closeConfig: () => void;
  startTimer: (params: {
    habitId: number;
    habitName: string;
    targetDurationSeconds?: number;
  }) => void;
  stopTimer: (durationSeconds: number) => void;
  showHabits: () => void;
  showActiveTimer: () => void;
  dismissSuccess: () => void;
  resetTimer: () => void;
  hydrate: (activeTimer: ActiveTimer | null) => void;
  setTimerViewMounted: (mounted: boolean) => void;
  setDisplayTime: (time: string, isTimesUp: boolean) => void;
};

export const useTimerStore = create<TimerState>((set, get) => ({
  activeTimer: null,
  view: { type: "habits_list" },
  timerViewMounted: false,
  displayTime: "00:00:00",
  isTimesUp: false,

  openConfig: (habitId, habitName) =>
    set({ view: { type: "timer_config", habitId, habitName } }),

  closeConfig: () => set({ view: { type: "habits_list" } }),

  startTimer: ({ habitId, habitName, targetDurationSeconds }) =>
    set({
      activeTimer: {
        habitId,
        habitName,
        startTime: new Date().toISOString(),
        targetDurationSeconds: targetDurationSeconds ?? null,
      },
      view: { type: "active_timer" },
    }),

  stopTimer: (durationSeconds) =>
    set({
      activeTimer: null,
      view: { type: "success", durationSeconds },
      displayTime: "00:00:00",
      isTimesUp: false,
    }),

  showHabits: () => set({ view: { type: "habits_list" } }),

  showActiveTimer: () => {
    if (get().activeTimer) set({ view: { type: "active_timer" } });
  },

  dismissSuccess: () => set({ view: { type: "habits_list" } }),

  resetTimer: () => set({ activeTimer: null, view: { type: "habits_list" }, displayTime: "00:00:00", isTimesUp: false }),

  hydrate: (activeTimer) => {
    if (get().activeTimer) return;
    if (!activeTimer) return;
    set({ activeTimer, view: { type: "active_timer" } });
  },

  setTimerViewMounted: (mounted) => set({ timerViewMounted: mounted }),

  setDisplayTime: (time, isTimesUp) => set({ displayTime: time, isTimesUp }),
}));
