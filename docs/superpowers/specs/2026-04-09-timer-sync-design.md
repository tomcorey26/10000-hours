# TimerSync: Combine TimerHydrator + CountdownAutoStop

## Problem

When a user closes the tab with a countdown running and returns to any page other than `/habits`, the session is auto-saved server-side but no toast is shown. The user has no idea their session was recorded.

Root cause: `TimerHydrator` and `CountdownAutoStop` are separate components with a gap between their responsibilities. Neither handles the "server already auto-stopped it" notification on non-habits pages.

## Solution

Combine `TimerHydrator` and `CountdownAutoStop` into a single `TimerSync` component mounted in the app layout. It handles three concerns:

### 1. Hydration (from TimerHydrator)

On mount, fetch `GET /api/habits`. If an active timer exists in the response, call `hydrate()` on the Zustand store. Runs once via a ref guard.

### 2. Server auto-stop toast (new behavior)

If the `GET /api/habits` response contains `autoStopped: { habitName, durationSeconds }`, show a success toast, play fanfare, send browser notification, and call `resetTimer()`. This fires on any page since `TimerSync` is in the app layout.

### 3. Client-side countdown polling (from CountdownAutoStop)

When Zustand has an active countdown timer and `timerViewMounted` is false, poll `isCountdownComplete()` every 1s. On expiry: `POST /api/timer/stop`, show toast, play fanfare, send browser notification, call `resetTimer()`, invalidate queries.

### Dismiss success on nav (from TimerHydrator)

When pathname changes away from `/habits` and the view is `success`, call `dismissSuccess()`.

## Files to create

- `src/components/TimerSync.tsx` — combined component

## Files to delete

- `src/components/TimerHydrator.tsx`
- `src/components/CountdownAutoStop.tsx`
- `src/components/AutoStopToast.tsx`

## Files to modify

- `src/app/(app)/layout.tsx` — replace `<TimerHydrator />` and `<CountdownAutoStop />` with `<TimerSync />`
- `src/app/(app)/habits/page.tsx` — remove `autoStopped` logic, stop passing it to Dashboard
- `src/components/Dashboard.tsx` — remove `autoStopped` prop and related toast logic

## Unchanged

- `src/server/db/timers.ts` — `autoStopExpiredCountdown` stays
- `src/app/api/habits/route.ts` — still returns `autoStopped` in response
- `src/stores/timer-store.ts` — no changes
- `src/components/TimerView.tsx` — still owns foreground auto-stop
- `src/components/MiniTimerBar.tsx` — untouched
- `src/app/api/timer/stop/route.ts` — untouched

## Tests

- Unit test for `TimerSync` covering: hydration, server auto-stop toast, client-side polling
- Update/remove existing tests that reference deleted components
- E2E tests for auto-stop should continue to pass
