# React Native Render Tests

This directory contains the setup for React Native component render testing using Jest (jest-expo) and @testing-library/react-native.

## Current Status

Render tests are enabled. The app uses React 19.2.0 with `react-test-renderer` pinned to `19.2.0` (the same version as `react`), `@testing-library/react-native` v14, and the `jest-expo` preset (SDK 55).

### What's Configured

- Jest configuration (`jest.config.js`) using the `jest-expo` preset, scoped to `**/*.render.test.tsx` files
- Test utilities (`test-utils.tsx`) with `renderWithProviders` helper wrapping i18n and `PaperProvider`
- Comprehensive mocks for:
  - expo-modules-core
  - expo-localization
  - expo-constants
  - expo-font
  - @expo/vector-icons
  - react-native-reanimated
  - react-native-safe-area-context
  - @react-native-async-storage/async-storage

### Running Tests

```bash
yarn test          # Run vitest unit tests
yarn test:render   # Run Jest render tests
yarn test:all      # Run both test suites
```

## Writing Render Tests

Place render tests in files named `*.render.test.tsx`:

```typescript
import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders successfully', () => {
    const { getByText } = renderWithProviders(<MyComponent />);
    expect(getByText('Hello')).toBeTruthy();
  });
});
```

The `renderWithProviders` wrapper includes:
- `PaperProvider` (app `paperTheme`)
- I18nextProvider for translations
