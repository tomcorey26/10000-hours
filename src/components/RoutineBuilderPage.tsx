"use client";

import { useState } from "react";
import { useRoutineBuilderStore } from "@/stores/routine-builder-store";
import { RoutineBuilder } from "@/components/RoutineBuilder";
import type { Routine, Habit } from "@/lib/types";

type Props = (
  | { mode: "create"; routine?: never }
  | { mode: "edit"; routine: Routine }
) & { initialHabits?: Habit[] };

export function RoutineBuilderPage({ mode, routine, initialHabits }: Props) {
  const [ready] = useState(() => {
    if (mode === "create") {
      useRoutineBuilderStore.getState().initEmpty();
    } else {
      useRoutineBuilderStore.getState().initFromRoutine(routine);
    }
    return true;
  });

  if (!ready) return null;

  return <RoutineBuilder mode={mode} initialHabits={initialHabits} />;
}
