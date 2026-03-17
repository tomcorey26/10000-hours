# Auto-Stop Countdown Timer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-record countdown sessions when they expire, with notifications, regardless of where the user is.

**Architecture:** Three layers: (1) server-side auto-stop in `getHabitsForUser` for closed-browser case, (2) client-side `CountdownAutoStop` component in app layout for in-app case, (3) sonner toasts + browser Notification API for feedback. The existing `TimerView` auto-stop logic is removed since the provider handles it.

**Tech Stack:** Next.js 16, React 19, TanStack Query, sonner (new dep), browser Notification API, Drizzle ORM + SQLite.

---

## Chunk 1: Server-Side Auto-Stop + Pure Functions

### Task 1: Extract auto-stop DB logic into a reusable function

The stop route and `getHabitsForUser` both need to record a session from an expired timer. Extract this into a shared function.

**Files:**
- Create: `src/lib/auto-stop-timer.ts`
- Test: `src/lib/auto-stop-timer.test.ts`

- [ ] **Step 1: Write the failing test for `buildSessionFromTimer`**

This is a pure function that takes timer data and returns session values (no DB). It uses `computeSessionDuration` internally.

```ts
// src/lib/auto-stop-timer.test.ts
import { describe, expect, it } from "vitest";
import { buildSessionFromTimer } from "./auto-stop-timer";

describe("buildSessionFromTimer", () => {
  const baseTimer = {
    habitId: 1,
    startTime: new Date("2026-03-13T10:00:00Z"),
    targetDurationSeconds: 300, // 5 minutes
  };

  it("caps countdown duration at target", () => {
    const now = new Date("2026-03-13T10:15:00Z"); // 15 min later
    const result = buildSessionFromTimer(baseTimer, now);
    expect(result.durationSeconds).toBe(300);
    expect(result.timerMode).toBe("countdown");
  });

  it("uses actual elapsed for stopwatch", () => {
    const now = new Date("2026-03-13T10:15:00Z");
    const result = buildSessionFromTimer(
      { ...baseTimer, targetDurationSeconds: null },
      now
    );
    expect(result.durationSeconds).toBe(900);
    expect(result.timerMode).toBe("stopwatch");
  });

  it("returns correct session shape", () => {
    const now = new Date("2026-03-13T10:05:00Z");
    const result = buildSessionFromTimer(baseTimer, now);
    expect(result).toEqual({
      habitId: 1,
      startTime: baseTimer.startTime,
      endTime: now,
      durationSeconds: 300,
      timerMode: "countdown",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auto-stop-timer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `buildSessionFromTimer`**

```ts
// src/lib/auto-stop-timer.ts
import { computeSessionDuration } from "@/lib/timer";

type TimerData = {
  habitId: number;
  startTime: Date;
  targetDurationSeconds: number | null;
};

export function buildSessionFromTimer(timer: TimerData, now: Date) {
  const elapsed = Math.round(
    (now.getTime() - timer.startTime.getTime()) / 1000
  );
  const timerMode =
    timer.targetDurationSeconds !== null ? "countdown" : "stopwatch";
  const durationSeconds = computeSessionDuration(
    elapsed,
    timer.targetDurationSeconds
  );

  return {
    habitId: timer.habitId,
    startTime: timer.startTime,
    endTime: now,
    durationSeconds,
    timerMode,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auto-stop-timer.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auto-stop-timer.ts src/lib/auto-stop-timer.test.ts
git commit -m "feat: add buildSessionFromTimer pure function"
```

### Task 2: Use `buildSessionFromTimer` in stop route

**Files:**
- Modify: `src/app/api/timer/stop/route.ts`

- [ ] **Step 1: Refactor stop route to use `buildSessionFromTimer`**

Replace the manual calculation with the shared function:

```ts
// src/app/api/timer/stop/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { activeTimers, timeSessions } from '@/db/schema';
import { getSessionUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { buildSessionFromTimer } from '@/lib/auto-stop-timer';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const timer = await db.select().from(activeTimers).where(eq(activeTimers.userId, userId)).get();
  if (!timer) return NextResponse.json({ error: 'No active timer' }, { status: 404 });

  const session = buildSessionFromTimer(timer, new Date());

  await db.transaction(async (tx) => {
    await tx.insert(timeSessions).values(session);
    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));
  });

  return NextResponse.json({ durationSeconds: session.durationSeconds, habitId: timer.habitId });
}
```

- [ ] **Step 2: Verify app still works**

Run: `npx vitest run` to ensure no regressions.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/timer/stop/route.ts
git commit -m "refactor: stop route uses buildSessionFromTimer"
```

