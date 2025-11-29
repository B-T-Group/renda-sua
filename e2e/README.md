# Playwright E2E Tests

This directory contains end-to-end tests for dev.rendasua.com using Playwright.

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

- **Base URL**: `https://dev.rendasua.com`
- **Browsers**: Chromium, Firefox, WebKit
- **Mobile**: Mobile Chrome and Mobile Safari viewports

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

## Tips

1. Use `page.waitForLoadState('networkidle')` to wait for page to fully load
2. Use `page.locator()` to find elements (supports CSS selectors, text, etc.)
3. Use `expect()` for assertions
4. Screenshots and videos are automatically captured on failure
5. Traces are collected on retry for debugging

## More Information

See [Playwright Documentation](https://playwright.dev/docs/intro) for more details.

