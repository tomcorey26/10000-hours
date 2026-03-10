import { Page, expect } from '@playwright/test';

/**
 * Signs up a new user with a unique email and returns the email used.
 * Ends on the dashboard page with "10,000 Hours" heading visible.
 */
export async function signUp(page: Page) {
  const email = `test-${Date.now()}@example.com`;
  const password = 'testpass123';

  await page.goto('/login');

  // Switch from Sign In (default) to Sign Up mode
  await page.getByRole('button', { name: 'Sign up' }).click();

  // Fill in the sign-up form
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  // Submit the form
  await page.getByRole('button', { name: 'Sign Up' }).click();

  // Wait for dashboard to load — the heading appears in Dashboard's header
  await page.getByRole('heading', { name: '10,000 Hours' }).waitFor();

  return email;
}

/**
 * Adds a habit with the given name from the dashboard.
 * Assumes the user is already signed in and on the dashboard.
 */
export async function addHabit(page: Page, name: string) {
  await page.getByPlaceholder('New habit name...').fill(name);
  await page.getByRole('button', { name: 'Add' }).click();

  // Wait for the habit to appear in the list
  await page.getByText(name).waitFor();
}

/**
 * Starts a stopwatch session for the first habit's Start button.
 * Uses the unified timer start screen (toggle + Start button).
 */
export async function startStopwatch(page: Page) {
  await page.getByRole('button', { name: /^start$/i }).click();
  // Stopwatch is default mode, just click Start
  await page.getByRole('button', { name: /^start$/i }).click();
  await expect(page.getByText('Recording...')).toBeVisible();
}

/**
 * Starts a stopwatch for a specific habit when multiple exist.
 */
export async function startStopwatchFirst(page: Page) {
  await page.locator('button', { hasText: /start/i }).first().click();
  await page.getByRole('button', { name: /^start$/i }).click();
  await expect(page.getByText('Recording...')).toBeVisible();
}

/**
 * Stops the currently running timer session.
 * Waits for the success screen to appear.
 */
export async function stopSession(page: Page) {
  await page.getByRole('button', { name: /end session/i }).click();
  await page.getByRole('button', { name: /back to habits/i }).waitFor();
  await page.getByRole('button', { name: /back to habits/i }).click();
}
