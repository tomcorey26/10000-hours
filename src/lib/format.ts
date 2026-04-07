export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function formatElapsed(startTimeIso: string): string {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startTimeIso).getTime()) / 1000));
  const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatRemaining(startTimeIso: string, targetDurationSeconds: number): string {
  const elapsed = Math.floor((Date.now() - new Date(startTimeIso).getTime()) / 1000);
  const remaining = Math.max(0, targetDurationSeconds - elapsed);
  const h = Math.floor(remaining / 3600).toString().padStart(2, '0');
  const m = Math.floor((remaining % 3600) / 60).toString().padStart(2, '0');
  const s = (remaining % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

