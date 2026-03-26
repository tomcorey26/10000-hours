import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Session } from '@/lib/types';

type SessionFilters = { habitId?: string; range?: string; viewMode: string };

export type SessionsPage = {
  sessions: Session[];
  totalSeconds: number;
  totalCount: number;
  hasNextPage: boolean;
  page: number;
};

export function useSessions(filters: SessionFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.sessions.list(filters),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (filters.habitId) params.set('habitId', filters.habitId);
      if (filters.viewMode === 'list' && filters.range && filters.range !== 'all') {
        params.set('range', filters.range);
      }
      params.set('page', String(pageParam));
      params.set('pageSize', '20');
      return api<SessionsPage>(`/api/sessions?${params}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.page + 1 : undefined,
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) =>
      api(`/api/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
    },
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
