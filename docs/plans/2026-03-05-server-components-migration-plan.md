# Server Components Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from client-side SPA to proper Next.js App Router with server components, real routing, and server-side data fetching.

**Architecture:** Server components fetch data via shared query functions (`src/lib/queries.ts`) and pass as `initialData` to client components. React Query stays for mutations and cache invalidation. Middleware handles auth redirects. Tab navigation becomes route-backed.

**Tech Stack:** Next.js App Router, React Server Components, Drizzle ORM, React Query (TanStack Query v5), jose JWT

---

### Task 1: Extract shared query functions

**Files:**
- Create: `src/lib/queries.ts`

**Step 1: Create `src/lib/queries.ts`**

Extract DB query logic from API routes into reusable functions. These will be called by both server components and API routes.

```typescript
import { db } from '@/db';
import { habits, timeSessions, activeTimers } from '@/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

export async function getHabitsForUser(userId: number) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const userHabits = await db.select().from(habits).where(eq(habits.userId, userId));

  return Promise.all(
    userHabits.map(async (habit) => {
      const [todayResult, timer, streak] = await Promise.all([
        db
          .select({ total: sql<number>`COALESCE(SUM(${timeSessions.durationSeconds}), 0)` })
          .from(timeSessions)
          .where(and(eq(timeSessions.habitId, habit.id), gte(timeSessions.endTime, todayStart)))
          .get(),
        db
          .select()
          .from(activeTimers)
          .where(eq(activeTimers.habitId, habit.id))
          .get(),
        computeStreak(habit.id),
      ]);

      return {
        ...habit,
        todaySeconds: todayResult?.total ?? 0,
        streak,
        activeTimer: timer
          ? { startTime: timer.startTime.toISOString(), targetDurationSeconds: timer.targetDurationSeconds ?? null }
          : null,
      };
    })
  );
}

async function computeStreak(habitId: number): Promise<number> {
  const rows = await db
    .select({ date: sql<string>`DATE(${timeSessions.endTime}, 'unixepoch', 'localtime')` })
    .from(timeSessions)
    .where(eq(timeSessions.habitId, habitId))
    .groupBy(sql`DATE(${timeSessions.endTime}, 'unixepoch', 'localtime')`)
    .orderBy(sql`DATE(${timeSessions.endTime}, 'unixepoch', 'localtime') DESC`);

  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let expected = today;

  for (const row of rows) {
    const rowDate = new Date(row.date + 'T00:00:00');
    const diffDays = Math.round((expected.getTime() - rowDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      streak++;
      expected = new Date(expected.getTime() - 24 * 60 * 60 * 1000);
    } else if (diffDays === 1 && streak === 0) {
      streak++;
      expected = new Date(rowDate.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }

  return streak;
}

export async function getSessionsForUser(
  userId: number,
  filters: { habitId?: string; range?: string }
) {
  let dateFilter: Date | null = null;
  const now = new Date();
  if (filters.range === 'today') {
    dateFilter = new Date(now);
    dateFilter.setHours(0, 0, 0, 0);
  } else if (filters.range === 'week') {
    dateFilter = new Date(now);
    dateFilter.setDate(dateFilter.getDate() - 7);
    dateFilter.setHours(0, 0, 0, 0);
  } else if (filters.range === 'month') {
    dateFilter = new Date(now);
    dateFilter.setMonth(dateFilter.getMonth() - 1);
    dateFilter.setHours(0, 0, 0, 0);
  }

  const conditions = [eq(habits.userId, userId)];
  if (filters.habitId) conditions.push(eq(timeSessions.habitId, Number(filters.habitId)));
  if (dateFilter) conditions.push(gte(timeSessions.endTime, dateFilter));

  const rows = await db
    .select({
      id: timeSessions.id,
      habitName: habits.name,
      habitId: timeSessions.habitId,
      startTime: timeSessions.startTime,
      endTime: timeSessions.endTime,
      durationSeconds: timeSessions.durationSeconds,
      timerMode: timeSessions.timerMode,
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(and(...conditions))
    .orderBy(desc(timeSessions.endTime));

  const totalSeconds = rows.reduce((sum, r) => sum + r.durationSeconds, 0);

  return {
    sessions: rows.map(r => ({
      ...r,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime.toISOString(),
    })),
    totalSeconds,
  };
}

export async function getRankingsForUser(userId: number) {
  const totalSecondsExpr = sql<number>`sum(${timeSessions.durationSeconds})`;

  const rows = await db
    .select({
      habitId: habits.id,
      habitName: habits.name,
      totalSeconds: totalSecondsExpr.as('total_seconds'),
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(eq(habits.userId, userId))
    .groupBy(habits.id, habits.name)
    .orderBy(desc(totalSecondsExpr));

  return rows.map((row, i) => ({
    rank: i + 1,
    habitId: row.habitId,
    habitName: row.habitName,
    totalSeconds: row.totalSeconds,
  }));
}
```

