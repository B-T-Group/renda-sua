import { expect, Locator, Page } from '@playwright/test';

const CLIENT_EMAIL = 'besongsamueloru+test@gmail.com';
const CLIENT_PASSWORD = '{Shaddy12}';
const BUSINESS_EMAIL = 'besongsamueloru+business5@gmail.com';
const BUSINESS_PASSWORD = '{Shaddy12}';
const AGENT_EMAIL = 'besongsamueloru+agent@gmail.com';
const AGENT_PASSWORD = '{Shaddy12}';

export type SignInUserType = 'client' | 'agent' | 'business';

function personaSelectButton(page: Page, persona: SignInUserType) {
  const name: Record<SignInUserType, RegExp> = {
    client:
      /^Client$|Continue as Client|Continuer en tant que Client/i,
    agent:
      /^Delivery agent$|^Livreur$|Continue as Delivery agent|Continuer en tant que Livreur/i,
    business:
      /^Business$|^Entreprise$|Continue as Business|Continuer en tant que Entreprise/i,
  };
  return page.getByRole('button', { name: name[persona] });
}

async function openAuth0FromLoginMethodDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Login with email\/password/i })
    .click();
  await page.waitForURL(/auth0\.com/i, { timeout: 45000 });
}

async function auth0ClickContinue(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /^Continue$/i })
    .or(page.getByRole('button', { name: /^Next$/i }))
    .first()
    .click();
}

async function auth0FillEmailAndContinue(page: Page, email: string): Promise<void> {
  const emailInput = page
    .locator('input[name="username"]')
    .or(page.locator('#username'))
    .or(page.locator('input[type="email"]'))
    .first();
  await emailInput.waitFor({ state: 'visible', timeout: 30000 });
  await emailInput.fill(email);
  await auth0ClickContinue(page);
}

async function auth0FillPasswordAndContinue(page: Page, password: string): Promise<void> {
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 30000 });
  await passwordInput.fill(password);
  await page
    .getByRole('button', { name: /^Continue$/i })
    .or(page.getByRole('button', { name: /^Log [Ii]n$/ }))
    .or(page.getByRole('button', { name: /^Next$/i }))
    .first()
    .click();
}

async function waitUntilLeftAuth0(page: Page): Promise<void> {
  await page.waitForURL((u) => !u.hostname.includes('auth0.com'), {
    timeout: 120000,
  });
}

async function selectPersonaIfShown(
  page: Page,
  persona: SignInUserType
): Promise<void> {
  const card = personaSelectButton(page, persona);
  try {
    await card.waitFor({ state: 'visible', timeout: 25000 });
  } catch {
    return;
  }
  await card.click();
}

