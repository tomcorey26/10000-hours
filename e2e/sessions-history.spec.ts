import { test, expect } from '@playwright/test';
import { signUp, addHabit, startStopwatch, startStopwatchFirst, stopSession } from './helpers';

test.describe('Sessions History', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
    await addHabit(page, 'Guitar');
  });

  test('completed session appears in Sessions tab', async ({ page }) => {
    await startStopwatch(page);
    await stopSession(page);

    await page.getByRole('link', { name: /sessions/i }).click();

    await expect(page.locator('.font-medium', { hasText: 'Guitar' })).toBeVisible();
    await expect(page.locator('.rounded-full', { hasText: 'stopwatch' })).toBeVisible();
  });

  test('sessions tab shows "No sessions yet" when empty', async ({ page }) => {
    await page.getByRole('link', { name: /sessions/i }).click();
    await expect(page.getByText('No sessions yet')).toBeVisible();
  });

  test('countdown session shows countdown mode badge', async ({ page }) => {
    // Start a countdown session
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByRole('button', { name: 'Countdown' }).click();
    await page.getByText('15m').click();
    await page.getByRole('button', { name: /^start$/i }).click();

    // Stop it
    await page.getByRole('button', { name: /end session/i }).click();
    await page.getByRole('button', { name: /back to habits/i }).click();

    // Go to Sessions tab
    await page.getByRole('link', { name: /sessions/i }).click();

    await expect(page.locator('.rounded-full', { hasText: 'countdown' })).toBeVisible();
  });

  test('can filter sessions by skill', async ({ page }) => {
    await addHabit(page, 'Reading');

    // Complete a Guitar session
    await startStopwatchFirst(page);
    await stopSession(page);

    await page.getByRole('link', { name: /sessions/i }).click();

    await expect(page.locator('.font-medium', { hasText: 'Guitar' })).toBeVisible();

    await page.locator('select').selectOption({ label: 'Reading' });
    await expect(page.getByText('No sessions yet')).toBeVisible();

    await page.locator('select').selectOption({ label: 'Guitar' });
    await expect(page.locator('.font-medium', { hasText: 'Guitar' })).toBeVisible();
  });
});
