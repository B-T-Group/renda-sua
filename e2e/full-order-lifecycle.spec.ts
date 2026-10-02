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

/**
 * Pay-after-the-store-confirms (per-location `pay_at_confirm`, epic #410).
 *
 * Needs a MoMo-market test environment where the test business's location has
 * `pay_at_confirm = true`, the kill switch `pay_after_confirm_location_flag_enabled` is on,
 * and E2E_PAY_AT_CONFIRM_SEARCH names a NON-cooked item sold from that location.
 * Skipped otherwise. The MoMo payment itself is NOT automated (sandbox UAT stays manual).
 */
const PAY_AT_CONFIRM_SEARCH = process.env.E2E_PAY_AT_CONFIRM_SEARCH;

test.describe('Pay after the store confirms (flagged location, non-cooked)', () => {
  test.skip(
    !PAY_AT_CONFIRM_SEARCH,
    'Set E2E_PAY_AT_CONFIRM_SEARCH to an item sold from a pay_at_confirm location'
  );

  test('client places a pay-after order without paying now', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await signInUser(page, 'client');

    await page.goto('/items');
    const search = page.getByRole('textbox', {
      name: /Search items|Search the item catalog|Rechercher des articles|Rechercher dans le catalogue/i,
    });
    await search.waitFor({ state: 'visible', timeout: 20000 });
    await search.fill(PAY_AT_CONFIRM_SEARCH as string);
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Buy Now' }).first().click();

    // Checkout explains pay-after (store copy) and offers no scheduling.
    await expect(
      page.getByText(/Pay after the store confirms|Payez après confirmation du magasin/i).first()
    ).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Confirm Order' }).click();

    // Navigates on the create response: confirmation page, no MoMo await screen.
    await expect(
      page.getByText(/Order Placed Successfully|Commande Passée avec Succès/i)
    ).toBeVisible({ timeout: 20000 });
    await expect(
      page.getByText(/Pay after the store confirms|Payez après confirmation du magasin/i).first()
    ).toBeVisible();
    await signOut(page);
  });

  test('business confirms with the store variant (no ready-in prompt)', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await signInUser(page, 'business');
    await page.goto('/orders');
    await page.waitForLoadState('domcontentloaded');

    const card = page
      .locator('.MuiCard-root')
      .filter({
        has: page.getByRole('button', {
          name: /Confirm Order|Confirmer la Commande/i,
        }),
      })
      .first();
    await card.waitFor({ state: 'visible', timeout: 25000 });
    await card.getByRole('button', { name: /Confirm Order|Confirmer la Commande/i }).click();

    const modal = page.getByRole('dialog');
    await expect(
      modal.getByText(/Confirm this order|Confirmer cette commande/i)
    ).toBeVisible({ timeout: 15000 });
    // Store variant never asks "When will it be ready?".
    await expect(
      modal.getByText(/When will it be ready\?|Quand sera-t-elle prête/i)
    ).toHaveCount(0);
    await modal
      .getByRole('button', { name: /Confirm order|Confirmer la commande/i })
      .click();

    // Second step: wait for the client's MoMo payment before preparing.
    await expect(
      modal.getByText(/Wait for payment before preparing|Attendez le paiement avant de préparer/i)
    ).toBeVisible({ timeout: 20000 });
    await signOut(page);
  });
});

