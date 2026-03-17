'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getMonthGrid, toDateKey, formatDayHeader, isoToDateKey } from '@/lib/calendar';
import { getHabitColor } from '@/lib/habit-colors';
import { useHaptics } from '@/hooks/use-haptics';
import type { Session } from '@/lib/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Props = {
  sessions: Session[];
  habits: { id: number; name: string }[];
};

export function CalendarView({ sessions, habits }: Props) {
  const { trigger } = useHaptics();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build a map: habitId -> index (for color assignment)
  const habitIndexMap = new Map<number, number>();
  habits.forEach((h, i) => habitIndexMap.set(h.id, i));

  // Group sessions by date key
  const sessionsByDate = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = isoToDateKey(s.endTime);
    if (!sessionsByDate.has(key)) sessionsByDate.set(key, []);
    sessionsByDate.get(key)!.push(s);
  }

  // Get unique habit IDs for a given date (for rendering dots)
  function getHabitIdsForDate(dateKey: string): number[] {
    const daySessions = sessionsByDate.get(dateKey) || [];
    return [...new Set(daySessions.map(s => s.habitId))];
  }

  const days = getMonthGrid(currentMonth.year, currentMonth.month);
  const todayKey = toDateKey(new Date());
  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  function prevMonth() {
    trigger('light');
    setCurrentMonth(prev => {
      const d = new Date(prev.year, prev.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelectedDate(null);
  }

  function nextMonth() {
    trigger('light');
    setCurrentMonth(prev => {
      const d = new Date(prev.year, prev.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelectedDate(null);
  }

  const selectedSessions = selectedDate ? (sessionsByDate.get(selectedDate) || []) : [];
  const selectedTotalSeconds = selectedSessions.reduce((sum, s) => sum + s.durationSeconds, 0);

  function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function formatTimeOfDay(iso: string) {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <Button variant="ghost" size="sm" onClick={nextMonth} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map(d => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((day, i) => {
          const key = toDateKey(day);
          const isCurrentMonth = day.getMonth() === currentMonth.month;
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const habitIds = getHabitIdsForDate(key);

          return (
            <button
              key={i}
              onClick={() => { trigger('selection'); setSelectedDate(isSelected ? null : key); }}
              className={`
                relative flex flex-col items-center py-1.5 text-sm rounded-md transition-colors
                ${!isCurrentMonth ? 'text-muted-foreground/40' : ''}
                ${isToday && !isSelected ? 'ring-1 ring-primary/40' : ''}
                ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}
              `}
            >
              <span className="text-xs">{day.getDate()}</span>
              {/* Habit dots */}
              {habitIds.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {habitIds.slice(0, 3).map(hId => (
                    <span
                      key={hId}
                      className="block h-1 w-1 rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? 'currentColor'
                          : getHabitColor(habitIndexMap.get(hId) ?? 0),
                      }}
                    />
                  ))}
                  {habitIds.length > 3 && (
                    <span className="block h-1 w-1 rounded-full bg-muted-foreground/50" />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Day detail panel */}
      {selectedDate && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">
                {formatDayHeader(new Date(selectedDate + 'T00:00:00'))}
              </h3>
              {selectedTotalSeconds > 0 && (
                <span className="text-xs text-muted-foreground">
                  Total: {formatDuration(selectedTotalSeconds)}
                </span>
              )}
            </div>
            {selectedSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions this day</p>
            ) : (
              <div className="space-y-2">
                {selectedSessions.map(session => (
                  <div key={session.id} className="flex items-center gap-2">
                    <span
                      className="block h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: getHabitColor(habitIndexMap.get(session.habitId) ?? 0),
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{session.habitName}</span>
                        <span className="text-sm font-mono text-muted-foreground ml-2">
                          {formatDuration(session.durationSeconds)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeOfDay(session.startTime)} — {formatTimeOfDay(session.endTime)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
