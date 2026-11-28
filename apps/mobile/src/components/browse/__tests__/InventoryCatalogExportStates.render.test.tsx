import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import type { CatalogInventoryItem } from '../../../types/inventoryCatalog';
import { InventoryCatalogCard } from '../InventoryCatalogCard';
import { InventoryCatalogGridTile } from '../InventoryCatalogGridTile';

jest.mock('../ItemLikeButton', () => ({ ItemLikeButton: () => null }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: { View, createAnimatedComponent: (c: unknown) => c } };
});
jest.mock('expo-crypto', () => ({ digestStringAsync: jest.fn(), CryptoDigestAlgorithm: {} }));
jest.mock('../../common/AppImage', () => ({ AppImage: () => null }));
jest.mock('../../../theme/motionHooks', () => ({
  usePressScale: () => ({ animatedStyle: {}, onPressIn: jest.fn(), onPressOut: jest.fn() }),
}));
let mockMarket = 'CM';
let mockExistingOrderId: string | null = null;
jest.mock('../../../hooks/useExportOrderForInventory', () => ({
  useExportOrderForInventory: () => mockExistingOrderId,
}));
jest.mock('../../../stores/RootStore', () => ({
  useStore: () => ({ auth: { isAuthenticated: false }, market: { hydrated: true, selectedCountryCode: mockMarket } }),
}));

function exportItem(): CatalogInventoryItem {
  return {
    id: 'inv-1',
    item_id: 'item-1',
    selling_price: 5000,
    computed_available_quantity: 20,
    item: {
      id: 'item-1',
      name: 'Pure maple syrup',
      currency: 'CAD',
      export_available: true,
      export_markets: [{ country_code: 'CM' }, { country_code: 'GA' }],
      item_images: [],
      item_variants: [],
      item_sub_category: { id: 1, name: 'Syrups', item_category: { id: 1, name: 'Food' } },
    },
    business_location: {
      id: 'loc-1',
      business_id: 'biz-1',
      name: 'Erable',
      location_type: 'store',
      is_primary: true,
      business: { id: 'biz-1', name: 'Erable Co', is_verified: true, can_accept_orders: true },
      address: { id: 'a', address_line_1: '', city: 'Montréal', state: 'QC', postal_code: '', country: 'CA' },
    },
  } as unknown as CatalogInventoryItem;
}

const card = async () =>
  await renderWithProviders(
    <ThemeProvider>
      <InventoryCatalogCard
        item={exportItem()}
        primaryLabel="Buy"
        onPrimaryPress={jest.fn()}
        onItemPress={jest.fn()}
        onAddToCart={jest.fn()}
      />
    </ThemeProvider>
  );

describe('export item card / tile', () => {
  it('destination viewer: badge, price on request, destinations, I’m interested, no Buy or cart', async () => {
    mockMarket = 'CM';
    await card();
    expect(screen.getByText('Export only')).toBeTruthy();
    expect(screen.getAllByText('Price on request').length).toBeGreaterThan(0);
    expect(screen.getByText('CM · GA')).toBeTruthy();
    expect(screen.getByText('I’m interested')).toBeTruthy();
    expect(screen.queryByText('Buy')).toBeNull();
    expect(screen.queryByLabelText('Add to cart')).toBeNull();
  });

  it('destination viewer with an open export order sees View order details instead of I’m interested', async () => {
    mockMarket = 'CM';
    mockExistingOrderId = 'order-1';
    await card();
    mockExistingOrderId = null;
    expect(screen.getByText('View order details')).toBeTruthy();
    expect(screen.queryByText('I’m interested')).toBeNull();
  });

  it.each(['CA', 'SN'])('viewer in %s (origin / third market): no interest, no Buy, no cart', async (code) => {
    mockMarket = code;
    await card();
    expect(screen.getByText('Export only')).toBeTruthy();
    expect(screen.queryByText('I’m interested')).toBeNull();
    expect(screen.queryByText('Buy')).toBeNull();
    expect(screen.queryByLabelText('Add to cart')).toBeNull();
  });

  it('grid tile shows the badge, price on request and the globe line', async () => {
    await renderWithProviders(
      <ThemeProvider>
        <InventoryCatalogGridTile item={exportItem()} onPress={jest.fn()} />
      </ThemeProvider>
    );
    expect(screen.getByText('Export only')).toBeTruthy();
    expect(screen.getByText('Price on request')).toBeTruthy();
    expect(screen.getByText('CM · GA')).toBeTruthy();
  });
});
