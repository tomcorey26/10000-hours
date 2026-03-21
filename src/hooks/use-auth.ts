import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

type User = { id: number; username: string };

export function useAuth() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return null;
      const data = await res.json();
      return data.user as User;
    },
    retry: false,
  });
}

export function usePasskeyRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ username, label }: { username: string; label?: string }) => {
      const options = await api<any>('/api/auth/passkey/register-options', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      const attestation = await startRegistration({ optionsJSON: options });
      return api('/api/auth/passkey/register-verify', {
        method: 'POST',
        body: JSON.stringify({ username, attestation, label }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
  });
}

export function usePasskeyLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const options = await api<any>('/api/auth/passkey/login-options', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      const assertion = await startAuthentication({ optionsJSON: options });
      return api('/api/auth/passkey/login-verify', {
        method: 'POST',
        body: JSON.stringify({ username, assertion }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
  });
}
