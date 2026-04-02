"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { HabitCard } from "@/components/HabitCard";
import { AddHabitForm } from "@/components/AddHabitForm";
import { StartTimerModal } from "@/components/StartTimerModal";
import { LogSessionModal } from "@/components/LogSessionModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useHabits,
  useAddHabit,
  useDeleteHabit,
  useStartTimer,
} from "@/hooks/use-habits";
import type { Habit } from "@/lib/types";

export function Dashboard({ initialHabits }: { initialHabits: Habit[] }) {
  const { data: habits } = useHabits(initialHabits);
  const [pendingHabitId, setPendingHabitId] = useState<number | null>(null);
  const [switchConfirmHabitId, setSwitchConfirmHabitId] = useState<number | null>(null);
  const [loggingHabitId, setLoggingHabitId] = useState<number | null>(null);
  const router = useRouter();

  const addHabit = useAddHabit();
  const deleteHabit = useDeleteHabit();
  const startTimer = useStartTimer();

  function handleStartClick(habitId: number) {
    const activeHabit = habits.find((h) => h.activeTimer);
    if (activeHabit && activeHabit.id !== habitId) {
      setSwitchConfirmHabitId(habitId);
      return;
    }
    setPendingHabitId(habitId);
  }

  function handleStartConfirm(targetDurationSeconds?: number) {
    if (pendingHabitId === null) return;
    startTimer.mutate(
      { habitId: pendingHabitId, targetDurationSeconds },
      {
        onSuccess: () => {
          router.push("/timer");
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

  const activeHabit = habits.find((h) => h.activeTimer);
  const pendingHabit = habits.find((h) => h.id === pendingHabitId);
  const switchConfirmHabit = habits.find((h) => h.id === switchConfirmHabitId);
  const loggingHabit = habits.find((h) => h.id === loggingHabitId);

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
      <AlertDialog
        open={!!switchConfirmHabit}
        onOpenChange={(open) => {
          if (!open) setSwitchConfirmHabitId(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Switch timer?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              Your <span className="font-semibold">{activeHabit?.name}</span> session is still running. Starting{" "}
              <span className="font-semibold">{switchConfirmHabit?.name}</span> will end that session and save your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={() => {
                if (switchConfirmHabitId !== null) {
                  setPendingHabitId(switchConfirmHabitId);
                  setSwitchConfirmHabitId(null);
                }
              }}
            >
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          <p className="text-muted-foreground mb-4">
            Start by adding your first habit
          </p>
        </div>
      ) : (
        <div className="mb-6">
          {activeHabit && (
            <div
              onClick={() => router.push("/timer")}
              className="cursor-pointer mb-3"
              data-testid="active-habit-card"
            >
              <HabitCard
                key={activeHabit.id}
                habit={activeHabit}
                onStart={handleStartClick}
                onDelete={handleDelete}
                onLog={handleLogClick}
              />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AnimatePresence initial={false}>
              {habits
                .filter((h) => !h.activeTimer)
                .map((habit) => (
                  <motion.div
                    key={habit.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <HabitCard
                      habit={habit}
                      onStart={handleStartClick}
                      onDelete={handleDelete}
                      onLog={handleLogClick}
                    />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </>
  );
}
