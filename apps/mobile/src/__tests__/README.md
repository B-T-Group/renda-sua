# React Native Render Tests

This directory contains the setup for React Native component render testing using Jest and @testing-library/react-native.

## Current Status

The render test infrastructure is set up but currently blocked by a React 19 compatibility issue with `react-test-renderer`. React Native 0.83 uses React 19.2.0, which changed the test renderer API and removed `createRoot`.

### What's Configured

- Jest configuration (`jest.config.js`) scoped to `**/*.render.test.tsx` files
- Test utilities (`test-utils.tsx`) with `renderWithProviders` helper
- Comprehensive mocks for:
  - expo-modules-core
  - expo-localization
  - expo-constants
  - expo-font
  - @expo/vector-icons
  - react-native-reanimated
  - react-native-safe-area-context
  - @react-native-async-storage/async-storage

### Known Issue

@testing-library/react-native v14.1.0 depends on `react-test-renderer` which uses `createRoot()`, but React 19's test-renderer changed this API. This is a known ecosystem compatibility gap as testing libraries catch up to React 19.

### Next Steps

When @testing-library/react-native releases a React 19-compatible version (or once react-test-renderer@19.x stabilizes the testing API), uncomment and use the render tests.

### Running Tests

```bash
yarn test          # Run vitest unit tests (working)
yarn test:render   # Run Jest render tests (blocked by React 19 issue)
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
- I18nextProvider for translations
- (Future: PaperProvider and NavigationContainer when React 19 support is ready)
