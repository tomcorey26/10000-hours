import { test, expect } from '@playwright/test';
import { signUp, addHabit } from './helpers';

const HABIT_NAME = 'Piano Practice';

test.describe('Countdown Timer', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
    await addHabit(page, HABIT_NAME);
  });

  test('clicking Start shows mode selection with Stopwatch and Countdown', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();

    await expect(page.getByText('Stopwatch')).toBeVisible();
    await expect(page.getByText('Countdown')).toBeVisible();
  });

  test('selecting Stopwatch starts timer immediately', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByText('Stopwatch').click();

    // Should show the running stopwatch UI
    await expect(page.getByText('Recording...')).toBeVisible();
    await expect(page.getByText(/\d{2}:\d{2}:\d{2}/)).toBeVisible();
  });

  test('selecting Countdown shows duration presets and custom input', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByText('Countdown').click();

    // Preset buttons
    await expect(page.getByText('15m')).toBeVisible();
    await expect(page.getByText('25m')).toBeVisible();
    await expect(page.getByText('30m')).toBeVisible();
    await expect(page.getByText('45m')).toBeVisible();
    await expect(page.getByText('60m')).toBeVisible();

    // Custom minutes input
    await expect(page.getByPlaceholder(/minutes/i)).toBeVisible();
  });

  test('selecting a preset and clicking Start begins countdown', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByText('Countdown').click();
    await page.getByText('25m').click();
    await page.getByRole('button', { name: /start/i }).click();

    // Should show countdown time (25:00 or 24:59 depending on timing)
    await expect(page.getByText(/2[45]:\d{2}/)).toBeVisible();
  });

  test('entering custom minutes and clicking Start begins countdown', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByText('Countdown').click();
    await page.getByPlaceholder(/minutes/i).fill('10');
    await page.getByRole('button', { name: /start/i }).click();

    // Should show countdown time around 10:00
    await expect(page.getByText(/(?:10|09):\d{2}/)).toBeVisible();
  });

  test('going back to dashboard shows remaining time on habit card', async ({ page }) => {
    // Start a 25-minute countdown
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByText('Countdown').click();
    await page.getByText('25m').click();
    await page.getByRole('button', { name: /start/i }).click();

    // Go back to dashboard
    await page.getByText(/back/i).click();

    // Habit card should show remaining countdown time
    await expect(page.getByText(/2[45]:\d{2}/)).toBeVisible();
  });

  test('Cancel on mode selection returns to dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();

    // Verify we're on mode selection
    await expect(page.getByText('Stopwatch')).toBeVisible();

    // Cancel should return to dashboard
    await page.getByText('Cancel').click();

    // Should be back on dashboard with the habit visible
    await expect(page.getByRole('heading', { name: '10,000 Hours' })).toBeVisible();
    await expect(page.getByText(HABIT_NAME)).toBeVisible();
  });
});
