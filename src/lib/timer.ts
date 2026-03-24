export function isCountdownComplete(startTimeIso: string, targetDurationSeconds: number): boolean {
  const elapsed = Math.floor((Date.now() - new Date(startTimeIso).getTime()) / 1000);
  return elapsed >= targetDurationSeconds;
}

export function computeSessionDuration(
  elapsedSeconds: number,
  targetDurationSeconds: number | null,
): number {
  if (targetDurationSeconds !== null) {
    return Math.min(elapsedSeconds, targetDurationSeconds);
  }
  return elapsedSeconds;
}

type TimerData = {
  habitId: number;
  userId: number;
  startTime: Date;
  targetDurationSeconds: number | null;
};

export function buildSessionFromTimer(timer: TimerData, now: Date) {
  const elapsed = Math.ceil(
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
