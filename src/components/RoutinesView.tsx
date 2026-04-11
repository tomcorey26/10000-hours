"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
import { useRoutines, useDeleteRoutine } from "@/hooks/use-routines";
import { useHaptics } from "@/hooks/use-haptics";
import type { Routine } from "@/lib/types";

const ROW_COLORS = [
  "bg-primary/20",
  "bg-primary/30",
  "bg-primary/10",
  "bg-primary/15",
  "bg-primary/25",
];

function RoutineCard({ routine }: { routine: Routine }) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteRoutine = useDeleteRoutine();
  const { trigger } = useHaptics();

  const totalSeconds = routine.blocks.reduce(
    (acc, block) =>
      acc +
      block.sets.reduce(
        (s, set) => s + set.durationSeconds + set.breakSeconds,
        0,
      ),
    0,
  );
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  async function handleDelete() {
    try {
      await deleteRoutine.mutateAsync(routine.id);
      trigger("success");
      toast.success("Routine deleted");
    } catch {
      toast.error("Failed to delete routine");
    }
  }

  return (
    <>
      <Link href={`/routines/${routine.id}`} className="block">
        <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer relative group">
          {/* Action icons */}
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit routine"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/routines/${routine.id}/edit`);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete routine"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

        <p className="text-sm font-semibold text-foreground mb-4">
          {routine.name}
        </p>
        <div className="space-y-3">
          {routine.blocks.map((block, i) => (
            <div
              key={block.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${ROW_COLORS[i % ROW_COLORS.length]}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/40 flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {block.habitName}
                </span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {block.sets.length} {block.sets.length === 1 ? "set" : "sets"}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            {timeDisplay}
          </span>
        </div>
      </Card>
      </Link>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete routine?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{routine.name}&rdquo;. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function RoutinesView({
  initialRoutines,
}: {
  initialRoutines?: Routine[];
}) {
  const { data: routines } = useRoutines(initialRoutines);

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader title="Routines" />
        <Link href="/routines/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Routine
          </Button>
        </Link>
      </div>
      {routines.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No routines yet. Create your first practice routine.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {routines.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} />
          ))}
        </div>
      )}
    </div>
  );
}
