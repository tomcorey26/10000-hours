'use client';

import { Button } from '@/components/ui/button';
import { useLogout } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useHaptics } from '@/hooks/use-haptics';

export function LogoutButton() {
  const logout = useLogout();
  const router = useRouter();
  const { trigger } = useHaptics();

  function handleLogout() {
    trigger('light');
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
