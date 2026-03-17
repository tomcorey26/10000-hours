'use client';

import { useState } from 'react';
import { PressableButton } from '@/components/ui/pressable-button';
import { DurationInput } from '@/components/DurationInput';
import { useHaptics } from '@/hooks/use-haptics';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type { TimerPreference } from '@/lib/timer-preferences';

type Props = {
  habitName: string;
  onStart: (targetDurationSeconds?: number) => void;
  onCancel: () => void;
};

const PRESETS = [
  { label: '15m', minutes: 15 },
  { label: '25m', minutes: 25 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '60m', minutes: 60 },
];

const DEFAULT_PREF: TimerPreference = { mode: 'stopwatch', durationMinutes: 25, durationSeconds: 0 };

export function StartTimerModal({ habitName, onStart, onCancel }: Props) {
  const { trigger } = useHaptics();
  const [pref, setPref] = useLocalStorage<TimerPreference>('timer-mode-preference', DEFAULT_PREF);
  const [mode, setMode] = useState<'stopwatch' | 'countdown'>(pref.mode);
  const [minutes, setMinutes] = useState(pref.durationMinutes);
  const [seconds, setSeconds] = useState(pref.durationSeconds ?? 0);
  const [inputKey, setInputKey] = useState(0);

  function handleStart() {
    trigger('medium');
    const totalSeconds = minutes * 60 + seconds;
    setPref({
      mode,
      durationMinutes: minutes,
      durationSeconds: seconds,
    });
    if (mode === 'countdown' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (mode === 'stopwatch') {
      onStart();
    } else {
      onStart(totalSeconds);
    }
  }

  function handlePresetClick(presetMinutes: number) {
    trigger('selection');
    setMinutes(presetMinutes);
    setSeconds(0);
    setInputKey((k) => k + 1);
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-4">
      <h2 className="text-2xl font-bold mb-2">{habitName}</h2>
      <p className="text-muted-foreground mb-8">Choose timer mode</p>

      {/* Toggle */}
      <div className="flex w-full max-w-xs rounded-lg border border-border overflow-hidden mb-8">
        <button
          onClick={() => { trigger('light'); setMode('stopwatch'); }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            mode === 'stopwatch'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-accent'
          }`}
        >
          Stopwatch
        </button>
        <button
          onClick={() => { trigger('light'); setMode('countdown'); }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            mode === 'countdown'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-accent'
          }`}
        >
          Countdown
        </button>
      </div>

      {/* Duration options (countdown only) */}
      {mode === 'countdown' && (
        <>
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset.minutes)}
                className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                  minutes === preset.minutes && seconds === 0
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-accent'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mb-8">
            <DurationInput
              key={inputKey}
              minutes={minutes}
              seconds={seconds}
              onChange={({ minutes: m, seconds: s }) => {
                setMinutes(m);
                setSeconds(s);
              }}
            />
          </div>
        </>
      )}

      <PressableButton
        size="lg"
        className="w-full max-w-xs py-6 text-lg"
        onClick={handleStart}
        disabled={mode === 'countdown' && minutes === 0 && seconds === 0}
      >
        Start
      </PressableButton>
      {mode === 'countdown' && minutes === 0 && seconds === 0 && (
        <p className="text-sm text-muted-foreground mt-2">Set a duration to start</p>
      )}

      <button
        onClick={onCancel}
        className="mt-6 text-sm text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}
