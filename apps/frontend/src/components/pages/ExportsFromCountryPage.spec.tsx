import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../../theme/theme';
import type { InventoryItem } from '../../hooks/useInventoryItems';
import ExportsFromCountryPage, { groupExportsByCategory } from './ExportsFromCountryPage';

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
jest.mock('../exports/ExportsDirectionBar', () => ({
  __esModule: true,
  default: ({ direction, originCode }: { direction: string; originCode?: string }) => (
    <div>
      bar:{direction}:{originCode}
    </div>
  ),
}));
jest.mock('../common/DashboardItemCard', () => ({
  __esModule: true,
  default: ({ item, exportInterestSource }: { item: InventoryItem; exportInterestSource?: string }) => (
    <div data-testid="card">
      {item.item.name}|{exportInterestSource}
    </div>
  ),
}));
jest.mock('../illustrations/ExportCatalogIllustration', () => () => null);

const mockOrigins = jest.fn();
const mockFrom = jest.fn();
jest.mock('../../hooks/useExportOrigins', () => ({
  useExportOrigins: () => mockOrigins(),
}));
jest.mock('../../hooks/useExportsFromOrigin', () => ({
  useExportsFromOrigin: (code: string | null) => mockFrom(code),
}));

function row(id: string, category: string | null, markets: string[]): InventoryItem {
  return {
    id,
    item: {
      name: `Item ${id}`,
      export_available: true,
      export_markets: markets.map((country_code) => ({ country_code })),
      item_sub_category: category ? { item_category: { name: category } } : undefined,
    },
    business_location: { business_id: `b-${id}`, address: { country: 'CA' } },
  } as unknown as InventoryItem;
}

function renderAt(path: string) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/exports/:countryCode" element={<ExportsFromCountryPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('groupExportsByCategory', () => {
  it('groups by category, biggest first, Other last', () => {
    const sections = groupExportsByCategory(
      [row('1', 'Food', []), row('2', null, []), row('3', 'Food', []), row('4', 'Apparel', [])],
      'Other'
    );
    expect(sections.map((s) => [s.name, s.items.length])).toEqual([
      ['Food', 2],
      ['Apparel', 1],
      ['Other', 1],
    ]);
  });
});

describe('ExportsFromCountryPage (public /exports/:cc)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrigins.mockReturnValue({
      origins: [{ country_code: 'CA', item_count: 2, business_count: 2, destination_codes: ['CM', 'GA'] }],
      loading: false,
      error: false,
    });
  });

  it('lists origin items by category with destinations and partner interest, indexed with a canonical URL', () => {
    mockFrom.mockReturnValue({
      items: [row('1', 'Food & drinks', ['CM', 'GA']), row('2', 'Apparel', ['CM'])],
      total: 2,
      loading: false,
      error: false,
    });
    renderAt('/exports/ca');
    expect(mockFrom).toHaveBeenCalledWith('CA');
    expect(screen.getByText('Exports from Canada')).toBeTruthy();
    expect(screen.getAllByTestId('exports-category-section')).toHaveLength(2);
    expect(screen.getAllByTestId('card')[0].textContent).toContain('public_export_catalog');
    expect(screen.getByText('bar:from:CA')).toBeTruthy();
    const seo = mockSeo.mock.calls.at(-1)?.[0] as { canonical: string; noindex: boolean };
    expect(seo.canonical).toBe('https://rendasua.com/exports/ca');
    expect(seo.noindex).toBe(false);
  });

  it('shows an empty state linking to /exports for an unknown code, and is not indexed', () => {
    mockFrom.mockReturnValue({ items: [], total: 0, loading: false, error: false });
    renderAt('/exports/zzz');
    expect(mockFrom).toHaveBeenCalledWith(null);
    expect(screen.getByText('We don’t know the country code “zzz”.')).toBeTruthy();
    expect(screen.getByText('Go to Exports').closest('a')?.getAttribute('href')).toBe('/exports');
    const seo = mockSeo.mock.calls.at(-1)?.[0] as { noindex: boolean };
    expect(seo.noindex).toBe(true);
  });

  it('shows the empty state for a valid code with no exports', () => {
    mockFrom.mockReturnValue({ items: [], total: 0, loading: false, error: false });
    renderAt('/exports/sn');
    expect(screen.getByText('No exports from Senegal yet')).toBeTruthy();
  });
});
