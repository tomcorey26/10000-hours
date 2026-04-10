"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, X } from "lucide-react";
import type { Habit } from "@/lib/types";

type HabitPickerProps = {
  habits: Habit[];
  onSelectHabit: (habit: { id: number; name: string }) => void;
  onClose: () => void;
  onCreateHabit: (name: string) => Promise<void>;
};

export function HabitPicker({
  habits,
  onSelectHabit,
  onClose,
  onCreateHabit,
}: HabitPickerProps) {
  const [search, setSearch] = useState("");
  const [newHabitName, setNewHabitName] = useState("");
  const [creating, setCreating] = useState(false);

  const sorted = [...habits].sort((a, b) => a.name.localeCompare(b.name));
  const filtered = sorted.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreateHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    setCreating(true);
    await onCreateHabit(newHabitName.trim());
    setNewHabitName("");
    setCreating(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Select Habit</h3>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search habits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <form onSubmit={handleCreateHabit} className="px-4 pb-3 flex gap-2">
        <Input
          placeholder="Create new habit..."
          value={newHabitName}
          onChange={(e) => setNewHabitName(e.target.value)}
          className="h-8 text-sm flex-1"
          maxLength={30}
        />
        <Button type="submit" size="sm" disabled={creating || !newHabitName.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>

      <div className="flex-1 overflow-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            {habits.length === 0
              ? "No habits yet. Create one above."
              : "No habits match your search."}
          </p>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((habit) => (
              <button
                key={habit.id}
                onClick={() => onSelectHabit({ id: habit.id, name: habit.name })}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                aria-label={habit.name}
              >
                {habit.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
