import { ThemeProvider, createTheme } from '@mui/material/styles';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import RentalsDefaultCatalog from './RentalsDefaultCatalog';
import { useRentalSearchCatalog, useTopRentalCategories } from '../../hooks/useRentalSearchCatalog';

jest.mock('../../hooks/useRentalSearchCatalog', () => ({
  useRentalSearchCatalog: jest.fn(),
  useTopRentalCategories: jest.fn(),
}));

jest.mock('../../hooks/useMarket', () => ({
  useMarket: () => ({
    selectedMarket: { name: 'Douala', stateCode: 'LT', stateName: 'Littoral' },
    hydrated: true,
  }),
}));

const mockSetSearchParams = jest.fn();
const mockNavigate = jest.fn();
const mockSearch = { params: new URLSearchParams() };

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearch.params, mockSetSearchParams],
}));

jest.mock('../../hooks/useClientFlags', () => ({
  useClientFlags: () => ({
    flags: { rentals_my_rentals_entry_enabled: true },
    loading: false,
  }),
}));

jest.mock('../../contexts/SessionAuthContext', () => ({
  useSessionAuth: () => ({ isAuthenticated: true }),
}));

jest.mock('../../hooks/useClientRentalsTabBadge', () => ({
  useClientRentalsTabBadge: () => ({ badge: '2', count: 2 }),
}));

const search = useRentalSearchCatalog as jest.Mock;
const categories = useTopRentalCategories as jest.Mock;

i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} }, fr: { translation: {} } },
});

function listing(id: string, name: string, price: number, currency: string) {
  return {
    id,
    base_price_per_hour: 0,
    base_price_per_day: price,
    min_rental_hours: 1,
    max_rental_hours: null,
    pickup_instructions: '',
    dropoff_instructions: '',
    weekly_availability: [],
    rental_item: {
      id: `${id}-item`,
      name,
      description: '',
      tags: [],
      currency,
      operation_mode: 'take_home',
      rental_category: { id: 'cam', name: 'Cameras' },
      rental_item_images: [],
      business: { id: 'biz', name: 'Studio' },
    },
    business_location: { id: 'loc', name: 'Studio Akwa', address: { city: 'Douala' } },
  };
}

function renderCatalog() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <I18nextProvider i18n={i18n}>
        <RentalsDefaultCatalog />
      </I18nextProvider>
    </ThemeProvider>
  );
}

