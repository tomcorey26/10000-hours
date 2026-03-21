# Log Session Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add start time, duration cap, and overlap validation to the Log Session modal so users cannot log impossible or conflicting sessions.

**Architecture:** Add a `startTime` dropdown (15-min increments) and cap duration at 720 min. Client fetches sessions for the selected date and validates overlaps locally. Server-side overlap check + active timer check as safety net. No schema migration needed.

**Tech Stack:** Next.js 16, React 19, Drizzle ORM, Turso/SQLite, TanStack React Query v5, Vitest, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-19-log-session-redesign-design.md`

---

### Task 1: Add `getTimeOptions` and overlap utility functions

**Files:**
- Create: `src/lib/session-utils.ts`
- Create: `src/lib/session-utils.test.ts`

- [ ] **Step 1: Write failing tests for `getTimeOptions`**

```typescript
// src/lib/session-utils.test.ts
import { describe, it, expect } from "vitest";
import { getTimeOptions, checkOverlap, isPlaceholderSession } from "./session-utils";

describe("getTimeOptions", () => {
  it("returns 96 options (15-min increments over 24 hours)", () => {
    expect(getTimeOptions()).toHaveLength(96);
  });

  it("first option is 12:00 AM", () => {
    const opts = getTimeOptions();
    expect(opts[0]).toEqual({ label: "12:00 AM", value: "00:00" });
  });

  it("last option is 11:45 PM", () => {
    const opts = getTimeOptions();
    expect(opts[95]).toEqual({ label: "11:45 PM", value: "23:45" });
  });

  it("formats PM times correctly", () => {
    const opts = getTimeOptions();
    // 13:00 = index 52
    expect(opts[52]).toEqual({ label: "1:00 PM", value: "13:00" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/session-utils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `getTimeOptions`**

```typescript
// src/lib/session-utils.ts
export function getTimeOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
      options.push({ label, value });
    }
  }
  return options;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/session-utils.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for `isPlaceholderSession`**

Note: The existing code stores placeholder sessions at **midnight** (`T00:00:00`), not noon. The function is named `isPlaceholderSession` to reflect this.

Add to `src/lib/session-utils.test.ts`:

```typescript
describe("isPlaceholderSession", () => {
  it("detects midnight placeholder manual sessions", () => {
    // Old code stored manual sessions at midnight: new Date(date + "T00:00:00")
    expect(isPlaceholderSession({
      startTime: "2026-03-19T00:00:00.000Z",
      endTime: "2026-03-19T01:00:00.000Z",
      durationSeconds: 3600,
      timerMode: "manual",
    })).toBe(true);
  });

  it("returns false for non-manual sessions at midnight", () => {
    expect(isPlaceholderSession({
      startTime: "2026-03-19T00:00:00.000Z",
      endTime: "2026-03-19T01:00:00.000Z",
      durationSeconds: 3600,
      timerMode: "stopwatch",
    })).toBe(false);
  });

  it("returns false for manual sessions not at midnight", () => {
    expect(isPlaceholderSession({
      startTime: "2026-03-19T14:00:00.000Z",
      endTime: "2026-03-19T15:00:00.000Z",
      durationSeconds: 3600,
      timerMode: "manual",
    })).toBe(false);
  });
});
```

- [ ] **Step 6: Implement `isPlaceholderSession`**

Add to `src/lib/session-utils.ts`:

```typescript
export type SessionForOverlap = {
  startTime: string;
  endTime: string;
  durationSeconds: number;
  timerMode: string;
  habitName?: string;
};

export function isPlaceholderSession(session: SessionForOverlap): boolean {
  if (session.timerMode !== "manual") return false;
  const start = new Date(session.startTime);
  // Old code stored manual sessions at midnight UTC: new Date(date + "T00:00:00")
  return start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/session-utils.test.ts`
Expected: PASS

- [ ] **Step 8: Write failing tests for `checkOverlap`**

**Key timezone design decision:** `checkOverlap` runs client-side where `new Date(isoString).getHours()` returns **local** hours. The proposed start time from the dropdown is also in local time. So we compare using minutes-of-day in local time, avoiding all timezone pitfalls.

Add to `src/lib/session-utils.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTimeOptions, checkOverlap, isPlaceholderSession } from "./session-utils";

// ... (existing getTimeOptions and isPlaceholderSession tests above)

describe("checkOverlap", () => {
  // Use fake timers to control timezone behavior in tests
  // All tests use local Date objects so they work in any timezone

  function makeSession(startHour: number, startMin: number, endHour: number, endMin: number, habitName = "Guitar"): SessionForOverlap {
    // Create dates using local time constructor — matches how browser interprets API dates
    const start = new Date(2026, 2, 19, startHour, startMin, 0);
    const end = new Date(2026, 2, 19, endHour, endMin, 0);
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationSeconds: (end.getTime() - start.getTime()) / 1000,
      timerMode: "stopwatch",
      habitName,
    };
  }

  it("returns null when no overlap", () => {
    const sessions = [makeSession(10, 0, 12, 0)];
    expect(checkOverlap("14:00", 60, sessions)).toBeNull();
  });

  it("detects overlap with existing session", () => {
    const sessions = [makeSession(14, 0, 16, 0, "Guitar")];
    const result = checkOverlap("15:00", 60, sessions);
    expect(result).not.toBeNull();
    expect(result!.habitName).toBe("Guitar");
  });

  it("allows back-to-back sessions (end == start)", () => {
    const sessions = [makeSession(14, 0, 16, 0)];
    expect(checkOverlap("16:00", 60, sessions)).toBeNull();
  });

  it("returns midnight error when session bleeds past midnight", () => {
    expect(checkOverlap("23:00", 120, [])).toEqual({
      type: "midnight",
      message: "Session cannot extend past midnight",
    });
  });

  it("excludes placeholder manual sessions", () => {
    const sessions = [{
      startTime: new Date(Date.UTC(2026, 2, 19, 0, 0, 0)).toISOString(),
      endTime: new Date(Date.UTC(2026, 2, 19, 1, 0, 0)).toISOString(),
      durationSeconds: 3600,
      timerMode: "manual",
      habitName: "Old Session",
    }];
    // This session is a midnight placeholder — should be excluded
    expect(checkOverlap("00:00", 60, sessions)).toBeNull();
  });

  it("detects overlap with non-placeholder manual sessions", () => {
    const sessions = [makeSession(14, 0, 15, 30, "Piano")];
    sessions[0].timerMode = "manual";
    const result = checkOverlap("14:30", 60, sessions);
    expect(result).not.toBeNull();
    expect(result!.habitName).toBe("Piano");
  });
});
```

- [ ] **Step 9: Implement `checkOverlap`**

**Design:** Compare using minutes-of-day in local time. The proposed `startTime` is `HH:mm` local. Existing sessions' ISO strings are converted to local hours via `new Date().getHours()` (which returns local time in the browser). This avoids all timezone comparison bugs.

Add to `src/lib/session-utils.ts`:

```typescript
type OverlapResult =
  | { type: "overlap"; habitName: string; startTime: string; endTime: string; message: string }
  | { type: "midnight"; message: string };

export function checkOverlap(
  startTime: string,
  durationMinutes: number,
  sessions: SessionForOverlap[],
): OverlapResult | null {
  const [hours, minutes] = startTime.split(":").map(Number);
  const proposedStartMin = hours * 60 + minutes;
  const proposedEndMin = proposedStartMin + durationMinutes;

  if (proposedEndMin > 24 * 60) {
    return { type: "midnight", message: "Session cannot extend past midnight" };
  }

  for (const session of sessions) {
    if (isPlaceholderSession(session)) continue;

    const existingStart = new Date(session.startTime);
    const existingEnd = new Date(session.endTime);

    // Use local hours — both proposed and existing are in the same local timezone
    const existStartMin = existingStart.getHours() * 60 + existingStart.getMinutes();
    const existEndMin = existingEnd.getHours() * 60 + existingEnd.getMinutes();

    // Half-open interval overlap: [A_start, A_end) overlaps [B_start, B_end) iff A_start < B_end && B_start < A_end
    if (proposedStartMin < existEndMin && existStartMin < proposedEndMin) {
      const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return {
        type: "overlap",
        habitName: session.habitName ?? "Unknown",
        startTime: session.startTime,
        endTime: session.endTime,
        message: `Overlaps with ${session.habitName} from ${fmt(existingStart)} – ${fmt(existingEnd)}`,
      };
    }
  }

  return null;
}
```

Note: `checkOverlap` no longer takes `date` as a parameter — it's not needed since we compare minutes-of-day.

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx vitest run src/lib/session-utils.test.ts`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/lib/session-utils.ts src/lib/session-utils.test.ts
git commit -m "feat: add time options and overlap checking utilities"
```

---

### Task 2: Add `date` query param to GET /api/sessions

**Files:**
- Modify: `src/app/api/sessions/route.ts:9-24` (GET handler)
- Modify: `src/server/db/sessions.ts:7-9,20-56` (filters type + query)
- Create: `src/app/api/sessions/route.test.ts`

- [ ] **Step 1: Write failing tests for GET with `date` and `tzOffset` params**

```typescript
// src/app/api/sessions/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserId, getSessionsForUser, createManualSessionForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getSessionsForUser: vi.fn(),
  createManualSessionForUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUserId }));
vi.mock("@/server/db/sessions", () => ({
  getSessionsForUser,
  createManualSessionForUser,
}));

import { GET } from "./route";

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/sessions");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

describe("GET /api/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("passes date and tzOffset to getSessionsForUser", async () => {
    getSessionUserId.mockResolvedValue(1);
    getSessionsForUser.mockResolvedValue({ sessions: [], totalSeconds: 0 });

    await GET(makeGetRequest({ date: "2026-03-19", tzOffset: "240" }));

    expect(getSessionsForUser).toHaveBeenCalledWith(1, {
      habitId: undefined,
      range: "all",
      date: "2026-03-19",
      tzOffset: 240,
    });
  });

  it("passes range and habitId without date", async () => {
    getSessionUserId.mockResolvedValue(1);
    getSessionsForUser.mockResolvedValue({ sessions: [], totalSeconds: 0 });

    await GET(makeGetRequest({ range: "week", habitId: "5" }));

    expect(getSessionsForUser).toHaveBeenCalledWith(1, {
      habitId: "5",
      range: "week",
      date: undefined,
      tzOffset: undefined,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/sessions/route.test.ts`
Expected: FAIL — filters shape mismatch

- [ ] **Step 3: Update `SessionFilters` type and `getSessionsForUser` in `src/server/db/sessions.ts`**

Update the type and add date filtering:

```typescript
// In src/server/db/sessions.ts — update SessionFilters type
type SessionFilters = {
  habitId?: string;
  range?: string;
  date?: string;
  tzOffset?: number;
};
```

In `getSessionsForUser`, add date filtering logic before the existing `dateFilter` logic:

```typescript
// Inside getSessionsForUser, after the conditions array is initialized:
if (filters.date && filters.tzOffset !== undefined) {
  // Compute day boundaries in user's local timezone
  const offsetMs = filters.tzOffset * 60 * 1000;
  const dayStart = new Date(filters.date + "T00:00:00");
  dayStart.setTime(dayStart.getTime() + offsetMs);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  conditions.push(gte(timeSessions.startTime, dayStart));
  conditions.push(lt(timeSessions.startTime, dayEnd));
} else {
  const dateFilter = getDateFilter(filters.range);
  if (dateFilter) conditions.push(gte(timeSessions.endTime, dateFilter));
}
```

Add `lt` to the drizzle-orm import:

```typescript
import { and, desc, eq, gte, lt } from "drizzle-orm";
```

- [ ] **Step 4: Update GET handler in `src/app/api/sessions/route.ts`**

```typescript
// In the GET handler, update the filter extraction:
const date = searchParams.get("date") || undefined;
const tzOffsetRaw = searchParams.get("tzOffset");
const tzOffset = tzOffsetRaw !== null ? Number(tzOffsetRaw) : undefined;

const result = await getSessionsForUser(userId, {
  habitId: habitId ?? undefined,
  range,
  date,
  tzOffset,
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/app/api/sessions/route.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/sessions/route.ts src/app/api/sessions/route.test.ts src/server/db/sessions.ts
git commit -m "feat: add date filter param to GET /api/sessions"
```

---

### Task 3: Update POST /api/sessions with startTime, overlap check, and active timer check

**Files:**
- Modify: `src/app/api/sessions/route.ts:26-85` (POST handler + schema)
- Modify: `src/server/db/sessions.ts` (add `getSessionsForDateRange` and `getActiveTimerForUser`)
- Modify: `src/app/api/sessions/route.test.ts` (add POST tests)

- [ ] **Step 1: Write failing tests for POST validation**

Add to `src/app/api/sessions/route.test.ts`:

```typescript
import { POST } from "./route";

// Add to vi.hoisted:
const { getSessionsForDateRange, getActiveTimerForUser } = vi.hoisted(() => ({
  ...existing,
  getSessionsForDateRange: vi.fn(),
  getActiveTimerForUser: vi.fn(),
}));

// Update the mock:
vi.mock("@/server/db/sessions", () => ({
  getSessionsForUser,
  createManualSessionForUser,
  getSessionsForDateRange,
  getActiveTimerForUser,
}));

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionsForDateRange.mockResolvedValue([]);
    getActiveTimerForUser.mockResolvedValue(null);
  });

  it("returns 400 when startTime is missing", async () => {
    getSessionUserId.mockResolvedValue(1);
    const res = await POST(makePostRequest({
      habitId: 1, date: "2026-03-19", durationMinutes: 60, tzOffset: 240,
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when duration exceeds 720", async () => {
    getSessionUserId.mockResolvedValue(1);
    const res = await POST(makePostRequest({
      habitId: 1, date: "2026-03-19", startTime: "14:00", durationMinutes: 721, tzOffset: 240,
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when duration is less than 1", async () => {
    getSessionUserId.mockResolvedValue(1);
    const res = await POST(makePostRequest({
      habitId: 1, date: "2026-03-19", startTime: "14:00", durationMinutes: 0, tzOffset: 240,
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when session extends past midnight", async () => {
    getSessionUserId.mockResolvedValue(1);
    const res = await POST(makePostRequest({
      habitId: 1, date: "2026-03-19", startTime: "23:00", durationMinutes: 120, tzOffset: 240,
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("midnight");
  });

  it("returns 409 when overlapping with existing session", async () => {
    getSessionUserId.mockResolvedValue(1);
    getSessionsForDateRange.mockResolvedValue([{
      startTime: new Date("2026-03-19T14:00:00Z"),
      endTime: new Date("2026-03-19T16:00:00Z"),
      durationSeconds: 7200,
      timerMode: "stopwatch",
      habitName: "Guitar",
    }]);
    const res = await POST(makePostRequest({
      habitId: 1, date: "2026-03-19", startTime: "15:00", durationMinutes: 60, tzOffset: 0,
    }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("Overlaps");
    expect(data.conflict.habitName).toBe("Guitar");
  });

  it("returns 409 when overlapping with active timer", async () => {
    getSessionUserId.mockResolvedValue(1);
    getActiveTimerForUser.mockResolvedValue({
      startTime: new Date("2026-03-19T14:00:00Z"),
      habitName: "Piano",
    });
    const res = await POST(makePostRequest({
      habitId: 1, date: "2026-03-19", startTime: "13:00", durationMinutes: 120, tzOffset: 0,
    }));
    expect(res.status).toBe(409);
  });

  it("allows session ending before active timer starts", async () => {
    getSessionUserId.mockResolvedValue(1);
    getActiveTimerForUser.mockResolvedValue({
      startTime: new Date("2026-03-19T16:00:00Z"),
      habitName: "Piano",
    });
    createManualSessionForUser.mockResolvedValue({ id: 1 });
    const res = await POST(makePostRequest({
      habitId: 1, date: "2026-03-19", startTime: "13:00", durationMinutes: 60, tzOffset: 0,
    }));
    expect(res.status).toBe(201);
  });

  it("creates session with correct startTime, endTime, and durationSeconds", async () => {
    getSessionUserId.mockResolvedValue(1);
    createManualSessionForUser.mockResolvedValue({ id: 1 });
    await POST(makePostRequest({
      habitId: 1, date: "2026-03-19", startTime: "14:00", durationMinutes: 90, tzOffset: 0,
    }));
    const call = createManualSessionForUser.mock.calls[0][0];
    expect(call.durationSeconds).toBe(5400);
    // With tzOffset=0, startTime should be 2026-03-19T14:00:00Z
    expect(call.startTime.toISOString()).toBe("2026-03-19T14:00:00.000Z");
    expect(call.endTime.toISOString()).toBe("2026-03-19T15:30:00.000Z");
  });

  it("correctly applies tzOffset to startTime/endTime", async () => {
    getSessionUserId.mockResolvedValue(1);
    createManualSessionForUser.mockResolvedValue({ id: 1 });
    // tzOffset=240 means UTC-4 (getTimezoneOffset returns positive for west of UTC)
    await POST(makePostRequest({
      habitId: 1, date: "2026-03-19", startTime: "14:00", durationMinutes: 60, tzOffset: 240,
    }));
    const call = createManualSessionForUser.mock.calls[0][0];
    // 14:00 UTC-4 = 18:00 UTC
    expect(call.startTime.toISOString()).toBe("2026-03-19T18:00:00.000Z");
    expect(call.endTime.toISOString()).toBe("2026-03-19T19:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/sessions/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Add `getSessionsForDateRange` and `getActiveTimerForUser` to `src/server/db/sessions.ts`**

```typescript
export async function getSessionsForDateRange(
  userId: number,
  dayStart: Date,
  dayEnd: Date,
): Promise<{ startTime: Date; endTime: Date; durationSeconds: number; timerMode: string; habitName: string }[]> {
  const rows = await db
    .select({
      startTime: timeSessions.startTime,
      endTime: timeSessions.endTime,
      durationSeconds: timeSessions.durationSeconds,
      timerMode: timeSessions.timerMode,
      habitName: habits.name,
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(
      and(
        eq(timeSessions.userId, userId),
        gte(timeSessions.startTime, dayStart),
        lt(timeSessions.startTime, dayEnd),
      ),
    );

  return rows;
}

export async function getActiveTimerForUser(
  userId: number,
): Promise<{ startTime: Date; habitName: string } | null> {
  const row = await db
    .select({
      startTime: activeTimers.startTime,
      habitName: habits.name,
    })
    .from(activeTimers)
    .innerJoin(habits, eq(activeTimers.habitId, habits.id))
    .where(eq(activeTimers.userId, userId))
    .get();

  return row ?? null;
}
```

Add `activeTimers` to schema import:

```typescript
import { habits, timeSessions, activeTimers } from "@/db/schema";
```

- [ ] **Step 4: Update Zod schema and POST handler in `src/app/api/sessions/route.ts`**

Update the schema:

```typescript
const logSessionSchema = z.object({
  habitId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  tzOffset: z.number().int(),
  durationMinutes: z.number().int().min(1).max(720),
});
```

Update the POST handler after parsing:

```typescript
const { habitId, date, startTime: startTimeStr, tzOffset, durationMinutes } = parsed.data;

// 7-day lookback check (keep existing logic)
const sessionDate = new Date(date + "T12:00:00");
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
sevenDaysAgo.setHours(0, 0, 0, 0);
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(0, 0, 0, 0);

if (sessionDate < sevenDaysAgo || sessionDate >= tomorrow) {
  return NextResponse.json(
    { error: "Date must be within the last 7 days" },
    { status: 400 },
  );
}

// Compute start/end times using tzOffset
const offsetHours = Math.floor(Math.abs(tzOffset) / 60);
const offsetMins = Math.abs(tzOffset) % 60;
const offsetSign = tzOffset <= 0 ? "+" : "-";
const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, "0")}:${String(offsetMins).padStart(2, "0")}`;

const startTime = new Date(`${date}T${startTimeStr}:00${offsetStr}`);
const durationSeconds = durationMinutes * 60;
const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

// Midnight boundary check
const [startH, startM] = startTimeStr.split(":").map(Number);
if (startH * 60 + startM + durationMinutes > 24 * 60) {
  return NextResponse.json(
    { error: "Session cannot extend past midnight" },
    { status: 400 },
  );
}

// Overlap check
const dayStart = new Date(`${date}T00:00:00${offsetStr}`);
const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

const existingSessions = await getSessionsForDateRange(userId, dayStart, dayEnd);
for (const session of existingSessions) {
  // Skip midnight placeholder sessions (old manual sessions stored at T00:00:00 UTC)
  if (session.timerMode === "manual" && session.startTime.getUTCHours() === 0 && session.startTime.getUTCMinutes() === 0 && session.startTime.getUTCSeconds() === 0) continue;

  if (startTime < session.endTime && session.startTime < endTime) {
    return NextResponse.json(
      {
        error: `Overlaps with ${session.habitName}`,
        conflict: {
          habitName: session.habitName,
          startTime: session.startTime.toISOString(),
          endTime: session.endTime.toISOString(),
        },
      },
      { status: 409 },
    );
  }
}

// Active timer check
const activeTimer = await getActiveTimerForUser(userId);
if (activeTimer && activeTimer.startTime < endTime) {
  return NextResponse.json(
    {
      error: `Overlaps with active ${activeTimer.habitName} timer`,
      conflict: {
        habitName: activeTimer.habitName,
        startTime: activeTimer.startTime.toISOString(),
        endTime: null,
      },
    },
    { status: 409 },
  );
}

const session = await createManualSessionForUser({
  userId, habitId, startTime, endTime, durationSeconds,
});
```

Add new imports to route.ts:

```typescript
import {
  createManualSessionForUser,
  getSessionsForUser,
  getSessionsForDateRange,
  getActiveTimerForUser,
} from "@/server/db/sessions";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/app/api/sessions/route.test.ts`
Expected: PASS

- [ ] **Step 6: Run all existing tests to verify no regressions**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/app/api/sessions/route.ts src/app/api/sessions/route.test.ts src/server/db/sessions.ts
git commit -m "feat: add overlap and active timer validation to POST /api/sessions"
```

---

### Task 4: Add `useSessionsByDate` hook and update query keys

**Files:**
- Modify: `src/lib/query-keys.ts:8-12`
- Modify: `src/hooks/use-sessions.ts`

- [ ] **Step 1: Update query keys**

Add to `src/lib/query-keys.ts` inside `sessions`:

```typescript
sessions: {
  all: ['sessions'] as const,
  list: (filters: { habitId?: string; range?: string; viewMode: string }) =>
    ['sessions', 'list', filters] as const,
  byDate: (date: string) => ['sessions', 'byDate', date] as const,
},
```

- [ ] **Step 2: Add `useSessionsByDate` hook to `src/hooks/use-sessions.ts`**

```typescript
export function useSessionsByDate(date: string | null) {
  return useQuery({
    queryKey: queryKeys.sessions.byDate(date ?? ""),
    queryFn: () => {
      const tzOffset = new Date().getTimezoneOffset();
      return api<{ sessions: Session[]; totalSeconds: number }>(
        `/api/sessions?date=${date}&tzOffset=${tzOffset}`,
      );
    },
    enabled: !!date,
  });
}
```

- [ ] **Step 3: Update `useLogSession` mutation body type and invalidation**

```typescript
export function useLogSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      habitId: number;
      date: string;
      startTime: string;
      tzOffset: number;
      durationMinutes: number;
    }) => api('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
    },
  });
}
```

Note: `queryKeys.sessions.all` is `['sessions']` which is a prefix of `['sessions', 'byDate', ...]`, so invalidating `sessions.all` already covers `sessions.byDate`. No additional invalidation needed.

- [ ] **Step 4: Commit**

```bash
git add src/lib/query-keys.ts src/hooks/use-sessions.ts
git commit -m "feat: add useSessionsByDate hook and update useLogSession body"
```

---

### Task 5: Update LogSessionModal UI

**Files:**
- Modify: `src/components/LogSessionModal.tsx`
- Modify: `src/components/LogSessionModal.test.ts`

- [ ] **Step 1: Write failing tests for `getDefaultStartTime`**

Add to `src/components/LogSessionModal.test.ts`:

```typescript
import { getDefaultStartTime } from "./LogSessionModal";

describe("getDefaultStartTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rounds down to nearest 15 minutes", () => {
    vi.setSystemTime(new Date("2026-03-19T14:37:00"));
    expect(getDefaultStartTime()).toBe("14:30");
  });

  it("returns exact time when already on 15-min boundary", () => {
    vi.setSystemTime(new Date("2026-03-19T09:15:00"));
    expect(getDefaultStartTime()).toBe("09:15");
  });

  it("pads single-digit hours", () => {
    vi.setSystemTime(new Date("2026-03-19T08:05:00"));
    expect(getDefaultStartTime()).toBe("08:00");
  });
});
```

Note: Full component render tests for the modal would require React Testing Library + React Query mocking. The core logic (overlap checking, time options, default time) is tested via unit tests. Modal integration is verified via manual testing.

- [ ] **Step 2: Update LogSessionModal component**

Replace the component in `src/components/LogSessionModal.tsx`:

```typescript
"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useLogSession, useSessionsByDate } from "@/hooks/use-sessions";
import { ApiError } from "@/lib/api";
import { useHaptics } from "@/hooks/use-haptics";
import { getTimeOptions, checkOverlap } from "@/lib/session-utils";

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

export function getDefaultStartTime(): string {
  const now = new Date();
  const h = now.getHours();
  const m = Math.floor(now.getMinutes() / 15) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
  const [startTime, setStartTime] = useState(getDefaultStartTime);
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState("");

  const logSession = useLogSession();
  const { trigger } = useHaptics();
  const { data: sessionsData } = useSessionsByDate(date);

  const durationMinutes = Number(minutes);
  const isValidDuration = minutes !== "" && durationMinutes >= 1 && durationMinutes <= 720;

  const overlapError = useMemo(() => {
    if (!startTime || !isValidDuration) return null;
    return checkOverlap(startTime, durationMinutes, sessionsData?.sessions ?? []);
  }, [startTime, durationMinutes, sessionsData?.sessions, isValidDuration]);

  const isValid = isValidDuration && !overlapError;

  // Compute end time display
  const endTimeDisplay = useMemo(() => {
    if (!startTime || !isValidDuration) return null;
    const [h, m] = startTime.split(":").map(Number);
    const endMin = h * 60 + m + durationMinutes;
    if (endMin > 24 * 60) return null;
    const endH = Math.floor(endMin / 60);
    const endM = endMin % 60;
    const fmtTime = (hr: number, mn: number) => {
      const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
      const ampm = hr < 12 ? "AM" : "PM";
      return `${hr12}:${String(mn).padStart(2, "0")} ${ampm}`;
    };
    return `${fmtTime(h, m)} → ${fmtTime(endH, endM)}`;
  }, [startTime, durationMinutes, isValidDuration]);

  function handleSave() {
    if (!isValid) return;
    setError("");
    const tzOffset = new Date().getTimezoneOffset();
    logSession.mutate(
      { habitId, date, startTime, tzOffset, durationMinutes },
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
  const timeOptions = getTimeOptions();

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

        <label htmlFor="log-start-time" className="block text-sm font-medium mb-1">
          Start Time
        </label>
        <select
          id="log-start-time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-background mb-4"
        >
          {timeOptions.map((opt) => (
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
          max="720"
          placeholder="e.g. 45"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-background mb-2"
        />

        {endTimeDisplay && !overlapError && (
          <p className="text-muted-foreground text-xs mb-4">{endTimeDisplay}</p>
        )}

        {overlapError && (
          <p className="text-destructive text-sm mb-4">{overlapError.message}</p>
        )}

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
```

- [ ] **Step 3: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/LogSessionModal.tsx src/components/LogSessionModal.test.ts
git commit -m "feat: add start time dropdown, duration cap, and overlap display to LogSessionModal"
```

---

### Task 6: Manual smoke test and final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run the dev server and test manually**

Run: `npm run dev`

Verify:
1. Open the Log Session modal from a habit card
2. Date dropdown shows 7 days (same as before)
3. Start Time dropdown shows 96 options in 15-min increments, defaults to current time rounded down
4. Duration input accepts 1–720, rejects values outside range
5. End time display shows computed range (e.g., "2:00 PM → 3:25 PM")
6. Log a session, then try to log another overlapping one — should see overlap error and Save disabled
7. Back-to-back sessions (end == start) should be allowed
8. Duration past midnight should show error
9. Existing stopwatch/countdown sessions should still display correctly in sessions list

- [ ] **Step 3: Commit any fixes if needed**

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No errors
