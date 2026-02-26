# Manual Session Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users manually log sessions done away from the computer via a modal on each habit card.

**Architecture:** New POST `/api/sessions` endpoint accepts habitId, date, durationMinutes. New `LogSessionModal` component opened from a "Log" button on `HabitCard`. Reuses existing `timeSessions` table with `timerMode = 'manual'`.

**Tech Stack:** Next.js API route, Zod validation, Drizzle ORM, React modal component, Playwright E2E tests.

---

### Task 1: POST /api/sessions — E2E test (failing)

**Files:**
- Create: `e2e/manual-session.spec.ts`

**Step 1: Write the failing E2E test**

```typescript
import { test, expect } from '@playwright/test';
import { signUp, addHabit } from './helpers';

test.describe('Manual Session Logging', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
    await addHabit(page, 'Guitar');
  });

  test('can log a manual session from habit card', async ({ page }) => {
    // Click Log button on the habit card
    await page.getByRole('button', { name: /log/i }).click();

    // Modal should appear with the habit name
    await expect(page.getByText('Log Session')).toBeVisible();

    // Enter duration in minutes
    await page.getByLabel('Duration (minutes)').fill('45');

    // Submit
    await page.getByRole('button', { name: /save/i }).click();

    // Modal should close and today's total should update
    await expect(page.getByText('Log Session')).not.toBeVisible();
    await expect(page.getByText('Today: 45m')).toBeVisible();
  });

  test('manual session appears in sessions history', async ({ page }) => {
    // Log a manual session
    await page.getByRole('button', { name: /log/i }).click();
    await page.getByLabel('Duration (minutes)').fill('30');
    await page.getByRole('button', { name: /save/i }).click();

    // Navigate to Sessions tab
    await page.getByRole('button', { name: /sessions/i }).click();

    // Should show the session
    await expect(page.locator('.font-medium', { hasText: 'Guitar' })).toBeVisible();
  });

  test('can select a past date for manual session', async ({ page }) => {
    await page.getByRole('button', { name: /log/i }).click();

    // Date selector should be present with today as default
    const dateSelect = page.getByLabel('Date');
    await expect(dateSelect).toBeVisible();

    // Should have 7 options (today + 6 past days)
    const options = dateSelect.locator('option');
    await expect(options).toHaveCount(7);

    // Select yesterday and enter duration
    await dateSelect.selectOption({ index: 1 });
    await page.getByLabel('Duration (minutes)').fill('60');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText('Log Session')).not.toBeVisible();
  });

  test('validates duration is required and positive', async ({ page }) => {
    await page.getByRole('button', { name: /log/i }).click();

    // Save button should be disabled with empty duration
    await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();

    // Enter 0 — should still be disabled
    await page.getByLabel('Duration (minutes)').fill('0');
    await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/manual-session.spec.ts --reporter=list`
Expected: FAIL — "Log" button not found

**Step 3: Commit**

```bash
git add e2e/manual-session.spec.ts
git commit -m "test: add E2E tests for manual session logging"
```

---

### Task 2: POST /api/sessions — API route

**Files:**
- Create: `src/app/api/sessions/route.ts` (add POST handler to existing file)

**Step 1: Write the POST handler**

Add to existing `src/app/api/sessions/route.ts` after the GET handler:

```typescript
import { z } from 'zod';
// (add z import at top, add timeSessions to existing import)

const logSessionSchema = z.object({
  habitId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().positive().max(1440),
});

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = logSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { habitId, date, durationMinutes } = parsed.data;

  // Verify habit belongs to user
  const habit = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .get();
  if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 });

  // Validate date is within last 7 days
  const sessionDate = new Date(date + 'T12:00:00');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (sessionDate < sevenDaysAgo || sessionDate >= tomorrow) {
    return NextResponse.json({ error: 'Date must be within the last 7 days' }, { status: 400 });
  }

  const durationSeconds = Math.round(durationMinutes * 60);
  const startTime = new Date(date + 'T00:00:00');
  const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

  const result = await db.insert(timeSessions).values({
    habitId,
    startTime,
    endTime,
    durationSeconds,
    timerMode: 'manual',
  }).returning();

  return NextResponse.json({ session: result[0] }, { status: 201 });
}
```

**Step 2: Verify route works**

Run: `curl -X POST http://localhost:3000/api/sessions` (should return 401)
Expected: `{"error":"Unauthorized"}`

**Step 3: Commit**

```bash
git add src/app/api/sessions/route.ts
git commit -m "feat: add POST /api/sessions for manual session logging"
```

---

### Task 3: LogSessionModal component

**Files:**
- Create: `src/components/LogSessionModal.tsx`

**Step 1: Create the modal component**

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  habitId: number;
  habitName: string;
  onSave: () => void;
  onCancel: () => void;
};

function getDateOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const value = d.toISOString().split('T')[0];
    const label =
      i === 0
        ? 'Today'
        : i === 1
          ? 'Yesterday'
          : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    options.push({ label, value });
  }
  return options;
}

export function LogSessionModal({ habitId, habitName, onSave, onCancel }: Props) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [minutes, setMinutes] = useState('');
  const [saving, setSaving] = useState(false);

  const durationMinutes = Number(minutes);
  const isValid = minutes !== '' && durationMinutes > 0;

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitId, date, durationMinutes }),
    });
    setSaving(false);
    if (res.ok) onSave();
  }

  const dateOptions = getDateOptions();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-background rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-1">Log Session</h2>
        <p className="text-muted-foreground text-sm mb-4">{habitName}</p>

        <label htmlFor="log-date" className="block text-sm font-medium mb-1">Date</label>
        <select
          id="log-date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-background mb-4"
        >
          {dateOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <label htmlFor="log-duration" className="block text-sm font-medium mb-1">Duration (minutes)</label>
        <input
          id="log-duration"
          type="number"
          min="1"
          placeholder="e.g. 45"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-background mb-6"
        />

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1" disabled={!isValid || saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/LogSessionModal.tsx
git commit -m "feat: add LogSessionModal component"
```

---

### Task 4: Add Log button to HabitCard

**Files:**
- Modify: `src/components/HabitCard.tsx:68-70`

**Step 1: Add onLog prop and Log button**

Add `onLog` prop to HabitCard:

```typescript
export function HabitCard({
  habit, onStart, onDelete, onLog,
}: {
  habit: Habit;
  onStart: (habitId: number) => void;
  onDelete: (habitId: number) => void;
  onLog: (habitId: number) => void;
}) {
```

Replace the `!isActive` block (lines 68-70) with:

```typescript
{!isActive && (
  <div className="flex gap-2 mt-1">
    <Button onClick={() => onStart(habit.id)} className="flex-1">Start</Button>
    <Button variant="outline" onClick={() => onLog(habit.id)} className="flex-1">Log</Button>
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/components/HabitCard.tsx
git commit -m "feat: add Log button to HabitCard"
```

---

### Task 5: Wire LogSessionModal into Dashboard

**Files:**
- Modify: `src/components/Dashboard.tsx`

**Step 1: Add state and handler for log modal**

Add import at top:
```typescript
import { LogSessionModal } from '@/components/LogSessionModal';
```

Add state after `pendingHabitId`:
```typescript
const [loggingHabitId, setLoggingHabitId] = useState<number | null>(null);
```

Add handler after `handleAdd`:
```typescript
function handleLogClick(habitId: number) {
  setLoggingHabitId(habitId);
}

async function handleLogSave() {
  setLoggingHabitId(null);
  await fetchHabits();
}
```

**Step 2: Add modal render and pass onLog to HabitCard**

Before the `return` of the dashboard list view, add the modal render. Find the `loggingHabit` the same way as `pendingHabit`:

```typescript
const loggingHabit = habits.find(h => h.id === loggingHabitId);
```

Render the modal inside the dashboard list view (inside the outer `<div>`), after the tab bar section:

```typescript
{loggingHabit && (
  <LogSessionModal
    habitId={loggingHabit.id}
    habitName={loggingHabit.name}
    onSave={handleLogSave}
    onCancel={() => setLoggingHabitId(null)}
  />
)}
```

Pass `onLog` to both HabitCard renders:

```typescript
<HabitCard key={activeHabit.id} habit={activeHabit} onStart={handleStartClick} onDelete={handleDelete} onLog={handleLogClick} />
```
and
```typescript
<HabitCard key={habit.id} habit={habit} onStart={handleStartClick} onDelete={handleDelete} onLog={handleLogClick} />
```

**Step 3: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat: wire LogSessionModal into Dashboard"
```

---

### Task 6: Run E2E tests and fix

**Step 1: Run the manual session E2E tests**

Run: `npx playwright test e2e/manual-session.spec.ts --reporter=list`
Expected: All 4 tests PASS

**Step 2: Run all E2E tests to check for regressions**

Run: `npx playwright test --reporter=list`
Expected: All tests PASS (sessions-history, countdown-timer, manual-session)

**Step 3: Fix any failures**

If any test fails, debug and fix. Re-run until green.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve E2E test issues for manual session logging"
```

---

### Task 7: Final verification

**Step 1: Run full test suite one more time**

Run: `npx playwright test --reporter=list`
Expected: All tests PASS

**Step 2: Manual smoke test**

Start dev server (`npm run dev`), sign in, verify:
1. "Log" button appears on habit cards
2. Modal opens with date dropdown and duration field
3. Saving a session updates "Today" total
4. Session appears in Sessions tab