describe('RentalsDefaultCatalog', () => {
  beforeEach(async () => {
    mockSearch.params = new URLSearchParams();
    mockNavigate.mockReset();
    await i18n.changeLanguage('en');
    categories.mockReturnValue({
      categories: [
        { id: 'cam', name: 'Cameras' },
        { id: 'tools', name: 'Tools' },
      ],
      loading: false,
    });
  });

  it('lists the market on first load and pages', () => {
    const loadMore = jest.fn();
    search.mockReturnValue({
      hits: [
        {
          listing: listing('sony', 'Sony A7 IV kit', 45000, 'XAF'),
          available: null,
          nextAvailableDate: null,
          pricePerDay: 45000,
          totalForDates: null,
          dayCount: null,
          inspection_enabled: true,
        },
      ],
      total: 12,
      loading: false,
      loadingMore: false,
      loadMore,
      ready: true,
    });
    renderCatalog();
    expect(screen.getByText('Sony A7 IV kit')).toBeTruthy();
    expect(screen.getByText('Studio Akwa, Douala')).toBeTruthy();
    expect(screen.getByText('Inspection')).toBeTruthy();
    const prices = screen.getAllByText((_, node) => (node?.textContent ?? '').includes('45\u00A0000\u00A0FCFA'));
    expect(prices.length).toBeGreaterThan(0);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ sort: 'recommended', q: '' }));
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(loadMore).toHaveBeenCalled();
  });

  it('shows an hourly-only listing from its hour rate, never a day price of 0', () => {
    const drill = { ...listing('drill', 'Bosch drill', 0, 'XAF'), base_price_per_hour: 3000, offers_daily: false, offers_hourly: true };
    search.mockReturnValue({
      hits: [{ listing: drill, available: true, nextAvailableDate: null, pricePerDay: 0, totalForDates: null, dayCount: 2 }],
      total: 1,
      loading: false,
      loadingMore: false,
      loadMore: jest.fn(),
      ready: true,
    });
    renderCatalog();
    expect(screen.getAllByText((_, node) => (node?.textContent ?? '') === 'from\u00A03\u00A0000\u00A0FCFA\u00A0/\u00A0h').length).toBeGreaterThan(0);
    expect(screen.queryAllByText((_, node) => /(^|\D)0\u00A0FCFA/.test(node?.textContent ?? '')).length).toBe(0);
  });

  it('shows skeletons, the empty market, and switches when the search is cleared', () => {
    search.mockReturnValue({ hits: [], total: 0, loading: true, loadingMore: false, loadMore: jest.fn(), ready: true });
    const view = renderCatalog();
    expect(screen.getByTestId('rentals-catalog-skeletons')).toBeTruthy();
    search.mockReturnValue({ hits: [], total: 0, loading: false, loadingMore: false, loadMore: jest.fn(), ready: true });
    view.rerender(
      <ThemeProvider theme={createTheme()}>
        <I18nextProvider i18n={i18n}>
          <RentalsDefaultCatalog />
        </I18nextProvider>
      </ThemeProvider>
    );
    expect(screen.getByTestId('rentals-empty-market')).toBeTruthy();
    expect(screen.getByText('No rentals here yet')).toBeTruthy();
    expect(screen.getByText('Nothing is listed in Douala yet. Try another city, or search by name.')).toBeTruthy();
  });

  it('hides load more when the search page says there is nothing else', () => {
    search.mockReturnValue({
      hits: [
        {
          listing: listing('sony', 'Sony A7 IV kit', 45000, 'XAF'),
          available: null,
          nextAvailableDate: null,
          pricePerDay: 45000,
          totalForDates: null,
          dayCount: null,
          inspection_enabled: false,
        },
      ],
      total: 12,
      hasMore: false,
      loading: false,
      loadingMore: false,
      loadMore: jest.fn(),
      ready: true,
    });
    renderCatalog();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('hides load more when every rental is already on the page', () => {
    search.mockReturnValue({
      hits: [
        {
          listing: listing('sony', 'Sony A7 IV kit', 45000, 'XAF'),
          available: null,
          nextAvailableDate: null,
          pricePerDay: 45000,
          totalForDates: null,
          dayCount: null,
          inspection_enabled: false,
        },
      ],
      total: 1,
      loading: false,
      loadingMore: false,
      loadMore: jest.fn(),
      ready: true,
    });
    renderCatalog();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('clears a search back to the unfiltered list', () => {
    jest.useFakeTimers();
    mockSearch.params = new URLSearchParams('q=camera');
    search.mockReturnValue({ hits: [], total: 0, loading: false, loadingMore: false, loadMore: jest.fn(), ready: true });
    renderCatalog();
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ q: 'camera' }));
    fireEvent.click(screen.getByLabelText('clear'));
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ q: '' }));
    jest.useRealTimers();
  });

  it('puts the My rentals control in the hero and opens To do when the badge is 2', () => {
    search.mockReturnValue({
      hits: [],
      total: 0,
      loading: false,
      loadingMore: false,
      loadMore: jest.fn(),
      ready: true,
    });
    renderCatalog();
    expect(screen.getByTestId('rental-my-rentals-entry')).toBeTruthy();
    expect(screen.getByTestId('rental-my-rentals-badge').textContent).toBe('2');
    fireEvent.click(screen.getByTestId('rental-my-rentals-entry'));
    expect(mockNavigate).toHaveBeenCalledWith('/rentals/requests?segment=action_needed');
  });
});
