"use client";

import { useRef } from "react";
import { useRoutineBuilderStore } from "@/stores/routine-builder-store";
import { RoutineBuilder } from "@/components/RoutineBuilder";
import type { Routine, Habit } from "@/lib/types";

type Props = (
  | { mode: "create"; routine?: never }
  | { mode: "edit"; routine: Routine }
) & { initialHabits?: Habit[] };

export function RoutineBuilderPage({ mode, routine, initialHabits }: Props) {
  const initialized = useRef(false);

  if (!initialized.current) {
    if (mode === "create") {
      useRoutineBuilderStore.getState().initEmpty();
    } else {
      useRoutineBuilderStore.getState().initFromRoutine(routine);
    }
    initialized.current = true;
  }

  return <RoutineBuilder mode={mode} initialHabits={initialHabits} />;
}