**Step 2: Update API routes to use shared queries**

Modify `src/app/api/habits/route.ts` GET handler:
```typescript
// Replace the inline query logic with:
import { getHabitsForUser } from '@/lib/queries';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const habitsWithStats = await getHabitsForUser(userId);
  return NextResponse.json({ habits: habitsWithStats });
}
```

Same pattern for `src/app/api/sessions/route.ts` GET and `src/app/api/rankings/route.ts` GET — replace inline query logic with calls to `getSessionsForUser` and `getRankingsForUser`.

**Step 3: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass (behavior unchanged)

**Step 4: Commit**

```bash
git add src/lib/queries.ts src/app/api/habits/route.ts src/app/api/sessions/route.ts src/app/api/rankings/route.ts
git commit -m "refactor: extract shared query functions from API routes"
```

---

### Task 2: Add auth middleware

**Files:**
- Create: `src/middleware.ts`

**Step 1: Write middleware**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/auth';

const PROTECTED_ROUTES = ['/dashboard', '/sessions', '/rankings', '/timer'];
const AUTH_ROUTES = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('session')?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Redirect unauthenticated users to /login
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirect authenticated users away from /login and /
  if (session && (AUTH_ROUTES.includes(pathname) || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect / to /login for unauthenticated
  if (pathname === '/' && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/sessions/:path*', '/rankings/:path*', '/timer/:path*'],
};
```

Note: `verifySessionToken` in `src/lib/auth.ts` currently uses `cookies()` from `next/headers` in `getSessionUserId`, but `verifySessionToken` itself is a pure JWT verify function that works fine in middleware. No changes needed to auth.ts.

**Step 2: Verify dev server starts**

Run: `npx next dev` — visit `/` and confirm redirect to `/login`

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware for route protection"
```

---

### Task 3: Create login page

**Files:**
- Create: `src/app/login/page.tsx`

**Step 1: Create the login page**

This wraps the existing `AuthForm` but adds router navigation on successful auth.

```typescript
'use client';

import { AuthForm } from '@/components/AuthForm';

export default function LoginPage() {
  return <AuthForm />;
}
```

**Step 2: Update AuthForm to navigate on success**

Modify `src/components/AuthForm.tsx`: after successful login/signup mutation, redirect to `/dashboard` using `router.push`.

```typescript
// Add to imports:
import { useRouter } from 'next/navigation';

// Inside AuthForm component:
const router = useRouter();

// Update handleSubmit onSuccess:
mutation.mutate(
  { email, password },
  {
    onSuccess: () => router.push('/dashboard'),
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    },
  },
);
```

**Step 3: Verify login flow**

Run dev server → go to `/login` → sign in → should redirect to `/dashboard`

**Step 4: Commit**

```bash
git add src/app/login/page.tsx src/components/AuthForm.tsx
git commit -m "feat: add login page with redirect to dashboard"
```

---

### Task 4: Create (app) layout with tab navigation

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/TabNav.tsx`
- Create: `src/app/(app)/loading.tsx`
- Modify: `src/app/layout.tsx` — remove Providers wrapper
- Modify: `src/app/login/page.tsx` — wrap in own Providers

**Step 1: Create TabNav client component**

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard', label: 'Skills' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/rankings', label: 'Rankings' },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <div className="flex mb-4 rounded-lg bg-muted p-1">
      {TABS.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors text-center ${
            pathname.startsWith(tab.href)
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
```

**Step 2: Create (app) layout**

```typescript
import { Providers } from '@/components/Providers';
import { TabNav } from '@/components/TabNav';
import { LogoutButton } from '@/components/LogoutButton';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 py-6 pb-[env(safe-area-inset-bottom)]">
          <header className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">10,000 Hours</h1>
            <LogoutButton />
          </header>
          <TabNav />
          {children}
        </div>
      </div>
    </Providers>
  );
}
```

**Step 3: Create LogoutButton client component**

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { useLogout } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const logout = useLogout();
  const router = useRouter();

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => router.push('/login'),
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      Log out
    </Button>
  );
}
```

Create file: `src/components/LogoutButton.tsx`

**Step 4: Create loading.tsx**

```typescript
import { Spinner } from '@/components/Spinner';

