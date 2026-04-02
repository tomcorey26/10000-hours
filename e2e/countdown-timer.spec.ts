import { test, expect } from '@playwright/test';
import { signUp, addHabit } from './helpers';
import { APP_NAME } from '../src/data/app';

const HABIT_NAME = 'Piano Practice';

test.describe('Unified Timer Start', () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page);
    await addHabit(page, HABIT_NAME);
  });

  test('clicking Start shows unified timer screen with toggle and Start button', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();

    // Toggle options visible
    await expect(page.getByRole('button', { name: 'Stopwatch' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Countdown' })).toBeVisible();

    // Single Start button always visible
    await expect(page.getByRole('button', { name: /^start$/i })).toBeVisible();
  });

  test('stopwatch mode hides duration options', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();

    // Stopwatch is default — no duration presets visible
    await expect(page.getByText('15m')).not.toBeVisible();
    await expect(page.getByPlaceholder(/minutes/i)).not.toBeVisible();
  });

  test('selecting Countdown shows duration presets with 25m default selected', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByRole('button', { name: 'Countdown' }).click();

    // Preset buttons visible
    await expect(page.getByText('15m')).toBeVisible();
    await expect(page.getByText('25m')).toBeVisible();
    await expect(page.getByText('30m')).toBeVisible();
    await expect(page.getByText('45m')).toBeVisible();
    await expect(page.getByText('60m')).toBeVisible();

    // Custom input shows 25 (matching default selection)
    await expect(page.getByLabel('min')).toHaveValue('25');
  });

  test('clicking a preset updates the custom input to match', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByRole('button', { name: 'Countdown' }).click();

    await page.getByText('45m').click();
    await expect(page.getByLabel('min')).toHaveValue('45');
  });

  test('starting in stopwatch mode begins recording', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    // Stopwatch is default, just click Start
    await page.getByRole('button', { name: /^start$/i }).click();

    await expect(page.getByText('Recording...')).toBeVisible();
    await expect(page.locator('p').filter({ hasText: /\d{2}:\d{2}:\d{2}/ })).toBeVisible();
  });

  test('starting in countdown mode begins countdown', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByRole('button', { name: 'Countdown' }).click();
    // 25m is default selected
    await page.getByRole('button', { name: /^start$/i }).click();

    await expect(page.locator('p').filter({ hasText: /2[45]:\d{2}/ })).toBeVisible();
  });

  test('custom minutes starts correct countdown', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByRole('button', { name: 'Countdown' }).click();
    await page.getByLabel('min').fill('10');
    await page.getByRole('button', { name: /^start$/i }).click();

    await expect(page.locator('p').filter({ hasText: /(?:10|09):\d{2}/ })).toBeVisible();
  });

  test('Cancel returns to dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByText('Cancel').click();

    await expect(page.getByRole('heading', { name: APP_NAME })).toBeVisible();
    await expect(page.getByText(HABIT_NAME)).toBeVisible();
  });

  test('remembers last used mode across sessions', async ({ page }) => {
    // Start a countdown timer
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByRole('button', { name: 'Countdown' }).click();
    await page.getByText('45m').click();
    await page.getByRole('button', { name: /^start$/i }).click();

    // End session and go back
    await page.getByRole('button', { name: /end session/i }).click();
    await page.getByRole('button', { name: /back to habits/i }).click();

    // Start again — should remember countdown mode with 45 min
    await page.getByRole('button', { name: /start/i }).click();
    await expect(page.getByLabel('min')).toHaveValue('45');
  });
});
