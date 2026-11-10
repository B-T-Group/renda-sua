import React, { useState } from 'react';
import { act, cleanup, fireEvent } from '@testing-library/react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import i18n from '@/i18n';
import {
  RentalSearchFirstView,
  type RentalSearchFirstViewProps,
} from './RentalSearchFirstView';
import type { RentalSearchCardModel } from './RentalSearchResultCard';
import type { RentalDateRange } from '@/utils/rentals/rentalSearchDates';

const canon: RentalSearchCardModel = {
  id: 'canon',
  name: 'Canon EOS R50 kit',
  pricePerDay: 25000,
  currency: 'XAF',
  available: true,
  totalForDates: 75000,
  dayCount: 3,
  nextAvailableDate: null,
  rangeLabel: '12–15 Nov',
};

const nikon: RentalSearchCardModel = {
  ...canon,
  id: 'nikon',
  name: 'Nikon Z50 body',
  available: false,
  totalForDates: null,
  nextAvailableDate: '2026-11-18',
};

function props(over: Partial<RentalSearchFirstViewProps> = {}): RentalSearchFirstViewProps {
  return {
    marketLabel: 'Douala · Littoral',
    mode: 'landing',
    query: '',
    dates: null,
    draftDates: null,
    dateSheetOpen: false,
    categories: [{ id: 'cam', name: 'Cameras' }],
    moreCategories: [],
    moreOpen: false,
    suggestions: [],
    recent: [],
    cards: [],
    activeCategoryId: null,
    takeHome: false,
    sortLabel: 'relevance',
    datesSkipped: false,
    loading: false,
    notifyState: 'idle',
    nearby: [],
    similar: [{ id: 'drones', name: 'Drones' }],
    bottomInset: 0,
    onQueryChange: jest.fn(),
    onFocusQuery: jest.fn(),
    onSubmitQuery: jest.fn(),
    onBack: jest.fn(),
    onOpenDates: jest.fn(),
    onSkipDates: jest.fn(),
    onDraftDates: jest.fn(),
    onApplyDates: jest.fn(),
    onCloseDates: jest.fn(),
    onCategory: jest.fn(),
    onMore: jest.fn(),
    onBrowseAll: jest.fn(),
    onSuggestion: jest.fn(),
    onRecent: jest.fn(),
    onRent: jest.fn(),
    onSeeDates: jest.fn(),
    onToggleTakeHome: jest.fn(),
    onToggleCheapest: jest.fn(),
    onCycleSort: jest.fn(),
    onNearby: jest.fn(),
    onNotify: jest.fn(),
    ...over,
  };
}

function renderSearch(over: Partial<RentalSearchFirstViewProps> = {}) {
  return renderWithProviders(
    <ThemeProvider>
      <RentalSearchFirstView {...props(over)} />
    </ThemeProvider>
  );
}

describe('search-first rentals', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(async () => {
    await act(async () => undefined);
    cleanup();
  });

  it('lands without a feed or a My rentals shortcut', async () => {
    const view = await renderSearch();
    expect(view.getByPlaceholderText('Search cameras, tools, sound...')).toBeTruthy();
    expect(view.getByText('Douala · Littoral')).toBeTruthy();
    expect(view.getByTestId('rental-search-skip-dates')).toBeTruthy();
    expect(view.getByTestId('rental-search-browse-all')).toBeTruthy();
    expect(view.getByText('Cameras')).toBeTruthy();
    expect(view.getByText('No scrolling feed on landing')).toBeTruthy();
    expect(view.queryByText('My rentals')).toBeNull();
    expect(view.queryByText('Canon EOS R50 kit')).toBeNull();
  });

  it('shows suggestions and recent searches while typing', async () => {
    const onRecent = jest.fn();
    const view = await renderSearch({
      mode: 'typing',
      query: 'cam',
      suggestions: [{ kind: 'category', id: 'cam', label: 'Camera', subtitle: 'Category · 48 listings' }],
      recent: ['Speaker system'],
      onRecent,
    });
    expect(view.getByTestId('rental-search-suggestion-cam')).toBeTruthy();
    expect(view.getByText('Speaker system')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-recent-0'));
    });
    expect(onRecent).toHaveBeenCalledWith('Speaker system');
  });

  it('lists a free camera with Rent and an unavailable body with See dates', async () => {
    const onRent = jest.fn();
    const onSeeDates = jest.fn();
    const view = await renderSearch({
      mode: 'results',
      query: 'camera',
      dates: { startDate: '2026-11-12', endDate: '2026-11-15', dayCount: 3 },
      cards: [canon, nikon],
      onRent,
      onSeeDates,
    });
    expect(view.getByText('Canon EOS R50 kit')).toBeTruthy();
    expect(view.getByText('Free 12–15 Nov')).toBeTruthy();
    expect(view.getByText(/75/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-rent-canon'));
    });
    expect(onRent).toHaveBeenCalledWith('canon');
    expect(view.getByText(/Available from/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-see-dates-nikon'));
    });
    expect(onSeeDates).toHaveBeenCalledWith('nikon');
    expect(view.queryByTestId('rental-search-rent-nikon')).toBeNull();
  });

  it('offers nearby dates and a one-time notify when nothing matches', async () => {
    const onNotify = jest.fn();
    const onNearby = jest.fn();
    const nearby: RentalDateRange[] = [{ startDate: '2026-11-16', endDate: '2026-11-19', dayCount: 3 }];
    const view = await renderSearch({
      mode: 'results',
      query: 'drone 4k',
      dates: { startDate: '2026-11-12', endDate: '2026-11-15', dayCount: 3 },
      nearby,
      onNotify,
      onNearby,
    });
    expect(view.getByText('Nothing free for those dates')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByText(/16–19/));
    });
    expect(onNearby).toHaveBeenCalledWith(nearby[0]);
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-notify'));
    });
    expect(onNotify).toHaveBeenCalled();
  });

  it('browses with the same chips and asks for dates before a total', async () => {
    const view = await renderSearch({
      mode: 'browse',
      cards: [{ ...canon, available: null, totalForDates: null, dayCount: null, rangeLabel: null }],
    });
    expect(view.getByText('DATES (OPTIONAL)')).toBeTruthy();
    expect(view.getByText('Take-home')).toBeTruthy();
    expect(view.getByText('Totals appear once you add dates')).toBeTruthy();
    expect(view.getByTestId('rental-search-rent-canon')).toBeTruthy();
  });

  it('opens the date picker blank, then fills a quick pick', async () => {
    function Sheet() {
      const [draft, setDraft] = useState<RentalDateRange | null>(null);
      return (
        <ThemeProvider>
          <RentalSearchFirstView {...props({ dateSheetOpen: true, draftDates: draft, onDraftDates: setDraft })} />
        </ThemeProvider>
      );
    }
    const view = await renderWithProviders(<Sheet />);
    expect(view.getByTestId('rental-search-dates-blank')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-quick-today'));
    });
    expect(view.queryByTestId('rental-search-dates-blank')).toBeNull();
    expect(view.getByTestId('rental-search-apply-dates')).toBeTruthy();
  });

  it('asks for dates in formal French', async () => {
    await i18n.changeLanguage('fr');
    const view = await renderSearch();
    expect(view.getByText('QUAND EN AVEZ-VOUS BESOIN ?')).toBeTruthy();
    expect(view.getByText('Ajoutez le début et la fin')).toBeTruthy();
    expect(view.getByText('Ignorer')).toBeTruthy();
  });
});
