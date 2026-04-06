# Timer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate timer client/server desync by replacing the `/timer` route with zustand-driven inline views on `/habits` and a persistent mini-timer bar.

**Architecture:** Zustand store owns runtime timer state (set client-side at click time). DB remains persistence layer. Habits page renders a view state machine (habits_list → timer_config → active_timer → success). Mini-timer bar in app layout shows on non-habits pages.

**Tech Stack:** Zustand, React Query (existing), Vitest (existing), Next.js App Router (existing)

---

### Task 1: Install Zustand

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install zustand**

Run: `npm install zustand`

- [ ] **Step 2: Verify install**

Run: `npm ls zustand`
Expected: `zustand@5.x.x` (or latest)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zustand dependency"
```

---

### Task 2: Create Timer Store

**Files:**
- Create: `src/stores/timer-store.ts`
- Test: `src/stores/timer-store.test.ts`

- [ ] **Step 1: Write failing tests for the timer store**

```typescript
// src/stores/timer-store.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTimerStore } from "./timer-store";

beforeEach(() => {
  useTimerStore.setState({
    activeTimer: null,
    view: { type: "habits_list" },
  });
});

describe("timer store", () => {
  describe("openConfig", () => {
    it("sets view to timer_config with habit info", () => {
      useTimerStore.getState().openConfig(1, "Guitar");
      const state = useTimerStore.getState();
      expect(state.view).toEqual({
        type: "timer_config",
        habitId: 1,
        habitName: "Guitar",
      });
    });
  });

  describe("closeConfig", () => {
    it("sets view back to habits_list", () => {
      useTimerStore.getState().openConfig(1, "Guitar");
      useTimerStore.getState().closeConfig();
      expect(useTimerStore.getState().view).toEqual({ type: "habits_list" });
    });
  });

  describe("startTimer", () => {
    it("sets activeTimer and view to active_timer", () => {
      vi.spyOn(Date.prototype, "toISOString").mockReturnValue(
        "2026-04-06T12:00:00.000Z"
      );
      useTimerStore
        .getState()
        .startTimer({ habitId: 1, habitName: "Guitar" });
      const state = useTimerStore.getState();
      expect(state.activeTimer).toEqual({
        habitId: 1,
        habitName: "Guitar",
        startTime: "2026-04-06T12:00:00.000Z",
        targetDurationSeconds: null,
      });
      expect(state.view).toEqual({ type: "active_timer" });
      vi.restoreAllMocks();
    });

    it("sets targetDurationSeconds for countdown mode", () => {
      useTimerStore.getState().startTimer({
        habitId: 1,
        habitName: "Guitar",
        targetDurationSeconds: 300,
      });
      expect(useTimerStore.getState().activeTimer?.targetDurationSeconds).toBe(
        300
      );
    });
  });

  describe("stopTimer", () => {
    it("clears activeTimer and sets view to success", () => {
      useTimerStore
        .getState()
        .startTimer({ habitId: 1, habitName: "Guitar" });
      useTimerStore.getState().stopTimer(120);
      const state = useTimerStore.getState();
      expect(state.activeTimer).toBeNull();
      expect(state.view).toEqual({ type: "success", durationSeconds: 120 });
    });
  });

  describe("dismissSuccess", () => {
    it("sets view back to habits_list", () => {
      useTimerStore
        .getState()
        .startTimer({ habitId: 1, habitName: "Guitar" });
      useTimerStore.getState().stopTimer(120);
      useTimerStore.getState().dismissSuccess();
      expect(useTimerStore.getState().view).toEqual({ type: "habits_list" });
    });
  });

  describe("hydrate", () => {
    it("sets activeTimer and view to active_timer when given timer data", () => {
      useTimerStore.getState().hydrate({
        habitId: 1,
        habitName: "Guitar",
        startTime: "2026-04-06T12:00:00.000Z",
        targetDurationSeconds: null,
      });
      const state = useTimerStore.getState();
      expect(state.activeTimer).toEqual({
        habitId: 1,
        habitName: "Guitar",
        startTime: "2026-04-06T12:00:00.000Z",
        targetDurationSeconds: null,
      });
      expect(state.view).toEqual({ type: "active_timer" });
    });

    it("skips hydration if activeTimer already exists", () => {
      useTimerStore.getState().startTimer({
        habitId: 1,
        habitName: "Guitar",
      });
      const originalStartTime =
        useTimerStore.getState().activeTimer!.startTime;

      useTimerStore.getState().hydrate({
        habitId: 2,
        habitName: "Piano",
        startTime: "2026-04-06T13:00:00.000Z",
        targetDurationSeconds: null,
      });

      expect(useTimerStore.getState().activeTimer!.habitId).toBe(1);
      expect(useTimerStore.getState().activeTimer!.startTime).toBe(
        originalStartTime
      );
    });

    it("does nothing when given null", () => {
      useTimerStore.getState().hydrate(null);
      expect(useTimerStore.getState().activeTimer).toBeNull();
      expect(useTimerStore.getState().view).toEqual({ type: "habits_list" });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/stores/timer-store.test.ts`
Expected: FAIL — module `./timer-store` not found

- [ ] **Step 3: Implement the timer store**

```typescript
// src/stores/timer-store.ts
import { create } from "zustand";

type ActiveTimer = {
  habitId: number;
  habitName: string;
  startTime: string;
  targetDurationSeconds: number | null;
};

type TimerView =
  | { type: "habits_list" }
  | { type: "timer_config"; habitId: number; habitName: string }
  | { type: "active_timer" }
  | { type: "success"; durationSeconds: number };

type TimerState = {
  activeTimer: ActiveTimer | null;
  view: TimerView;
  openConfig: (habitId: number, habitName: string) => void;
  closeConfig: () => void;
  startTimer: (params: {
    habitId: number;
    habitName: string;
    targetDurationSeconds?: number;
  }) => void;
  stopTimer: (durationSeconds: number) => void;
  dismissSuccess: () => void;
  hydrate: (activeTimer: ActiveTimer | null) => void;
};

export const useTimerStore = create<TimerState>((set, get) => ({
  activeTimer: null,
  view: { type: "habits_list" },

  openConfig: (habitId, habitName) =>
    set({ view: { type: "timer_config", habitId, habitName } }),

  closeConfig: () => set({ view: { type: "habits_list" } }),

  startTimer: ({ habitId, habitName, targetDurationSeconds }) =>
    set({
      activeTimer: {
        habitId,
        habitName,
        startTime: new Date().toISOString(),
        targetDurationSeconds: targetDurationSeconds ?? null,
      },
      view: { type: "active_timer" },
    }),

  stopTimer: (durationSeconds) =>
    set({
      activeTimer: null,
      view: { type: "success", durationSeconds },
    }),

  dismissSuccess: () => set({ view: { type: "habits_list" } }),

  hydrate: (activeTimer) => {
    if (get().activeTimer) return;
    if (!activeTimer) return;
    set({ activeTimer, view: { type: "active_timer" } });
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/stores/timer-store.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/timer-store.ts src/stores/timer-store.test.ts
git commit -m "feat: add zustand timer store with view state machine"
```

---

### Task 3: Update Start API to Accept Client startTime

**Files:**
- Modify: `src/app/api/timer/start/route.ts:6-9` (schema)
- Modify: `src/server/db/timers.ts:8-12,40` (accept startTime param)

- [ ] **Step 1: Write failing test for the API accepting startTime**

Add a test file:

```typescript
// src/app/api/timer/start/route.test.ts
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// Test the schema accepts startTime
const startSchema = z.object({
  habitId: z.number().int().positive(),
  targetDurationSeconds: z.number().int().positive().optional(),
  startTime: z.string().datetime().optional(),
});

describe("start timer schema", () => {
  it("accepts startTime as optional ISO string", () => {
    const result = startSchema.safeParse({
      habitId: 1,
      startTime: "2026-04-06T12:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("works without startTime", () => {
    const result = startSchema.safeParse({ habitId: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects invalid startTime", () => {
    const result = startSchema.safeParse({
      habitId: 1,
      startTime: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (schema-only test)**

Run: `npx vitest run src/app/api/timer/start/route.test.ts`
Expected: PASS (this validates the schema shape we'll use)

- [ ] **Step 3: Update the start API route to accept and forward startTime**

Replace `src/app/api/timer/start/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { startTimerForUser } from "@/server/db/timers";

const startSchema = z.object({
  habitId: z.number().int().positive(),
  targetDurationSeconds: z.number().int().positive().optional(),
  startTime: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid habitId" }, { status: 400 });

  const { habitId, targetDurationSeconds, startTime } = parsed.data;

  const timer = await startTimerForUser({
    userId,
    habitId,
    targetDurationSeconds,
    startTime: startTime ? new Date(startTime) : undefined,
  });
  if (!timer)
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });

  return NextResponse.json(timer);
}
```

- [ ] **Step 4: Update startTimerForUser to accept optional startTime**

In `src/server/db/timers.ts`, change the `StartTimerInput` type and the function:

Change the type from:
```typescript
type StartTimerInput = {
  userId: number;
  habitId: number;
  targetDurationSeconds?: number;
};
```
To:
```typescript
type StartTimerInput = {
  userId: number;
  habitId: number;
  targetDurationSeconds?: number;
  startTime?: Date;
};
```

Then in the `startTimerForUser` function, change line 40 from:
```typescript
    const startTime = new Date();
```
To:
```typescript
    const startTime = input.startTime ?? new Date();
```

Where `input` is the destructured parameter — update the function signature to use a named parameter instead of destructuring at the top level. The full function should change from:

```typescript
export async function startTimerForUser({
  userId,
  habitId,
  targetDurationSeconds,
}: StartTimerInput) {
```
To:
```typescript
export async function startTimerForUser(input: StartTimerInput) {
  const { userId, habitId, targetDurationSeconds } = input;
```

And change line 40 to: `const startTime = input.startTime ?? new Date();`

- [ ] **Step 5: Run existing tests to verify nothing is broken**

Run: `npx vitest run`
Expected: All existing tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/timer/start/route.ts src/app/api/timer/start/route.test.ts src/server/db/timers.ts
git commit -m "feat: accept client-provided startTime in timer start API"
```

---

### Task 4: Rewrite Dashboard as View State Machine

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/StartTimerModal.tsx` (remove fullscreen overlay wrapper)
- Test: `src/components/Dashboard.test.tsx`

- [ ] **Step 1: Update Dashboard tests for the new flow**

Replace `src/components/Dashboard.test.tsx`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { useTimerStore } from "@/stores/timer-store";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockMutate = vi.fn();
const mockMutateAsync = vi.fn();
vi.mock("@/hooks/use-habits", () => ({
  useHabits: (initial: unknown) => ({ data: initial }),
  useAddHabit: () => ({ mutateAsync: mockMutateAsync }),
  useDeleteHabit: () => ({ mutate: mockMutate }),
  useStartTimer: () => ({ mutate: mockMutate }),
  useStopTimer: () => ({ mutate: mockMutate }),
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({ data: { logSession: true } }),
}));

import { Dashboard } from "./Dashboard";
import type { Habit } from "@/lib/types";

function makeHabit(
  overrides: Partial<Habit> & { id: number; name: string }
): Habit {
  return {
    todaySeconds: 0,
    totalSeconds: 0,
    streak: 0,
    activeTimer: null,
    ...overrides,
  };
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTimerStore.setState({
      activeTimer: null,
      view: { type: "habits_list" },
    });
  });

  it("renders habits list when view is habits_list", () => {
    const habits = [
      makeHabit({ id: 1, name: "Guitar" }),
      makeHabit({ id: 2, name: "Piano" }),
    ];
    render(<Dashboard initialHabits={habits} />);
    expect(screen.getByText("Guitar")).toBeInTheDocument();
    expect(screen.getByText("Piano")).toBeInTheDocument();
  });

  it("renders empty state when no habits exist", () => {
    render(<Dashboard initialHabits={[]} />);
    expect(
      screen.getByText("Start by adding your first habit")
    ).toBeInTheDocument();
  });

  it("shows timer config when view is timer_config", () => {
    useTimerStore.setState({
      view: { type: "timer_config", habitId: 1, habitName: "Guitar" },
    });
    const habits = [makeHabit({ id: 1, name: "Guitar" })];
    render(<Dashboard initialHabits={habits} />);
    expect(screen.getByText("Guitar")).toBeInTheDocument();
    expect(screen.getByText("Choose timer mode")).toBeInTheDocument();
  });

  it("opens timer config when Start is clicked on a habit", async () => {
    const user = userEvent.setup();
    const habits = [makeHabit({ id: 1, name: "Guitar" })];
    render(<Dashboard initialHabits={habits} />);

    await user.click(screen.getByText("Start"));
    expect(useTimerStore.getState().view.type).toBe("timer_config");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/Dashboard.test.tsx`
Expected: FAIL — Dashboard doesn't read from zustand yet

- [ ] **Step 3: Convert StartTimerModal from fullscreen overlay to inline component**

Replace the outer wrapper in `src/components/StartTimerModal.tsx`. Change the root `<div>` from:

```tsx
<div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-4">
```
To:
```tsx
<div className="flex flex-col items-center justify-center px-4 py-8">
```

This removes the fullscreen overlay positioning so it renders inline.

- [ ] **Step 4: Rewrite Dashboard to use zustand view state machine**

Replace `src/components/Dashboard.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useHaptics } from "@/hooks/use-haptics";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { HabitCard } from "@/components/HabitCard";
import { AddHabitForm } from "@/components/AddHabitForm";
import { StartTimerModal } from "@/components/StartTimerModal";
import { TimerView } from "@/components/TimerView";
import { LogSessionModal } from "@/components/LogSessionModal";
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
import {
  useHabits,
  useAddHabit,
  useDeleteHabit,
  useStartTimer,
  useStopTimer,
} from "@/hooks/use-habits";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useTimerStore } from "@/stores/timer-store";
import type { Habit } from "@/lib/types";

export function Dashboard({ initialHabits }: { initialHabits: Habit[] }) {
  const { data: habits } = useHabits(initialHabits);
  const { data: flags } = useFeatureFlags();
  const { trigger } = useHaptics();
  const [switchConfirmHabitId, setSwitchConfirmHabitId] = useState<
    number | null
  >(null);
  const [loggingHabitId, setLoggingHabitId] = useState<number | null>(null);

  const addHabit = useAddHabit();
  const deleteHabit = useDeleteHabit();
  const startTimerApi = useStartTimer();
  const stopTimerApi = useStopTimer();

  const view = useTimerStore((s) => s.view);
  const activeTimer = useTimerStore((s) => s.activeTimer);
  const openConfig = useTimerStore((s) => s.openConfig);
  const closeConfig = useTimerStore((s) => s.closeConfig);
  const startTimer = useTimerStore((s) => s.startTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);

  function handleStartClick(habitId: number) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    if (activeTimer && activeTimer.habitId !== habitId) {
      setSwitchConfirmHabitId(habitId);
      return;
    }
    openConfig(habitId, habit.name);
  }

  function handleStartConfirm(targetDurationSeconds?: number) {
    if (view.type !== "timer_config") return;
    const { habitId, habitName } = view;

    trigger("medium");
    startTimer({ habitId, habitName, targetDurationSeconds });

    startTimerApi.mutate(
      {
        habitId,
        targetDurationSeconds,
        startTime: useTimerStore.getState().activeTimer!.startTime,
      },
      {
        onError: () => {
          useTimerStore.getState().dismissSuccess();
          useTimerStore.setState({
            activeTimer: null,
            view: { type: "habits_list" },
          });
          toast.error("Failed to start timer");
        },
      }
    );
  }

  function handleStop() {
    trigger("buzz");
    stopTimerApi.mutate(undefined, {
      onSuccess: (data) => {
        stopTimer(data.durationSeconds);
      },
      onError: () => {
        toast.error("Failed to stop timer");
      },
    });
  }

  function handleDelete(habitId: number) {
    deleteHabit.mutate(habitId);
  }

  async function handleAdd(name: string) {
    await addHabit.mutateAsync(name);
  }

  function handleLogClick(habitId: number) {
    setLoggingHabitId(habitId);
  }

  function handleLogSave() {
    setLoggingHabitId(null);
  }

  const switchConfirmHabit = habits.find((h) => h.id === switchConfirmHabitId);
  const loggingHabit = habits.find((h) => h.id === loggingHabitId);

  // ── Timer Config View ──
  if (view.type === "timer_config") {
    return (
      <StartTimerModal
        habitName={view.habitName}
        onStart={handleStartConfirm}
        onCancel={closeConfig}
      />
    );
  }

  // ── Active Timer View ──
  if (view.type === "active_timer" && activeTimer) {
    const habit = habits.find((h) => h.id === activeTimer.habitId);
    return (
      <TimerView
        habitName={activeTimer.habitName}
        startTime={activeTimer.startTime}
        targetDurationSeconds={activeTimer.targetDurationSeconds}
        todaySeconds={habit?.todaySeconds ?? 0}
        streak={habit?.streak ?? 0}
        onStop={handleStop}
        onBack={() =>
          useTimerStore.setState({
            activeTimer: null,
            view: { type: "habits_list" },
          })
        }
      />
    );
  }

  // ── Success View ──
  if (view.type === "success") {
    // TimerView handles the success screen internally via its own state,
    // but we also need to handle success here for auto-stop cases.
    // For now, just dismiss and go back to habits.
    useTimerStore.getState().dismissSuccess();
  }

  // ── Habits List View (default) ──
  return (
    <>
      <AlertDialog
        open={!!switchConfirmHabit}
        onOpenChange={(open) => {
          if (!open) setSwitchConfirmHabitId(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Switch timer?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              Your{" "}
              <span className="font-semibold">{activeTimer?.habitName}</span>{" "}
              session is still running. Starting{" "}
              <span className="font-semibold">{switchConfirmHabit?.name}</span>{" "}
              will end that session and save your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={() => {
                if (switchConfirmHabitId !== null) {
                  const habit = habits.find(
                    (h) => h.id === switchConfirmHabitId
                  );
                  if (habit) {
                    openConfig(switchConfirmHabitId, habit.name);
                  }
                  setSwitchConfirmHabitId(null);
                }
              }}
            >
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {flags?.logSession && loggingHabit && (
        <LogSessionModal
          habitId={loggingHabit.id}
          habitName={loggingHabit.name}
          onSave={handleLogSave}
          onCancel={() => setLoggingHabitId(null)}
        />
      )}

      <div className="mb-3">
        <AddHabitForm onAdd={handleAdd} />
      </div>

      {habits.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            Start by adding your first habit
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence initial={false}>
              {habits.map((habit) => (
                <motion.div
                  key={habit.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <HabitCard
                    habit={habit}
                    onStart={handleStartClick}
                    onDelete={handleDelete}
                    onLog={flags?.logSession ? handleLogClick : undefined}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/components/Dashboard.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.tsx src/components/Dashboard.test.tsx src/components/StartTimerModal.tsx
git commit -m "feat: rewrite Dashboard as zustand-driven view state machine"
```

---

### Task 5: Update TimerView to Accept Callbacks Instead of Managing Its Own Stop

**Files:**
- Modify: `src/components/TimerView.tsx`

The TimerView currently calls `useStopTimer()` internally and manages navigation. It needs to accept `onStop` and `onBack` callbacks so the Dashboard controls the flow.

- [ ] **Step 1: Update TimerView to use callback props**

In `src/components/TimerView.tsx`:

Replace the Props type (lines 55-61) from:
```typescript
type Props = {
  habitName: string;
  startTime: string;
  targetDurationSeconds: number | null;
  todaySeconds: number;
  streak: number;
};
```
To:
```typescript
type Props = {
  habitName: string;
  startTime: string;
  targetDurationSeconds: number | null;
  todaySeconds: number;
  streak: number;
  onStop: () => void;
  onBack: () => void;
};
```

Replace the component function (starting at line 72). Remove the `useRouter`, `useStopTimer` hooks and the internal `handleStop` / `handleBack` functions. Use the props instead:

```typescript
export function TimerView({
  habitName,
  startTime,
  targetDurationSeconds,
  todaySeconds,
  streak,
  onStop,
  onBack,
}: Props) {
  const isCountdown = targetDurationSeconds !== null;
  const { trigger } = useHaptics();

  const [display, setDisplay] = useState(() =>
    isCountdown
      ? formatRemaining(startTime, targetDurationSeconds)
      : formatElapsed(startTime)
  );
  const stoppedRef = useRef(false);
  const [successData, setSuccessData] = useState<{
    durationSeconds: number;
    message: string;
  } | null>(null);

  function handleStop() {
    if (stoppedRef.current) return;
    stoppedRef.current = true;
    trigger("buzz");
    onStop();
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (isCountdown) {
        setDisplay(formatRemaining(startTime, targetDurationSeconds));
        if (
          !stoppedRef.current &&
          isCountdownComplete(startTime, targetDurationSeconds)
        ) {
          handleStop();
        }
      } else {
        setDisplay(formatElapsed(startTime));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, targetDurationSeconds, isCountdown]);

  useEffect(() => {
    const prev = document.title;
    document.title = `${display} — ${habitName}`;
    return () => {
      document.title = prev;
    };
  }, [display, habitName]);

  // Remove the successData screen — success is now handled by Dashboard
  // (the store view transitions to { type: "success" })

  return (
    <FullHeight>
      <header className="flex items-center justify-between py-4">
        <button onClick={onBack} className="text-muted-foreground text-sm">
          &larr; Back
        </button>
        <span className="font-semibold truncate max-w-[50%]">{habitName}</span>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-6xl font-mono font-light tracking-tight mb-3">
          {display}
        </p>
        <div className="flex items-center gap-2 mb-12">
          {isCountdown && display === "00:00:00" ? (
            <span className="text-sm font-semibold text-primary">
              Time&apos;s up!
            </span>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {isCountdown ? "Counting down..." : "Recording..."}
              </span>
            </>
          )}
        </div>

        <PressableButton
          size="lg"
          onClick={handleStop}
          className="px-12 py-6 text-lg"
        >
          End Session {isCountdown ? "Early" : ""}
        </PressableButton>
      </div>

      <footer className="pb-2 text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          Today total: {formatTime(todaySeconds)}
        </p>
        <p className="text-sm text-muted-foreground">
          {streak > 0 ? `🔥 ${streak} day streak` : "No streak yet"}
        </p>
      </footer>
    </FullHeight>
  );
}
```

Also remove the unused imports: `useRouter` from `next/navigation`, `useStopTimer` from `@/hooks/use-habits`, and `getRandomCongratsMessage` from `@/lib/congrats-messages`.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/TimerView.tsx
git commit -m "refactor: TimerView accepts onStop/onBack callbacks from parent"
```

---

### Task 6: Add Success Screen to Dashboard

**Files:**
- Modify: `src/components/Dashboard.tsx`

The success screen (congrats, emoji bubbles, fanfare) was previously in TimerView. Now it needs to render when `view.type === "success"`.

- [ ] **Step 1: Move success screen rendering into Dashboard**

In `src/components/Dashboard.tsx`, replace the success view handler block (the `if (view.type === "success")` section) with a proper success screen. Update the existing block from:

```typescript
  // ── Success View ──
  if (view.type === "success") {
    // TimerView handles the success screen internally via its own state,
    // but we also need to handle success here for auto-stop cases.
    // For now, just dismiss and go back to habits.
    useTimerStore.getState().dismissSuccess();
  }
```

To:

```typescript
  // ── Success View ──
  if (view.type === "success") {
    return <SuccessScreen durationSeconds={view.durationSeconds} />;
  }
```

Then add a `SuccessScreen` component at the top of the file (or as a separate import). Add it above the `Dashboard` function:

```typescript
function SuccessScreen({ durationSeconds }: { durationSeconds: number }) {
  const { trigger } = useHaptics();
  const dismissSuccess = useTimerStore((s) => s.dismissSuccess);
  const message = getRandomCongratsMessage();

  useEffect(() => {
    playFanfare();
    trigger("buzz");
    if (
      document.hidden &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("🎉 Session Complete", {
          body: `Your ${formatTime(durationSeconds)} session was recorded`,
        });
      } catch {}
    }
  }, []);

  return (
    <div className="relative flex-1 flex flex-col">
      <EmojiBubbles />
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-slam-down relative z-10">
        <p className="text-6xl mb-6">&#127942;</p>
        <h1 className="text-2xl font-bold mb-3">Session Complete!</h1>
        <p className="text-lg text-muted-foreground mb-6 max-w-xs">
          {message}
        </p>
        <p className="text-4xl font-mono font-light tracking-tight mb-10">
          {formatTime(durationSeconds)}
        </p>
        <PressableButton
          size="lg"
          onClick={() => {
            trigger("light");
            dismissSuccess();
          }}
          className="px-12 py-6 text-lg"
        >
          Back to Habits
        </PressableButton>
      </div>
    </div>
  );
}

function playFanfare() {
  try {
    const audio = new Audio("/fanfare.mp3");
    audio.play().catch(() => {});
  } catch {}
}
```

Add the necessary imports at the top of Dashboard.tsx:

```typescript
import { useEffect } from "react";
import { formatTime } from "@/lib/format";
import { getRandomCongratsMessage } from "@/lib/congrats-messages";
import { PressableButton } from "@/components/ui/pressable-button";
```

Also move the `EmojiBubbles` component from `TimerView.tsx` into a shared location, or copy it into Dashboard.tsx. The simplest approach: extract it to its own file.

Create `src/components/EmojiBubbles.tsx`:

```typescript
const BUBBLE_EMOJIS = [
  "🎉", "⭐", "🔥", "💪", "✨", "🏆", "🎯", "💥", "🙌", "👏",
];

export function EmojiBubbles() {
  const bubbles = Array.from({ length: 14 }, (_, i) => ({
    emoji: BUBBLE_EMOJIS[i % BUBBLE_EMOJIS.length],
    left: `${5 + ((i * 7) % 90)}%`,
    duration: 2.5 + (i % 4) * 0.6,
    delay: (i % 7) * 0.4,
    size: 1.2 + (i % 3) * 0.5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="absolute bottom-0"
          style={{
            left: b.left,
            fontSize: `${b.size}rem`,
            animation: `bubble-up ${b.duration}s ease-out ${0.4 + b.delay}s infinite`,
            opacity: 0,
          }}
        >
          {b.emoji}
        </span>
      ))}
    </div>
  );
}
```

Import it in Dashboard.tsx:
```typescript
import { EmojiBubbles } from "@/components/EmojiBubbles";
```

Update TimerView.tsx to import from the shared location too (replace the inline `EmojiBubbles` — but since we removed the success screen from TimerView in Task 5, just delete the `EmojiBubbles` function and `BUBBLE_EMOJIS` constant from TimerView.tsx).

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/Dashboard.tsx src/components/EmojiBubbles.tsx src/components/TimerView.tsx
git commit -m "feat: add success screen to Dashboard, extract EmojiBubbles"
```

---

### Task 7: Update useStartTimer Hook to Send startTime

**Files:**
- Modify: `src/hooks/use-habits.ts:33-39`

- [ ] **Step 1: Update the useStartTimer mutation to include startTime**

In `src/hooks/use-habits.ts`, change `useStartTimer` from:

```typescript
export function useStartTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { habitId: number; targetDurationSeconds?: number }) =>
      api('/api/timer/start', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.habits.all }),
  });
}
```

To:

```typescript
export function useStartTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { habitId: number; targetDurationSeconds?: number; startTime?: string }) =>
      api('/api/timer/start', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.habits.all }),
  });
}
```

The only change is adding `startTime?: string` to the body type.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-habits.ts
git commit -m "feat: useStartTimer accepts optional startTime"
```

---

### Task 8: Add TimerHydrator Component

**Files:**
- Create: `src/components/TimerHydrator.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create TimerHydrator component**

```typescript
// src/components/TimerHydrator.tsx
"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useTimerStore } from "@/stores/timer-store";
import type { Habit } from "@/lib/types";

export function TimerHydrator() {
  const queryClient = useQueryClient();
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;

    const data = queryClient.getQueryData<{ habits: Habit[] }>(
      queryKeys.habits.all
    );
    if (!data) return;

    const activeHabit = data.habits.find((h) => h.activeTimer);
    if (activeHabit?.activeTimer) {
      useTimerStore.getState().hydrate({
        habitId: activeHabit.id,
        habitName: activeHabit.name,
        startTime: activeHabit.activeTimer.startTime,
        targetDurationSeconds: activeHabit.activeTimer.targetDurationSeconds,
      });
    }
    hydratedRef.current = true;
  }, [queryClient]);

  // Also subscribe to cache updates for initial population
  useEffect(() => {
    if (hydratedRef.current) return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (hydratedRef.current) return;
      if (event.query.queryKey[0] !== "habits") return;

      const data = queryClient.getQueryData<{ habits: Habit[] }>(
        queryKeys.habits.all
      );
      if (!data) return;

      const activeHabit = data.habits.find((h) => h.activeTimer);
      if (activeHabit?.activeTimer) {
        useTimerStore.getState().hydrate({
          habitId: activeHabit.id,
          habitName: activeHabit.name,
          startTime: activeHabit.activeTimer.startTime,
          targetDurationSeconds: activeHabit.activeTimer.targetDurationSeconds,
        });
      }
      hydratedRef.current = true;
    });

    return unsubscribe;
  }, [queryClient]);

  return null;
}
```

- [ ] **Step 2: Add TimerHydrator to the app layout**

In `src/app/(app)/layout.tsx`, add the import:

```typescript
import { TimerHydrator } from "@/components/TimerHydrator";
```

Add `<TimerHydrator />` right after `<CountdownAutoStop />` (line 55):

```tsx
<CountdownAutoStop />
<TimerHydrator />
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/TimerHydrator.tsx src/app/(app)/layout.tsx
git commit -m "feat: add TimerHydrator to sync zustand from server on page load"
```

---

### Task 9: Update CountdownAutoStop to Read from Zustand

**Files:**
- Modify: `src/components/CountdownAutoStop.tsx`

- [ ] **Step 1: Rewrite CountdownAutoStop to use zustand store**

Replace `src/components/CountdownAutoStop.tsx`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { formatTime } from "@/lib/format";
import { isCountdownComplete } from "@/lib/timer";
import { useTimerStore } from "@/stores/timer-store";

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {}
}

export function CountdownAutoStop() {
  const queryClient = useQueryClient();
  const stoppingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTimer = useTimerStore((s) => s.activeTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);

  useEffect(() => {
    // Only poll for countdowns
    if (!activeTimer?.targetDurationSeconds) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const { startTime, targetDurationSeconds, habitName } = activeTimer;

    async function checkAndStop() {
      if (stoppingRef.current) return;
      if (!isCountdownComplete(startTime, targetDurationSeconds!)) return;

      stoppingRef.current = true;
      try {
        const result = await api<{ durationSeconds: number }>(
          "/api/timer/stop",
          { method: "POST" }
        );
        stopTimer(result.durationSeconds);

        const message = `🎉 Your ${formatTime(result.durationSeconds)} ${habitName} session was recorded`;
        toast.success(message);
        sendBrowserNotification("🎉 Session Complete", message);
        try {
          new Audio("/fanfare.mp3").play().catch(() => {});
        } catch {}

        queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
      } catch {
        // Timer may have already been stopped (e.g., another tab)
      } finally {
        stoppingRef.current = false;
      }
    }

    intervalRef.current = setInterval(checkAndStop, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTimer, queryClient, stopTimer]);

  return null;
}
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/CountdownAutoStop.tsx
git commit -m "refactor: CountdownAutoStop reads from zustand instead of query cache"
```

---

### Task 10: Create MiniTimerBar Component

**Files:**
- Create: `src/components/MiniTimerBar.tsx`
- Test: `src/components/MiniTimerBar.test.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Write failing tests for MiniTimerBar**

```typescript
// src/components/MiniTimerBar.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useTimerStore } from "@/stores/timer-store";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/sessions",
}));

vi.mock("@/hooks/use-haptics", () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

import { MiniTimerBar } from "./MiniTimerBar";

describe("MiniTimerBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTimerStore.setState({
      activeTimer: null,
      view: { type: "habits_list" },
    });
  });

  it("renders nothing when no active timer", () => {
    const { container } = render(<MiniTimerBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders timer info when active timer exists", () => {
    useTimerStore.setState({
      activeTimer: {
        habitId: 1,
        habitName: "Guitar",
        startTime: new Date().toISOString(),
        targetDurationSeconds: null,
      },
      view: { type: "active_timer" },
    });

    render(<MiniTimerBar />);
    expect(screen.getByText("Guitar")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/MiniTimerBar.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement MiniTimerBar**

```typescript
// src/components/MiniTimerBar.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTimerStore } from "@/stores/timer-store";
import { useHaptics } from "@/hooks/use-haptics";
import { formatElapsed, formatRemaining } from "@/lib/format";

export function MiniTimerBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { trigger } = useHaptics();
  const activeTimer = useTimerStore((s) => s.activeTimer);
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!activeTimer) return;

    const update = () => {
      setDisplay(
        activeTimer.targetDurationSeconds !== null
          ? formatRemaining(
              activeTimer.startTime,
              activeTimer.targetDurationSeconds
            )
          : formatElapsed(activeTimer.startTime)
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  // Hidden when no timer or on /habits (which shows full timer view)
  if (!activeTimer || pathname.startsWith("/habits")) return null;

  return (
    <button
      onClick={() => {
        trigger("light");
        router.push("/habits");
      }}
      className="w-full px-4 py-3 bg-primary/10 border-t border-primary/30 flex items-center justify-between hover:bg-primary/15 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="font-semibold text-sm truncate max-w-[200px]">
          {activeTimer.habitName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{display}</span>
        <span className="text-xs text-muted-foreground">&rarr;</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/MiniTimerBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Add MiniTimerBar to app layout**

In `src/app/(app)/layout.tsx`, add the import:

```typescript
import { MiniTimerBar } from "@/components/MiniTimerBar";
```

Add `<MiniTimerBar />` right before the `<Toaster>`, positioned at the bottom of the layout. Change the bottom section from:

```tsx
        <Toaster position="top-center" />
        <CountdownAutoStop />
        <TimerHydrator />
```

To:

```tsx
        <MiniTimerBar />
        <Toaster position="top-center" />
        <CountdownAutoStop />
        <TimerHydrator />
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/MiniTimerBar.tsx src/components/MiniTimerBar.test.tsx src/app/(app)/layout.tsx
git commit -m "feat: add persistent MiniTimerBar above mobile tab nav"
```

---

### Task 11: Remove HabitCard Active Timer Display

**Files:**
- Modify: `src/components/HabitCard.tsx`

Since the active timer now triggers a full view takeover in Dashboard, HabitCard no longer needs its own active timer display (the pulsing ring, live elapsed time, etc.).

- [ ] **Step 1: Simplify HabitCard to always show Start button**

In `src/components/HabitCard.tsx`:

Remove the `elapsed` state and the `useEffect` that updates it (lines 33-51).

Remove the `isActive` variable (line 53).

Remove the active timer ring styling — change line 57 from:
```tsx
className={`transition-all ${isActive ? "ring-2 ring-primary animate-pulse-subtle" : ""}`}
```
To:
```tsx
className="transition-all"
```

Remove the active timer display block (lines 117-119):
```tsx
{isActive && (
  <p className="text-2xl font-mono text-primary">{elapsed}</p>
)}
```

Change the actions section (lines 122-140) from:
```tsx
{!isActive && (
  <div className="flex gap-2">
    ...
  </div>
)}
```
To (remove the `!isActive` condition):
```tsx
<div className="flex gap-2">
  <Button
    onClick={() => {
      trigger("medium");
      onStart(habit.id);
    }}
    className="flex-1"
  >
    Start
  </Button>
  {onLog && (
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
  )}
</div>
```

Remove unused imports: `useEffect`, `useState`, `formatElapsed`, `formatRemaining`.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/HabitCard.tsx
git commit -m "refactor: remove active timer display from HabitCard (handled by view takeover)"
```

---

### Task 12: Remove /timer Route and Layout

**Files:**
- Delete: `src/app/(timer)/timer/page.tsx`
- Delete: `src/app/(timer)/layout.tsx`

- [ ] **Step 1: Delete the timer route files**

```bash
rm src/app/\(timer\)/timer/page.tsx
rm src/app/\(timer\)/layout.tsx
rmdir src/app/\(timer\)/timer
rmdir src/app/\(timer\)
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Run build to check for broken imports**

Run: `npm run build`
Expected: Build succeeds with no errors referencing `/timer` route

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove /timer route (replaced by inline habits view)"
```

---

### Task 13: Clean Up Habits Page Server Component

**Files:**
- Modify: `src/app/(app)/habits/page.tsx`

The habits page currently handles auto-stop redirect logic that involved the old `/timer` route. Simplify it since auto-stop is now handled by `CountdownAutoStop` + zustand.

- [ ] **Step 1: Simplify habits page**

Replace `src/app/(app)/habits/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { Dashboard } from "@/components/Dashboard";
import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { getHabitsForUser } from "@/server/db/habits";

export default async function HabitsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const habits = await getHabitsForUser(userId);

  return (
    <Suspense fallback={<Spinner />}>
      <Dashboard initialHabits={habits} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Check if AutoStopToast and parseAutoStoppedSearchParams are used elsewhere**

Run: `grep -r "AutoStopToast\|parseAutoStoppedSearchParams" src/ --include="*.ts" --include="*.tsx" -l`

If only referenced from the old habits page and the auto-stop-search-params files, these can be deleted in a follow-up cleanup. For now, just leave them — they're unused but harmless.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/habits/page.tsx
git commit -m "refactor: simplify habits page, remove auto-stop redirect logic"
```

---

### Task 14: End-to-End Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Manual smoke test checklist**

Start the dev server: `npm run dev`

Verify each flow:
1. Navigate to `/habits` — see habits list
2. Click "Start" on a habit — see timer config inline (not fullscreen overlay)
3. Click "Back" in config — return to habits list
4. Click "Start" again, select countdown 5s, click Start — timer shows 5s immediately (no desync!)
5. Wait for countdown to complete — see success screen with emoji bubbles
6. Click "Back to Habits" — return to habits list
7. Start a stopwatch timer — navigate to `/sessions` — see mini-timer bar at bottom
8. Click mini-timer bar — navigate back to `/habits` with active timer view
9. Click "End Session" — see success screen
10. Verify `/timer` route returns 404

- [ ] **Step 4: Commit any fixes found during smoke testing**
