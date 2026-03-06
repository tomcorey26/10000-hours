'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarView } from '@/components/CalendarView';
import { List, CalendarDays } from 'lucide-react';
import { formatTime } from '@/lib/format';
import { useSessions } from '@/hooks/use-sessions';
import { useHaptics } from '@/hooks/use-haptics';
import type { Session } from '@/lib/types';

type DateRange = 'today' | 'week' | 'month' | 'all';

export function SessionsView({
  habits,
  initialSessions,
  initialTotalSeconds,
}: {
  habits: { id: number; name: string }[];
  initialSessions?: Session[];
  initialTotalSeconds?: number;
}) {
  const [selectedHabitId, setSelectedHabitId] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const { trigger } = useHaptics();

  const initialData = initialSessions ? { sessions: initialSessions, totalSeconds: initialTotalSeconds ?? 0 } : undefined;
  const { data } = useSessions({ habitId: selectedHabitId || undefined, range: dateRange, viewMode }, initialData);
  const sessions = data?.sessions ?? [];
  const totalSeconds = data?.totalSeconds ?? 0;

  const dateRanges: { value: DateRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'all', label: 'All Time' },
  ];

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function formatTimeOfDay(iso: string) {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric', minute: '2-digit',
    });
  }

  function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={selectedHabitId}
            onChange={(e) => setSelectedHabitId(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Skills</option>
            {habits.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <div className="flex rounded-md border border-input">
            <button
              onClick={() => { trigger('selection'); setViewMode('list'); }}
              className={`p-2 rounded-l-md transition-colors ${viewMode === 'list' ? 'bg-muted' : ''}`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => { trigger('selection'); setViewMode('calendar'); }}
              className={`p-2 rounded-r-md transition-colors ${viewMode === 'calendar' ? 'bg-muted' : ''}`}
              aria-label="Calendar view"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        </div>

        {viewMode === 'list' && (
          <div className="flex gap-1">
            {dateRanges.map(r => (
              <Button
                key={r.value}
                variant={dateRange === r.value ? 'default' : 'outline'}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => { trigger('light'); setDateRange(r.value); }}
              >
                {r.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      {viewMode === 'list' && (
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">Total Time</p>
          <p className="text-2xl font-bold">{formatTime(totalSeconds)}</p>
        </div>
      )}

      {/* Sessions list or calendar */}
      {viewMode === 'calendar' ? (
        <CalendarView sessions={sessions} habits={habits} />
      ) : sessions.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No sessions yet</p>
      ) : (
        <div className="space-y-2">
          {sessions.map(session => (
            <Card key={session.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{session.habitName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                    {session.timerMode}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{formatDate(session.endTime)}</span>
                  <span className="font-mono">{formatDuration(session.durationSeconds)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatTimeOfDay(session.startTime)} — {formatTimeOfDay(session.endTime)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
