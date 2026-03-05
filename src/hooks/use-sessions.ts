import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Session } from '@/lib/types';

type SessionFilters = { habitId?: string; range?: string; viewMode: string };

export function useSessions(filters: SessionFilters, initialData?: { sessions: Session[]; totalSeconds: number }) {
  // Only use initialData for the default (unfiltered) query to avoid stale data on filter changes
  const isDefaultFilter = !filters.habitId && filters.range === 'all';
  return useQuery({
    queryKey: queryKeys.sessions.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.habitId) params.set('habitId', filters.habitId);
      if (filters.viewMode === 'list' && filters.range && filters.range !== 'all') {
        params.set('range', filters.range);
      }
      return api<{ sessions: Session[]; totalSeconds: number }>(`/api/sessions?${params}`);
    },
    ...(initialData && isDefaultFilter ? { initialData } : {}),
  });
}

export function useLogSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { habitId: number; date: string; durationMinutes: number }) =>
      api('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
    },
  });
}
