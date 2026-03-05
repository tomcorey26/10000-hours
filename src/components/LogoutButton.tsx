'use client';

import { Button } from '@/components/ui/button';
import { useLogout } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const logout = useLogout();
  const router = useRouter();

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => router.push('/login'),
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      Log out
    </Button>
  );
}
