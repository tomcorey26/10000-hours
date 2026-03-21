export type SessionForOverlap = {
  startTime: string;
  endTime: string;
  durationSeconds: number;
  timerMode: string;
  habitName?: string;
};

type OverlapResult =
  | { type: 'overlap'; habitName: string; startTime: string; endTime: string; message: string }
  | { type: 'midnight'; message: string };

export function getTimeOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  for (let i = 0; i < 96; i++) {
    const totalMinutes = i * 15;
    const hour24 = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    const value = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    const period = hour24 < 12 ? 'AM' : 'PM';
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    const label = `${hour12}:${String(minute).padStart(2, '0')} ${period}`;

    options.push({ label, value });
  }
  return options;
}

export function isPlaceholderSession(session: SessionForOverlap): boolean {
  if (session.timerMode !== 'manual') return false;
  const d = new Date(session.startTime);
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
}

function formatTimeFromDate(d: Date): string {
  const period = d.getHours() < 12 ? 'AM' : 'PM';
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${period}`;
}

export function checkOverlap(
  startTime: string,
  durationMinutes: number,
  sessions: SessionForOverlap[],
): OverlapResult | null {
  const [startH, startM] = startTime.split(':').map(Number);
  const proposedStartMin = startH * 60 + startM;
  const proposedEndMin = proposedStartMin + durationMinutes;

  if (proposedEndMin > 24 * 60) {
    return { type: 'midnight', message: 'Session cannot extend past midnight' };
  }

  for (const session of sessions) {
    if (isPlaceholderSession(session)) continue;

    const existStart = new Date(session.startTime);
    const existEnd = new Date(session.endTime);
    const existStartMin = existStart.getHours() * 60 + existStart.getMinutes();
    const existEndMin = existEnd.getHours() * 60 + existEnd.getMinutes();

    // Half-open interval overlap: [A_start, A_end) overlaps [B_start, B_end)
    if (proposedStartMin < existEndMin && existStartMin < proposedEndMin) {
      return {
        type: 'overlap',
        habitName: session.habitName ?? 'Unknown',
        startTime: session.startTime,
        endTime: session.endTime,
        message: `Overlaps with ${session.habitName ?? 'Unknown'} from ${formatTimeFromDate(existStart)} \u2013 ${formatTimeFromDate(existEnd)}`,
      };
    }
  }

  return null;
}
