import { test, expect } from '@playwright/test';
import { signUp, addHabit } from './helpers';

test.describe('Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
    await addHabit(page, 'Guitar');
  });

  test('can toggle to calendar view', async ({ page }) => {
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.getByRole('button', { name: /calendar view/i }).click();

    // Should show month navigation and weekday headers
    await expect(page.getByText('Mon')).toBeVisible();
    await expect(page.getByText('Tue')).toBeVisible();
    await expect(page.getByRole('button', { name: /previous month/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next month/i })).toBeVisible();
  });

  test('session shows on calendar and day detail works', async ({ page }) => {
    // Complete a session
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByText('Stopwatch').click();
    await expect(page.getByText('Recording...')).toBeVisible();
    await page.getByRole('button', { name: /stop/i }).click();

    // Wait for redirect back to dashboard after stopping
    await page.getByRole('heading', { name: '10,000 Hours' }).waitFor();

    // Go to calendar view
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.getByRole('button', { name: /calendar view/i }).click();

    // Click today's date to see the detail panel.
    // Today's button has a ring class distinguishing it from same-numbered
    // days in adjacent months that also appear in the grid.
    const todayButton = page.locator('button.ring-1');
    await todayButton.click();

    // Day detail panel should show Guitar session.
    // Use a specific locator to avoid matching the hidden <option> in the filter dropdown.
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

    // Go to previous month
    await page.getByRole('button', { name: /previous month/i }).click();
    await expect(page.getByText(currentMonth)).not.toBeVisible();
  });

  test('clicking a day with no sessions shows empty message', async ({ page }) => {
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.getByRole('button', { name: /calendar view/i }).click();

    // Click day "1" which likely has no sessions
    const calendarGrid = page.locator('.grid-cols-7').last();
    await calendarGrid.getByRole('button', { name: '1' }).first().click();

    await expect(page.getByText('No sessions this day')).toBeVisible();
  });

  test('can toggle back to list view', async ({ page }) => {
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.getByRole('button', { name: /calendar view/i }).click();

    // Toggle back to list
    await page.getByRole('button', { name: /list view/i }).click();

    // Date range buttons should reappear
    await expect(page.getByRole('button', { name: /all time/i })).toBeVisible();
  });
});
