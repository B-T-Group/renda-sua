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
    i18n: { language: 'en' },
    t: (key: string, defaultValue?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const opts = (typeof defaultValue === 'object' && defaultValue ? defaultValue : options) ?? {};
      const text = typeof defaultValue === 'string' ? defaultValue : (opts.defaultValue as string) ?? key;
      return text.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(opts[k] ?? ''));
    },
  }),
}));

const mockUseExportSellers = jest.fn();
jest.mock('../../hooks/useExportSellers', () => ({
  useExportSellers: (...args: unknown[]) => mockUseExportSellers(...args),
}));
jest.mock('../../hooks/useExportSellerTracking', () => ({
  useExportSellerTracking: () => jest.fn(),
}));
jest.mock('../illustrations/ExportCatalogIllustration', () => () => <div>illustration</div>);

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

jest.mock('../../hooks/useExportOrigins', () => ({
  useExportOrigins: () => ({ origins: [], loading: false, error: false }),
}));

jest.mock('../exports/ExportsDirectionBar', () => ({
  __esModule: true,
  default: ({ direction }: { direction: string }) => <div>direction:{direction}</div>,
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
const mockRail = jest.fn(() => null);
jest.mock('../catalog-experience/RecentlyViewedRail', () => ({
  RecentlyViewedRail: (props: unknown) => mockRail(props),
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
    mockUseExportSellers.mockReset();
    mockRail.mockClear();
    mockUseExportSellers.mockReturnValue({ sellers: [], total: 0, loading: false, error: false });
  });

  it('shows a compact header (no hero illustration or subtitle), counts and the Into sellers carousel', () => {
    mockUseInventoryItems.mockReturnValue({
      inventoryItems: [listing()],
      loading: false,
      error: null,
      pagination: { total: 71, totalPages: 3, page: 1, limit: 24 },
    });
    mockUseExportSellers.mockReturnValue({
      sellers: [
        {
          business_location_id: 'loc-1',
          business_id: 'b-1',
          name: 'Maple Ridge Foods',
          city: 'Toronto',
          country: 'CA',
          logo_url: null,
          item_count: 5,
          latest_export_at: null,
        },
      ],
      total: 12,
      loading: false,
      error: false,
    });
    renderPage();
    expect(mockUseExportSellers).toHaveBeenCalledWith(
      expect.objectContaining({ direction: 'into', marketCode: 'CM', limit: 10 })
    );
    expect(screen.getByTestId('exports-into-summary').textContent).toBe('71 products · 12 sellers');
    expect(screen.queryByText('illustration')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Submit interest and the seller will contact you/)
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('export-sellers-carousel')).toBeInTheDocument();
    expect(screen.getByTestId('export-seller-card-0').getAttribute('href')).toBe('/exports/sellers/loc-1');
    expect(screen.getByTestId('export-sellers-more-card').getAttribute('href')).toBe('/exports/sellers');
    expect(screen.getByText('direction:into')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Exports into Cameroon');
    expect(screen.queryByText('Available for export')).not.toBeInTheDocument();
    expect(mockRail).not.toHaveBeenCalled();
    expect(screen.queryByText('Order Now')).not.toBeInTheDocument();
    expect(screen.queryByText('Add to Cart')).not.toBeInTheDocument();
    expect(screen.queryByText('Buy Now')).not.toBeInTheDocument();
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

  it('renders loading skeletons and hides empty state and stale items', () => {
    mockUseInventoryItems.mockReturnValue({
      inventoryItems: [
        listing({ id: 'inv-stale', item: { name: 'Stale export' } as InventoryItem['item'] }),
      ],
      loading: true,
      error: null,
      pagination: null,
    });
    expect(() => renderPage()).not.toThrow();
    expect(
      screen.getByLabelText('Loading items…')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No export items for this market yet.')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Stale export')).not.toBeInTheDocument();
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
