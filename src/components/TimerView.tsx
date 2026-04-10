"use client";

import { useEffect, useRef } from "react";
import { PressableButton } from "@/components/ui/pressable-button";
import { formatTime } from "@/lib/format";
import { useHaptics } from "@/hooks/use-haptics";
import { useTimerStore } from "@/stores/timer-store";
import { FullHeight } from "@/components/ui/full-height";

type Props = {
  habitName: string;
  targetDurationSeconds: number | null;
  todaySeconds: number;
  streak: number;
  onStop: () => void;
  onBack: () => void;
};

export function TimerView({
  habitName,
  targetDurationSeconds,
  todaySeconds,
  streak,
  onStop,
  onBack,
}: Props) {
  const isCountdown = targetDurationSeconds !== null;
  const { trigger } = useHaptics();
  const setTimerViewMounted = useTimerStore((s) => s.setTimerViewMounted);
  const displayTime = useTimerStore((s) => s.displayTime);
  const isTimesUp = useTimerStore((s) => s.isTimesUp);

  useEffect(() => {
    setTimerViewMounted(true);
    return () => setTimerViewMounted(false);
  }, [setTimerViewMounted]);

  const stoppedRef = useRef(false);

  function handleStop() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    trigger("buzz");
    onStop();
  }

  return (
    <FullHeight>
      <header className="flex items-center justify-between py-4">
        <button onClick={onBack} className="text-muted-foreground text-sm">
          &larr; Back
        </button>
        <span className="font-semibold truncate max-w-[50%]">{habitName}</span>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-6xl font-mono font-light tracking-tight mb-3">
          {displayTime}
        </p>
        <div className="flex items-center gap-2 mb-12">
          {isTimesUp ? (
            <span className="text-sm font-semibold text-primary">
              Time&apos;s up!
            </span>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {isCountdown ? "Counting down..." : "Recording..."}
              </span>
            </>
          )}
        </div>

        <PressableButton
          size="lg"
          onClick={handleStop}
          className="px-12 py-6 text-lg"
        >
          End Session {isCountdown ? "Early" : ""}
        </PressableButton>
      </div>

      <footer className="pb-2 text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          Today total: {formatTime(todaySeconds)}
        </p>
        <p className="text-sm text-muted-foreground">
          {streak > 0 ? `🔥 ${streak} day streak` : "No streak yet"}
        </p>
      </footer>
    </FullHeight>
  );
}
