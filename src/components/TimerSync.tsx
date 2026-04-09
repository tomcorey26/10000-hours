"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { formatTime } from "@/lib/format";
import { isCountdownComplete } from "@/lib/timer";
import { useTimerStore } from "@/stores/timer-store";
import type { Habit } from "@/lib/types";

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {}
}

function playFanfare() {
  try {
    new Audio("/fanfare.mp3").play().catch(() => {});
  } catch {}
}

export function TimerSync() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const hydratedRef = useRef(false);
  const stoppingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeTimer = useTimerStore((s) => s.activeTimer);
  const timerViewMounted = useTimerStore((s) => s.timerViewMounted);

  // Fetch habits — pure GET, no server-side mutations
  const { data } = useQuery({
    queryKey: queryKeys.habits.all,
    queryFn: () => api<{ habits: Habit[] }>("/api/habits"),
  });

  // --- Hydration (once) ---
  useEffect(() => {
    if (hydratedRef.current || !data) return;

    const activeHabit = data.habits.find((h) => h.activeTimer);
    if (activeHabit?.activeTimer) {
      useTimerStore.getState().hydrate({
        habitId: activeHabit.id,
        habitName: activeHabit.name,
        startTime: activeHabit.activeTimer.startTime,
        targetDurationSeconds: activeHabit.activeTimer.targetDurationSeconds,
      });
    }
    hydratedRef.current = true;
  }, [data]);

  // --- Dismiss success on nav away from /habits ---
  useEffect(() => {
    if (
      !pathname.startsWith("/habits") &&
      useTimerStore.getState().view.type === "success"
    ) {
      useTimerStore.getState().dismissSuccess();
    }
  }, [pathname]);

  // --- Client-side countdown polling ---
  useEffect(() => {
    if (!activeTimer?.targetDurationSeconds || timerViewMounted) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      stoppingRef.current = false;
      return;
    }

    const { startTime, targetDurationSeconds, habitName } = activeTimer;

    async function checkAndStop() {
      if (stoppingRef.current) return;
      if (!isCountdownComplete(startTime, targetDurationSeconds!)) return;

      stoppingRef.current = true;
      try {
        const result = await api<{ durationSeconds: number }>(
          "/api/timer/stop",
          { method: "POST" },
        );

        const message = `Your ${formatTime(result.durationSeconds)} ${habitName} session was recorded`;
        toast.success(message);
        sendBrowserNotification("Session Complete", message);
        playFanfare();

        useTimerStore.getState().resetTimer();

        queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
      } catch {
        useTimerStore.getState().resetTimer();
      }
    }

    stoppingRef.current = false;
    intervalRef.current = setInterval(checkAndStop, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTimer, timerViewMounted, queryClient]);

  return null;
}