### Task 3: Server-side auto-stop in `getHabitsForUser`

**Files:**
- Modify: `src/lib/queries.ts`

- [ ] **Step 1: Add expired countdown check to `getHabitsForUser`**

At the top of `getHabitsForUser`, before fetching habits, check for and auto-stop any expired countdown timer. Return a flag indicating if auto-stop happened.

```ts
// Add to imports in src/lib/queries.ts
import { buildSessionFromTimer } from '@/lib/auto-stop-timer';

// New type for the return value
export type AutoStoppedSession = {
  habitName: string;
  durationSeconds: number;
} | null;

export async function getHabitsForUser(userId: number): Promise<{
  habits: Awaited<ReturnType<typeof getHabitsForUser>>; // will fix type below
  autoStopped: AutoStoppedSession;
}> {
```

Actually — changing the return type of `getHabitsForUser` would cascade through many consumers. Instead, add a separate function.

Replace step 1 with:

- [ ] **Step 1: Add `autoStopExpiredCountdown` function to queries.ts**

Add this function to `src/lib/queries.ts`:

```ts
import { buildSessionFromTimer } from '@/lib/auto-stop-timer';

export type AutoStoppedSession = {
  habitName: string;
  durationSeconds: number;
};

/** Check for expired countdown timers and auto-record them. Returns info if one was stopped. */
export async function autoStopExpiredCountdown(userId: number): Promise<AutoStoppedSession | null> {
  const timer = await db
    .select()
    .from(activeTimers)
    .where(eq(activeTimers.userId, userId))
    .get();

  if (!timer || timer.targetDurationSeconds === null) return null;

  const elapsed = Math.round((Date.now() - timer.startTime.getTime()) / 1000);
  if (elapsed < timer.targetDurationSeconds) return null;

  const session = buildSessionFromTimer(timer, new Date());

  const habit = await db
    .select({ name: habits.name })
    .from(habits)
    .where(eq(habits.id, timer.habitId))
    .get();

  await db.transaction(async (tx) => {
    await tx.insert(timeSessions).values(session);
    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));
  });

  return {
    habitName: habit?.name ?? "Unknown",
    durationSeconds: session.durationSeconds,
  };
}
```

- [ ] **Step 2: Verify tests pass**

Run: `npx vitest run`

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat: add autoStopExpiredCountdown server-side function"
```

### Task 4: Call `autoStopExpiredCountdown` from habits API

**Files:**
- Modify: `src/app/api/habits/route.ts`

- [ ] **Step 1: Call auto-stop before returning habits**

```ts
// src/app/api/habits/route.ts — update GET handler
import { getHabitsForUser, autoStopExpiredCountdown } from '@/lib/queries';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const autoStopped = await autoStopExpiredCountdown(userId);
  const habitsWithStats = await getHabitsForUser(userId);
  return NextResponse.json({ habits: habitsWithStats, autoStopped });
}
```

- [ ] **Step 2: Update the `Habit` API response type**

In `src/hooks/use-habits.ts`, update the `useHabits` hook's API response type:

```ts
// The api call now returns { habits, autoStopped }
// autoStopped is handled separately (Task 7), useHabits still selects .habits
```

No change needed to `useHabits` — it already does `select: (data) => data.habits` which ignores extra fields.

- [ ] **Step 3: Also call auto-stop from the timer page server component**

In `src/app/(timer)/timer/page.tsx`, the page calls `getHabitsForUser` directly. Add auto-stop check before it:

```ts
// src/app/(timer)/timer/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getHabitsForUser, autoStopExpiredCountdown } from '@/lib/queries';
import { TimerView } from '@/components/TimerView';

