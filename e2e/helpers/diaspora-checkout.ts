import { expect, Locator, Page } from '@playwright/test';

/** Recipient used by the diaspora scenario. Must be reachable in GA/CM. */
export interface DiasporaRecipient {
  name: string;
  phone: string;
}

export const DEFAULT_DIASPORA_RECIPIENT: DiasporaRecipient = {
  name: 'Awa Ndong',
  phone: '077123456',
};

function recipientSection(page: Page): Locator {
  return page
    .locator('.MuiCard-root')
    .filter({ hasText: /Who is receiving this order|Qui reçoit cette commande/i })
    .first();
}

/** Adds the first catalog result to the cart and opens checkout. */
export async function addFirstItemAndOpenCheckout(
  page: Page,
  searchTerm = 'Computer'
): Promise<void> {
  await page.goto('/items');
  await page.waitForLoadState('domcontentloaded');
  const catalogSearch = page.getByRole('textbox', {
    name: /Search items|Search the item catalog|Rechercher des articles|Rechercher dans le catalogue/i,
  });
  await catalogSearch.waitFor({ state: 'visible', timeout: 20000 });
  await catalogSearch.fill(searchTerm);
  await page.waitForTimeout(1000);
  await page
    .getByRole('button', { name: /Add to cart|Ajouter au panier/i })
    .first()
    .click();
  await page.goto('/checkout');
  await page.waitForLoadState('domcontentloaded');
}

/** Turns on "someone else is receiving this order" and fills the recipient. */
export async function enableThirdPartyRecipient(
  page: Page,
  recipient: DiasporaRecipient = DEFAULT_DIASPORA_RECIPIENT
): Promise<void> {
  await page
    .getByText(
      /Someone else is receiving this order|Une autre personne reçoit cette commande/i
    )
    .click();

  const section = recipientSection(page);
  await section.waitFor({ state: 'visible', timeout: 15000 });
  await section
    .getByLabel(/Recipient full name|Nom complet du destinataire/i)
    .fill(recipient.name);
  await section
    .getByLabel(/Recipient phone number|Numéro du destinataire/i)
    .fill(recipient.phone);
}

/** The banner names both markets, so the payer knows where the money lands. */
export async function expectDiasporaBanner(
  page: Page,
  payerCountry: string,
  fulfillmentCountry: string
): Promise<void> {
  await expect(
    page.getByText(new RegExp(`Paying from ${payerCountry}`, 'i'))
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText(new RegExp(`Delivering to ${fulfillmentCountry}`, 'i'))
  ).toBeVisible();
}

/** Place Order stays disabled until the recipient has a name and a phone. */
export async function expectPlaceOrderBlockedWithoutRecipient(
  page: Page
): Promise<void> {
  await page
    .getByText(
      /Someone else is receiving this order|Une autre personne reçoit cette commande/i
    )
    .click();
  await recipientSection(page).waitFor({ state: 'visible', timeout: 15000 });
  await expect(
    page.getByRole('button', { name: /Place Order|Passer la commande/i })
  ).toBeDisabled();
}

/** Confirmation must name the recipient, not the payer. */
export async function expectConfirmationNamesRecipient(
  page: Page,
  recipientName: string
): Promise<void> {
  await expect(
    page.getByText(new RegExp(`Out for ${recipientName}`, 'i'))
  ).toBeVisible({ timeout: 30000 });
}
