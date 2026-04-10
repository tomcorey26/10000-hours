# Centralized Timer Display Time — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate timer display drift by making `TimerSync` the single tick source that writes a formatted `displayTime` string to the Zustand store, so all consumers read one value instead of running independent intervals.

**Architecture:** Add `displayTime` and `isTimesUp` fields to the timer store. A new `useEffect` in `TimerSync` computes the display string every second (for both stopwatch and countdown) and writes it to the store, including updating `document.title`. `TimerView` and `MiniTimerBar` drop their local intervals and read from the store.

**Tech Stack:** Zustand, React, Vitest

---

## File Map

- **Modify:** `src/stores/timer-store.ts` — add `displayTime`, `isTimesUp`, `setDisplayTime` action; update `resetTimer`/`stopTimer`
- **Modify:** `src/stores/timer-store.test.ts` — add tests for new fields and actions
- **Modify:** `src/components/TimerSync.tsx` — add display tick `useEffect` with `document.title`
- **Modify:** `src/components/TimerSync.test.tsx` — add tests for display tick and title
- **Modify:** `src/components/TimerView.tsx` — remove local interval/state, read from store
- **Modify:** `src/components/MiniTimerBar.tsx` — remove local interval/state, read from store
- **Modify:** `src/components/MiniTimerBar.test.tsx` — update test to set `displayTime` in store

---

### Task 1: Add `displayTime` and `isTimesUp` to the store

**Files:**
- Modify: `src/stores/timer-store.test.ts`
- Modify: `src/stores/timer-store.ts`

- [ ] **Step 1: Write failing tests for new store fields and actions**

Add to `src/stores/timer-store.test.ts`:

```ts
describe("setDisplayTime", () => {
  it("updates displayTime and isTimesUp", () => {
    useTimerStore.getState().setDisplayTime("01:23:45", false);
    expect(useTimerStore.getState().displayTime).toBe("01:23:45");
    expect(useTimerStore.getState().isTimesUp).toBe(false);
  });

  it("sets isTimesUp to true", () => {
    useTimerStore.getState().setDisplayTime("00:00:00", true);
    expect(useTimerStore.getState().isTimesUp).toBe(true);
  });
});
```

Also add assertions to the existing `stopTimer` and `resetTimer` describe blocks:

In the `stopTimer` test `"clears activeTimer and sets view to success"`, add after the existing expects:

```ts
expect(state.displayTime).toBe("00:00:00");
expect(state.isTimesUp).toBe(false);
```

In the `resetTimer` test `"clears activeTimer and sets view to habits_list"`, add after the existing expects:

```ts
expect(state.displayTime).toBe("00:00:00");
expect(state.isTimesUp).toBe(false);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/stores/timer-store.test.ts`
Expected: FAIL — `setDisplayTime` not found, `displayTime` undefined

- [ ] **Step 3: Add fields and action to the store**

In `src/stores/timer-store.ts`:

Add to the `TimerState` type:

```ts
displayTime: string;
isTimesUp: boolean;
setDisplayTime: (time: string, isTimesUp: boolean) => void;
```

Add default values in `create`:

```ts
displayTime: "00:00:00",
isTimesUp: false,
```

Add the action:

```ts
setDisplayTime: (time, isTimesUp) => set({ displayTime: time, isTimesUp }),
```

Update `stopTimer`:

```ts
stopTimer: (durationSeconds) =>
  set({
    activeTimer: null,
    view: { type: "success", durationSeconds },
    displayTime: "00:00:00",
    isTimesUp: false,
  }),
```

Update `resetTimer`:

```ts
resetTimer: () => set({ activeTimer: null, view: { type: "habits_list" }, displayTime: "00:00:00", isTimesUp: false }),
```

- [ ] **Step 4: Update beforeEach in test to include new fields**

In `src/stores/timer-store.test.ts`, update the `beforeEach`:

```ts
beforeEach(() => {
  useTimerStore.setState({
    activeTimer: null,
    view: { type: "habits_list" },
    displayTime: "00:00:00",
    isTimesUp: false,
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/stores/timer-store.test.ts`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/stores/timer-store.ts src/stores/timer-store.test.ts
git commit -m "feat: add displayTime and isTimesUp to timer store"
```

---

### Task 2: Add display tick and document.title to TimerSync

**Files:**
- Modify: `src/components/TimerSync.test.tsx`
- Modify: `src/components/TimerSync.tsx`

- [ ] **Step 1: Write failing tests for the display tick**

Add mock for format functions at the top of `src/components/TimerSync.test.tsx` (after existing mocks):

```ts
vi.mock("@/lib/format", () => ({
  formatTime: vi.fn((s: number) => `${s}s`),
  formatElapsed: vi.fn(() => "00:01:00"),
  formatRemaining: vi.fn(() => "00:09:00"),
}));
```

Add a new describe block:

```ts
describe("display time tick", () => {
  it("updates displayTime in store for stopwatch timer", async () => {
    mockedApi.mockResolvedValueOnce({ habits: [] });

    useTimerStore.setState({
      activeTimer: {
        habitId: 1,
        habitName: "Guitar",
        startTime: "2026-04-09T12:00:00.000Z",
        targetDurationSeconds: null,
      },
    });

    renderHook(() => TimerSync(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useTimerStore.getState().displayTime).toBe("00:01:00");
    });
  });

  it("updates displayTime in store for countdown timer", async () => {
    mockedApi.mockResolvedValueOnce({ habits: [] });

    useTimerStore.setState({
      activeTimer: {
        habitId: 1,
        habitName: "Guitar",
        startTime: "2026-04-09T12:00:00.000Z",
        targetDurationSeconds: 600,
      },
    });

    renderHook(() => TimerSync(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useTimerStore.getState().displayTime).toBe("00:09:00");
    });
  });

  it("sets isTimesUp when countdown reaches 00:00:00", async () => {
    const { formatRemaining } = await import("@/lib/format");
    vi.mocked(formatRemaining).mockReturnValue("00:00:00");
    mockedApi.mockResolvedValueOnce({ habits: [] });

    useTimerStore.setState({
      activeTimer: {
        habitId: 1,
        habitName: "Guitar",
        startTime: "2026-04-09T12:00:00.000Z",
        targetDurationSeconds: 600,
      },
    });

    renderHook(() => TimerSync(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useTimerStore.getState().isTimesUp).toBe(true);
    });
  });

  it("updates document.title with display time and habit name", async () => {
    mockedApi.mockResolvedValueOnce({ habits: [] });

    useTimerStore.setState({
      activeTimer: {
        habitId: 1,
        habitName: "Guitar",
        startTime: "2026-04-09T12:00:00.000Z",
        targetDurationSeconds: null,
      },
    });

    renderHook(() => TimerSync(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(document.title).toBe("00:01:00 — Guitar");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/TimerSync.test.tsx`
Expected: FAIL — `displayTime` stays `"00:00:00"`

- [ ] **Step 3: Add the display tick effect to TimerSync**

In `src/components/TimerSync.tsx`, add imports for `formatElapsed` and `formatRemaining`:

```ts
import { formatTime, formatElapsed, formatRemaining } from "@/lib/format";
```

(Replace the existing `import { formatTime } from "@/lib/format";`)

Add a new `useEffect` after the existing ones (before `return null`):

```ts
// --- Display time tick (single source of truth for all UI) ---
useEffect(() => {
  if (!activeTimer) return;

  const { startTime, targetDurationSeconds, habitName } = activeTimer;
  const isCountdown = targetDurationSeconds !== null;
  const prevTitle = document.title;

  function tick() {
    const time = isCountdown
      ? formatRemaining(startTime, targetDurationSeconds!)
      : formatElapsed(startTime);
    const timesUp = isCountdown && time === "00:00:00";
    useTimerStore.getState().setDisplayTime(time, timesUp);
    document.title = `${time} — ${habitName}`;
  }

  tick(); // compute immediately — no flash of stale value
  const id = setInterval(tick, 1000);

  return () => {
    clearInterval(id);
    document.title = prevTitle;
  };
}, [activeTimer]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/TimerSync.test.tsx`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TimerSync.tsx src/components/TimerSync.test.tsx
git commit -m "feat: add display time tick and document.title to TimerSync"
```

---

### Task 3: Simplify TimerView to read from the store

**Files:**
- Modify: `src/components/TimerView.tsx`

- [ ] **Step 1: Remove local interval and title effect, read from store**

Replace the imports:

```ts
import { useEffect, useRef } from "react";
```

(Remove `useState` from the import.)

Remove these blocks:
- The `const [display, setDisplay] = useState(...)` (lines 38-42)
- The `setInterval` effect (lines 52-62)
- The `document.title` effect (lines 64-70)

Add store reads:

```ts
const displayTime = useTimerStore((s) => s.displayTime);
const isTimesUp = useTimerStore((s) => s.isTimesUp);
```

In the JSX, replace all references to `display` with `displayTime`:

- `{display}` → `{displayTime}` (the big timer text)

Replace the condition `display === "00:00:00"` with `isTimesUp`:

- `{isCountdown && display === "00:00:00" ? (` → `{isTimesUp ? (`

- [ ] **Step 2: Run unit tests**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/TimerView.tsx
git commit -m "refactor: TimerView reads displayTime from store"
```

---

### Task 4: Simplify MiniTimerBar to read from the store

**Files:**
- Modify: `src/components/MiniTimerBar.tsx`
- Modify: `src/components/MiniTimerBar.test.tsx`

- [ ] **Step 1: Remove local interval, read from store**

In `src/components/MiniTimerBar.tsx`:

Remove imports of `useEffect`, `useState`, `formatElapsed`, `formatRemaining`:

```ts
import { useRouter, usePathname } from "next/navigation";
import { useTimerStore } from "@/stores/timer-store";
import { useHaptics } from "@/hooks/use-haptics";
```

(Remove the `"use client"` — actually keep it, it's needed. Final imports:)

```ts
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTimerStore } from "@/stores/timer-store";
import { useHaptics } from "@/hooks/use-haptics";
```

Remove the `const [display, setDisplay] = useState(...)` block and the entire `useEffect` with `setInterval`.

Add store read:

```ts
const displayTime = useTimerStore((s) => s.displayTime);
```

Replace `{display}` with `{displayTime}` in the JSX.

- [ ] **Step 2: Update MiniTimerBar test**

In `src/components/MiniTimerBar.test.tsx`, update the `"renders timer info when active timer exists"` test to also set `displayTime` in store state and assert it renders:

```ts
it("renders timer info when active timer exists", () => {
  useTimerStore.setState({
    activeTimer: {
      habitId: 1,
      habitName: "Guitar",
      startTime: new Date().toISOString(),
      targetDurationSeconds: null,
    },
    displayTime: "00:05:30",
    view: { type: "active_timer" },
  });

  render(<MiniTimerBar />);
  expect(screen.getByText("Guitar")).toBeInTheDocument();
  expect(screen.getByText("00:05:30")).toBeInTheDocument();
});
```

Update `beforeEach` to include `displayTime`:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  useTimerStore.setState({
    activeTimer: null,
    view: { type: "habits_list" },
    displayTime: "00:00:00",
  });
});
```

- [ ] **Step 3: Run all unit tests**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/MiniTimerBar.tsx src/components/MiniTimerBar.test.tsx
git commit -m "refactor: MiniTimerBar reads displayTime from store"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full unit test suite**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run lint**

Run: `npx next lint`
Expected: no errors

- [ ] **Step 4: Manual smoke test (if applicable)**

Start the dev server and verify:
1. Start a stopwatch timer — both TimerView and MiniTimerBar (on other pages) show the same time
2. Start a countdown timer — both views show the same remaining time, "Time's up!" appears when it hits zero
3. Document title updates on all pages while timer is active
4. Stopping/resetting the timer clears the title back to normal