export default function Loading() {
  return <Spinner />;
}
```

**Step 5: Update root layout — remove Providers**

Modify `src/app/layout.tsx`:
```typescript
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// ... fonts and metadata stay the same ...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

**Step 6: Wrap login page in Providers**

Since login is outside `(app)` group and needs React Query for auth mutations:

```typescript
'use client';

import { Providers } from '@/components/Providers';
import { AuthForm } from '@/components/AuthForm';

export default function LoginPage() {
  return (
    <Providers>
      <AuthForm />
    </Providers>
  );
}
```

**Step 7: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/app/\(app\)/loading.tsx src/components/TabNav.tsx src/components/LogoutButton.tsx src/app/layout.tsx src/app/login/page.tsx
git commit -m "feat: add app layout with route-backed tab navigation"
```

---

### Task 5: Create dashboard server page

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/components/Dashboard.tsx` — strip to habit list + modals only
- Modify: `src/hooks/use-habits.ts` — accept initialData

**Step 1: Update useHabits to accept initialData**

```typescript
import type { Habit } from '@/lib/types';

export function useHabits(initialData?: Habit[]) {
  return useSuspenseQuery({
    queryKey: queryKeys.habits.all,
    queryFn: () => api<{ habits: Habit[] }>('/api/habits'),
    select: (data) => data.habits,
    ...(initialData ? { initialData: { habits: initialData } } : {}),
  });
}
```

**Step 2: Create dashboard server page**

```typescript
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getHabitsForUser } from '@/lib/queries';
import { Dashboard } from '@/components/Dashboard';
import { Suspense } from 'react';
import { Spinner } from '@/components/Spinner';

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const habits = await getHabitsForUser(userId);

  return (
    <Suspense fallback={<Spinner />}>
      <Dashboard initialHabits={habits} />
    </Suspense>
  );
}
```

**Step 3: Strip Dashboard to habit list + modals**

Remove tabs, header, logout, sessions view, rankings view. Keep: habit cards, add form, start timer modal, log session modal. Timer start now navigates to `/timer` instead of setting local state.

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HabitCard } from '@/components/HabitCard';
import { AddHabitForm } from '@/components/AddHabitForm';
import { StartTimerModal } from '@/components/StartTimerModal';
import { LogSessionModal } from '@/components/LogSessionModal';
import { useHabits, useAddHabit, useDeleteHabit, useStartTimer } from '@/hooks/use-habits';
import type { Habit } from '@/lib/types';

