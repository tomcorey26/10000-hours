import { test, expect } from '@playwright/test';
import { signUp, addHabit } from './helpers';

test.describe('Rankings', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
  });

  test('rankings tab shows "No rankings yet" when no sessions exist', async ({ page }) => {
    await page.getByRole('link', { name: /rankings/i }).click();
    await expect(page.getByText('No rankings yet')).toBeVisible();
  });

  test('rankings tab shows skills ranked by total time', async ({ page }) => {
    // Add two habits
    await addHabit(page, 'Guitar');
    await addHabit(page, 'Reading');

    // Complete a Guitar session
    await page.locator('button', { hasText: /start/i }).first().click();
    await page.getByText('Stopwatch').click();
    await expect(page.getByText('Recording...')).toBeVisible();
    await page.getByRole('button', { name: /stop/i }).click();

    // Go to Rankings tab
    await page.getByRole('link', { name: /rankings/i }).click();

    // Guitar should appear ranked #1
    await expect(page.getByText('Guitar')).toBeVisible();
    await expect(page.getByText('#1')).toBeVisible();

    // Reading should NOT appear (no sessions)
    await expect(page.getByText('Reading')).not.toBeVisible();
  });
});
