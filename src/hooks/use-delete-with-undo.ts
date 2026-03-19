"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

export function useDeleteWithUndo(onDelete: (id: number) => void) {
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  function scheduleDelete(id: number, label: string) {
    setPendingIds((prev) => new Set(prev).add(id));

    const timeoutId = setTimeout(() => {
      onDelete(id);
      timersRef.current.delete(id);
    }, 5000);

    timersRef.current.set(id, timeoutId);

    toast(`${label} deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          const timer = timersRef.current.get(id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
            toast.success(`${label} restored`);
          }
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      },
    });
  }

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return { pendingIds, scheduleDelete };
}
