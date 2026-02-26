'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { HabitCard } from '@/components/HabitCard';
import { AddHabitForm } from '@/components/AddHabitForm';
import { TimerView } from '@/components/TimerView';
import { StartTimerModal } from '@/components/StartTimerModal';
import { SessionsView } from '@/components/SessionsView';
import type { Habit } from '@/lib/types';

export function Dashboard({ user, onLogout }: { user: { id: number; email: string }; onLogout: () => void }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'list' | 'timer' | 'sessions'>('list');
  const [pendingHabitId, setPendingHabitId] = useState<number | null>(null);

  const fetchHabits = useCallback(async () => {
    const res = await fetch('/api/habits');
    if (res.ok) {
      const data = await res.json();
      setHabits(data.habits);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  function handleStartClick(habitId: number) {
    setPendingHabitId(habitId);
  }

  async function handleStartConfirm(targetDurationSeconds?: number) {
    if (pendingHabitId === null) return;
    const res = await fetch('/api/timer/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitId: pendingHabitId, targetDurationSeconds }),
    });
    if (!res.ok) return;
    await fetchHabits();
    setPendingHabitId(null);
    setActiveView('timer');
  }

  async function handleStop() {
    const res = await fetch('/api/timer/stop', { method: 'POST' });
    if (!res.ok) return;
    await fetchHabits();
    setActiveView('list');
  }

  async function handleDelete(habitId: number) {
    const res = await fetch(`/api/habits/${habitId}`, { method: 'DELETE' });
    if (!res.ok) return;
    fetchHabits();
  }

  async function handleAdd(name: string) {
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    fetchHabits();
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    onLogout();
  }

  const activeHabit = habits.find(h => h.activeTimer);

  // Start timer modal
  const pendingHabit = habits.find(h => h.id === pendingHabitId);
  if (pendingHabitId && pendingHabit) {
    return (
      <StartTimerModal
        habitName={pendingHabit.name}
        onStart={handleStartConfirm}
        onCancel={() => setPendingHabitId(null)}
      />
    );
  }

  // Timer view
  if (activeView === 'timer' && activeHabit) {
    return (
      <TimerView
        habitName={activeHabit.name}
        startTime={activeHabit.activeTimer!.startTime}
        targetDurationSeconds={activeHabit.activeTimer!.targetDurationSeconds}
        todaySeconds={activeHabit.todaySeconds}
        streak={activeHabit.streak}
        onStop={handleStop}
        onBack={() => setActiveView('list')}
      />
    );
  }

  // Dashboard list view
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 pb-[env(safe-area-inset-bottom)]">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">10,000 Hours</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>Log out</Button>
        </header>

        {/* Tab bar */}
        <div className="flex mb-4 rounded-lg bg-muted p-1">
          <button
            onClick={() => setActiveView('list')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeView === 'list' || activeView === 'timer'
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            Skills
          </button>
          <button
            onClick={() => setActiveView('sessions')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeView === 'sessions' ? 'bg-background shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Sessions
          </button>
        </div>

        {activeView === 'sessions' ? (
          <SessionsView habits={habits.map(h => ({ id: h.id, name: h.name }))} />
        ) : (
          <>
            {loading ? (
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : habits.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Start by adding your first habit</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {activeHabit && (
                  <div onClick={() => setActiveView('timer')} className="cursor-pointer">
                    <HabitCard key={activeHabit.id} habit={activeHabit} onStart={handleStartClick} onDelete={handleDelete} />
                  </div>
                )}
                {habits.filter(h => !h.activeTimer).map((habit) => (
                  <HabitCard key={habit.id} habit={habit} onStart={handleStartClick} onDelete={handleDelete} />
                ))}
              </div>
            )}

            <AddHabitForm onAdd={handleAdd} />
          </>
        )}
      </div>
    </div>
  );
}
