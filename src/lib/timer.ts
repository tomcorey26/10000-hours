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
