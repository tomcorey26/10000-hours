'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth, usePasskeyRegister } from '@/hooks/use-auth';

type Credential = {
  id: string;
  label: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
};

export default function AccountPage() {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['passkeys'],
    queryFn: () => api<{ credentials: Credential[] }>('/api/auth/passkey/list'),
  });

  const addPasskey = usePasskeyRegister();

  const deletePasskey = useMutation({
    mutationFn: (id: string) =>
      api(`/api/auth/passkey/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passkeys'] }),
  });

  const credentials = data?.credentials ?? [];

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-lg font-semibold">Account</h2>
      <p className="text-sm text-muted-foreground">Signed in as <span className="font-medium text-foreground">{user?.username}</span></p>
      <Card>
        <CardHeader>
          <CardTitle>Your Passkeys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {credentials.map((cred) => (
            <div key={cred.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <p className="text-sm font-medium">
                  {cred.label || `Passkey ${cred.id.slice(0, 8)}...`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cred.deviceType === 'multiDevice' ? 'Synced' : 'Device-bound'}
                  {cred.backedUp ? ' · Backed up' : ''}
                  {' · '}
                  {new Date(cred.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={credentials.length <= 1 || deletePasskey.isPending}
                onClick={() => deletePasskey.mutate(cred.id)}
              >
                Remove
              </Button>
            </div>
          ))}
          {!isLoading && credentials.length === 0 && (
            <p className="text-sm text-muted-foreground">No passkeys found.</p>
          )}
        </CardContent>
      </Card>
      <Button
        className="w-full"
        disabled={addPasskey.isPending}
        onClick={() => {
          if (user?.username) addPasskey.mutate({ username: user.username });
        }}
      >
        {addPasskey.isPending ? 'Adding...' : 'Add a Passkey'}
      </Button>
    </div>
  );
}
