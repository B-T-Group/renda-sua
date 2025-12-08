# Playwright E2E Tests

This directory contains end-to-end tests for the local development server using Playwright.

## Setup

Playwright is already installed. If you need to reinstall browsers:

```bash
npx playwright install
```

## Running Tests

### Run all tests

```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)

```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)

```bash
npm run test:e2e:headed
```

### Debug tests

```bash
npm run test:e2e:debug
```

### View test report

```bash
npm run test:e2e:report
```

## Configuration

The Playwright configuration is in `playwright.config.ts` at the root of the project.

- **Base URL**: `http://localhost:4200`
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile**: Mobile Chrome and Mobile Safari viewports

**Note**: Make sure your local development server is running on port 4200 before running tests.

## Writing Tests

Create test files in the `e2e/` directory with the `.spec.ts` extension.

Example:

```typescript
import { test, expect } from '@playwright/test';

test('should load homepage', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Rendasua/i);
});
```

## Test Structure

- Tests are organized by feature or page
- Use `test.describe()` to group related tests
- Use `test.beforeEach()` for setup if needed

## Full Order Lifecycle Test

The `full-order-lifecycle.spec.ts` test covers the complete multi-persona order flow:

1. **Client** signs in and places an order on the first available item
2. **Business** signs in, confirms the order, starts and completes preparation
3. **Agent** signs in, claims the order, picks it up, starts delivery, and delivers it
4. **Client** signs in again and completes the order

### Required Test Accounts

The test uses the following seeded test accounts (all use the same password):

- **Client**: `besongsamueloru+test@gmail.com` / `{Shaddy12}`
- **Business**: `besongsamueloru+business5@gmail.com` / `{Shaddy12}`
- **Agent**: `besongsamueloru+agent@gmail.com` / `{Shaddy12}`

### Running the Full Order Lifecycle Test

```bash
npx playwright test e2e/full-order-lifecycle.spec.ts
```

### Helper Functions

The test uses helper functions from `e2e/helpers/order-flow.ts` for reusable actions:

- `signInClient()`, `signInBusiness()`, `signInAgent()` - Authentication helpers
- `signOut()` - Sign out helper
- `clientPlaceFirstItemOrder()` - Client order placement
- `businessConfirmAndPrepareOrder()` - Business order management
- `agentDeliverOrder()` - Agent delivery workflow
- `clientCompleteOrder()` - Client order completion

## Tips

1. Use `page.waitForLoadState('networkidle')` to wait for page to fully load
2. Use `page.locator()` to find elements (supports CSS selectors, text, etc.)
3. Use `expect()` for assertions
4. Screenshots and videos are automatically captured on failure
5. Traces are collected on retry for debugging

## More Information

See [Playwright Documentation](https://playwright.dev/docs/intro) for more details.
