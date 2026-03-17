"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { formatTime } from "@/lib/format";
import type { AutoStoppedSession } from "@/lib/types";

export function AutoStopToastTrigger({
  autoStopped,
}: {
  autoStopped: AutoStoppedSession;
}) {
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    toast.success(
      `🎉 Your ${formatTime(autoStopped.durationSeconds)} ${autoStopped.habitName} session was auto-recorded`,
    );
  }, [autoStopped]);

  return null;
}
