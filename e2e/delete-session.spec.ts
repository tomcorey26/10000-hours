import { test, expect } from '@playwright/test';
import { signUp, addHabit, startStopwatch, stopSession } from './helpers';

test.describe('Delete session with undo', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
    await addHabit(page, 'Piano');
    await startStopwatch(page);
    await stopSession(page);
    await page.getByRole('link', { name: /sessions/i }).click();
    await expect(page.locator('.font-medium', { hasText: 'Piano' })).toBeVisible();
  });

  test('deleting a session removes it and shows undo toast', async ({ page }) => {
    await page.getByLabel('Delete session').click();

    // Session should disappear
    await expect(page.locator('.font-medium', { hasText: 'Piano' })).not.toBeVisible();

    // Undo toast should appear
    await expect(page.getByText('Piano session deleted')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  });

  test('clicking undo restores the deleted session', async ({ page }) => {
    await page.getByLabel('Delete session').click();
    await expect(page.locator('.font-medium', { hasText: 'Piano' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Undo' }).click();

    // Session should reappear
    await expect(page.locator('.font-medium', { hasText: 'Piano' })).toBeVisible();
  });
});
