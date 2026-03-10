import { test, expect } from '@playwright/test';
import { signUp, addHabit, startStopwatchFirst, stopSession } from './helpers';

test.describe('Rankings', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
  });

  test('rankings tab shows "No rankings yet" when no sessions exist', async ({ page }) => {
    await page.getByRole('link', { name: /rankings/i }).click();
    await expect(page.getByText('No rankings yet')).toBeVisible();
  });

  test('rankings tab shows skills ranked by total time', async ({ page }) => {
    await addHabit(page, 'Guitar');
    await addHabit(page, 'Reading');

    // Complete a Guitar session
    await startStopwatchFirst(page);
    await stopSession(page);

    await page.getByRole('link', { name: /rankings/i }).click();

    await expect(page.getByText('Guitar')).toBeVisible();
    await expect(page.getByText('#1')).toBeVisible();
    await expect(page.getByText('Reading')).not.toBeVisible();
  });
});
