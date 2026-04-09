import { Page } from '@playwright/test';
import type { Habit, Session } from '../src/lib/types';

// ─── Fixture factories ───

let nextId = 1;

export function makeHabit(overrides: Partial<Habit> & { name: string }): Habit {
  return {
    id: nextId++,
    todaySeconds: 0,
    totalSeconds: 0,
    streak: 0,
    activeTimer: null,
    ...overrides,
  };
}

export function makeSession(
  overrides: Partial<Session> & { habitName: string; habitId: number },
): Session {
  const now = new Date();
  const start = new Date(now.getTime() - 60_000);
  return {
    id: nextId++,
    startTime: start.toISOString(),
    endTime: now.toISOString(),
    durationSeconds: 60,
    timerMode: 'stopwatch',
    ...overrides,
  };
}

// ─── Mock state ───

export type MockState = {
  habits: Habit[];
  sessions: Session[];
  rankings: { rank: number; habitId: number; habitName: string; totalSeconds: number }[];
  featureFlags: Record<string, boolean>;
  /** Track stop calls for assertions */
  stopCalls: { timestamp: number }[];
};

function defaultState(): MockState {
  return {
    habits: [],
    sessions: [],
    rankings: [],
    featureFlags: { logSession: true },
    stopCalls: [],
  };
}

// ─── Main mock setup ───

/**
 * Intercepts all API routes with mock responses.
 * Returns mutable state — mutate before navigation to set up scenarios.
 */
export async function mockApi(
  page: Page,
  initial?: Partial<MockState>,
): Promise<MockState> {
  const state: MockState = { ...defaultState(), ...initial };

  // Habits
  await page.route('**/api/habits', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ habits: state.habits }),
      });
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const habit = makeHabit({ name: body.name });
      state.habits.push(habit);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ habit }),
      });
    } else {
      await route.continue();
    }
  });

  // Habit delete
  await page.route('**/api/habits/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    } else {
      await route.continue();
    }
  });

  // Timer start
  await page.route('**/api/timer/start', async (route) => {
    const body = route.request().postDataJSON();
    const habit = state.habits.find((h) => h.id === body.habitId);
    if (habit) {
      habit.activeTimer = {
        startTime: body.startTime ?? new Date().toISOString(),
        targetDurationSeconds: body.targetDurationSeconds ?? null,
      };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        habitId: body.habitId,
        startTime: habit?.activeTimer?.startTime,
        targetDurationSeconds: body.targetDurationSeconds ?? null,
      }),
    });
  });

  // Timer stop
  await page.route('**/api/timer/stop', async (route) => {
    state.stopCalls.push({ timestamp: Date.now() });
    const activeHabit = state.habits.find((h) => h.activeTimer);
    if (!activeHabit) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No active timer' }),
      });
      return;
    }
    const duration = activeHabit.activeTimer?.targetDurationSeconds ?? 5;
    const timerMode = activeHabit.activeTimer?.targetDurationSeconds
      ? 'countdown'
      : 'stopwatch';
    activeHabit.activeTimer = null;
    // Add a session
    state.sessions.unshift(
      makeSession({
        habitName: activeHabit.name,
        habitId: activeHabit.id,
        durationSeconds: duration,
        timerMode,
      }),
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ durationSeconds: duration }),
    });
  });

  // Sessions
  await page.route('**/api/sessions?*', async (route) => {
    const url = new URL(route.request().url());
    const habitId = url.searchParams.get('habitId');
    let filtered = state.sessions;
    if (habitId) {
      filtered = filtered.filter((s) => s.habitId === Number(habitId));
    }
    const totalSeconds = filtered.reduce((sum, s) => sum + s.durationSeconds, 0);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessions: filtered, totalSeconds }),
    });
  });

  // Sessions (no query string)
  await page.route('**/api/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const habit = state.habits.find((h) => h.id === body.habitId);
      const session = makeSession({
        habitName: habit?.name ?? 'Unknown',
        habitId: body.habitId,
        durationSeconds: body.durationMinutes * 60,
        timerMode: 'manual',
      });
      state.sessions.unshift(session);
      // Update habit todaySeconds
      if (habit) {
        habit.todaySeconds += body.durationMinutes * 60;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ session }),
      });
    } else {
      // GET without query params
      const totalSeconds = state.sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions: state.sessions, totalSeconds }),
      });
    }
  });

  // Session delete
  await page.route('**/api/sessions/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      const url = route.request().url();
      const id = Number(url.split('/').pop());
      state.sessions = state.sessions.filter((s) => s.id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    } else {
      await route.continue();
    }
  });

  // Rankings
  await page.route('**/api/rankings*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rankings: state.rankings }),
    });
  });

  // Feature flags
  await page.route('**/api/features*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.featureFlags),
    });
  });

  return state;
}
