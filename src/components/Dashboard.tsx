'use client';

import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HabitCard } from '@/components/HabitCard';
import { AddHabitForm } from '@/components/AddHabitForm';
import { TimerView } from '@/components/TimerView';
import { StartTimerModal } from '@/components/StartTimerModal';
import { SessionsView } from '@/components/SessionsView';
import { RankingsView } from '@/components/RankingsView';
import { LogSessionModal } from '@/components/LogSessionModal';
import { Spinner } from '@/components/Spinner';
import { useHabits, useAddHabit, useDeleteHabit, useStartTimer, useStopTimer } from '@/hooks/use-habits';
import { useLogout } from '@/hooks/use-auth';

export function Dashboard({ user }: { user: { id: number; email: string } }) {
  const { data: habits } = useHabits();
  const [activeView, setActiveView] = useState<'list' | 'timer' | 'sessions' | 'rankings'>('list');
  const [pendingHabitId, setPendingHabitId] = useState<number | null>(null);
  const [loggingHabitId, setLoggingHabitId] = useState<number | null>(null);

  const addHabit = useAddHabit();
  const deleteHabit = useDeleteHabit();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const logout = useLogout();

  function handleStartClick(habitId: number) {
    setPendingHabitId(habitId);
  }

  function handleStartConfirm(targetDurationSeconds?: number) {
    if (pendingHabitId === null) return;
    startTimer.mutate(
      { habitId: pendingHabitId, targetDurationSeconds },
      {
        onSuccess: () => {
          setPendingHabitId(null);
          setActiveView('timer');
        },
      },
    );
  }

  function handleStop() {
    stopTimer.mutate(undefined, {
      onSuccess: () => setActiveView('list'),
    });
  }

  function handleDelete(habitId: number) {
    deleteHabit.mutate(habitId);
  }

  async function handleAdd(name: string) {
    await addHabit.mutateAsync(name);
  }

  function handleLogClick(habitId: number) {
    setLoggingHabitId(habitId);
  }

  function handleLogSave() {
    setLoggingHabitId(null);
  }

  function handleLogout() {
    logout.mutate();
  }

  const activeHabit = habits.find(h => h.activeTimer);

  // Start timer modal
  const pendingHabit = habits.find(h => h.id === pendingHabitId);
  const loggingHabit = habits.find(h => h.id === loggingHabitId);
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
          <button
            onClick={() => setActiveView('rankings')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeView === 'rankings' ? 'bg-background shadow-sm' : 'text-muted-foreground'
            }`}
          >
            Rankings
          </button>
        </div>

        {loggingHabit && (
          <LogSessionModal
            habitId={loggingHabit.id}
            habitName={loggingHabit.name}
            onSave={handleLogSave}
            onCancel={() => setLoggingHabitId(null)}
          />
        )}

        {activeView === 'rankings' ? (
          <Suspense fallback={<Spinner />}>
            <RankingsView />
          </Suspense>
        ) : activeView === 'sessions' ? (
          <Suspense fallback={<Spinner />}>
            <SessionsView habits={habits.map(h => ({ id: h.id, name: h.name }))} />
          </Suspense>
        ) : (
          <>
            {habits.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Start by adding your first habit</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {activeHabit && (
                  <div onClick={() => setActiveView('timer')} className="cursor-pointer">
                    <HabitCard key={activeHabit.id} habit={activeHabit} onStart={handleStartClick} onDelete={handleDelete} onLog={handleLogClick} />
                  </div>
                )}
                {habits.filter(h => !h.activeTimer).map((habit) => (
                  <HabitCard key={habit.id} habit={habit} onStart={handleStartClick} onDelete={handleDelete} onLog={handleLogClick} />
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
