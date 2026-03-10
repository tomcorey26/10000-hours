import { test, expect } from '@playwright/test';
import { signUp, addHabit, startStopwatch, stopSession } from './helpers';

test.describe('Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
    await addHabit(page, 'Guitar');
  });

  test('can toggle to calendar view', async ({ page }) => {
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.getByRole('button', { name: /calendar view/i }).click();

    await expect(page.getByText('Mon')).toBeVisible();
    await expect(page.getByText('Tue')).toBeVisible();
    await expect(page.getByRole('button', { name: /previous month/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next month/i })).toBeVisible();
  });

  test('session shows on calendar and day detail works', async ({ page }) => {
    await startStopwatch(page);
    await stopSession(page);

    // Go to calendar view
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.getByRole('button', { name: /calendar view/i }).click();

    const todayButton = page.locator('button.ring-1');
    await todayButton.click();

    await expect(page.locator('.font-medium', { hasText: 'Guitar' })).toBeVisible();
  });

  test('can navigate between months', async ({ page }) => {
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.getByRole('button', { name: /calendar view/i }).click();

    const currentMonth = new Date().toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
    await expect(page.getByText(currentMonth)).toBeVisible();

    await page.getByRole('button', { name: /previous month/i }).click();
    await expect(page.getByText(currentMonth)).not.toBeVisible();
  });

  test('clicking a day with no sessions shows empty message', async ({ page }) => {
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.getByRole('button', { name: /calendar view/i }).click();

    const calendarGrid = page.locator('.grid-cols-7').last();
    await calendarGrid.getByRole('button', { name: '1' }).first().click();

    await expect(page.getByText('No sessions this day')).toBeVisible();
  });

  test('can toggle back to list view', async ({ page }) => {
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.getByRole('button', { name: /calendar view/i }).click();

    await page.getByRole('button', { name: /list view/i }).click();

    await expect(page.getByRole('button', { name: /all time/i })).toBeVisible();
  });
});
