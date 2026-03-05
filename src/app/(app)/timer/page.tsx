import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getHabitsForUser } from '@/lib/queries';
import { TimerView } from '@/components/TimerView';

export default async function TimerPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const habits = await getHabitsForUser(userId);
  const activeHabit = habits.find(h => h.activeTimer);

  // No active timer — redirect back to dashboard
  if (!activeHabit) redirect('/dashboard');

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
