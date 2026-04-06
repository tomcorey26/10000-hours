# Timer Redesign: Zustand Global State + Inline Views + Mini-Timer Bar

## Problem

When user starts a countdown timer (e.g. 5s), server sets `startTime` during DB write. By the time the API responds and the app navigates to `/timer`, 1-2s have elapsed. User sees 3s instead of 5s. Root cause: two round-trips of dead time between clicking Start and seeing the timer.

## Solution Overview

1. Remove the `/timer` route entirely
2. Render timer views inline on `/habits` as a state machine
3. Use a zustand store as the runtime source of truth for timer state
4. Set `startTime` client-side at click time (eliminates desync)
5. Add a persistent mini-timer bar for other pages
6. DB remains the persistence layer; zustand is the cache layer

## Habits Page View State Machine

Three views rendered in the main content area of `/habits`, driven by zustand `view` state:

```
habits_list —[click Start]→ timer_config { habitId, habitName }
timer_config —[click Back]→ habits_list
timer_config —[click Start]→ active_timer { habitId, habitName, startTime, targetDuration }
active_timer —[End Session / countdown done]→ success { durationSeconds }
success —[Back to Habits]→ habits_list

On page load: if zustand has activeTimer → active_timer
```

- **habits_list**: Current habit cards grid with Start buttons
- **timer_config**: Mode selector (stopwatch/countdown) + duration picker, rendered inline (not fullscreen overlay)
- **active_timer**: Full takeover of the content area. Shows elapsed/remaining time, habit name, End Session button, today total, streak
- **success**: Congrats screen with emoji bubbles, fanfare, duration summary, Back to Habits button

## Zustand Store

```typescript
type TimerState = {
  activeTimer: {
    habitId: number;
    habitName: string;
    startTime: string;                    // ISO string, set client-side
    targetDurationSeconds: number | null; // null = stopwatch
  } | null;

  view:
    | { type: 'habits_list' }
    | { type: 'timer_config'; habitId: number; habitName: string }
    | { type: 'active_timer' }
    | { type: 'success'; durationSeconds: number };

  openConfig: (habitId: number, habitName: string) => void;
  closeConfig: () => void;
  startTimer: (params: { habitId: number; habitName: string; targetDurationSeconds?: number }) => void;
  stopTimer: () => void;
  hydrate: (activeTimer: TimerState['activeTimer']) => void;
};
```

- `startTimer()` sets `startTime = new Date().toISOString()` immediately — this is the desync fix
- `hydrate()` called once on app load from habits query; skipped if zustand already has state (don't overwrite optimistic state)
- Single `activeTimer` slot enforces one timer at a time

## Mini-Timer Bar

- **Placement**: Bottom of viewport, above mobile tab nav (Spotify-style)
- **Visible when**: zustand has an active timer AND current page is NOT `/habits`
- **Hidden on `/habits`**: because that page shows the full timer takeover view
- **Click action**: navigate to `/habits`
- **Shows**: habit name + live elapsed/remaining time (updates every 1s via setInterval)
- **Component location**: rendered in the app layout (`src/app/(app)/layout.tsx`)

## Hydration & Sync

### Page load / refresh
- Habits query already returns `activeTimer` on each habit
- A `TimerHydrator` component runs once on mount: reads habits query, finds any habit with `activeTimer`, calls `store.hydrate()`
- If zustand already has state (optimistic), skip hydration

### Start flow
1. `store.startTimer()` → zustand updates instantly with client-side `startTime`, view flips to `active_timer`
2. `POST /api/timer/start` fires in background, sending `{ habitId, targetDurationSeconds, startTime }` — server uses the client-provided `startTime` instead of generating its own
3. On success: invalidate habits query (for list data refresh)
4. On failure: `store.stopTimer()` to rollback, show error toast, view returns to `habits_list`

### Stop flow
1. `POST /api/timer/stop` fires
2. On success: `store.stopTimer()`, view flips to `success`, invalidate habits/sessions/rankings
3. On failure: keep timer running, show error toast

### CountdownAutoStop
- Reads from zustand store instead of query cache
- Polls every 1s when zustand has an active countdown
- When expired: calls stop API, then `store.stopTimer()`

### Multiple tabs
- Each tab hydrates independently from DB on load
- DB unique constraint on `activeTimers.userId` is the tiebreaker
- No real-time cross-tab sync (unnecessary complexity)

## Files to Create

- `src/stores/timer-store.ts` — zustand store
- `src/components/MiniTimerBar.tsx` — persistent bottom bar
- `src/components/TimerHydrator.tsx` — one-time hydration from server data

## Files to Modify

- `src/app/(app)/layout.tsx` — add MiniTimerBar and TimerHydrator
- `src/components/Dashboard.tsx` — replace router.push("/timer") with zustand view transitions, render views based on store state
- `src/components/StartTimerModal.tsx` — convert from fullscreen overlay to inline component
- `src/components/TimerView.tsx` — adapt to read from zustand instead of props (or keep props, fed from store)
- `src/components/CountdownAutoStop.tsx` — read from zustand instead of query cache
- `src/hooks/use-habits.ts` — `useStartTimer` and `useStopTimer` integrate with zustand actions
- `src/components/HabitCard.tsx` — remove active timer display logic (handled by view takeover)

## Files to Delete

- `src/app/(timer)/timer/page.tsx` — no longer needed
- `src/app/(timer)/layout.tsx` — no longer needed

## Timer Display

- Uses `setInterval` with 1000ms, recalculates from `Date.now() - startTime` each tick
- No drift accumulation since display is always derived from the absolute startTime
- Both mini-timer bar and active timer view use the same format utilities (`formatElapsed`, `formatRemaining`)

## Dependencies

- `zustand` — new dependency to add
