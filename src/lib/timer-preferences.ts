export type TimerPreference = {
  mode: "stopwatch" | "countdown";
  durationMinutes: number;
  durationSeconds?: number;
};
