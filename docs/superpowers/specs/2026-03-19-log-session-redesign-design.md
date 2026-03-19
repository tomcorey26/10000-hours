# Log Session Redesign: Time-Aware Input with Overlap Validation

## Problem

The current Log Session modal accepts only a date and duration in minutes. There is no upper bound on duration (users can enter absurd values like 2323213223214321432), no start time, and no overlap detection. This allows impossible and conflicting data.

## Goals

- Prevent absurd duration values
- Capture *when* a session happened, not just how long
- Block overlapping sessions across all habits on the same day
- Keep the UX simple — modal stays a modal

## Out of Scope

- Editing existing sessions (start time, duration) — may be added later
- Migrating old manual sessions from noon placeholder to real times

## Design

### Modal Fields

| Field | Type | Details |
|-------|------|---------|
| Date | Dropdown | Last 7 days (Today → 6 days ago). Same as current. |
| Start Time | Dropdown | 15-minute increments, 12:00 AM → 11:45 PM (96 options). Default: current hour rounded down to nearest 15 min. |
| Duration | Number input | Free-form, min 1, max 720 minutes |
| Computed end time | Read-only text | Displayed below form, e.g. "2:00 PM → 3:25 PM". Hidden until both start time and duration are filled. |

### Timezone Handling

All times are treated as the **user's local timezone**. The client sends:
- `date`: `YYYY-MM-DD` (local date)
- `startTime`: `HH:mm` (local time)
- `tzOffset`: UTC offset in minutes (from `new Date().getTimezoneOffset()`)

The server constructs timestamps using the offset: `2026-03-19T14:00:00-04:00`. This ensures overlap checks and storage are correct regardless of server timezone. Timestamps are stored as Unix epoch integers in Turso (via Drizzle's `mode: 'timestamp'`), so timezone is baked into the stored value.

### Overlap Validation (Client-Side)

1. When user selects a date, fetch all sessions for that day across all habits via `GET /api/sessions?date=YYYY-MM-DD`.
2. On any change to start time or duration, compute the proposed interval `[startTime, startTime + duration)`.
3. Check against fetched sessions for overlap. **Exclude old manual sessions that have the noon placeholder pattern** (where `startTime` equals date at 12:00:00 and `endTime` equals `startTime + durationSeconds`) — these don't represent real time ranges.
4. If overlap found, display inline error: *"Overlaps with [Habit Name] from 2:00 PM – 4:00 PM"* and disable Save button.
5. If session would extend past midnight (11:59 PM), display: *"Session cannot extend past midnight"* and disable Save.

No debounce needed — the overlap check runs against locally cached data after the initial date fetch.

### Backend Validation (Safety Net)

On `POST /api/sessions`:

1. **Duration bounds**: Reject if `durationMinutes < 1` or `durationMinutes > 720`.
2. **Start time required**: `startTime` (`HH:mm`) and `tzOffset` (integer) are required fields for manual sessions.
3. **Overlap check**: Query existing sessions for the user on the given date. Exclude noon-placeholder manual sessions. If the proposed `[startTime, endTime)` overlaps any remaining session (any habit), return 409 Conflict with details of the conflicting session.
4. **Active timer check**: If the user has an active timer (in `activeTimers` table) whose start time is before the proposed session's end time, treat the timer as unbounded (still running) and return 409 Conflict. A past session that ends before the active timer's start time is allowed.
5. **Midnight boundary**: Reject if computed end time crosses into the next day.

### Schema

No schema migration needed. The `timeSessions` table already has `startTime` and `endTime` (timestamp columns). Currently, manual sessions store a noon placeholder — they will now store real values derived from the user's date + start time + duration.

### API Changes

#### `GET /api/sessions` — new query param

- `date` (optional, `YYYY-MM-DD`): Return sessions where `startTime` falls on that date (i.e., `startTime >= day_start AND startTime < next_day_start`).
- `tzOffset` (required when `date` is provided, integer): UTC offset in minutes from client. Used to compute day boundaries in the user's local timezone.

#### `POST /api/sessions` — updated body

```json
{
  "habitId": 123,
  "date": "2026-03-19",
  "startTime": "14:00",
  "tzOffset": 240,
  "durationMinutes": 90
}
```

Server computes:
- `startTime` = `2026-03-19T14:00:00-04:00` (using tzOffset to build offset string)
- `endTime` = `2026-03-19T15:30:00-04:00`
- `durationSeconds` = `5400`

Returns 409 if overlap detected:
```json
{
  "error": "Overlaps with existing session",
  "conflict": {
    "habitName": "Guitar",
    "startTime": "2026-03-19T13:00:00-04:00",
    "endTime": "2026-03-19T15:00:00-04:00"
  }
}
```

### React Query Integration

- New query key: `sessions.byDate(date)` — fetches all sessions for a specific date
- New hook: `useSessionsByDate(date)` — used by LogSessionModal to get sessions for overlap checking
- On successful `POST /api/sessions`, invalidate both `sessions.byDate` and existing `sessions.all` / `habits.all` / `rankings.all` keys

### What Stays the Same

- Modal remains a modal (no new page)
- 7-day lookback rule unchanged
- Delete flow unchanged
- `timerMode` for manual sessions stays `'manual'`
- Stopwatch and countdown sessions are unaffected (they already have real start/end times)

### Edge Cases

| Case | Behavior |
|------|----------|
| Duration bleeds past midnight | Error: "Session cannot extend past midnight" |
| Two sessions back-to-back (end == start) | Allowed — intervals are `[start, end)`, so no overlap |
| User changes date after entering time/duration | Re-fetch sessions for new date, re-validate |
| Existing manual sessions with noon placeholder | Excluded from overlap checks (detected by noon-start pattern). Remain as-is in DB. |
| Active timer running | 409 if active timer started before proposed session ends (timer is unbounded). Past sessions ending before the timer's start are allowed. |
| Start time and duration not yet filled | Computed end time hidden, Save disabled |
