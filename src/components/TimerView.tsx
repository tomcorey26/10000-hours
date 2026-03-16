"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PressableButton } from "@/components/ui/pressable-button";
import {
  formatTime,
  formatElapsed,
  formatRemaining,
  isCountdownComplete,
} from "@/lib/format";
import { getRandomCongratsMessage } from "@/lib/congrats-messages";
import { useStopTimer } from "@/hooks/use-habits";
import { useHaptics } from "@/hooks/use-haptics";
import { FullHeight } from "@/components/ui/full-height";

const BUBBLE_EMOJIS = [
  "🎉",
  "⭐",
  "🔥",
  "💪",
  "✨",
  "🏆",
  "🎯",
  "💥",
  "🙌",
  "👏",
];

function EmojiBubbles() {
  const bubbles = Array.from({ length: 14 }, (_, i) => ({
    emoji: BUBBLE_EMOJIS[i % BUBBLE_EMOJIS.length],
    left: `${5 + ((i * 7) % 90)}%`,
    duration: 2.5 + (i % 4) * 0.6,
    delay: (i % 7) * 0.4,
    size: 1.2 + (i % 3) * 0.5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="absolute bottom-0"
          style={{
            left: b.left,
            fontSize: `${b.size}rem`,
            animation: `bubble-up ${b.duration}s ease-out ${0.4 + b.delay}s infinite`,
            opacity: 0,
          }}
        >
          {b.emoji}
        </span>
      ))}
    </div>
  );
}

type Props = {
  habitName: string;
  startTime: string;
  targetDurationSeconds: number | null;
  todaySeconds: number;
  streak: number;
};

function playFanfare() {
  try {
    const audio = new Audio("/fanfare.mp3");
    audio.play().catch(() => {});
  } catch {
    // Ignore audio errors
  }
}

export function TimerView({
  habitName,
  startTime,
  targetDurationSeconds,
  todaySeconds,
  streak,
}: Props) {
  const isCountdown = targetDurationSeconds !== null;
  const router = useRouter();
  const stopTimer = useStopTimer();
  const { trigger } = useHaptics();

  const [display, setDisplay] = useState(() =>
    isCountdown
      ? formatRemaining(startTime, targetDurationSeconds)
      : formatElapsed(startTime),
  );
  const [finished, setFinished] = useState(() =>
    isCountdown ? isCountdownComplete(startTime, targetDurationSeconds) : false,
  );
  const autoStopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [successData, setSuccessData] = useState<{
    durationSeconds: number;
    message: string;
  } | null>(null);

  function handleStop() {
    trigger("buzz");
    stopTimer.mutate(undefined, {
      onSuccess: (data) => {
        setSuccessData({
          durationSeconds: data.durationSeconds,
          message: getRandomCongratsMessage(),
        });
        playFanfare();
        trigger("buzz");
      },
    });
  }

  function handleBack() {
    router.push("/skills");
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (isCountdown) {
        setDisplay(formatRemaining(startTime, targetDurationSeconds));
        if (isCountdownComplete(startTime, targetDurationSeconds)) {
          setFinished(true);
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

  useEffect(() => {
    if (!finished) return;

    trigger("buzz");

    try {
      const audio = new Audio("/alarm.mp3");
      audio.play().catch(() => {});
    } catch {
      // Ignore audio errors
    }

    autoStopTimeout.current = setTimeout(() => {
      handleStop();
    }, 2000);

    return () => {
      if (autoStopTimeout.current) {
        clearTimeout(autoStopTimeout.current);
      }
    };
  }, [finished]);

  if (successData) {
    return (
      <FullHeight className="relative">
        <EmojiBubbles />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-slam-down relative z-10">
          <p className="text-6xl mb-6">&#127942;</p>
          <h1 className="text-2xl font-bold mb-3">Session Complete!</h1>
          <p className="text-lg text-muted-foreground mb-6 max-w-xs">
            {successData.message}
          </p>
          <p className="text-4xl font-mono font-light tracking-tight mb-2">
            {formatTime(successData.durationSeconds)}
          </p>
          <p className="text-sm text-muted-foreground mb-10">of {habitName}</p>
          <PressableButton
            size="lg"
            onClick={handleBack}
            className="px-12 py-6 text-lg"
          >
            Back to Habits
          </PressableButton>
        </div>
      </FullHeight>
    );
  }

  return (
    <FullHeight>
      <header className="flex items-center justify-between py-4">
        <button onClick={handleBack} className="text-muted-foreground text-sm">
          &larr; Back
        </button>
        <span className="font-semibold">{habitName}</span>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-6xl font-mono font-light tracking-tight mb-3">
          {display}
        </p>
        <div className="flex items-center gap-2 mb-12">
          {finished ? (
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
