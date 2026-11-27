import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ProductInterestSheet } from '../ProductInterestSheet';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const render = (orderMode?: boolean) =>
  renderWithProviders(
    <ThemeProvider>
      <ProductInterestSheet
        visible
        itemName="Widget"
        orderMode={orderMode}
        onDismiss={jest.fn()}
        onSubmit={jest.fn()}
      />
    </ThemeProvider>
  );

describe('ProductInterestSheet', () => {
  it('keeps the lead copy by default', async () => {
    await render();
    expect(screen.getByText(/contact you outside the app/)).toBeTruthy();
    expect(screen.getByText('Send interest')).toBeTruthy();
  });

  it('uses order copy when export orders are on', async () => {
    await render(true);
    expect(screen.getByText('Send request')).toBeTruthy();
    expect(screen.queryByText(/contact you outside the app/)).toBeNull();
  });
});
