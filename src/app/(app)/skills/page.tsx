import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getHabitsForUser, autoStopExpiredCountdown } from '@/lib/queries';
import { Dashboard } from '@/components/Dashboard';
import { AutoStopToastTrigger } from '@/components/AutoStopToast';
import { Suspense } from 'react';
import { Spinner } from '@/components/Spinner';

export default async function SkillsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const autoStopped = await autoStopExpiredCountdown(userId);
  const habits = await getHabitsForUser(userId);

  return (
    <Suspense fallback={<Spinner />}>
      <Dashboard initialHabits={habits} />
      {autoStopped && <AutoStopToastTrigger autoStopped={autoStopped} />}
    </Suspense>
  );
}
