import { test, expect } from '@playwright/test';

test.describe('Auth Form Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test.describe('client-side validation', () => {
    test('shows error for empty email on blur', async ({ page }) => {
      await page.getByLabel('Email').focus();
      await page.getByLabel('Password').focus();
      await expect(page.getByText('Email is required')).toBeVisible();
    });

    test('shows error for invalid email format on blur', async ({ page }) => {
      await page.getByLabel('Email').fill('notanemail');
      await page.getByLabel('Password').focus();
      await expect(page.getByText('Enter a valid email address')).toBeVisible();
    });

    test('shows error for empty password on blur', async ({ page }) => {
      await page.getByLabel('Password').focus();
      await page.getByLabel('Email').focus();
      await expect(page.getByText('Password is required')).toBeVisible();
    });

    test('shows error for short password on signup', async ({ page }) => {
      await page.getByRole('button', { name: 'Sign up' }).click();
      await page.getByLabel('Password').fill('short');
      await page.getByLabel('Email').focus();
      await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
    });

    test('does not require 8 char password for login mode', async ({ page }) => {
      await page.getByLabel('Password').fill('short');
      await page.getByLabel('Email').focus();
      await expect(page.getByText('Password must be at least 8 characters')).not.toBeVisible();
    });

    test('shows validation errors on submit with empty fields', async ({ page }) => {
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page.getByText('Email is required')).toBeVisible();
      await expect(page.getByText('Password is required')).toBeVisible();
    });
  });

  test.describe('server errors — login', () => {
    test('shows error for invalid credentials (401)', async ({ page }) => {
      await page.route('**/api/auth/login', (route) =>
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid email or password' }),
        }),
      );

      await page.getByLabel('Email').fill('user@example.com');
      await page.getByLabel('Password').fill('wrongpassword');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await expect(page.getByRole('alert').filter({ hasText: 'Invalid email or password' })).toBeVisible();
    });

    test('shows error for bad request (400)', async ({ page }) => {
      await page.route('**/api/auth/login', (route) =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid input' }),
        }),
      );

      await page.getByLabel('Email').fill('user@example.com');
      await page.getByLabel('Password').fill('somepassword');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await expect(page.getByRole('alert').filter({ hasText: 'Invalid input' })).toBeVisible();
    });

    test('shows generic error for network failure', async ({ page }) => {
      await page.route('**/api/auth/login', (route) => route.abort());

      await page.getByLabel('Email').fill('user@example.com');
      await page.getByLabel('Password').fill('somepassword');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await expect(page.getByRole('alert').filter({ hasText: 'Something went wrong' })).toBeVisible();
    });
  });

  test.describe('server errors — signup', () => {
    test('shows email field error for duplicate email (409)', async ({ page }) => {
      await page.route('**/api/auth/signup', (route) =>
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Email already in use' }),
        }),
      );

      await page.getByRole('button', { name: 'Sign up' }).click();
      await page.getByLabel('Email').fill('taken@example.com');
      await page.getByLabel('Password').fill('password123');
      await page.getByRole('button', { name: 'Sign Up' }).click();

      await expect(page.getByText('An account with this email already exists')).toBeVisible();
    });

    test('shows error for invalid signup input (400)', async ({ page }) => {
      await page.route('**/api/auth/signup', (route) =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid email or password (min 8 chars)' }),
        }),
      );

      await page.getByRole('button', { name: 'Sign up' }).click();
      await page.getByLabel('Email').fill('user@example.com');
      await page.getByLabel('Password').fill('password123');
      await page.getByRole('button', { name: 'Sign Up' }).click();

      await expect(page.getByRole('alert').filter({ hasText: 'Invalid email or password (min 8 chars)' })).toBeVisible();
    });
  });

  test.describe('mode toggling', () => {
    test('clears errors when switching between login and signup', async ({ page }) => {
      // Trigger a validation error
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page.getByText('Email is required')).toBeVisible();

      // Toggle to signup — errors should clear
      await page.getByRole('button', { name: 'Sign up' }).click();
      await expect(page.getByText('Email is required')).not.toBeVisible();
    });

    test('clears field values when switching modes', async ({ page }) => {
      await page.getByLabel('Email').fill('user@example.com');
      await page.getByLabel('Password').fill('password123');

      await page.getByRole('button', { name: 'Sign up' }).click();

      await expect(page.getByLabel('Email')).toHaveValue('');
      await expect(page.getByLabel('Password')).toHaveValue('');
    });
  });
});
