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

  useEffect(() => {
    const interval = setInterval(async () => {
      if (stoppingRef.current) return;

      const data = queryClient.getQueryData<{ habits: Habit[] }>(queryKeys.habits.all);
      if (!data) return;

      const active = data.habits.find(h => h.activeTimer);
      if (!active?.activeTimer?.targetDurationSeconds) return;

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
    }, 1000);

    return () => clearInterval(interval);
  }, [queryClient]);

  return null;
}
