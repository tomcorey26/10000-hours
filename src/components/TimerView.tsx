"use client";

import { useEffect, useState, useRef } from "react";
import { PressableButton } from "@/components/ui/pressable-button";
import { formatTime, formatElapsed, formatRemaining } from "@/lib/format";
import { isCountdownComplete } from "@/lib/timer";
import { useHaptics } from "@/hooks/use-haptics";
import { FullHeight } from "@/components/ui/full-height";

type Props = {
  habitName: string;
  startTime: string;
  targetDurationSeconds: number | null;
  todaySeconds: number;
  streak: number;
  onStop: () => void;
  onBack: () => void;
};

export function TimerView({
  habitName,
  startTime,
  targetDurationSeconds,
  todaySeconds,
  streak,
  onStop,
  onBack,
}: Props) {
  const isCountdown = targetDurationSeconds !== null;
  const { trigger } = useHaptics();

  const [display, setDisplay] = useState(() =>
    isCountdown
      ? formatRemaining(startTime, targetDurationSeconds)
      : formatElapsed(startTime),
  );
  const stoppedRef = useRef(false);

  function handleStop() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    trigger("buzz");
    onStop();
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (isCountdown) {
        setDisplay(formatRemaining(startTime, targetDurationSeconds));
        if (
          !stoppedRef.current &&
          isCountdownComplete(startTime, targetDurationSeconds)
        ) {
          handleStop();
        }
      } else {
        setDisplay(formatElapsed(startTime));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, targetDurationSeconds, isCountdown]);

  useEffect(() => {
    const prev = document.title;
    document.title = `${display} — ${habitName}`;
    return () => {
      document.title = prev;
    };
  }, [display, habitName]);

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
          {display}
        </p>
        <div className="flex items-center gap-2 mb-12">
          {isCountdown && display === "00:00:00" ? (
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
