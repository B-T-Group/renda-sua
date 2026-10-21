import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import Logo from './Logo';

describe('Logo', () => {
  it('renders successfully', async () => {
    const result = await renderWithProviders(<Logo />);
    expect(result).toBeTruthy();
    expect(screen.getByLabelText('Rendasua')).toBeTruthy();
  });

  it('renders with default full variant', async () => {
    const result = await renderWithProviders(<Logo />);
    expect(result).toBeTruthy();
    expect(screen.getByLabelText('Rendasua')).toBeTruthy();
  });

  it('renders with compact variant', async () => {
    const result = await renderWithProviders(<Logo variant="compact" />);
    expect(result).toBeTruthy();
    expect(screen.getByLabelText('Rendasua')).toBeTruthy();
  });
});
