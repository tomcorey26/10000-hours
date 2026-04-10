# Centralized Timer Display Time

## Problem

`TimerView` and `MiniTimerBar` each run independent `setInterval`s calling `Date.now()` at different moments. When navigating between pages, the two displays are visibly out of sync.

## Solution

`TimerSync` becomes the single tick source. Each second it computes the formatted display string and writes it to the Zustand store. All consumers read from the store with no local intervals.

## Store Changes (`timer-store.ts`)

Add two fields:

- `displayTime: string` — formatted `HH:MM:SS`, default `"00:00:00"`
- `isTimesUp: boolean` — `true` when countdown reaches `00:00:00`, default `false`

Add action:

- `setDisplayTime(time: string, isTimesUp: boolean)` — called by `TimerSync` each tick

Existing actions updated:

- `resetTimer` — also resets `displayTime` to `"00:00:00"` and `isTimesUp` to `false`
- `stopTimer` — also resets `displayTime` to `"00:00:00"` and `isTimesUp` to `false`

## TimerSync Changes

New display interval `useEffect`:

- Runs whenever `activeTimer` is non-null (both countdown and stopwatch)
- Computes formatted time immediately on mount (before first interval tick) to avoid flash of `00:00:00` on countdowns
- Calls `setDisplayTime` with the computed string and whether it's `00:00:00` on a countdown
- Updates `document.title` to `"{displayTime} — {habitName}"` each tick
- Restores original `document.title` on cleanup (timer stops)

Existing auto-stop `useEffect` unchanged — still only runs for countdowns, still handles the stop API call.

## TimerView Changes

- Remove local `useState(display)` and the `setInterval` effect
- Remove the `document.title` effect
- Read `displayTime` and `isTimesUp` from the store
- Replace `display === "00:00:00"` check with `isTimesUp` from store
- All other props, layout, and behavior unchanged

## MiniTimerBar Changes

- Remove local `useState(display)` and the `setInterval` effect
- Read `displayTime` from the store
- All other props, layout, and behavior unchanged

## What Doesn't Change

- `format.ts` functions — still used by `TimerSync`
- Auto-stop logic in `TimerSync`
- Hydration logic
- Component props/layout (except removing unused display state)

## Key Detail: No Null Display Time

`displayTime` defaults to `"00:00:00"` (not `null`) so consumers never need null-handling. For countdowns, `TimerSync` computes the correct initial value synchronously in the effect body before starting the interval, so users never see `00:00:00` flash for a countdown timer.
