"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { RoutineStickyHeader } from "@/components/RoutineStickyHeader";
import { RoutineBlockCard } from "@/components/RoutineBlockCard";
import { HabitPicker } from "@/components/HabitPicker";
import { HabitBlockConfigForm } from "@/components/HabitBlockConfigForm";
import { useRoutineBuilderStore } from "@/stores/routine-builder-store";
import { useHabits, useAddHabit } from "@/hooks/use-habits";
import { useCreateRoutine, useUpdateRoutine } from "@/hooks/use-routines";
import { useHaptics } from "@/hooks/use-haptics";

type PickerView =
  | { type: "closed" }
  | { type: "list" }
  | { type: "config"; habitId: number; habitName: string };

type RoutineBuilderProps = {
  mode: "create" | "edit";
  initialHabits?: import("@/lib/types").Habit[];
};

export function RoutineBuilder({ mode, initialHabits }: RoutineBuilderProps) {
  const router = useRouter();
  const { trigger } = useHaptics();
  const { data: habits } = useHabits(initialHabits);
  const addHabit = useAddHabit();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();

  const {
    routineId,
    name,
    blocks,
    isDirty,
    setName,
    addBlock,
    removeBlock,
    updateBlockNotes,
    addSet,
    removeSet,
    updateSetDuration,
    updateSetBreak,
    toPayload,
  } = useRoutineBuilderStore();

  const [pickerView, setPickerView] = useState<PickerView>({ type: "closed" });
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const isSaving = createRoutine.isPending || updateRoutine.isPending;
  const canSave = name.trim().length > 0 && blocks.length > 0;

  let totalSeconds = 0;
  for (const block of blocks) {
    for (const s of block.sets) {
      totalSeconds += s.durationSeconds + s.breakSeconds;
    }
  }
  const totalMinutes = Math.round(totalSeconds / 60);

  // beforeunload handler
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function handleDiscard() {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      router.push("/routines");
    }
  }

  function handleConfirmDiscard() {
    setShowDiscardDialog(false);
    router.push("/routines");
  }

  async function handleSave() {
    if (!canSave) return;
    try {
      const payload = toPayload();
      if (mode === "create") {
        await createRoutine.mutateAsync(payload);
        toast.success("Routine created");
      } else {
        await updateRoutine.mutateAsync({ id: routineId!, ...payload });
        toast.success("Routine updated");
      }
      trigger("success");
      router.push("/routines");
    } catch {
      toast.error("Failed to save routine");
    }
  }

  function handleSelectHabit(habit: { id: number; name: string }) {
    setPickerView({ type: "config", habitId: habit.id, habitName: habit.name });
  }

  function handleAddBlock(config: {
    sets: number;
    durationMinutes: number;
    breakMinutes: number;
    notes: string | null;
  }) {
    if (pickerView.type !== "config") return;
    addBlock({
      habitId: pickerView.habitId,
      habitName: pickerView.habitName,
      notes: config.notes,
      sets: Array.from({ length: config.sets }, () => ({
        durationSeconds: config.durationMinutes * 60,
        breakSeconds: config.breakMinutes * 60,
      })),
    });
    trigger("success");
    setPickerView({ type: "closed" });
  }

  async function handleCreateHabit(habitName: string) {
    await addHabit.mutateAsync(habitName);
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <RoutineStickyHeader
        totalMinutes={totalMinutes}
        habitCount={blocks.length}
        onDiscard={handleDiscard}
        onSave={handleSave}
        isSaving={isSaving}
        canSave={canSave}
      />

      <div className="flex-1 py-4 space-y-4">
        {/* Routine name */}
        <Input
          placeholder="Untitled Routine"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="text-lg font-semibold h-12 border-none shadow-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground/50"
        />

        {/* Habit blocks */}
        <AnimatePresence initial={false}>
          {blocks.map((block) => (
            <motion.div
              key={block.clientId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <RoutineBlockCard
                block={block}
                mode="editable"
                onRemoveBlock={removeBlock}
                onAddSet={addSet}
                onRemoveSet={removeSet}
                onUpdateDuration={updateSetDuration}
                onUpdateBreak={updateSetBreak}
                onUpdateNotes={updateBlockNotes}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add habits button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setPickerView({ type: "list" })}
          disabled={blocks.length >= 20}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Habits
        </Button>
      </div>

      {/* Habit picker modal */}
      {pickerView.type !== "closed" && (
        <div className="fixed inset-0 z-50 bg-background">
          {pickerView.type === "list" ? (
            <HabitPicker
              habits={habits}
              onSelectHabit={handleSelectHabit}
              onClose={() => setPickerView({ type: "closed" })}
              onCreateHabit={handleCreateHabit}
            />
          ) : (
            <HabitBlockConfigForm
              habitName={pickerView.habitName}
              onAdd={handleAddBlock}
              onBack={() => setPickerView({ type: "list" })}
            />
          )}
        </div>
      )}

      {/* Discard confirmation */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDiscard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
