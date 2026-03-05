import { test, expect } from '@playwright/test';
import { signUp, addHabit } from './helpers';

test.describe('Sessions History', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
    await addHabit(page, 'Guitar');
  });

  test('completed session appears in Sessions tab', async ({ page }) => {
    // Start and stop a stopwatch session
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByText('Stopwatch').click();
    await expect(page.getByText('Recording...')).toBeVisible();
    await page.getByRole('button', { name: /stop/i }).click();

    // Navigate to Sessions tab
    await page.getByRole('link', { name: /sessions/i }).click();

    // Should show the completed session card with habit name and mode
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
    await page.getByText('Countdown').click();
    await page.getByText('15m').click();
    await page.getByRole('button', { name: /start/i }).click();

    // Stop it
    await page.getByRole('button', { name: /stop/i }).click();

    // Go to Sessions tab
    await page.getByRole('link', { name: /sessions/i }).click();

    await expect(page.locator('.rounded-full', { hasText: 'countdown' })).toBeVisible();
  });

  test('can filter sessions by skill', async ({ page }) => {
    // Add a second habit
    await addHabit(page, 'Reading');

    // Complete a Guitar session
    await page.locator('button', { hasText: /start/i }).first().click();
    await page.getByText('Stopwatch').click();
    await expect(page.getByText('Recording...')).toBeVisible();
    await page.getByRole('button', { name: /stop/i }).click();

    // Navigate to Sessions tab
    await page.getByRole('link', { name: /sessions/i }).click();

    // Should show Guitar session
    await expect(page.locator('.font-medium', { hasText: 'Guitar' })).toBeVisible();

    // Filter by Reading — should show no sessions
    await page.locator('select').selectOption({ label: 'Reading' });
    await expect(page.getByText('No sessions yet')).toBeVisible();

    // Filter by Guitar — should show the session again
    await page.locator('select').selectOption({ label: 'Guitar' });
    await expect(page.locator('.font-medium', { hasText: 'Guitar' })).toBeVisible();
  });
});
