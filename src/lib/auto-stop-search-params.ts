export type AutoStopSearchParams = {
  autoStopped?: string;
  duration?: string;
};

export type AutoStoppedToast = {
  habitName: string;
  durationSeconds: number;
};

export function parseAutoStoppedSearchParams(
  params: AutoStopSearchParams,
  habits: Array<{ name: string }>,
): AutoStoppedToast | null {
  if (!params.autoStopped || !params.duration) return null;
  if (!habits.some((habit) => habit.name === params.autoStopped)) return null;

  const rawDuration = params.duration.trim();
  if (!/^\d+$/.test(rawDuration)) return null;

  const durationSeconds = Number.parseInt(rawDuration, 10);
  if (Number.isNaN(durationSeconds)) return null;

  return {
    habitName: params.autoStopped,
    durationSeconds,
  };
}
