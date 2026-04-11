"use client";

import { useEffect } from "react";
import { useRoutineBuilderStore } from "@/stores/routine-builder-store";
import { RoutineBuilder } from "@/components/RoutineBuilder";
import type { Routine, Habit } from "@/lib/types";

type Props = (
  | { mode: "create"; routine?: never }
  | { mode: "edit"; routine: Routine }
) & { initialHabits?: Habit[] };

export function RoutineBuilderPage({ mode, routine, initialHabits }: Props) {
  const { initEmpty, initFromRoutine } = useRoutineBuilderStore();

  useEffect(() => {
    if (mode === "create") {
      initEmpty();
    } else {
      initFromRoutine(routine);
    }
  }, [mode, routine, initEmpty, initFromRoutine]);

  return <RoutineBuilder mode={mode} initialHabits={initialHabits} />;
}
