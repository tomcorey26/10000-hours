'use client';

import { useState } from 'react';
import { PressableButton } from '@/components/ui/pressable-button';
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
  const [minutes, setMinutes] = useState(String(pref.durationMinutes));
  const [seconds, setSeconds] = useState(String(pref.durationSeconds ?? 0).padStart(2, '0'));

  function handleMinutesChange(value: string) {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) setMinutes(digits === '' ? '' : String(Number(digits)));
  }

  function handleSecondsChange(value: string) {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) setSeconds(digits);
  }

  function handleSecondsBlur() {
    const n = Math.min(59, Math.max(0, Number(seconds) || 0));
    setSeconds(String(n).padStart(2, '0'));
  }

  function handleMinutesBlur() {
    if (minutes === '') setMinutes('0');
  }

  function handleStart() {
    trigger('medium');
    const mins = Math.max(0, Math.floor(Number(minutes) || 0));
    const secs = Math.min(59, Math.max(0, Math.floor(Number(seconds) || 0)));
    const totalSeconds = mins * 60 + secs;
    setPref({
      mode,
      durationMinutes: mins,
      durationSeconds: secs,
    });
    if (mode === 'countdown' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (mode === 'stopwatch') {
      onStart();
    } else {
      onStart(Math.max(1, totalSeconds));
    }
  }

  function handlePresetClick(presetMinutes: number) {
    trigger('selection');
    setMinutes(String(presetMinutes));
    setSeconds('00');
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
                  Number(minutes) === preset.minutes
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-accent'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full max-w-xs mb-8">
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1 text-center">min</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={minutes}
                onChange={(e) => handleMinutesChange(e.target.value)}
                onBlur={handleMinutesBlur}
                className="w-full px-4 py-3 rounded-md border border-border bg-background text-center text-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <span className="text-2xl font-bold text-muted-foreground mt-4">:</span>
            <div className="flex-1">
              <label className="block text-xs text-muted-foreground mb-1 text-center">sec</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="00"
                maxLength={2}
                value={seconds}
                onChange={(e) => handleSecondsChange(e.target.value)}
                onBlur={handleSecondsBlur}
                className="w-full px-4 py-3 rounded-md border border-border bg-background text-center text-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
        </>
      )}

      <PressableButton
        size="lg"
        className="w-full max-w-xs py-6 text-lg"
        onClick={handleStart}
      >
        Start
      </PressableButton>

      <button
        onClick={onCancel}
        className="mt-6 text-sm text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}
