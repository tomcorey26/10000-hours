import { test, expect } from '@playwright/test';
import { signUp, addHabit } from './helpers';

test.describe('Manual Session Logging', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
    await addHabit(page, 'Guitar');
  });

  test('can log a manual session from habit card', async ({ page }) => {
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    await expect(page.getByText('Log Session')).toBeVisible();
    await page.getByLabel('Duration (minutes)').fill('45');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('Log Session')).not.toBeVisible();
    await expect(page.getByText('Today: 45m')).toBeVisible();
  });

  test('manual session appears in sessions history', async ({ page }) => {
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    await page.getByLabel('Duration (minutes)').fill('30');
    await page.getByRole('button', { name: /save/i }).click();
    await page.getByRole('button', { name: /sessions/i }).click();
    await expect(page.locator('.font-medium', { hasText: 'Guitar' })).toBeVisible();
  });

  test('can select a past date for manual session', async ({ page }) => {
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    const dateSelect = page.getByLabel('Date');
    await expect(dateSelect).toBeVisible();
    const options = dateSelect.locator('option');
    await expect(options).toHaveCount(7);
    await dateSelect.selectOption({ index: 1 });
    await page.getByLabel('Duration (minutes)').fill('60');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByText('Log Session')).not.toBeVisible();
  });

  test('validates duration is required and positive', async ({ page }) => {
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();
    await page.getByLabel('Duration (minutes)').fill('0');
    await expect(page.getByRole('button', { name: /save/i })).toBeDisabled();
  });
});
