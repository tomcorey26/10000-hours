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
    await page.getByRole('button', { name: /sessions/i }).click();

    // Should show the completed session card with habit name and mode
    await expect(page.locator('.font-medium', { hasText: 'Guitar' })).toBeVisible();
    await expect(page.locator('.rounded-full', { hasText: 'stopwatch' })).toBeVisible();
  });
});
