'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { formatTime } from '@/lib/format';
import type { AutoStoppedSession } from '@/lib/queries';

export function AutoStopToast() {
  const queryClient = useQueryClient();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;

    const data = queryClient.getQueryData<{
      habits: unknown[];
      autoStopped: AutoStoppedSession | null;
    }>(queryKeys.habits.all);

    if (data?.autoStopped) {
      shown.current = true;
      toast.success(
        `🎉 Your ${formatTime(data.autoStopped.durationSeconds)} ${data.autoStopped.habitName} session was auto-recorded`
      );
    }
  }, [queryClient]);

  return null;
}
