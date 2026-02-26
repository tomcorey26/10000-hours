'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  habitName: string;
  habitId: number;
  startTime: string;
  todaySeconds: number;
  streak: number;
  onStop: () => void;
  onBack: () => void;
};

function formatElapsed(startTimeIso: string): string {
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startTimeIso).getTime()) / 1000));
  const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function TimerView({ habitName, startTime, todaySeconds, streak, onStop, onBack }: Props) {
  const [elapsed, setElapsed] = useState(formatElapsed(startTime));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  async function handleStop() {
    await fetch('/api/timer/stop', { method: 'POST' });
    onStop();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-4">
        <button onClick={onBack} className="text-muted-foreground text-sm">&larr; Back</button>
        <span className="font-semibold">{habitName}</span>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        <p className="text-6xl font-mono font-light tracking-tight mb-3">{elapsed}</p>
        <div className="flex items-center gap-2 mb-12">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm text-muted-foreground">Recording...</span>
        </div>

        <Button size="lg" onClick={handleStop} className="px-12 py-6 text-lg">Stop</Button>
      </div>

      <footer className="px-4 pb-8 pb-[env(safe-area-inset-bottom)] text-center space-y-1">
        <p className="text-sm text-muted-foreground">Today total: {formatTime(todaySeconds)}</p>
        <p className="text-sm text-muted-foreground">
          {streak > 0 ? `${streak} day streak` : 'No streak yet'}
        </p>
      </footer>
    </div>
  );
}
