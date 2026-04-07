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
  openConfig: (habitId: number, habitName: string) => void;
  closeConfig: () => void;
  startTimer: (params: {
    habitId: number;
    habitName: string;
    targetDurationSeconds?: number;
  }) => void;
  stopTimer: (durationSeconds: number) => void;
  showHabits: () => void;
  dismissSuccess: () => void;
  resetTimer: () => void;
  hydrate: (activeTimer: ActiveTimer | null) => void;
};

export const useTimerStore = create<TimerState>((set, get) => ({
  activeTimer: null,
  view: { type: "habits_list" },

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
    }),

  showHabits: () => set({ view: { type: "habits_list" } }),

  dismissSuccess: () => set({ view: { type: "habits_list" } }),

  resetTimer: () => set({ activeTimer: null, view: { type: "habits_list" } }),

  hydrate: (activeTimer) => {
    if (get().activeTimer) return;
    if (!activeTimer) return;
    set({ activeTimer, view: { type: "active_timer" } });
  },
}));
