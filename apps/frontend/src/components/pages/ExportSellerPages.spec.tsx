import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../../theme/theme';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import ExportSellerPage from './ExportSellerPage';
import ExportSellersPage from './ExportSellersPage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, defaultValue?: string | Record<string, unknown>, options?: Record<string, unknown>) => {
      const opts = (typeof defaultValue === 'object' ? defaultValue : options) ?? {};
      const text = typeof defaultValue === 'string' ? defaultValue : (opts.defaultValue as string) ?? key;
      return text.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(opts[k] ?? ''));
    },
  }),
}));

const mockSeo = jest.fn();
jest.mock('../seo/SEOHead', () => (props: unknown) => {
  mockSeo(props);
  return null;
});
jest.mock('../../hooks/useMarket', () => ({
  useMarket: () => ({ selectedMarket: { id: 'cm', countryCode: 'CM' } }),
}));
jest.mock('../../contexts/SessionAuthContext', () => ({
  useSessionAuth: () => ({ isAuthenticated: false }),
}));
jest.mock('../../contexts/UserProfileContext', () => ({
  useUserProfileContext: () => ({ profile: null }),
}));
const mockTrack = jest.fn();
jest.mock('../../hooks/useExportSellerTracking', () => ({
  useExportSellerTracking: () => mockTrack,
}));
const mockSellers = jest.fn();
jest.mock('../../hooks/useExportSellers', () => ({
  useExportSellers: (...args: unknown[]) => mockSellers(...args),
}));
const mockItems = jest.fn();
jest.mock('../../hooks/useInventoryItems', () => ({
  useInventoryItems: (...args: unknown[]) => mockItems(...args),
}));
jest.mock('../common/DashboardItemCard', () => ({
  __esModule: true,
  default: ({ item, exportInterestSource }: { item: InventoryItem; exportInterestSource?: string }) => (
    <div data-testid="card">
      {item.item.name}|{exportInterestSource ?? 'in-app'}
    </div>
  ),
}));

const maple = {
  business_location_id: 'loc-1',
  business_id: 'b-1',
  name: 'Maple Ridge Foods',
  city: 'Toronto',
  country: 'CA',
  logo_url: null,
  item_count: 5,
  latest_export_at: null,
};

function renderAt(path: string) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/exports/sellers" element={<ExportSellersPage />} />
          <Route path="/exports/sellers/:locationId" element={<ExportSellerPage />} />
          <Route path="/exports/:countryCode/sellers" element={<ExportSellersPage />} />
          <Route path="/exports/:countryCode/sellers/:locationId" element={<ExportSellerPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

const lastSeo = () => mockSeo.mock.calls.at(-1)?.[0] as { canonical?: string; noindex: boolean; structuredData?: Record<string, unknown> };

beforeEach(() => {
  jest.clearAllMocks();
  mockSellers.mockReturnValue({ sellers: [maple], total: 1, loading: false, loadingMore: false, error: false, loadMore: jest.fn(), hasMore: false });
  mockItems.mockReturnValue({
    inventoryItems: [{ id: 'inv-1', item: { name: 'Maple syrup' } }],
    loading: false,
    error: null,
    pagination: { total: 1, totalPages: 1 },
  });
});

describe('ExportSellersPage', () => {
  it('public /exports/ca/sellers: From list with search, indexed with a canonical on rendasua.com', () => {
    renderAt('/exports/ca/sellers');
    expect(mockSellers).toHaveBeenCalledWith(expect.objectContaining({ direction: 'from', originCode: 'CA', limit: 20, search: '' }));
    expect(screen.getByText('All sellers')).toBeTruthy();
    expect(screen.getByTestId('export-sellers-context').textContent).toBe('From Canada · 1 sellers');
    expect(screen.getByTestId('export-sellers-search')).toBeTruthy();
    expect(screen.getByTestId('export-seller-row').getAttribute('href')).toBe('/exports/ca/sellers/loc-1');
    expect(lastSeo().canonical).toBe('https://rendasua.com/exports/ca/sellers');
    expect(lastSeo().noindex).toBe(false);
    expect(mockTrack).toHaveBeenCalledWith('exports_sellers_list_viewed', { total: 1 });
  });

  it('in-app /exports/sellers uses the viewer market (Into) and is not indexed', () => {
    renderAt('/exports/sellers');
    expect(mockSellers).toHaveBeenCalledWith(expect.objectContaining({ direction: 'into', marketCode: 'CM' }));
    expect(screen.getByTestId('export-seller-row').getAttribute('href')).toBe('/exports/sellers/loc-1');
    expect(lastSeo().noindex).toBe(true);
  });

  it('shows the empty state and noindex when the context has no sellers', () => {
    mockSellers.mockReturnValue({ sellers: [], total: 0, loading: false, loadingMore: false, error: false, loadMore: jest.fn(), hasMore: false });
    renderAt('/exports/sn/sellers');
    expect(screen.getByTestId('export-sellers-empty').textContent).toContain('No sellers in this view yet.');
    expect(lastSeo().noindex).toBe(true);
  });
});

describe('ExportSellerPage', () => {
  it('public seller page: export items only, partner interest, canonical + Organization structured data', () => {
    renderAt('/exports/ca/sellers/loc-1');
    expect(mockSellers).toHaveBeenCalledWith(expect.objectContaining({ direction: 'from', originCode: 'CA', businessLocationId: 'loc-1', limit: 1 }));
    expect(mockItems).toHaveBeenCalledWith(
      expect.objectContaining({ export_only: true, business_location_id: 'loc-1', origin_country: 'CA', pageMode: 'replace' })
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Maple Ridge Foods');
    expect(screen.getByText('5 export items')).toBeTruthy();
    expect(screen.getByTestId('export-seller-search')).toBeTruthy();
    expect(screen.getByTestId('card').textContent).toBe('Maple syrup|public_export_catalog');
    expect(lastSeo().canonical).toBe('https://rendasua.com/exports/ca/sellers/loc-1');
    expect(lastSeo().noindex).toBe(false);
    expect((lastSeo().structuredData?.about as { name: string }).name).toBe('Maple Ridge Foods');
    expect(mockTrack).toHaveBeenCalledWith('exports_seller_page_viewed', { location_id: 'loc-1', item_count: 5 });
  });

  it('in-app Into seller page canonicalises to the public URL but is not indexed', () => {
    renderAt('/exports/sellers/loc-1');
    expect(mockItems).toHaveBeenCalledWith(expect.not.objectContaining({ origin_country: expect.anything() }));
    expect(screen.getByTestId('card').textContent).toBe('Maple syrup|in-app');
    expect(lastSeo().canonical).toBe('https://rendasua.com/exports/ca/sellers/loc-1');
    expect(lastSeo().noindex).toBe(true);
  });

  it('unknown seller: not-found state and noindex', () => {
    mockSellers.mockReturnValue({ sellers: [], total: 0, loading: false, loadingMore: false, error: false, loadMore: jest.fn(), hasMore: false });
    renderAt('/exports/ca/sellers/nope');
    expect(screen.getByTestId('export-seller-not-found')).toBeTruthy();
    expect(lastSeo().noindex).toBe(true);
  });
});
