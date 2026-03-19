"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLogSession } from "@/hooks/use-sessions";
import { ApiError } from "@/lib/api";
import { useHaptics } from "@/hooks/use-haptics";

type Props = {
  habitId: number;
  habitName: string;
  onSave: () => void;
  onCancel: () => void;
};

export function getDateOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Yesterday"
          : d.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
    options.push({ label, value });
  }
  return options;
}

export function LogSessionModal({
  habitId,
  habitName,
  onSave,
  onCancel,
}: Props) {
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState("");

  const logSession = useLogSession();
  const { trigger } = useHaptics();

  const durationMinutes = Number(minutes);
  const isValid = minutes !== "" && durationMinutes > 0;

  function handleSave() {
    if (!isValid) return;
    setError("");
    logSession.mutate(
      { habitId, date, durationMinutes },
      {
        onSuccess: () => {
          trigger("success");
          onSave();
        },
        onError: (err) => {
          trigger("error");
          setError(
            err instanceof ApiError ? err.message : "Failed to save session",
          );
        },
      },
    );
  }

  const dateOptions = getDateOptions();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-background rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-1">Log Session</h2>
        <p className="text-muted-foreground text-sm mb-4 truncate">{habitName}</p>
        <p className="text-muted-foreground text-xs mb-4">
          Sessions can only be logged up to 7 days back.
        </p>

        <label htmlFor="log-date" className="block text-sm font-medium mb-1">
          Date
        </label>
        <select
          id="log-date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-background mb-4"
        >
          {dateOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label
          htmlFor="log-duration"
          className="block text-sm font-medium mb-1"
        >
          Duration (minutes)
        </label>
        <input
          id="log-duration"
          type="number"
          min="1"
          placeholder="e.g. 45"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-background mb-6"
        />

        {error && <p className="text-destructive text-sm mb-2">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!isValid || logSession.isPending}
            onClick={handleSave}
          >
            {logSession.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
