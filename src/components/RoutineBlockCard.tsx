"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pause, NotebookPen, Plus } from "lucide-react";
import type { BuilderBlock } from "@/stores/routine-builder-store";

type ReadonlyProps = {
  block: BuilderBlock;
  mode: "readonly";
};

type EditableProps = {
  block: BuilderBlock;
  mode: "editable";
  onRemoveBlock: (clientId: string) => void;
  onAddSet: (clientId: string) => void;
  onRemoveSet: (clientId: string, setIndex: number) => void;
  onUpdateDuration: (clientId: string, setIndex: number, durationSeconds: number) => void;
  onUpdateBreak: (clientId: string, setIndex: number, breakSeconds: number) => void;
  onUpdateNotes: (clientId: string, notes: string) => void;
};

type Props = ReadonlyProps | EditableProps;

function formatMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

export function RoutineBlockCard(props: Props) {
  const { block, mode } = props;
  const isEditable = mode === "editable";
  const maxSets = block.sets.length >= 10;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-foreground">{block.habitName}</h3>
        {isEditable && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => (props as EditableProps).onRemoveBlock(block.clientId)}
            aria-label="Delete block"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Notes banner (readonly) */}
      {block.notes && !isEditable && (
        <div className="mx-4 mb-2 rounded-lg bg-primary/10 px-3 py-2 flex items-center gap-2">
          <NotebookPen className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs text-foreground">{block.notes}</span>
        </div>
      )}

      {/* Notes input (editable) */}
      {isEditable && (
        <div className="mx-4 mb-2">
          <Input
            placeholder="Add notes..."
            value={block.notes ?? ""}
            onChange={(e) => (props as EditableProps).onUpdateNotes(block.clientId, e.target.value)}
            className="text-xs h-8 bg-primary/5"
          />
        </div>
      )}

      {/* Set rows */}
      <div className="px-4 pb-2">
        {/* Column headers */}
        <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-1 px-1">
          <span>Set</span>
          <span>Duration</span>
          <span>Break</span>
          <span />
        </div>

        {block.sets.map((s, i) => (
          <div key={i}>
            {/* Set row */}
            <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center py-1.5 px-1">
              <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>
              {isEditable ? (
                <>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={Math.round(s.durationSeconds / 60)}
                    onChange={(e) => {
                      const mins = Number(e.target.value);
                      if (mins >= 1 && mins <= 120) {
                        (props as EditableProps).onUpdateDuration(block.clientId, i, mins * 60);
                      }
                    }}
                    className="h-7 text-xs"
                    aria-label={`Set ${i + 1} duration`}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={Math.round(s.breakSeconds / 60)}
                    onChange={(e) => {
                      const mins = Number(e.target.value);
                      if (mins >= 0 && mins <= 60) {
                        (props as EditableProps).onUpdateBreak(block.clientId, i, mins * 60);
                      }
                    }}
                    className="h-7 text-xs"
                    aria-label={`Set ${i + 1} break`}
                  />
                  {block.sets.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => (props as EditableProps).onRemoveSet(block.clientId, i)}
                      aria-label={`Remove set ${i + 1}`}
                      className="h-6 w-6"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : (
                    <span />
                  )}
                </>
              ) : (
                <>
                  <span className="text-sm text-foreground">{formatMinutes(s.durationSeconds)}</span>
                  {s.breakSeconds > 0 ? (
                    <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                      <Pause className="h-3 w-3" />
                      {formatMinutes(s.breakSeconds)} break
                    </span>
                  ) : (
                    <span />
                  )}
                  <span />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add set button */}
      {isEditable && (
        <button
          onClick={() => (props as EditableProps).onAddSet(block.clientId)}
          disabled={maxSets}
          className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3 w-3 inline mr-1" />
          Add a Set
        </button>
      )}
    </Card>
  );
}
