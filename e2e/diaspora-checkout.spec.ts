import { expect, test } from '@playwright/test';
import {
  DEFAULT_DIASPORA_RECIPIENT,
  addFirstItemAndOpenCheckout,
  enableThirdPartyRecipient,
  expectConfirmationNamesRecipient,
  expectDiasporaBanner,
  expectPlaceOrderBlockedWithoutRecipient,
} from './helpers/diaspora-checkout';
import {
  agentCompleteDeliveryWithPin,
  businessConfirmAndPrepareOrder,
  clientGetDeliveryPinFromOrdersPage,
  signInUser,
  signOut,
} from './helpers/order-flow';

/**
 * Diaspora checkout: a payer billing from CA/US buys for a recipient in GA/CM.
 *
 * Like the rest of this directory, these tests need the full local stack —
 * frontend on :4200, backend, Hasura with seeded data, and Auth0 — plus a
 * seeded client whose billing country is CA and a GA/CM merchant in the
 * catalog. See e2e/README.md.
 */
test.describe('Diaspora checkout (recipient is not the payer)', () => {
  test('payer abroad checks out for a local recipient', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await signInUser(page, 'client');
    await addFirstItemAndOpenCheckout(page);

    await expectDiasporaBanner(page, 'CA', 'GA');
    await enableThirdPartyRecipient(page);

    // The payer sees an estimate in their own currency and the trust copy that
    // the money is held rather than paid straight to the merchant.
    await expect(page.getByText(/You'll pay ≈/i)).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(/Merchant price/i)).toBeVisible();
    await expect(
      page.getByText(
        new RegExp(`Held until ${DEFAULT_DIASPORA_RECIPIENT.name}`, 'i')
      )
    ).toBeVisible();

    await page
      .getByRole('button', { name: /Place Order|Passer la commande/i })
      .click();

    await expectConfirmationNamesRecipient(
      page,
      DEFAULT_DIASPORA_RECIPIENT.name
    );
    await signOut(page);
  });

  test('checkout is blocked until the recipient has a name and phone', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await signInUser(page, 'client');
    await addFirstItemAndOpenCheckout(page);
    await expectPlaceOrderBlockedWithoutRecipient(page);
    await signOut(page);
  });

  test('the existing PIN handover still completes a diaspora order', async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await signInUser(page, 'business');
    await businessConfirmAndPrepareOrder(page);
    await signOut(page);

    // The payer can still read the PIN, even though the recipient also
    // received it by SMS/WhatsApp.
    await signInUser(page, 'client');
    const deliveryPin = await clientGetDeliveryPinFromOrdersPage(page);
    await signOut(page);

    await signInUser(page, 'agent');
    await agentCompleteDeliveryWithPin(page, deliveryPin);
    await expect(
      page.getByText(/delivered|excellent work|successfully delivered/i).first()
    ).toBeVisible({ timeout: 20000 });
    await signOut(page);
  });
});
