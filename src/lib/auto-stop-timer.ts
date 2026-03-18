import { computeSessionDuration } from "@/lib/timer";

type TimerData = {
  habitId: number;
  userId: number;
  startTime: Date;
  targetDurationSeconds: number | null;
};

export function buildSessionFromTimer(timer: TimerData, now: Date) {
  const elapsed = Math.round(
    (now.getTime() - timer.startTime.getTime()) / 1000
  );
  const timerMode =
    timer.targetDurationSeconds !== null ? "countdown" : "stopwatch";
  const durationSeconds = computeSessionDuration(
    elapsed,
    timer.targetDurationSeconds
  );

  return {
    habitId: timer.habitId,
    userId: timer.userId,
    startTime: timer.startTime,
    endTime: now,
    durationSeconds,
    timerMode,
  };
}
