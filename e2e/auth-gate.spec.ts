import { expect, test } from '@playwright/test';
import {
  mockClientFlags,
  mockOtpStart,
  mockPasswordLoginAvailability,
} from './helpers/auth-gate';

/**
 * Auth gate UI with mocked API flags/endpoints.
 * Full OTP flows need DEV stack + test users (see e2e/README.md).
 */
test.describe('Auth gate (mocked flags)', () => {
  test.beforeEach(async ({ page }) => {
    await mockOtpStart(page);
  });

  test('shows gate for interest when flag on', async ({ page }) => {
    await mockClientFlags(page, { auth_web_inapp_gates: true });
    await mockPasswordLoginAvailability(page, false);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const interestButton = page
      .getByRole('button', {
        name: /interested|intéressé/i,
      })
      .first();
    if ((await interestButton.count()) === 0) {
      test.skip(true, 'No public inventory card on homepage');
    }
    await interestButton.click();

    await expect(
      page.getByRole('heading', {
        name: /Tell the seller you're interested|Montrez votre intérêt/i,
      })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('button', { name: /Send code|Envoyer le code/i })
    ).toBeVisible();
  });

  test('hides password link when password-login is 404', async ({ page }) => {
    await mockClientFlags(page, { auth_web_inapp_gates: true });
    await mockPasswordLoginAvailability(page, false);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const interestButton = page
      .getByRole('button', { name: /interested|intéressé/i })
      .first();
    if ((await interestButton.count()) === 0) {
      test.skip(true, 'No public inventory card on homepage');
    }
    await interestButton.click();

    await page.getByRole('button', { name: /Use email instead|Utiliser l'e-mail/i }).click();
    await expect(
      page.getByRole('button', { name: /Use password instead|Utiliser un mot de passe/i })
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('shows password link when endpoint exists', async ({ page }) => {
    await mockClientFlags(page, { auth_web_inapp_gates: true });
    await mockPasswordLoginAvailability(page, true);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const interestButton = page
      .getByRole('button', { name: /interested|intéressé/i })
      .first();
    if ((await interestButton.count()) === 0) {
      test.skip(true, 'No public inventory card on homepage');
    }
    await interestButton.click();

    await page.getByRole('button', { name: /Use email instead|Utiliser l'e-mail/i }).click();
    await expect(
      page.getByRole('button', { name: /Use password instead|Utiliser un mot de passe/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('flag off keeps Auth0 path for header sign in', async ({ page }) => {
    await mockClientFlags(page, { auth_web_inapp_gates: false });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Login with email\/password/i })
    ).toBeVisible();
  });
});