async function signInWithEmailPasswordPersona(
  page: Page,
  email: string,
  password: string,
  persona: SignInUserType
): Promise<void> {
  await openAuth0FromLoginMethodDialog(page);
  await auth0FillEmailAndContinue(page, email);
  await auth0FillPasswordAndContinue(page, password);
  await waitUntilLeftAuth0(page);
  await page.waitForLoadState('domcontentloaded');
  await selectPersonaIfShown(page, persona);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

export async function signInUser(
  page: Page,
  userType: SignInUserType
): Promise<void> {
  const creds: Record<SignInUserType, { email: string; password: string }> = {
    client: { email: CLIENT_EMAIL, password: CLIENT_PASSWORD },
    agent: { email: AGENT_EMAIL, password: AGENT_PASSWORD },
    business: { email: BUSINESS_EMAIL, password: BUSINESS_PASSWORD },
  };
  const { email, password } = creds[userType];
  await signInWithEmailPasswordPersona(page, email, password, userType);
}

export async function signOut(page: Page): Promise<void> {
  const avatarButton = page
    .locator('button')
    .filter({ has: page.locator('[class*="MuiAvatar"]') });
  await avatarButton.click();
  await page.waitForTimeout(500);
  await page
    .getByRole('menuitem')
    .getByRole('button', { name: 'Logout' })
    .click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

async function assertOrderPlacedAndGoToDashboard(page: Page): Promise<void> {
  await expect(
    page.getByText(/Order Placed Successfully|Commande Passée avec Succès/i)
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByRole('button', {
      name: /Go to Dashboard|Aller au Tableau de Bord/i,
    })
    .click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

export async function clientPlaceFirstItemOrder(page: Page): Promise<void> {
  await page.goto('/items');
  await page.waitForLoadState('domcontentloaded');
  const catalogSearch = page.getByRole('textbox', {
    name: /Search items|Search the item catalog|Rechercher des articles|Rechercher dans le catalogue/i,
  });
  await catalogSearch.waitFor({ state: 'visible', timeout: 20000 });
  await catalogSearch.fill('Computer');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Buy Now' }).first().click();
  await page.getByRole('button', { name: 'Confirm Order' }).click();
  await page.waitForLoadState('domcontentloaded');
  await assertOrderPlacedAndGoToDashboard(page);
}

async function clickBusinessDashboardOrdersManage(page: Page): Promise<void> {
  const ordersHeading = page.getByRole('heading', {
    name: /^Orders$|^Commandes$/i,
  });
  const card = page.locator('.MuiCard-root').filter({ has: ordersHeading }).first();
  await card.getByRole('button', { name: /^Manage$|^Gérer$/i }).click();
  await page.waitForURL(/\/orders(?:\?|$)/, { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

function firstOrderCardWithConfirmButton(page: Page): Locator {
  return page
    .locator('.MuiCard-root')
    .filter({
      has: page.getByRole('button', {
        name: /Confirm Order|Confirmer la Commande/i,
      }),
    })
    .first();
}

async function readHashOrderNumberFromCard(card: Locator): Promise<string> {
  const raw =
    (await card.getByText(/^#\d+$/).first().textContent())?.trim() ?? '';
  return raw.replace(/^#/, '');
}

async function selectDeliveryWindowInConfirmModal(
  page: Page,
  modal: Locator
): Promise<void> {
  const inputRadio = modal.locator('input[type="radio"]').first();
  try {
    await inputRadio.waitFor({ state: 'attached', timeout: 12000 });
    await inputRadio.click({ force: true });
    return;
  } catch {
    /* selector or new-window flow may load later */
  }
  const byRole = modal.getByRole('radio').first();
  if (await byRole.isVisible().catch(() => false)) {
    await byRole.click();
    return;
  }
  await page.waitForTimeout(3000);
}

async function clickEnabledConfirmInModal(modal: Locator, page: Page): Promise<void> {
  const confirmButton = modal.getByRole('button', {
    name: /Confirm Order|Confirmer la Commande/i,
  });
  for (let i = 0; i < 30; i++) {
    const disabled = await confirmButton
      .evaluate((el) => el.hasAttribute('disabled'))
      .catch(() => true);
    if (!disabled) break;
    await page.waitForTimeout(500);
  }
  await confirmButton.click({ timeout: 10000 });
}

async function openConfirmModalForFirstPendingOrder(page: Page): Promise<string> {
  const pendingCard = firstOrderCardWithConfirmButton(page);
  await pendingCard.waitFor({ state: 'visible', timeout: 25000 });
  const orderNumber = await readHashOrderNumberFromCard(pendingCard);
  await pendingCard
    .getByRole('button', { name: /Confirm Order|Confirmer la Commande/i })
    .click();
  return orderNumber;
}

async function completeConfirmOrderModal(page: Page): Promise<void> {
  const modal = page.getByRole('dialog');
  await modal.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
  await selectDeliveryWindowInConfirmModal(page, modal);
  await page.waitForTimeout(500);
  await clickEnabledConfirmInModal(modal, page);
  await page.waitForLoadState('networkidle');
  await modal.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
}

async function clickSetAsReadyForOrderNumber(
  page: Page,
  orderNumber: string
): Promise<void> {
  const card = page
    .locator('.MuiCard-root')
    .filter({ has: page.getByText(`#${orderNumber}`, { exact: true }) })
    .first();
  await card
    .getByRole('button', {
      name: /Set as ready|Marquer comme prêt|ready for pickup|prêt pour ramassage|Action Requise.*Marquer comme prêt/i,
    })
    .click({ timeout: 20000 });
}

export async function businessConfirmAndPrepareOrder(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  await clickBusinessDashboardOrdersManage(page);
  const orderNumber = await openConfirmModalForFirstPendingOrder(page);
  await completeConfirmOrderModal(page);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await clickSetAsReadyForOrderNumber(page, orderNumber);
  await page.waitForLoadState('networkidle');
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
}

export async function agentDeliverOrder(page: Page): Promise<void> {
  // Click the "Claim Order" button
  await page.getByRole('button', { name: /claim/i }).first().click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Wait for the confirmation modal to appear
  const confirmationModal = page.getByRole('dialog');
  await confirmationModal.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  // Click "Claim Order" button in the confirmation modal
  const confirmClaimButton = confirmationModal.getByRole('button', {
    name: /claim order/i,
  });
  await confirmClaimButton.waitFor({ state: 'visible', timeout: 10000 });
  await confirmClaimButton.click({ timeout: 10000 });

  // Wait for the modal to close and page to update
  await page.waitForLoadState('networkidle');

  // Navigate to the order details page after claiming
  const orderLink = page
    .getByRole('link', { name: /details|view/i })
    .or(page.locator('a[href*="/orders/"]'))
    .first();
  await orderLink.waitFor({ state: 'visible', timeout: 10000 });
  await orderLink.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Click "Pick up" button (no confirmation modal for pick up)
  await page
    .getByRole('button', { name: /pick up/i })
    .first()
    .click({ timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Click "Out for delivery" button (no confirmation modal)
  await page
    .getByRole('button', { name: /out for delivery/i })
    .first()
    .click({ timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Click "Mark as Delivered" button (no confirmation modal)
  await page
    .getByRole('button', { name: /mark as delivered/i })
    .first()
    .click({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

export async function clientCompleteOrder(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Complete Order' }).first().click();
  await page
    .getByRole('button', { name: 'Confirm' })
    .or(page.getByRole('button', { name: /confirm/i }))
    .click();
  await page.waitForLoadState('networkidle');

  // Wait for the success modal to appear
  const successModal = page.getByRole('dialog');
  await successModal.waitFor({ state: 'visible', timeout: 10000 });
  // Verify the success modal contains the congratulatory message
  // Use .first() since DialogTitle wrapper and Typography both create headings
  await expect(
    successModal
      .getByRole('heading', {
        name: /order.*successfully completed/i,
      })
      .first()
  ).toBeVisible({ timeout: 10000 });
}
