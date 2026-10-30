import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '../../theme/theme';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import ExportsPage, {
  buildExportAddToCartEvent,
  hasCatalogItem,
} from './ExportsPage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

const mockUseInventoryItems = jest.fn();

jest.mock('../../hooks/useInventoryItems', () => ({
  useInventoryItems: (...args: unknown[]) => mockUseInventoryItems(...args),
}));

jest.mock('../../contexts/UserProfileContext', () => ({
  useUserProfileContext: () => ({
    profile: { user_type_id: 'client' },
  }),
}));

jest.mock('../../contexts/CartContext', () => ({
  useCart: () => ({ addToCart: jest.fn() }),
}));

jest.mock('../../hooks/useMarket', () => ({
  useMarket: () => ({ selectedMarket: { id: 'cm', countryCode: 'CM' } }),
}));

jest.mock('../../hooks/usePublicBrowserGeo', () => ({
  usePublicBrowserGeo: () => null,
}));

jest.mock('../../hooks/useTrackItemView', () => ({
  useTrackItemView: () => ({ trackView: jest.fn() }),
}));

jest.mock('../../hooks/useMetaAddToCartTrack', () => ({
  useMetaAddToCartTrack: () => jest.fn(),
}));

jest.mock('../../hooks/useLoginMethodDialog', () => ({
  useLoginMethodDialog: () => ({
    openLoginDialog: jest.fn(),
    loginMethodDialog: null,
  }),
}));

jest.mock('../seo/SEOHead', () => () => null);
jest.mock('../market/MarketSelector', () => ({
  MarketSelector: () => <div>Market selector</div>,
}));

/**
 * Accesses `item.item` the same way the production card did. Passing
 * `inventory=` instead of `item=` makes `item` undefined and throws
 * "Cannot read properties of undefined (reading 'item')".
 */
jest.mock('../common/DashboardItemCard', () => ({
  __esModule: true,
  default: ({ item }: { item?: { item?: { name?: string } } }) => (
    <div>{item.item.name}</div>
  ),
}));

jest.mock('../common/CatalogVariantPickerDialog', () => () => null);

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <ExportsPage />
      </BrowserRouter>
    </ThemeProvider>
  );
}

function listing(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'inv-1',
    item_id: 'item-1',
    item: { name: 'Export tea', currency: 'CAD' },
    ...overrides,
  } as InventoryItem;
}

describe('hasCatalogItem', () => {
  it('rejects undefined rows and listings with a missing nested item', () => {
    expect(hasCatalogItem(undefined)).toBe(false);
    expect(hasCatalogItem(null)).toBe(false);
    expect(hasCatalogItem({ id: 'inv-orphan' } as InventoryItem)).toBe(false);
    expect(hasCatalogItem(listing())).toBe(true);
  });
});

describe('buildExportAddToCartEvent', () => {
  const cartItem = {
    quantity: 2,
    itemData: { price: 10, currency: 'USD' },
  } as Parameters<typeof buildExportAddToCartEvent>[0];

  it('does not read .item on a listing that is missing the nested catalog', () => {
    expect(() =>
      buildExportAddToCartEvent(cartItem, { id: 'inv-orphan' } as InventoryItem)
    ).not.toThrow();
    const event = buildExportAddToCartEvent(cartItem, {
      id: 'inv-orphan',
    } as InventoryItem);
    expect(event.content_name).toBeUndefined();
    expect(event.currency).toBe('USD');
  });
});

describe('ExportsPage', () => {
  beforeEach(() => {
    mockUseInventoryItems.mockReset();
  });

  it('renders the empty state without crashing', () => {
    mockUseInventoryItems.mockReturnValue({
      inventoryItems: [],
      loading: false,
      error: null,
      pagination: null,
    });
    renderPage();
    expect(
      screen.getByText('No export items for this market yet.')
    ).toBeInTheDocument();
  });

  it('renders loading placeholders without crashing', () => {
    mockUseInventoryItems.mockReturnValue({
      inventoryItems: [],
      loading: true,
      error: null,
      pagination: null,
    });
    expect(() => renderPage()).not.toThrow();
    expect(
      screen.queryByText('No export items for this market yet.')
    ).not.toBeInTheDocument();
  });

  it('passes item= so cards can read nested .item, and skips incomplete rows', () => {
    mockUseInventoryItems.mockReturnValue({
      inventoryItems: [
        listing({ id: 'inv-ok', item: { name: 'Export tea' } as InventoryItem['item'] }),
        { id: 'inv-missing-item' } as InventoryItem,
      ],
      loading: false,
      error: null,
      pagination: null,
    });
    expect(() => renderPage()).not.toThrow();
    expect(screen.getByText('Export tea')).toBeInTheDocument();
    expect(screen.queryByText('inv-missing-item')).not.toBeInTheDocument();
  });
});
