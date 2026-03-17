'use client';

import { useState } from 'react';

type DurationValue = { minutes: number; seconds: number };

type Props = {
  minutes: number;
  seconds: number;
  onChange: (value: DurationValue) => void;
};

export function DurationInput({ minutes: minProp, seconds: secProp, onChange }: Props) {
  const [minText, setMinText] = useState(String(minProp));
  const [secText, setSecText] = useState(String(secProp).padStart(2, '0'));

  function handleMinutesChange(value: string) {
    const digits = value.replace(/\D/g, '');
    if (digits.length > 3) return;
    const display = digits === '' ? '' : String(Number(digits));
    setMinText(display);
    onChange({ minutes: Number(display) || 0, seconds: Number(secText) || 0 });
  }

  function handleSecondsChange(value: string) {
    const digits = value.replace(/\D/g, '');
    // Shift-left: when full (2 digits) and a new digit is typed, drop the left digit
    const trimmed = digits.length > 2 ? digits.slice(-2) : digits;
    setSecText(trimmed);
    onChange({ minutes: Number(minText) || 0, seconds: Math.min(59, Number(trimmed) || 0) });
  }

  function handleMinutesKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const current = Number(minText) || 0;
      const next = e.key === 'ArrowUp' ? Math.min(999, current + 1) : Math.max(0, current - 1);
      setMinText(String(next));
      onChange({ minutes: next, seconds: Number(secText) || 0 });
    }
  }

  function handleSecondsKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const current = Number(secText) || 0;
      const next = e.key === 'ArrowUp' ? Math.min(59, current + 1) : Math.max(0, current - 1);
      const padded = String(next).padStart(2, '0');
      setSecText(padded);
      onChange({ minutes: Number(minText) || 0, seconds: next });
    }
  }

  function handleMinutesBlur() {
    const val = minText === '' ? '0' : minText;
    setMinText(val);
    onChange({ minutes: Number(val) || 0, seconds: Number(secText) || 0 });
  }

  function handleSecondsBlur() {
    const n = Math.min(59, Math.max(0, Number(secText) || 0));
    const padded = String(n).padStart(2, '0');
    setSecText(padded);
    onChange({ minutes: Number(minText) || 0, seconds: n });
  }

  return (
    <div className="flex items-center gap-2 w-full max-w-xs">
      <div className="flex-1">
        <label htmlFor="duration-min" className="block text-xs text-muted-foreground mb-1 text-center">min</label>
        <input
          id="duration-min"
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={minText}
          onChange={(e) => handleMinutesChange(e.target.value)}
          onKeyDown={handleMinutesKeyDown}
          onBlur={handleMinutesBlur}
          className="w-full px-4 py-3 rounded-md border border-border bg-background text-center text-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <span className="text-2xl font-bold text-muted-foreground mt-4">:</span>
      <div className="flex-1">
        <label htmlFor="duration-sec" className="block text-xs text-muted-foreground mb-1 text-center">sec</label>
        <input
          id="duration-sec"
          type="text"
          inputMode="numeric"
          placeholder="00"
          value={secText}
          onChange={(e) => handleSecondsChange(e.target.value)}
          onKeyDown={handleSecondsKeyDown}
          onBlur={handleSecondsBlur}
          className="w-full px-4 py-3 rounded-md border border-border bg-background text-center text-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
}
