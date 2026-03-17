import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getHabitsForUser, autoStopExpiredCountdown } from '@/lib/queries';
import { TimerView } from '@/components/TimerView';

export default async function TimerPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const autoStopped = await autoStopExpiredCountdown(userId);

  const habits = await getHabitsForUser(userId);
  const activeHabit = habits.find(h => h.activeTimer);

  // No active timer — redirect back to skills
  if (!activeHabit) {
    if (autoStopped) {
      redirect(`/skills?autoStopped=${encodeURIComponent(autoStopped.habitName)}&duration=${autoStopped.durationSeconds}`);
    }
    redirect('/skills');
  }

  return (
    <TimerView
      habitName={activeHabit.name}
      startTime={activeHabit.activeTimer!.startTime}
      targetDurationSeconds={activeHabit.activeTimer!.targetDurationSeconds}
      todaySeconds={activeHabit.todaySeconds}
      streak={activeHabit.streak}
    />
  );
}
