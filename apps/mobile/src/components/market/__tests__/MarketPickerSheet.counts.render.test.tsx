import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import i18n from '../../../i18n';
import type { Market } from '../../../types/market';
import { MarketPickerSheet, type MarketPickerLane } from '../MarketPickerSheet';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

let mockCounts: {
  counts: { rentals: number; exports: number; shop: number } | null;
  totals: { rentals: number; shop: number } | null;
  states: unknown[];
  loading: boolean;
  statesFailed: boolean;
};
jest.mock('../../../hooks/useMarketPickerCounts', () => ({
  useMarketPickerCounts: () => mockCounts,
}));

const markets: Market[] = [
  {
    id: 'CM',
    code: 'CM',
    countryCode: 'CM',
    stateCode: null,
    stateName: null,
    name: 'Cameroon',
    currency: 'XAF',
    flag: '🇨🇲',
    isEnabled: true,
  },
];

const ready = {
  counts: { rentals: 32, exports: 86, shop: 1240 },
  totals: { rentals: 32, shop: 1240 },
  states: [
    { state: 'Littoral', itemCount: 640, inventoryCount: 640, rentalCount: 18 },
    { state: 'Centre', itemCount: 402, inventoryCount: 402, rentalCount: 11 },
  ],
  loading: false,
  statesFailed: false,
};

async function open(lane: MarketPickerLane, onSelect = jest.fn()) {
  await renderWithProviders(
    <ThemeProvider>
      <MarketPickerSheet
        visible
        markets={markets}
        selectedCode="CM"
        selectedStateCode={null}
        lane={lane}
        onSelect={onSelect}
        onDismiss={jest.fn()}
      />
    </ThemeProvider>
  );
  return onSelect;
}

beforeEach(async () => {
  mockCounts = ready;
  await i18n.changeLanguage('en');
});

describe('MarketPickerSheet counts strip (Option C)', () => {
  it('shows Rentals, Exports and Shop cells with plural-aware accessibility labels', async () => {
    await open('rentals');
    expect(screen.getByLabelText('32 rentals')).toBeTruthy();
    expect(screen.getByLabelText('86 exports')).toBeTruthy();
    expect(screen.getByLabelText('1,240 items')).toBeTruthy();
    expect(screen.getByText('Rentals')).toBeTruthy();
    expect(screen.getByText('Exports')).toBeTruthy();
    expect(screen.getByText('Shop')).toBeTruthy();
  });

  it('highlights only the lane the user is in', async () => {
    await open('exports');
    expect(screen.getByTestId('market-count-exports').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('market-count-rentals').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('market-count-shop').props.accessibilityState.selected).toBe(false);
  });

  it('highlights nothing in the Food lane', async () => {
    await open('food');
    for (const lane of ['rentals', 'exports', 'shop']) {
      expect(screen.getByTestId(`market-count-${lane}`).props.accessibilityState.selected).toBe(false);
    }
  });

  it('keeps a zero cell visible (always three cells)', async () => {
    mockCounts = { ...ready, counts: { rentals: 58, exports: 0, shop: 12400 }, totals: { rentals: 58, shop: 12400 } };
    await open('shop');
    expect(screen.getByLabelText('0 exports')).toBeTruthy();
    expect(screen.getAllByText('12.4k')).toHaveLength(2); // strip cell + "All of" row
  });

  it('formats French numbers with a narrow no-break space and uses the lane tab labels', async () => {
    await i18n.changeLanguage('fr');
    await open('shop');
    expect(screen.getAllByText('1\u202f240')).toHaveLength(2); // strip cell + "Tout le pays" row
    expect(screen.getByText('Locations')).toBeTruthy();
    expect(screen.getByText('Boutique')).toBeTruthy();
    expect(screen.getByText('Tout le pays')).toBeTruthy();
  });

  it('shows the lane count on state rows and no exports count there', async () => {
    await open('rentals');
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.queryByText('640')).toBeNull();
  });

  it('never blocks selection while counts load', async () => {
    mockCounts = { counts: null, totals: null, states: [], loading: true, statesFailed: false };
    const onSelect = await open('shop');
    expect(screen.getByTestId('market-counts-strip')).toBeTruthy();
    fireEvent.press(screen.getByText('All of Cameroon'));
    expect(onSelect).toHaveBeenCalledWith('CM', null);
  });

  it('hides the strip when a count call failed and keeps the rows usable', async () => {
    mockCounts = { counts: null, totals: { rentals: 32, shop: 1240 }, states: ready.states, loading: false, statesFailed: false };
    const onSelect = await open('shop');
    expect(screen.queryByTestId('market-counts-strip')).toBeNull();
    // The states call worked, so the "All of" row still shows its count.
    expect(screen.getByText('1,240')).toBeTruthy();
    fireEvent.press(screen.getByText('Littoral'));
    expect(onSelect).toHaveBeenCalledWith('CM', 'Littoral');
  });
});
