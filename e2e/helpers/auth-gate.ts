import { Page } from '@playwright/test';

const API_GLOB = '**/api/**';

export async function mockClientFlags(
  page: Page,
  flags: Record<string, boolean>
): Promise<void> {
  await page.route(`${API_GLOB}/app-config/client-flags*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: flags }),
    });
  });
}

export async function mockPasswordLoginAvailability(
  page: Page,
  available: boolean
): Promise<void> {
  await page.route(`${API_GLOB}/auth/password-login`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: available ? 400 : 404,
        contentType: 'application/json',
        body: JSON.stringify(
          available
            ? { error: 'Invalid credentials' }
            : { error: 'Not found' }
        ),
      });
      return;
    }
    await route.continue();
  });
}

export async function mockOtpStart(page: Page): Promise<void> {
  await page.route(`${API_GLOB}/auth/login/start-otp`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        flowId: 'test-flow',
        channel: 'email',
        maskedEmail: 'u***@example.com',
        codeExpiresAt: new Date(Date.now() + 600_000).toISOString(),
        resendAvailableAt: new Date(Date.now() + 120_000).toISOString(),
      }),
    });
  });
}
