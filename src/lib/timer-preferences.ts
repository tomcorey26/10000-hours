const STORAGE_KEY = "timer-mode-preference";

export type TimerPreference = {
  mode: "stopwatch" | "countdown";
  durationMinutes: number;
};

const DEFAULT: TimerPreference = { mode: "stopwatch", durationMinutes: 25 };

export function getTimerPreference(): TimerPreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return JSON.parse(raw) as TimerPreference;
  } catch {
    return DEFAULT;
  }
}

export function saveTimerPreference(pref: TimerPreference): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}
