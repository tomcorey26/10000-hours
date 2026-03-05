'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HabitCard } from '@/components/HabitCard';
import { AddHabitForm } from '@/components/AddHabitForm';
import { StartTimerModal } from '@/components/StartTimerModal';
import { LogSessionModal } from '@/components/LogSessionModal';
import { useHabits, useAddHabit, useDeleteHabit, useStartTimer } from '@/hooks/use-habits';
import type { Habit } from '@/lib/types';

export function Dashboard({ initialHabits }: { initialHabits: Habit[] }) {
  const { data: habits } = useHabits(initialHabits);
  const [pendingHabitId, setPendingHabitId] = useState<number | null>(null);
  const [loggingHabitId, setLoggingHabitId] = useState<number | null>(null);
  const router = useRouter();

  const addHabit = useAddHabit();
  const deleteHabit = useDeleteHabit();
  const startTimer = useStartTimer();

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
          router.push('/timer');
        },
      },
    );
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

  const activeHabit = habits.find(h => h.activeTimer);
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

  return (
    <>
      {loggingHabit && (
        <LogSessionModal
          habitId={loggingHabit.id}
          habitName={loggingHabit.name}
          onSave={handleLogSave}
          onCancel={() => setLoggingHabitId(null)}
        />
      )}

      <div className="mb-3">
        <AddHabitForm onAdd={handleAdd} />
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Start by adding your first habit</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {activeHabit && (
            <div onClick={() => router.push('/timer')} className="cursor-pointer">
              <HabitCard key={activeHabit.id} habit={activeHabit} onStart={handleStartClick} onDelete={handleDelete} onLog={handleLogClick} />
            </div>
          )}
          {habits.filter(h => !h.activeTimer).map((habit) => (
            <HabitCard key={habit.id} habit={habit} onStart={handleStartClick} onDelete={handleDelete} onLog={handleLogClick} />
          ))}
        </div>
      )}
    </>
  );
}
