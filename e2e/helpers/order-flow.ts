import { Page } from '@playwright/test';

const CLIENT_EMAIL = 'besongsamueloru+test@gmail.com';
const CLIENT_PASSWORD = '{Shaddy12}';
const BUSINESS_EMAIL = 'besongsamueloru+business5@gmail.com';
const BUSINESS_PASSWORD = '{Shaddy12}';
const AGENT_EMAIL = 'besongsamueloru+agent@gmail.com';
const AGENT_PASSWORD = '{Shaddy12}';

export async function signInClient(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(CLIENT_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(CLIENT_PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

export async function signInBusiness(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page
    .getByRole('textbox', { name: 'Email address' })
    .fill(BUSINESS_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(BUSINESS_PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

export async function signInAgent(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(AGENT_EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(AGENT_PASSWORD);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
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

export async function clientPlaceFirstItemOrder(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Search items...' }).fill('Computer');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Buy Now' }).first().click();
  await page.getByRole('button', { name: 'Confirm Order' }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

async function selectTab(page: Page, tabName: string): Promise<void> {
  // Find the tab by its label text (case-insensitive)
  const tab = page
    .getByRole('tab')
    .filter({ hasText: new RegExp(tabName, 'i') })
    .first();
  await tab.click({ timeout: 10000 });
  await page.waitForTimeout(1000); // Wait for orders to filter
}

async function businessConfirmOrder(page: Page): Promise<void> {
  await page.goto('/orders');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  // Select the "Pending" tab to view all pending orders
  await selectTab(page, 'Pending');
  // Click on the first order's "View Details" button to navigate to order details page
  await page
    .getByRole('button', { name: /view details/i })
    .first()
    .click({ timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  // Click the "Confirm Order" button on the order details page
  await page.getByRole('button', { name: 'Confirm Order' }).first().click();
  // Wait for the modal to appear and any backdrop to be ready
  await page.waitForTimeout(1000);
  // Wait for the modal dialog to be visible
  const modal = page.getByRole('dialog');
  await modal.waitFor({ state: 'visible', timeout: 10000 });
  // Wait a bit more for the modal content to fully load
  await page.waitForTimeout(1000);

  // Check if there are existing delivery windows (radio buttons)
  const existingWindowRadio = page.locator('input[type="radio"]').first();
  const hasExistingWindows = await existingWindowRadio
    .isVisible()
    .catch(() => false);

  if (hasExistingWindows) {
    // Select the first existing delivery window
    await existingWindowRadio.click({ timeout: 10000 });
    await page.waitForTimeout(1000);
  } else {
    // Wait for the DeliveryTimeWindowSelector to load and auto-select a slot
    // The selector should auto-select based on initialWindowValue
    // Wait for any loading indicators to disappear
    await page.waitForTimeout(3000);
  }

  // Wait for the "Confirm Order" button in the modal to be enabled
  // The button is disabled until a delivery window is selected
  const confirmButton = modal.getByRole('button', { name: 'Confirm Order' });

  // Wait for the button to be enabled (not disabled)
  // Retry checking until it's enabled, with a timeout
  let attempts = 0;
  const maxAttempts = 30; // 15 seconds with 500ms intervals
  while (attempts < maxAttempts) {
    const isDisabled = await confirmButton
      .evaluate((el) => el.hasAttribute('disabled'))
      .catch(() => true);
    if (!isDisabled) {
      break;
    }
    await page.waitForTimeout(500);
    attempts++;
  }

  // Ensure any backdrop is not blocking clicks
  await page.waitForTimeout(500);

  // Click the "Confirm Order" button in the modal
  await confirmButton.click({ timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

export async function businessConfirmAndPrepareOrder(
  page: Page
): Promise<void> {
  await businessConfirmOrder(page);
  // After confirming, we're still on the order details page
  // Wait for the modal to close and page to update
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Wait for the order status to update to "confirmed" by checking for the "Start Preparing" button
  // This button only appears when status is "confirmed"
  const startPreparingButton = page
    .getByRole('button', { name: /start preparing/i })
    .first();

  // Wait up to 20 seconds for the button to appear (order confirmation might take time)
  await startPreparingButton.waitFor({ state: 'visible', timeout: 20000 });
  await startPreparingButton.click({ timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Wait for the order status to update to "preparing" by checking for the "Complete Preparation" button
  // This button only appears when status is "preparing"
  const completePrepButton = page
    .getByRole('button', { name: /finish.*preparing|complete.*preparation/i })
    .first();

  // Wait up to 20 seconds for the button to appear (status update might take time)
  await completePrepButton.waitFor({ state: 'visible', timeout: 20000 });
  await completePrepButton.click({ timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  // Navigate to home page
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

async function confirmStatusChange(page: Page): Promise<void> {
  // Wait for the confirmation modal to appear
  const confirmationModal = page.getByRole('dialog');
  await confirmationModal.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(500);

  // Click "Confirm" button in the confirmation modal
  const confirmButton = confirmationModal.getByRole('button', {
    name: /confirm/i,
  });
  await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
  await confirmButton.click({ timeout: 10000 });

  // Wait for the modal to close and page to update
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
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

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
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Click "Start delivery" or "In transit" button
  await page
    .getByRole('button', { name: /out for delivery/i })
    .first()
    .click({ timeout: 15000 });
  // Confirm the status change in the modal
  await confirmStatusChange(page);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Click "Deliver" button
  await page
    .getByRole('button', { name: /mark as delivered/i })
    .first()
    .click({ timeout: 15000 });
  // Confirm the status change in the modal
  await confirmStatusChange(page);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

export async function clientCompleteOrder(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Complete Order' }).first().click();
  await page
    .getByRole('button', { name: 'Confirm' })
    .or(page.getByRole('button', { name: /confirm/i }))
    .click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}
