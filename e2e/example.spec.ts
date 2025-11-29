import { expect, test } from '@playwright/test';

test.describe('Rendasua Dev Site', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check that the page title is present or page loaded successfully
    await expect(page).toHaveTitle(/Rendasua/i, { timeout: 10000 });
  });

  test('should sign in and place an order', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).click();
    await page
      .getByRole('textbox', { name: 'Email address' })
      .fill('besongsamueloru+test@gmail.com');
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill('{Shaddy12}');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search items...' }).click();
    await page
      .getByRole('textbox', { name: 'Search items...' })
      .fill('Computer');
    await page.getByRole('button', { name: 'Buy Now' }).click();
    await page.getByRole('button', { name: 'Confirm Order' }).click();
    await page.getByRole('button', { name: 'Go to Dashboard' }).click();
    await expect(
      page.getByText('Client Dashboard', { exact: false })
    ).toBeVisible();
  });

  test('business should be able to sign in and confirm an order', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).click();
    await page
      .getByRole('textbox', { name: 'Email address' })
      .fill('besongsamueloru+business5@gmail.com');
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill('{Shaddy12}');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Welcome to your business' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Manage' }).first().click();
    await page.getByRole('button', { name: 'Confirm Order' }).first().click();
    await page.getByRole('button', { name: 'Choose date' }).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('gridcell', { name: '17' }).click();
    await page
      .locator('div')
      .filter({
        hasText: /^Morning FastAvailable09:00:00 - 12:00:005 spots available$/,
      })
      .nth(2)
      .click();
    await page.getByRole('button', { name: 'Confirm Order' }).click();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify page loads on mobile
    await expect(page).toHaveTitle(/Rendasua/i, { timeout: 10000 });
  });
});
