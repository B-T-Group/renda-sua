import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import Logo from './Logo';

describe.skip('Logo (React 19 compatibility - blocked)', () => {
  // These tests are currently skipped due to React 19 compatibility issues.
  // React Native 0.83 uses React 19.2.0, but @testing-library/react-native v14
  // depends on react-test-renderer APIs that changed in React 19.
  // Once the testing library ecosystem catches up, these tests can be enabled.
  
  it('renders successfully', async () => {
    const result = await renderWithProviders(<Logo />);
    expect(result).toBeTruthy();
  });

  it('renders with default full variant', async () => {
    const result = await renderWithProviders(<Logo />);
    expect(result).toBeTruthy();
  });

  it('renders with compact variant', async () => {
    const result = await renderWithProviders(<Logo variant="compact" />);
    expect(result).toBeTruthy();
  });
});
