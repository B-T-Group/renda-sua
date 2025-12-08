import { expect, test } from '@playwright/test';
import {
  agentDeliverOrder,
  businessConfirmAndPrepareOrder,
  clientCompleteOrder,
  clientPlaceFirstItemOrder,
  signInAgent,
  signInBusiness,
  signInClient,
  signOut,
} from './helpers/order-flow';

test.describe('Order Lifecycle E2E Tests', () => {
  test('client can place an order', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await signInClient(page);
    await expect(
      page.getByText('Client Dashboard', { exact: false })
    ).toBeVisible({ timeout: 10000 });
    await clientPlaceFirstItemOrder(page);
    await expect(page.getByText(/order.*confirm|success/i)).toBeVisible({
      timeout: 10000,
    });
    await signOut(page);
  });

  test('business can confirm and prepare an order', async ({ page }) => {
    test.setTimeout(60000); // 1 minute timeout for this test
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await signInBusiness(page);
    await expect(
      page.getByRole('heading', { name: 'Welcome to your business' })
    ).toBeVisible({ timeout: 10000 });
    await businessConfirmAndPrepareOrder(page);
    await signOut(page);
    // Expect to be on the home page after completing preparation
    await expect(page).toHaveURL(/\/$/);
  });

  test('agent can deliver order and client can complete it', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await signInAgent(page);
    await agentDeliverOrder(page);
    await expect(page.getByText(/delivered|delivery.*complete/i)).toBeVisible({
      timeout: 10000,
    });
    await signOut(page);

    await signInClient(page);
    await clientCompleteOrder(page);
    await expect(page.getByText(/order.*complete|completed/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
