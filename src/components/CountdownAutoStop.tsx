'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatTime } from '@/lib/format';
import { isCountdownComplete } from '@/lib/timer';
import type { Habit } from '@/lib/types';

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    // Some browsers don't support Notification constructor
  }
}

export function CountdownAutoStop() {
  const queryClient = useQueryClient();
  const stoppingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function getActiveCountdown() {
      const data = queryClient.getQueryData<{ habits: Habit[] }>(queryKeys.habits.all);
      return data?.habits.find(h => h.activeTimer?.targetDurationSeconds) ?? null;
    }

    async function checkAndStop() {
      if (stoppingRef.current) return;

      const active = getActiveCountdown();
      if (!active?.activeTimer?.targetDurationSeconds) {
        // No active countdown — stop polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      const { startTime, targetDurationSeconds } = active.activeTimer;
      if (!isCountdownComplete(startTime, targetDurationSeconds)) return;

      stoppingRef.current = true;
      try {
        const result = await api<{ durationSeconds: number }>('/api/timer/stop', { method: 'POST' });
        const message = `🎉 Your ${formatTime(result.durationSeconds)} ${active.name} session was recorded`;

        toast.success(message);
        sendBrowserNotification('🎉 Session Complete', message);
        try { new Audio('/fanfare.mp3').play().catch(() => {}); } catch {}

        queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
      } catch {
        // Timer may have already been stopped (e.g., another tab)
      } finally {
        stoppingRef.current = false;
      }
    }

    function startPolling() {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(checkAndStop, 1000);
    }

    // Subscribe to query cache changes to start polling when a countdown becomes active
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] !== 'habits') return;
      if (getActiveCountdown() && !intervalRef.current) {
        startPolling();
      }
    });

    // Start polling immediately if there's already an active countdown
    if (getActiveCountdown()) {
      startPolling();
    }

    return () => {
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [queryClient]);

  return null;
}
