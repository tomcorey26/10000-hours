'use client';

import { Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AuthForm } from '@/components/AuthForm';
import { Dashboard } from '@/components/Dashboard';
import { FullPageSpinner } from '@/components/Spinner';

export default function Home() {
  const { data: user, isLoading } = useAuth();

  if (isLoading) return <FullPageSpinner />;
  if (!user) return <AuthForm />;

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Dashboard user={user} />
    </Suspense>
  );
}
