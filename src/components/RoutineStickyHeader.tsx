"use client";

import { Button } from "@/components/ui/button";
import { Clock, Layers } from "lucide-react";

type RoutineStickyHeaderProps = {
  totalMinutes: number;
  habitCount: number;
  onDiscard: () => void;
  onSave: () => void;
  isSaving: boolean;
  canSave: boolean;
};

export function RoutineStickyHeader({
  totalMinutes,
  habitCount,
  onDiscard,
  onSave,
  isSaving,
  canSave,
}: RoutineStickyHeaderProps) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 -mx-4 md:-mx-6">
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={!canSave || isSaving}>
            {isSaving ? "Saving..." : "Save Routine"}
          </Button>
        </div>
      </div>
    </div>
  );
}