export function Dashboard({ initialHabits }: { initialHabits: Habit[] }) {
  const { data: habits } = useHabits(initialHabits);
  const [pendingHabitId, setPendingHabitId] = useState<number | null>(null);
  const [loggingHabitId, setLoggingHabitId] = useState<number | null>(null);
  const router = useRouter();

  const addHabit = useAddHabit();
  const deleteHabit = useDeleteHabit();
  const startTimer = useStartTimer();

  function handleStartClick(habitId: number) {
    setPendingHabitId(habitId);
  }

  function handleStartConfirm(targetDurationSeconds?: number) {
    if (pendingHabitId === null) return;
    startTimer.mutate(
      { habitId: pendingHabitId, targetDurationSeconds },
      {
        onSuccess: () => {
          setPendingHabitId(null);
          router.push('/timer');
        },
      },
    );
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

  const activeHabit = habits.find(h => h.activeTimer);
  const pendingHabit = habits.find(h => h.id === pendingHabitId);
  const loggingHabit = habits.find(h => h.id === loggingHabitId);

  if (pendingHabitId && pendingHabit) {
    return (
      <StartTimerModal
        habitName={pendingHabit.name}
        onStart={handleStartConfirm}
        onCancel={() => setPendingHabitId(null)}
      />
    );
  }

  return (
    <>
      {loggingHabit && (
        <LogSessionModal
          habitId={loggingHabit.id}
          habitName={loggingHabit.name}
          onSave={handleLogSave}
          onCancel={() => setLoggingHabitId(null)}
        />
      )}

      {habits.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Start by adding your first habit</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {activeHabit && (
            <div onClick={() => router.push('/timer')} className="cursor-pointer">
              <HabitCard key={activeHabit.id} habit={activeHabit} onStart={handleStartClick} onDelete={handleDelete} onLog={handleLogClick} />
            </div>
          )}
          {habits.filter(h => !h.activeTimer).map((habit) => (
            <HabitCard key={habit.id} habit={habit} onStart={handleStartClick} onDelete={handleDelete} onLog={handleLogClick} />
          ))}
        </div>
      )}

      <AddHabitForm onAdd={handleAdd} />
    </>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run`

**Step 5: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx src/components/Dashboard.tsx src/hooks/use-habits.ts
git commit -m "feat: add dashboard server page with server-side data fetching"
```

---

### Task 6: Create sessions server page

**Files:**
- Create: `src/app/(app)/sessions/page.tsx`
- Modify: `src/components/SessionsView.tsx` — accept initialData props
- Modify: `src/hooks/use-sessions.ts` — accept initialData

**Step 1: Update useSessions to accept initialData**

```typescript
import type { Session } from '@/lib/types';

type SessionFilters = { habitId?: string; range?: string; viewMode: string };

export function useSessions(filters: SessionFilters, initialData?: { sessions: Session[]; totalSeconds: number }) {
  return useSuspenseQuery({
    queryKey: queryKeys.sessions.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.habitId) params.set('habitId', filters.habitId);
      if (filters.viewMode === 'list' && filters.range && filters.range !== 'all') {
        params.set('range', filters.range);
      }
      return api<{ sessions: Session[]; totalSeconds: number }>(`/api/sessions?${params}`);
    },
    ...(initialData ? { initialData } : {}),
  });
}
```

**Step 2: Update SessionsView to accept initial data + habits**

```typescript
// Add to SessionsView props:
export function SessionsView({
  habits,
  initialSessions,
  initialTotalSeconds,
}: {
  habits: { id: number; name: string }[];
  initialSessions?: Session[];
  initialTotalSeconds?: number;
}) {
  // ... existing state ...
  const initialData = initialSessions ? { sessions: initialSessions, totalSeconds: initialTotalSeconds ?? 0 } : undefined;
  const { data } = useSessions({ habitId: selectedHabitId || undefined, range: dateRange, viewMode }, initialData);
  // ... rest unchanged ...
}
```

Note: initialData only applies on first render (default filters). Once user changes filters, React Query fetches fresh data from API.

**Step 3: Create sessions server page**

```typescript
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getSessionsForUser, getHabitsForUser } from '@/lib/queries';
import { SessionsView } from '@/components/SessionsView';
import { Suspense } from 'react';
import { Spinner } from '@/components/Spinner';

export default async function SessionsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const [sessionsData, habits] = await Promise.all([
    getSessionsForUser(userId, {}),
    getHabitsForUser(userId),
  ]);

  const habitsList = habits.map(h => ({ id: h.id, name: h.name }));

  return (
    <Suspense fallback={<Spinner />}>
      <SessionsView
        habits={habitsList}
        initialSessions={sessionsData.sessions}
        initialTotalSeconds={sessionsData.totalSeconds}
      />
    </Suspense>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run`

**Step 5: Commit**

```bash
git add src/app/\(app\)/sessions/page.tsx src/components/SessionsView.tsx src/hooks/use-sessions.ts
git commit -m "feat: add sessions server page with server-side data fetching"
```

---

### Task 7: Create rankings server page

**Files:**
- Create: `src/app/(app)/rankings/page.tsx`
- Modify: `src/components/RankingsView.tsx` — accept initialData
- Modify: `src/hooks/use-rankings.ts` — accept initialData

**Step 1: Update useRankings to accept initialData**

```typescript
type Ranking = {
  rank: number;
  habitId: number;
  habitName: string;
  totalSeconds: number;
};

export function useRankings(initialData?: Ranking[]) {
  return useSuspenseQuery({
    queryKey: queryKeys.rankings.all,
    queryFn: () => api<{ rankings: Ranking[] }>('/api/rankings'),
    select: (data) => data.rankings,
    ...(initialData ? { initialData: { rankings: initialData } } : {}),
  });
}
```

**Step 2: Update RankingsView**

```typescript
type Ranking = {
  rank: number;
  habitId: number;
  habitName: string;
  totalSeconds: number;
};

export function RankingsView({ initialRankings }: { initialRankings?: Ranking[] }) {
  const { data: rankings } = useRankings(initialRankings);
  // ... rest unchanged ...
}
```

**Step 3: Create rankings server page**

```typescript
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getRankingsForUser } from '@/lib/queries';
import { RankingsView } from '@/components/RankingsView';
import { Suspense } from 'react';
import { Spinner } from '@/components/Spinner';

export default async function RankingsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const rankings = await getRankingsForUser(userId);

  return (
    <Suspense fallback={<Spinner />}>
      <RankingsView initialRankings={rankings} />
    </Suspense>
  );
}
```

**Step 4: Run tests**

Run: `npx vitest run`

**Step 5: Commit**

```bash
git add src/app/\(app\)/rankings/page.tsx src/components/RankingsView.tsx src/hooks/use-rankings.ts
git commit -m "feat: add rankings server page with server-side data fetching"
```

---

### Task 8: Create timer server page

**Files:**
- Create: `src/app/(app)/timer/page.tsx`
- Modify: `src/components/TimerView.tsx` — add navigation on stop/back

**Step 1: Update TimerView**

Add `useRouter` for navigation. Replace `onBack` and `onStop` callbacks with router-based navigation.

```typescript
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { formatTime, formatElapsed, formatRemaining, isCountdownComplete } from '@/lib/format';
import { useStopTimer } from '@/hooks/use-habits';

type Props = {
  habitName: string;
  startTime: string;
  targetDurationSeconds: number | null;
  todaySeconds: number;
  streak: number;
};

export function TimerView({ habitName, startTime, targetDurationSeconds, todaySeconds, streak }: Props) {
  const isCountdown = targetDurationSeconds !== null;
  const router = useRouter();
  const stopTimer = useStopTimer();

  const [display, setDisplay] = useState(() =>
    isCountdown
      ? formatRemaining(startTime, targetDurationSeconds)
      : formatElapsed(startTime)
  );
  const [finished, setFinished] = useState(() =>
    isCountdown ? isCountdownComplete(startTime, targetDurationSeconds) : false
  );
  const autoStopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleStop() {
    stopTimer.mutate(undefined, {
      onSuccess: () => router.push('/dashboard'),
    });
  }

  function handleBack() {
    router.push('/dashboard');
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (isCountdown) {
        setDisplay(formatRemaining(startTime, targetDurationSeconds));
        if (isCountdownComplete(startTime, targetDurationSeconds)) {
          setFinished(true);
        }
      } else {
        setDisplay(formatElapsed(startTime));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, targetDurationSeconds, isCountdown]);

  useEffect(() => {
    if (!finished) return;

    try {
      const audio = new Audio('/alarm.mp3');
      audio.play().catch(() => {});
    } catch {
      // Ignore audio errors
    }

    autoStopTimeout.current = setTimeout(() => {
      handleStop();
    }, 2000);

    return () => {
      if (autoStopTimeout.current) {
        clearTimeout(autoStopTimeout.current);
      }
    };
  }, [finished]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-4 relative z-10">
        <button onClick={handleBack} className="text-muted-foreground text-sm">&larr; Back</button>
        <span className="font-semibold">{habitName}</span>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-16">
        <p className="text-6xl font-mono font-light tracking-tight mb-3">{display}</p>
        <div className="flex items-center gap-2 mb-12">
          {finished ? (
            <span className="text-sm font-semibold text-primary">Time&apos;s up!</span>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {isCountdown ? 'Counting down...' : 'Recording...'}
              </span>
            </>
          )}
        </div>

        <Button size="lg" onClick={handleStop} className="px-12 py-6 text-lg">Stop</Button>
      </div>

      <footer className="px-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-center space-y-1">
        <p className="text-sm text-muted-foreground">Today total: {formatTime(todaySeconds)}</p>
        <p className="text-sm text-muted-foreground">
          {streak > 0 ? `${streak} day streak` : 'No streak yet'}
        </p>
      </footer>
    </div>
  );
}
```

**Step 2: Create timer server page**

```typescript
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getHabitsForUser } from '@/lib/queries';
import { TimerView } from '@/components/TimerView';

export default async function TimerPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const habits = await getHabitsForUser(userId);
  const activeHabit = habits.find(h => h.activeTimer);

  // No active timer — redirect back to dashboard
  if (!activeHabit) redirect('/dashboard');

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

**Step 3: Run tests**

Run: `npx vitest run`

**Step 4: Commit**

```bash
git add src/app/\(app\)/timer/page.tsx src/components/TimerView.tsx
git commit -m "feat: add timer server page with server-side data fetching"
```

---

### Task 9: Update root page and clean up

**Files:**
- Modify: `src/app/page.tsx` — redirect to /dashboard
- Delete old unused code paths

**Step 1: Replace root page with redirect**

```typescript
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
```

**Step 2: Remove useStopTimer from Dashboard.tsx**

Dashboard no longer handles stopping timers (that's in TimerView now). Remove the `useStopTimer` import and usage if still present.

**Step 3: Run full app test**

Run: `npx vitest run`
Run: dev server and manually test all routes: `/login`, `/dashboard`, `/sessions`, `/rankings`, `/timer`

**Step 4: Commit**

```bash
git add src/app/page.tsx src/components/Dashboard.tsx
git commit -m "refactor: replace root page with redirect, clean up Dashboard"
```

---

### Task 10: Run e2e tests and fix issues

**Step 1: Run e2e tests**

Run: `npx playwright test`

Fix any failures from route changes (e.g., tests that expect content at `/` instead of `/dashboard`).

**Step 2: Commit fixes**

```bash
git add -A
git commit -m "fix: update e2e tests for new route structure"
```
