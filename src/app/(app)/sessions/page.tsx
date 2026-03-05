import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getSessionsForUser, getHabitsForUser } from '@/lib/queries';
import { SessionsView } from '@/components/SessionsView';
import { Suspense } from 'react';
import { Spinner } from '@/components/Spinner';

export default async function SessionsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const [sessionsData, habits] = await Promise.all([
    getSessionsForUser(userId, {}),
    getHabitsForUser(userId),
  ]);

  const habitsList = habits.map(h => ({ id: h.id, name: h.name }));

  return (
    <Suspense fallback={<Spinner />}>
      <SessionsView
        habits={habitsList}
        initialSessions={sessionsData.sessions}
        initialTotalSeconds={sessionsData.totalSeconds}
      />
    </Suspense>
  );
}
