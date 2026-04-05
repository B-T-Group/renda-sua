import { expect, test } from '@playwright/test';
import {
  agentCompleteDeliveryWithPin,
  businessConfirmAndPrepareOrder,
  clientGetDeliveryPinFromOrdersPage,
  clientPlaceFirstItemOrder,
  signInUser,
  signOut
} from './helpers/order-flow';

test.describe('Order Lifecycle E2E Tests', () => {
  test('client can place an order', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await signInUser(page, 'client');
    await expect(
      page.getByText('Client Dashboard', { exact: false })
    ).toBeVisible({ timeout: 10000 });
    await clientPlaceFirstItemOrder(page);
    await expect(
      page.getByText('Client Dashboard', { exact: false })
    ).toBeVisible({ timeout: 10000 });
    await signOut(page);
  });

  test('business can confirm and prepare an order', async ({ page }) => {
    test.setTimeout(60000); // 1 minute timeout for this test
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await signInUser(page, 'business');
    await expect(
      page.getByRole('heading', { name: 'Welcome to your business' })
    ).toBeVisible({ timeout: 10000 });
    await businessConfirmAndPrepareOrder(page);
    await signOut(page);
  });

  test('agent can deliver order', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await signInUser(page, 'client');
    const deliveryPin = await clientGetDeliveryPinFromOrdersPage(page);
    console.log('deliveryPin', deliveryPin);
    await signOut(page);

    await signInUser(page, 'agent');
    await agentCompleteDeliveryWithPin(page, deliveryPin);
    await expect(
      page.getByText(/delivered|excellent work|successfully delivered/i).first()
    ).toBeVisible({
      timeout: 20000,
    });
    await signOut(page);
  });

  
});
