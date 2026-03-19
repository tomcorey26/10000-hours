import { test, expect } from '@playwright/test';
import { signUp, addHabit } from './helpers';

const HABIT_NAME = 'Guitar';

/**
 * Start a countdown timer via the API directly so we can use very short durations.
 * Returns the habitId.
 */
async function startCountdownViaApi(page: import('@playwright/test').Page, seconds: number) {
  // Get habits to find the habitId
  const habitsRes = await page.request.get('/api/habits');
  const { habits } = await habitsRes.json();
  const habit = habits.find((h: { name: string }) => h.name === HABIT_NAME);

  await page.request.post('/api/timer/start', {
    data: { habitId: habit.id, targetDurationSeconds: seconds },
  });

  return habit.id;
}

test.describe('Countdown Auto-Stop', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
    await addHabit(page, HABIT_NAME);
  });

  test('auto-stops and shows success screen when countdown finishes on timer page', async ({ page }) => {
    await startCountdownViaApi(page, 3);
    await page.goto('/timer');

    await expect(page.getByText('Counting down...')).toBeVisible();

    // Wait for auto-stop — success screen should appear
    await expect(page.getByText('Session Complete!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /back to habits/i })).toBeVisible();
  });

  test('records capped duration for countdown (not wall-clock time)', async ({ page }) => {
    await startCountdownViaApi(page, 2);
    await page.goto('/timer');

    // Wait for success screen
    await expect(page.getByText('Session Complete!')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /back to habits/i }).click();

    // Check sessions tab — duration should be ~2s, not more
    await page.getByRole('link', { name: /sessions/i }).click();
    await expect(page.locator('.font-medium', { hasText: HABIT_NAME })).toBeVisible();
    await expect(page.locator('.rounded-full', { hasText: 'countdown' })).toBeVisible();
    // The duration text should show "2s" (capped at target)
    await expect(page.locator('.font-mono', { hasText: '2s' })).toBeVisible();
  });

  test('auto-stops with toast when user navigates away during countdown', async ({ page }) => {
    await startCountdownViaApi(page, 3);
    await page.goto('/timer');

    await expect(page.getByText('Counting down...')).toBeVisible();

    // Navigate away before countdown finishes
    await page.goto('/habits');

    // Wait for the countdown to expire and CountdownAutoStop to fire
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('session was recorded');
  });

  test('shows toast on return when timer expired while away (server-side auto-stop)', async ({ page }) => {
    // Start a 1-second countdown so it expires immediately
    await startCountdownViaApi(page, 1);

    // Wait for it to definitely expire
    await page.waitForTimeout(2000);

    // Navigate to skills — server should auto-stop and show toast
    await page.goto('/habits');

    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('auto-recorded');
  });

  test('stopwatch is not affected by auto-stop logic', async ({ page }) => {
    // Start a stopwatch via API
    const habitsRes = await page.request.get('/api/habits');
    const { habits } = await habitsRes.json();
    const habit = habits.find((h: { name: string }) => h.name === HABIT_NAME);
    await page.request.post('/api/timer/start', {
      data: { habitId: habit.id },
    });

    await page.goto('/timer');

    // Should show recording, not auto-stop
    await expect(page.getByText('Recording...')).toBeVisible();

    // Wait a few seconds — should still be recording (no auto-stop)
    await page.waitForTimeout(3000);
    await expect(page.getByText('Recording...')).toBeVisible();
    await expect(page.getByText('Session Complete!')).not.toBeVisible();
  });
});
