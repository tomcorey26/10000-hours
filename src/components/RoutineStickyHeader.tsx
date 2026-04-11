"use client";

import Link from "next/link";
import { ArrowLeft, Clock, Layers, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type RoutineStickyHeaderProps = {
  totalMinutes: number;
  habitCount: number;
  onDiscard: () => void;
  onSave: () => void;
  onDelete?: () => void;
  isSaving: boolean;
  canSave: boolean;
  isDirty: boolean;
  mode: "create" | "edit";
};

export function RoutineStickyHeader({
  totalMinutes,
  habitCount,
  onDiscard,
  onSave,
  onDelete,
  isSaving,
  canSave,
  isDirty,
  mode,
}: RoutineStickyHeaderProps) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="sticky -top-0.5 md:-top-6 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 py-3 -mx-4 md:-mx-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/routines"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Routines
          </Link>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {timeDisplay}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {habitCount} {habitCount === 1 ? "habit" : "habits"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" && onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {isDirty && (
            <Button variant="outline" size="sm" onClick={onDiscard}>
              Discard changes
            </Button>
          )}
          <Button size="sm" onClick={onSave} disabled={!canSave || isSaving}>
            {isSaving ? "Saving..." : "Save Routine"}
          </Button>
        </div>
      </div>
    </div>
  );
}
