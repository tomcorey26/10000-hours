import { request } from '@playwright/test';

const STORAGE_STATE_PATH = '.playwright-auth.json';
const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'e2e-test@test.local';
const TEST_PASSWORD = 'testpassword123';

async function globalSetup() {
  const context = await request.newContext({ baseURL: BASE_URL });

  // Try signup first; fall back to login if user already exists
  const signupRes = await context.post('/api/auth/signup', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });

  if (signupRes.status() === 409) {
    // User already exists — login instead
    const loginRes = await context.post('/api/auth/login', {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    if (!loginRes.ok()) {
      throw new Error(`E2E login failed: ${loginRes.status()} ${await loginRes.text()}`);
    }
  } else if (!signupRes.ok()) {
    throw new Error(`E2E signup failed: ${signupRes.status()} ${await signupRes.text()}`);
  }

  // Save authenticated state (session cookie)
  await context.storageState({ path: STORAGE_STATE_PATH });
  await context.dispose();
}

export default globalSetup;
