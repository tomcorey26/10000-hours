import { describe, it, expect } from 'vitest';
import {
  getTimeOptions,
  isPlaceholderSession,
  checkOverlap,
  type SessionForOverlap,
} from './session-utils';

// Helper to create sessions using local time constructor
function makeSession(
  startHour: number,
  startMin: number,
  endHour: number,
  endMin: number,
  habitName = 'Guitar',
): SessionForOverlap {
  const start = new Date(2026, 2, 19, startHour, startMin, 0);
  const end = new Date(2026, 2, 19, endHour, endMin, 0);
  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    durationSeconds: (end.getTime() - start.getTime()) / 1000,
    timerMode: 'stopwatch',
    habitName,
  };
}

describe('getTimeOptions', () => {
  it('returns 96 options', () => {
    const options = getTimeOptions();
    expect(options).toHaveLength(96);
  });

  it('first option is 12:00 AM / 00:00', () => {
    const options = getTimeOptions();
    expect(options[0]).toEqual({ label: '12:00 AM', value: '00:00' });
  });

  it('last option is 11:45 PM / 23:45', () => {
    const options = getTimeOptions();
    expect(options[95]).toEqual({ label: '11:45 PM', value: '23:45' });
  });

  it('formats PM hours correctly', () => {
    const options = getTimeOptions();
    // 13:00 is index 52 (13*4)
    expect(options[52]).toEqual({ label: '1:00 PM', value: '13:00' });
  });
});

describe('isPlaceholderSession', () => {
  it('detects midnight manual session as placeholder', () => {
    const session: SessionForOverlap = {
      startTime: new Date(Date.UTC(2026, 2, 19, 0, 0, 0)).toISOString(),
      endTime: new Date(Date.UTC(2026, 2, 19, 0, 30, 0)).toISOString(),
      durationSeconds: 1800,
      timerMode: 'manual',
    };
    expect(isPlaceholderSession(session)).toBe(true);
  });

  it('rejects non-manual session at midnight UTC', () => {
    const session: SessionForOverlap = {
      startTime: new Date(Date.UTC(2026, 2, 19, 0, 0, 0)).toISOString(),
      endTime: new Date(Date.UTC(2026, 2, 19, 0, 30, 0)).toISOString(),
      durationSeconds: 1800,
      timerMode: 'stopwatch',
    };
    expect(isPlaceholderSession(session)).toBe(false);
  });

  it('rejects manual session not at midnight UTC', () => {
    const session: SessionForOverlap = {
      startTime: new Date(Date.UTC(2026, 2, 19, 10, 30, 0)).toISOString(),
      endTime: new Date(Date.UTC(2026, 2, 19, 11, 0, 0)).toISOString(),
      durationSeconds: 1800,
      timerMode: 'manual',
    };
    expect(isPlaceholderSession(session)).toBe(false);
  });
});

describe('checkOverlap', () => {
  it('returns null when no overlap', () => {
    const sessions = [makeSession(10, 0, 11, 0)];
    const result = checkOverlap('08:00', 60, sessions);
    expect(result).toBeNull();
  });

  it('detects overlap with existing session', () => {
    const sessions = [makeSession(10, 0, 11, 0)];
    const result = checkOverlap('10:30', 60, sessions);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('overlap');
    if (result!.type === 'overlap') {
      expect(result!.habitName).toBe('Guitar');
    }
  });

  it('allows back-to-back sessions (half-open intervals)', () => {
    const sessions = [makeSession(10, 0, 11, 0)];
    const result = checkOverlap('11:00', 60, sessions);
    expect(result).toBeNull();
  });

  it('returns midnight error when session extends past midnight', () => {
    const result = checkOverlap('23:30', 60, []);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('midnight');
    expect(result!.message).toBe('Session cannot extend past midnight');
  });

  it('excludes placeholder sessions from overlap check', () => {
    const placeholder: SessionForOverlap = {
      startTime: new Date(Date.UTC(2026, 2, 19, 0, 0, 0)).toISOString(),
      endTime: new Date(Date.UTC(2026, 2, 19, 0, 30, 0)).toISOString(),
      durationSeconds: 1800,
      timerMode: 'manual',
      habitName: 'Guitar',
    };
    // The placeholder's local time depends on TZ, but isPlaceholderSession should skip it
    const result = checkOverlap('00:00', 30, [placeholder]);
    expect(result).toBeNull();
  });

  it('detects overlap with non-placeholder manual session', () => {
    const manualSession: SessionForOverlap = {
      startTime: new Date(2026, 2, 19, 14, 0, 0).toISOString(),
      endTime: new Date(2026, 2, 19, 15, 0, 0).toISOString(),
      durationSeconds: 3600,
      timerMode: 'manual',
      habitName: 'Piano',
    };
    const result = checkOverlap('14:30', 30, [manualSession]);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('overlap');
    if (result!.type === 'overlap') {
      expect(result!.habitName).toBe('Piano');
    }
  });
});