export default async function TimerPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  await autoStopExpiredCountdown(userId);

  const habits = await getHabitsForUser(userId);
  const activeHabit = habits.find(h => h.activeTimer);

  if (!activeHabit) redirect('/skills');

  return (
    <TimerView
      habitName={activeHabit.name}
      startTime={activeHabit.activeTimer!.startTime}
      targetDurationSeconds={activeHabit.activeTimer!.targetDurationSeconds}
      todaySeconds={activeHabit.todaySeconds}
      streak={activeHabit.streak}
    />
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/habits/route.ts src/app/(timer)/timer/page.tsx
git commit -m "feat: call autoStopExpiredCountdown from habits API and timer page"
```

---

## Chunk 2: Toast Notifications (Sonner)

### Task 5: Install sonner and add Toaster

**Files:**
- Modify: `package.json`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(timer)/layout.tsx`

- [ ] **Step 1: Install sonner**

```bash
npm install sonner
```

- [ ] **Step 2: Add `<Toaster />` to app layout**

In `src/app/(app)/layout.tsx`, add the Toaster component:

```tsx
import { Toaster } from 'sonner';

// Inside the return, after </main>:
<Toaster position="top-center" />
```

- [ ] **Step 3: Add `<Toaster />` to timer layout too**

In `src/app/(timer)/layout.tsx`:

```tsx
import { Toaster } from 'sonner';

// Inside the return, after </main>:
<Toaster position="top-center" />
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/app/(app)/layout.tsx src/app/(timer)/layout.tsx
git commit -m "feat: install sonner and add Toaster to layouts"
```

### Task 6: Show toast on return for server-side auto-stopped sessions

**Files:**
- Create: `src/components/AutoStopToast.tsx`
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: Create `AutoStopToast` component**

This component reads the `autoStopped` field from the habits query and shows a toast when present.

```tsx
// src/components/AutoStopToast.tsx
'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { formatTime } from '@/lib/format';

export function AutoStopToast() {
  const queryClient = useQueryClient();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;

    const data = queryClient.getQueryData<{ habits: unknown[]; autoStopped: { habitName: string; durationSeconds: number } | null }>(queryKeys.habits.all);
    if (data?.autoStopped) {
      shown.current = true;
      toast.success(
        `Your ${formatTime(data.autoStopped.durationSeconds)} ${data.autoStopped.habitName} session was auto-recorded`
      );
    }
  }, [queryClient]);

  return null;
}
```

- [ ] **Step 2: Add `AutoStopToast` to app layout**

In `src/app/(app)/layout.tsx`, inside the `<Providers>` wrapper:

```tsx
import { AutoStopToast } from '@/components/AutoStopToast';

// Inside Providers, after <Toaster />:
<AutoStopToast />
```

- [ ] **Step 3: Verify it works manually**

Start a countdown timer, stop the dev server, wait for it to expire, restart, and navigate to /skills. Should see a toast.

- [ ] **Step 4: Commit**

```bash
git add src/components/AutoStopToast.tsx src/app/(app)/layout.tsx
git commit -m "feat: show toast when server auto-stops an expired countdown"
```

---

## Chunk 3: Client-Side Auto-Stop (Global Provider)

### Task 7: Create `CountdownAutoStop` component

**Files:**
- Create: `src/components/CountdownAutoStop.tsx`

- [ ] **Step 1: Create `CountdownAutoStop`**

This component watches for an active countdown timer across the app. When expired, it calls the stop API, shows a toast, fires a browser notification, and invalidates queries.

```tsx
// src/components/CountdownAutoStop.tsx
'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatTime } from '@/lib/format';
import { isCountdownComplete } from '@/lib/timer';
import type { Habit } from '@/lib/types';

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body });
  } catch {
    // Ignore — some browsers don't support Notification constructor
  }
}

export function CountdownAutoStop() {
  const queryClient = useQueryClient();
  const stoppingRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (stoppingRef.current) return;

      const data = queryClient.getQueryData<{ habits: Habit[] }>(queryKeys.habits.all);
      if (!data) return;

      const active = data.habits.find(h => h.activeTimer);
      if (!active?.activeTimer?.targetDurationSeconds) return;

      const { startTime, targetDurationSeconds } = active.activeTimer;
      if (!isCountdownComplete(startTime, targetDurationSeconds)) return;

      // Countdown expired — auto-stop
      stoppingRef.current = true;
      try {
        const result = await api<{ durationSeconds: number }>('/api/timer/stop', { method: 'POST' });

        toast.success(
          `Your ${formatTime(result.durationSeconds)} ${active.name} session was recorded`
        );
        sendBrowserNotification(
          'Session Complete',
          `Your ${formatTime(result.durationSeconds)} ${active.name} session was recorded`
        );

        queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
      } catch {
        // Timer may have already been stopped (e.g., another tab) — ignore
      } finally {
        stoppingRef.current = false;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [queryClient]);

  return null;
}
```

- [ ] **Step 2: Add `CountdownAutoStop` to app layout**

In `src/app/(app)/layout.tsx`, inside `<Providers>`:

```tsx
import { CountdownAutoStop } from '@/components/CountdownAutoStop';

// After <AutoStopToast />:
<CountdownAutoStop />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CountdownAutoStop.tsx src/app/(app)/layout.tsx
git commit -m "feat: add CountdownAutoStop for client-side auto-stop with notifications"
```

### Task 8: Request notification permission on countdown start

**Files:**
- Modify: `src/components/StartTimerModal.tsx`

- [ ] **Step 1: Request permission when starting a countdown**

Add notification permission request to `handleStart` in `StartTimerModal.tsx`:

```tsx
// In StartTimerModal.tsx, update handleStart:
function handleStart() {
  trigger('medium');
  const durationMinutes = Math.max(1, Math.floor(Number(minutes)));
  setPref({
    mode,
    durationMinutes: mode === 'countdown' ? durationMinutes : Number(minutes) || 25,
  });

  // Request notification permission for countdown timers
  if (mode === 'countdown' && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  if (mode === 'stopwatch') {
    onStart();
  } else {
    onStart(durationMinutes * 60);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StartTimerModal.tsx
git commit -m "feat: request notification permission on countdown start"
```

### Task 9: Remove auto-stop from TimerView

**Files:**
- Modify: `src/components/TimerView.tsx`

- [ ] **Step 1: Remove the `finished` state and auto-stop effect from TimerView**

The `CountdownAutoStop` provider now handles auto-stopping. Remove:
- The `finished` state
- The `useEffect` that calls `handleStop` when `finished` is true
- The `isCountdownComplete` check in the interval (keep the display update)

Update `TimerView.tsx`:

```tsx
// Remove: import { isCountdownComplete } from "@/lib/timer";
// Remove: the finished state
// Remove: the useEffect that calls handleStop on finished

// Update the interval effect to only update display:
useEffect(() => {
  const interval = setInterval(() => {
    if (isCountdown) {
      setDisplay(formatRemaining(startTime, targetDurationSeconds));
    } else {
      setDisplay(formatElapsed(startTime));
    }
  }, 1000);
  return () => clearInterval(interval);
}, [startTime, targetDurationSeconds, isCountdown]);

// Update the UI: replace the "finished" conditional with checking isCountdownComplete inline
// In the display section, replace finished check with:
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
```

- [ ] **Step 2: Verify all tests pass**

Run: `npx vitest run`

- [ ] **Step 3: Commit**

```bash
git add src/components/TimerView.tsx
git commit -m "refactor: remove auto-stop from TimerView, now handled by CountdownAutoStop"
```

---

## Chunk 4: Edge Cases + Final Verification

### Task 10: Handle multiple tabs gracefully

The stop API already returns 404 when no active timer exists. The `CountdownAutoStop` catches errors silently. No code change needed, but verify:

- [ ] **Step 1: Verify stop route returns 404 for no active timer**

Read `src/app/api/timer/stop/route.ts` line 13 — confirms `{ error: 'No active timer' }, { status: 404 }`.

- [ ] **Step 2: Verify `CountdownAutoStop` catches the error**

The `try/catch` in `CountdownAutoStop` handles this. Second tab's auto-stop attempt will silently fail and the query invalidation from the first tab will clear the stale data.

### Task 11: Run full test suite and manual verification

- [ ] **Step 1: Run unit tests**

```bash
npx vitest run
```

- [ ] **Step 2: Run e2e tests**

```bash
npx playwright test
```

- [ ] **Step 3: Manual test: countdown expires while on different page**

1. Start a 1-minute countdown
2. Navigate to /sessions
3. Wait 1 minute
4. Expect: toast notification + browser notification + session recorded

- [ ] **Step 4: Manual test: countdown expires after closing tab**

1. Start a 1-minute countdown
2. Close the browser tab
3. Wait 2 minutes
4. Open the app
5. Expect: toast "Your 1m X session was auto-recorded" + session in history

- [ ] **Step 5: Manual test: stopwatch is unaffected**

1. Start a stopwatch
2. Navigate away, come back
3. Expect: stopwatch still running, no auto-stop

- [ ] **Step 6: Final commit if any fixes needed**
