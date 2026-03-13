"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEffect, useState } from "react";
import { formatTime, formatElapsed, formatRemaining } from "@/lib/format";
import { useHaptics } from "@/hooks/use-haptics";
import type { Habit } from "@/lib/types";

export function HabitCard({
  habit,
  onStart,
  onDelete,
  onLog,
}: {
  habit: Habit;
  onStart: (habitId: number) => void;
  onDelete: (habitId: number) => void;
  onLog: (habitId: number) => void;
}) {
  const [elapsed, setElapsed] = useState("");
  const { trigger } = useHaptics();

  const activeStartTime = habit.activeTimer?.startTime;

  useEffect(() => {
    if (!activeStartTime) return;
    const targetDuration = habit.activeTimer?.targetDurationSeconds ?? null;
    const update = () => {
      setElapsed(
        targetDuration !== null
          ? formatRemaining(activeStartTime, targetDuration)
          : formatElapsed(activeStartTime),
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeStartTime, habit.activeTimer?.targetDurationSeconds]);

  const isActive = !!habit.activeTimer;

  return (
    <Card
      className={`transition-all ${isActive ? "ring-2 ring-primary animate-pulse-subtle" : ""}`}
    >
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">{habit.name}</h3>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-muted-foreground text-sm hover:text-destructive">
                Delete
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete &quot;{habit.name}&quot;?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the habit and all its time data. This cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    trigger("error");
                    onDelete(habit.id);
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {isActive && (
          <p className="text-2xl font-mono text-primary">{elapsed}</p>
        )}
        <div className="text-sm text-muted-foreground">
          <div>Today: {formatTime(habit.todaySeconds)}</div>
          <div>Lifetime: {formatTime(habit.totalSeconds)}</div>
          <div>{habit.streak > 0 ? `🔥 ${habit.streak} day streak` : "No streak"}</div>
        </div>
        {!isActive && (
          <div className="flex gap-2 mt-1">
            <Button
              onClick={() => {
                trigger("medium");
                onStart(habit.id);
              }}
              className="flex-1"
            >
              Start
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                trigger("light");
                onLog(habit.id);
              }}
              className="flex-1"
            >
              Log
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
