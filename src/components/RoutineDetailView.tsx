"use client";

import Link from "next/link";
import { ArrowLeft, Clock, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoutineBlockCard } from "@/components/RoutineBlockCard";
import { useRoutine } from "@/hooks/use-routines";
import type { Routine } from "@/lib/types";

export function RoutineDetailView({
  routineId,
  initialRoutine,
}: {
  routineId: number;
  initialRoutine?: Routine;
}) {
  const { data: routine } = useRoutine(routineId, initialRoutine);

  const totalSeconds = routine.blocks.reduce(
    (acc, block) =>
      acc + block.sets.reduce((s, set) => s + set.durationSeconds + set.breakSeconds, 0),
    0
  );
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="py-4">
      <Link href="/routines" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Routines
      </Link>

      <h2 className="text-lg font-semibold mb-2">{routine.name}</h2>
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-6">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {timeDisplay}
        </span>
        <span className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          {routine.blocks.length} {routine.blocks.length === 1 ? "habit" : "habits"}
        </span>
      </div>

      <div className="space-y-3">
        {routine.blocks.map((block) => (
          <RoutineBlockCard
            key={block.id}
            block={{ clientId: String(block.id), ...block }}
            mode="readonly"
          />
        ))}
      </div>

      {routine.blocks.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          This routine has no habits. Edit it to add some.
        </p>
      )}

      <div className="mt-6">
        <Button className="w-full" disabled>
          Start Routine (Coming Soon)
        </Button>
      </div>
    </div>
  );
}
