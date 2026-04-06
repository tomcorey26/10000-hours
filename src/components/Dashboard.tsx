"use client";

import { useState, useEffect } from "react";
import { useHaptics } from "@/hooks/use-haptics";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { HabitCard } from "@/components/HabitCard";
import { AddHabitForm } from "@/components/AddHabitForm";
import { StartTimerModal } from "@/components/StartTimerModal";
import { TimerView } from "@/components/TimerView";
import { EmojiBubbles } from "@/components/EmojiBubbles";
import { LogSessionModal } from "@/components/LogSessionModal";
import { PressableButton } from "@/components/ui/pressable-button";
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
  useStopTimer,
} from "@/hooks/use-habits";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useTimerStore } from "@/stores/timer-store";
import { formatTime } from "@/lib/format";
import { getRandomCongratsMessage } from "@/lib/congrats-messages";
import type { Habit } from "@/lib/types";

function playFanfare() {
  try {
    const audio = new Audio("/fanfare.mp3");
    audio.play().catch(() => {});
  } catch {}
}

function SuccessScreen({ durationSeconds }: { durationSeconds: number }) {
  const { trigger } = useHaptics();
  const dismissSuccess = useTimerStore((s) => s.dismissSuccess);
  const [message] = useState(() => getRandomCongratsMessage());

  useEffect(() => {
    playFanfare();
    trigger("buzz");
    if (
      document.hidden &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("🎉 Session Complete", {
          body: `Your ${formatTime(durationSeconds)} session was recorded`,
        });
      } catch {}
    }
  }, []);

  return (
    <div className="relative flex-1 flex flex-col">
      <EmojiBubbles />
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-slam-down relative z-10">
        <p className="text-6xl mb-6">&#127942;</p>
        <h1 className="text-2xl font-bold mb-3">Session Complete!</h1>
        <p className="text-lg text-muted-foreground mb-6 max-w-xs">
          {message}
        </p>
        <p className="text-4xl font-mono font-light tracking-tight mb-10">
          {formatTime(durationSeconds)}
        </p>
        <PressableButton
          size="lg"
          onClick={() => {
            trigger("light");
            dismissSuccess();
          }}
          className="px-12 py-6 text-lg"
        >
          Back to Habits
        </PressableButton>
      </div>
    </div>
  );
}

export function Dashboard({ initialHabits }: { initialHabits: Habit[] }) {
  const { data: habits } = useHabits(initialHabits);
  const { data: flags } = useFeatureFlags();
  const { trigger } = useHaptics();
  const [switchConfirmHabitId, setSwitchConfirmHabitId] = useState<
    number | null
  >(null);
  const [loggingHabitId, setLoggingHabitId] = useState<number | null>(null);

  const addHabit = useAddHabit();
  const deleteHabit = useDeleteHabit();
  const startTimerApi = useStartTimer();
  const stopTimerApi = useStopTimer();

  const view = useTimerStore((s) => s.view);
  const activeTimer = useTimerStore((s) => s.activeTimer);
  const openConfig = useTimerStore((s) => s.openConfig);
  const closeConfig = useTimerStore((s) => s.closeConfig);
  const startTimer = useTimerStore((s) => s.startTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);

  function handleStartClick(habitId: number) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    if (activeTimer && activeTimer.habitId !== habitId) {
      setSwitchConfirmHabitId(habitId);
      return;
    }
    openConfig(habitId, habit.name);
  }

  function handleStartConfirm(targetDurationSeconds?: number) {
    if (view.type !== "timer_config") return;
    const { habitId, habitName } = view;

    trigger("medium");
    startTimer({ habitId, habitName, targetDurationSeconds });

    const storeStartTime = useTimerStore.getState().activeTimer!.startTime;
    startTimerApi.mutate(
      {
        habitId,
        targetDurationSeconds,
        startTime: storeStartTime,
      },
      {
        onError: () => {
          useTimerStore.setState({
            activeTimer: null,
            view: { type: "habits_list" },
          });
          toast.error("Failed to start timer");
        },
      },
    );
  }

  function handleStop() {
    trigger("buzz");
    stopTimerApi.mutate(undefined, {
      onSuccess: (data) => {
        stopTimer(data.durationSeconds);
      },
      onError: () => {
        toast.error("Failed to stop timer");
      },
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

  const switchConfirmHabit = habits.find((h) => h.id === switchConfirmHabitId);
  const loggingHabit = habits.find((h) => h.id === loggingHabitId);

  // ── Timer Config View ──
  if (view.type === "timer_config") {
    return (
      <StartTimerModal
        habitName={view.habitName}
        onStart={handleStartConfirm}
        onCancel={closeConfig}
      />
    );
  }

  // ── Active Timer View ──
  if (view.type === "active_timer" && activeTimer) {
    const habit = habits.find((h) => h.id === activeTimer.habitId);
    return (
      <TimerView
        habitName={activeTimer.habitName}
        startTime={activeTimer.startTime}
        targetDurationSeconds={activeTimer.targetDurationSeconds}
        todaySeconds={habit?.todaySeconds ?? 0}
        streak={habit?.streak ?? 0}
        onStop={handleStop}
        onBack={() =>
          useTimerStore.setState({
            activeTimer: null,
            view: { type: "habits_list" },
          })
        }
      />
    );
  }

  // ── Success View ──
  if (view.type === "success") {
    return <SuccessScreen durationSeconds={view.durationSeconds} />;
  }

  // ── Habits List View (default) ──
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
              Your{" "}
              <span className="font-semibold">{activeTimer?.habitName}</span>{" "}
              session is still running. Starting{" "}
              <span className="font-semibold">{switchConfirmHabit?.name}</span>{" "}
              will end that session and save your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={() => {
                if (switchConfirmHabitId !== null) {
                  const habit = habits.find(
                    (h) => h.id === switchConfirmHabitId,
                  );
                  if (habit) {
                    openConfig(switchConfirmHabitId, habit.name);
                  }
                  setSwitchConfirmHabitId(null);
                }
              }}
            >
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {flags?.logSession && loggingHabit && (
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence initial={false}>
              {habits.map((habit) => (
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
                    onLog={flags?.logSession ? handleLogClick : undefined}
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
