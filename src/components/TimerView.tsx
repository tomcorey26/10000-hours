'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatTime, formatElapsed, formatRemaining, isCountdownComplete } from '@/lib/format';
import { useStopTimer } from '@/hooks/use-habits';

type Props = {
  habitName: string;
  startTime: string;
  targetDurationSeconds: number | null;
  todaySeconds: number;
  streak: number;
};

export function TimerView({ habitName, startTime, targetDurationSeconds, todaySeconds, streak }: Props) {
  const isCountdown = targetDurationSeconds !== null;
  const router = useRouter();
  const stopTimer = useStopTimer();

  const [display, setDisplay] = useState(() =>
    isCountdown
      ? formatRemaining(startTime, targetDurationSeconds)
      : formatElapsed(startTime)
  );
  const [finished, setFinished] = useState(() =>
    isCountdown ? isCountdownComplete(startTime, targetDurationSeconds) : false
  );
  const autoStopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleStop() {
    stopTimer.mutate(undefined, {
      onSuccess: () => router.push('/dashboard'),
    });
  }

  function handleBack() {
    router.push('/dashboard');
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
    if (!finished) return;

    try {
      const audio = new Audio('/alarm.mp3');
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-4 relative z-10">
        <button onClick={handleBack} className="text-muted-foreground text-sm">&larr; Back</button>
        <span className="font-semibold">{habitName}</span>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        <p className="text-6xl font-mono font-light tracking-tight mb-3">{display}</p>
        <div className="flex items-center gap-2 mb-12">
          {finished ? (
            <span className="text-sm font-semibold text-primary">Time&apos;s up!</span>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {isCountdown ? 'Counting down...' : 'Recording...'}
              </span>
            </>
          )}
        </div>

        <Button size="lg" onClick={handleStop} className="px-12 py-6 text-lg">Stop</Button>
      </div>

      <footer className="px-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-center space-y-1">
        <p className="text-sm text-muted-foreground">Today total: {formatTime(todaySeconds)}</p>
        <p className="text-sm text-muted-foreground">
          {streak > 0 ? `${streak} day streak` : 'No streak yet'}
        </p>
      </footer>
    </div>
  );
}
