'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  habitName: string;
  onStart: (targetDurationSeconds?: number) => void;
  onCancel: () => void;
};

const PRESETS = [
  { label: '15m', seconds: 15 * 60 },
  { label: '25m', seconds: 25 * 60 },
  { label: '30m', seconds: 30 * 60 },
  { label: '45m', seconds: 45 * 60 },
  { label: '60m', seconds: 60 * 60 },
];

export function StartTimerModal({ habitName, onStart, onCancel }: Props) {
  const [mode, setMode] = useState<'select' | 'countdown'>('select');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState('');

  const selectedSeconds =
    selectedPreset !== null
      ? selectedPreset
      : customMinutes !== ''
        ? Math.max(1, Math.floor(Number(customMinutes))) * 60
        : null;

  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center pt-[25vh] px-4">
        <h2 className="text-2xl font-bold mb-2">{habitName}</h2>
        <p className="text-muted-foreground mb-8">Choose timer mode</p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button size="lg" className="w-full py-6 text-lg" onClick={() => onStart()}>
            Stopwatch
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full py-6 text-lg"
            onClick={() => setMode('countdown')}
          >
            Countdown
          </Button>
        </div>

        <button
          onClick={onCancel}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Countdown mode
  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-[25vh] px-4">
      <h2 className="text-2xl font-bold mb-2">{habitName}</h2>
      <p className="text-muted-foreground mb-8">Set countdown duration</p>

      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              setSelectedPreset(preset.seconds);
              setCustomMinutes('');
            }}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
              selectedPreset === preset.seconds
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-accent'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <input
        type="number"
        placeholder="Custom minutes"
        value={customMinutes}
        onChange={(e) => {
          setCustomMinutes(e.target.value);
          setSelectedPreset(null);
        }}
        className="w-full max-w-xs px-4 py-3 rounded-md border border-border bg-background text-center text-lg mb-6 focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <Button
        size="lg"
        className="w-full max-w-xs py-6 text-lg"
        disabled={selectedSeconds === null}
        onClick={() => {
          if (selectedSeconds !== null) {
            onStart(selectedSeconds);
          }
        }}
      >
        Start
      </Button>

      <button
        onClick={() => {
          setMode('select');
          setSelectedPreset(null);
          setCustomMinutes('');
        }}
        className="mt-6 text-sm text-muted-foreground hover:text-foreground"
      >
        Back
      </button>
    </div>
  );
}
