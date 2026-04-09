import { Page } from '@playwright/test';

/**
 * Create a habit via the real API. Returns the habit id.
 */
export async function createHabit(page: Page, name: string): Promise<number> {
  const res = await page.request.post('/api/habits', {
    data: { name },
  });
  const { habit } = await res.json();
  return habit.id;
}

/**
 * Start a timer via the real API.
 */
export async function startTimer(
  page: Page,
  habitId: number,
  opts?: { targetDurationSeconds?: number },
) {
  await page.request.post('/api/timer/start', {
    data: { habitId, ...opts },
  });
}

/**
 * Stop any active timer via the real API (cleanup).
 */
export async function stopTimer(page: Page) {
  await page.request.post('/api/timer/stop');
}

/**
 * Delete all habits for the current user (cleanup).
 */
export async function deleteAllHabits(page: Page) {
  const res = await page.request.get('/api/habits');
  const { habits } = await res.json();
  for (const habit of habits) {
    await page.request.delete(`/api/habits/${habit.id}`);
  }
}

/**
 * Intercept POST /api/timer/stop to track how many times it's called.
 * The request still hits the real server.
 */
export async function trackStopCalls(page: Page) {
  const calls: { timestamp: number }[] = [];
  await page.route('**/api/timer/stop', async (route) => {
    calls.push({ timestamp: Date.now() });
    await route.continue();
  });
  return calls;
}
