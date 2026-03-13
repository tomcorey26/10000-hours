# Auto-Stop Countdown Timer

## Problem

When a user starts a countdown timer and navigates away (within the app or closes the browser), the session isn't recorded until they manually return to the timer page. This causes over-recording (wall-clock time instead of target duration).

## Solution

Auto-record countdown sessions when they expire, regardless of where the user is. Three mechanisms cover all scenarios.

## 1. Global Timer Provider (Client-Side)

A `TimerProvider` component added to the root app layout.

**Responsibilities:**
- Poll active timer state from the existing habits query
- Run a `setInterval` that checks if the active countdown has expired
- When expired: call `POST /api/timer/stop`, fire a browser `Notification`, show an in-app toast, and invalidate the React Query cache

**Scope:** Only countdown timers. Stopwatch timers have no defined end, so they're ignored.

**Notification permission:** Request `Notification.requestPermission()` when the user first starts a countdown timer — the moment the value is clear.

## 2. Check-on-Return (Server-Side)

For the case where no client code is running (browser/tab closed).

**Location:** Inside the habits query layer (e.g., `getHabitsForUser`).

**Logic:** Before returning data, check if there's an active countdown timer where `startTime + targetDurationSeconds < now`. If so:
- Insert a session record with `durationSeconds = targetDurationSeconds`
- Delete the active timer row
- Return a flag (`autoStoppedSession`) with the response data (habit name, duration)

**Scope:** Only countdown timers. Stopwatch timers are left as-is.

## 3. Return Toast

When the server auto-stops a session (check-on-return), the client displays a toast: "Your 5m guitar session was auto-recorded."

**Mechanism:** The server passes `autoStoppedSession: { habitName, durationSeconds }` alongside the habits data. A client component in the app layout picks this up and renders a toast.

## Notification Matrix

| Scenario | Auto-stop by | Notification |
|---|---|---|
| In-app, different page | Timer provider (client) | Browser Notification + in-app toast |
| Tab/browser closed | Check-on-return (server) | Toast on next visit |

## Components to Create/Modify

- **New:** `src/components/TimerProvider.tsx` — global provider with interval + auto-stop logic
- **New:** Toast component or integrate with existing toast system (if one exists)
- **Modify:** `src/app/(app)/layout.tsx` — wrap children with `TimerProvider`
- **Modify:** `src/lib/queries.ts` (`getHabitsForUser`) — add expired countdown check-and-record
- **Modify:** `src/app/api/timer/start/route.ts` — no changes needed, but notification permission is requested client-side when starting a countdown
- **Modify:** `src/components/TimerView.tsx` — remove auto-stop logic (now handled by provider)
- **New:** `src/lib/timer.ts` — add `isCountdownExpired(startTime, targetDurationSeconds)` helper (reuse `isCountdownComplete`)

## Edge Cases

- **Stopwatch timers:** Completely unaffected. No auto-stop, no notifications.
- **User returns mid-countdown:** Provider is running, timer page shows countdown as normal. No behavior change.
- **Multiple tabs:** Provider runs in each tab, but the first one to call stop wins. The second call gets a 404 (no active timer) — handle gracefully.
- **Notification permission denied:** Auto-stop still works, just no browser notification. Toast still shows.
- **Very stale timers:** User started a 5m countdown a week ago. Check-on-return records 5m, shows toast. Correct behavior.
