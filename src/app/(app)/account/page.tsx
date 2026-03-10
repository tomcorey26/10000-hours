'use client';

import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AccountPage() {
  const { data: user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="py-6 space-y-6">
      <h2 className="text-lg font-semibold">Account</h2>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={user?.email ?? ''} readOnly />
      </div>
    </div>
  );
}
