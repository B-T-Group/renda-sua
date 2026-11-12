import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
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
import { RentalSearchDateSheet } from './RentalSearchDateSheet';

const canon: RentalSearchCardModel = {
  id: 'canon',
  name: 'Canon EOS R50 kit',
  pricePerDay: 25000,
  currency: 'XAF',
  available: true,
  totalForDates: 75000,
  totalIsEstimate: false,
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

type StyledNode = { props: { style?: unknown }; children: Array<StyledNode | string> };

function firstChild(node: StyledNode): StyledNode | null {
  const child = node.children.find((item) => typeof item !== 'string');
  return child ?? null;
}

function centeredDay(cell: StyledNode): boolean {
  const cellStyle = StyleSheet.flatten(cell.props.style);
  const wrap = firstChild(cell);
  const text = wrap ? firstChild(wrap) : null;
  const wrapStyle = wrap ? StyleSheet.flatten(wrap.props.style) : null;
  const textStyle = text ? StyleSheet.flatten(text.props.style) : null;
  return (
    cellStyle?.alignItems === 'center' &&
    cellStyle?.justifyContent === 'center' &&
    cellStyle?.lineHeight == null &&
    cellStyle?.paddingTop == null &&
    wrapStyle?.alignItems === 'center' &&
    wrapStyle?.justifyContent === 'center' &&
    textStyle?.textAlign === 'center' &&
    textStyle?.textAlignVertical === 'center' &&
    textStyle?.includeFontPadding === false &&
    textStyle?.lineHeight == null &&
    textStyle?.padding === 0 &&
    textStyle?.paddingTop === 0
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
    expect(view.getByText('Search or pick a category')).toBeTruthy();
    expect(view.getByTestId('rental-search-more')).toBeTruthy();
    expect(view.getByTestId('rental-search-pinned')).toBeTruthy();
    expect(view.queryByText('No scrolling feed on landing')).toBeNull();
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
    expect(view.getByText('2 matches · available for your dates first')).toBeTruthy();
    expect(view.getByText('Canon EOS R50 kit')).toBeTruthy();
    expect(view.getByText('Free 12–15 Nov')).toBeTruthy();
    expect(view.getByText(/Total ·/)).toBeTruthy();
    expect(view.getByText(/75/)).toBeTruthy();
    expect(view.queryByText(/Est\./)).toBeNull();
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
    expect(view.getByText('Today')).toBeTruthy();
    expect(view.getByText('This weekend')).toBeTruthy();
    expect(view.getByText('1 week')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-quick-today'));
    });
    expect(view.getByTestId('rental-search-quick-today').props.accessibilityState).toMatchObject({ selected: true });
    expect(view.queryByTestId('rental-search-dates-blank')).toBeNull();
    expect(view.getByTestId('rental-search-apply-dates')).toBeTruthy();
  });

  it('greys out days before today and opens on the current month', async () => {
    const onChange = jest.fn();
    const view = await renderWithProviders(
      <ThemeProvider>
        <RentalSearchDateSheet
          visible
          now={new Date(2026, 10, 10)}
          timeZone="Africa/Douala"
          value={null}
          onChange={onChange}
          onApply={() => undefined}
          onClose={() => undefined}
        />
      </ThemeProvider>
    );
    expect(view.getByText('November 2026')).toBeTruthy();
    expect(view.getByTestId('rental-search-day-2026-11-01').props.accessibilityState).toMatchObject({ disabled: true });
    expect(view.getByTestId('rental-search-day-2026-11-09').props.accessibilityState).toMatchObject({ disabled: true });
    expect(view.getByTestId('rental-search-cal-prev').props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-day-2026-11-01'));
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(view.getByTestId('rental-search-dates-blank')).toBeTruthy();
    expect(centeredDay(view.getByTestId('rental-search-day-2026-11-01'))).toBe(true);
  });

  it('centers day numbers for open, in-range, and range-end cells', async () => {
    function Sheet() {
      const [value, setValue] = useState<RentalDateRange | null>(null);
      return (
        <ThemeProvider>
          <RentalSearchDateSheet
            visible
            now={new Date(2026, 10, 10)}
            value={value}
            onChange={setValue}
            onApply={() => undefined}
            onClose={() => undefined}
          />
        </ThemeProvider>
      );
    }
    const view = await renderWithProviders(<Sheet />);
    expect(centeredDay(view.getByTestId('rental-search-day-2026-11-20'))).toBe(true);
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-day-2026-11-11'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-day-2026-11-19'));
    });
    expect(centeredDay(view.getByTestId('rental-search-day-2026-11-11'))).toBe(true);
    expect(centeredDay(view.getByTestId('rental-search-day-2026-11-15'))).toBe(true);
    expect(centeredDay(view.getByTestId('rental-search-day-2026-11-19'))).toBe(true);
    expect(centeredDay(view.getByTestId('rental-search-day-2026-11-01'))).toBe(true);
  });

  it('explains a range over 30 days in English and does not apply it', async () => {
    const onApply = jest.fn();
    const onChange = jest.fn();
    function Sheet() {
      const [value, setValue] = useState<RentalDateRange | null>(null);
      return (
        <ThemeProvider>
          <RentalSearchDateSheet
            visible
            now={new Date(2026, 10, 10)}
            value={value}
            onChange={(range) => {
              onChange(range);
              setValue(range);
            }}
            onApply={onApply}
            onClose={() => undefined}
          />
        </ThemeProvider>
      );
    }
    const view = await renderWithProviders(<Sheet />);
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-day-2026-11-10'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-cal-next'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-day-2026-12-11'));
    });
    expect(view.getByTestId('rental-search-dates-too-long').props.children).toContain('31 days');
    expect(view.getByText(/30 days or fewer/)).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(null);
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-apply-dates'));
    });
    expect(onApply).not.toHaveBeenCalled();
  });

  it('explains the 30-day limit in formal French', async () => {
    await i18n.changeLanguage('fr');
    function Sheet() {
      const [value, setValue] = useState<RentalDateRange | null>(null);
      return (
        <ThemeProvider>
          <RentalSearchDateSheet
            visible
            now={new Date(2026, 10, 10)}
            value={value}
            onChange={setValue}
            onApply={() => undefined}
            onClose={() => undefined}
          />
        </ThemeProvider>
      );
    }
    const view = await renderWithProviders(<Sheet />);
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-day-2026-11-10'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-cal-next'));
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-day-2026-12-11'));
    });
    expect(view.getByText('Cette période compte 31 jours. Choisissez 30 jours ou moins.')).toBeTruthy();
  });

  it('labels a daily total as an estimate when the booking quote differs', async () => {
    const view = await renderSearch({
      mode: 'results',
      query: 'scaffold',
      dates: { startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 },
      cards: [{ ...canon, totalForDates: 760, dayCount: 2, totalIsEstimate: true, rangeLabel: '14–16 Nov' }],
    });
    expect(view.getByText(/Est\./)).toBeTruthy();
  });

  it('asks for dates in formal French', async () => {
    await i18n.changeLanguage('fr');
    const view = await renderSearch();
    expect(view.getByText('QUAND EN AVEZ-VOUS BESOIN ?')).toBeTruthy();
    expect(view.getByText('Ajoutez le début et la fin')).toBeTruthy();
    expect(view.getByText('Ignorer')).toBeTruthy();
    expect(view.getByText('Locations')).toBeTruthy();
    expect(view.getByText(/pour vos dates/)).toBeTruthy();
    expect(view.queryByText('Aucun fil à faire défiler sur cette page')).toBeNull();
  });

  it('hides the recent header when nothing has been searched', async () => {
    const view = await renderSearch({ mode: 'typing', query: '', suggestions: [], recent: [] });
    expect(view.queryByText('SUGGESTIONS')).toBeNull();
    expect(view.queryByText('RECENT')).toBeNull();
    expect(view.queryByTestId('rental-search-run-query')).toBeNull();
  });

  it('offers to search the typed query when nothing is suggested', async () => {
    const onSubmitQuery = jest.fn();
    const view = await renderSearch({
      mode: 'typing',
      query: 'zzzz',
      suggestions: [],
      recent: [],
      onSubmitQuery,
    });
    expect(view.queryByText('SUGGESTIONS')).toBeNull();
    expect(view.getByText('Search for “zzzz”')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-search-run-query'));
    });
    expect(onSubmitQuery).toHaveBeenCalled();
  });

  it('uses the singular result count for one listing', async () => {
    const view = await renderSearch({
      mode: 'results',
      dates: { startDate: '2026-11-10', endDate: '2026-11-17', dayCount: 7 },
      cards: [canon],
    });
    expect(view.getByText('1 match · available for your dates first')).toBeTruthy();
    expect(view.queryByText(/1 matches/)).toBeNull();
  });

  it('keeps the browse tile and drops the duplicate category chip', async () => {
    const view = await renderSearch({
      mode: 'browse',
      categories: [{ id: 'equip', name: 'Equipment' }],
      activeCategoryId: 'equip',
      cards: [],
    });
    expect(view.getAllByText('Equipment')).toHaveLength(1);
    expect(view.getByTestId('rental-search-more')).toBeTruthy();
  });

  it('names Cameroon in French on the landing', async () => {
    await i18n.changeLanguage('fr');
    const view = await renderSearch({ marketLabel: 'Cameroon' });
    expect(view.getByText('Cameroun')).toBeTruthy();
  });

  it('translates seeded categories and the empty-search row in French', async () => {
    await i18n.changeLanguage('fr');
    const view = await renderSearch({
      mode: 'typing',
      query: 'zzzz',
      suggestions: [],
    });
    expect(view.getByText('Rechercher « zzzz »')).toBeTruthy();
    expect(view.queryByText('SUGGESTIONS')).toBeNull();
  });

  it('translates the seeded category names on a French browse screen', async () => {
    await i18n.changeLanguage('fr');
    const results = await renderSearch({
      mode: 'browse',
      categories: [
        { id: 'equip', name: 'Equipment' },
        { id: 'other', name: 'Other' },
        { id: 'phones', name: 'Téléphone' },
      ],
      cards: [canon],
    });
    expect(results.getByText('Équipement')).toBeTruthy();
    expect(results.getByText('Autre')).toBeTruthy();
    expect(results.getByText('Téléphone')).toBeTruthy();
    expect(results.queryByText('Equipment')).toBeNull();
    expect(results.getByText("1 location · ajoutez des dates pour trier par disponibilité")).toBeTruthy();
  });

  it('uses the French plural when more than one listing matches', async () => {
    await i18n.changeLanguage('fr');
    const view = await renderSearch({
      mode: 'results',
      dates: { startDate: '2026-11-10', endDate: '2026-11-17', dayCount: 7 },
      cards: [canon, nikon],
    });
    expect(view.getByText("2 résultats · les dates libres d'abord")).toBeTruthy();
  });

  it('shows the My rentals caption, badge, and next card', async () => {
    const onPress = jest.fn();
    const onOpen = jest.fn();
    const onDismiss = jest.fn();
    const view = await renderSearch({
      myRentals: {
        label: 'My rentals',
        badge: '3',
        accessibilityLabel: 'My rentals, 3 to do',
        onPress,
        next: {
          name: 'Echafaudage roulant 4 m',
          period: 'Sat 14 Nov · 2 days',
          statusLabel: 'Accepted',
          imageUrl: null,
          onOpen,
          onDismiss,
        },
      },
    });
    const caption = view.getByText('My rentals');
    expect(caption.props.numberOfLines).toBe(1);
    expect(view.getByText('3')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-my-rentals-entry'));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('rental-next-card')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('rental-next-card-dismiss'));
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('caps the badge at 9+', async () => {
    const withBadge = await renderSearch({
      myRentals: {
        label: 'My rentals',
        badge: '9+',
        accessibilityLabel: 'My rentals, 12 to do',
        onPress: jest.fn(),
        next: null,
      },
    });
    expect(withBadge.getByText('9+')).toBeTruthy();
  });

  it('hides the badge at zero', async () => {
    const clear = await renderSearch({
      myRentals: {
        label: 'My rentals',
        badge: null,
        accessibilityLabel: 'My rentals',
        onPress: jest.fn(),
        next: null,
      },
    });
    expect(clear.queryByTestId('rental-my-rentals-badge')).toBeNull();
    expect(clear.getByText('My rentals').props.numberOfLines).toBe(1);
  });

  it('keeps the French caption on one line', async () => {
    await i18n.changeLanguage('fr');
    const view = await renderSearch({
      myRentals: {
        label: 'Mes locations',
        badge: '2',
        accessibilityLabel: 'Mes locations, 2 à faire',
        onPress: jest.fn(),
        next: {
          name: 'Echafaudage roulant 4 m',
          period: 'sam. 14 nov. · 2 jours',
          statusLabel: 'Acceptée',
          imageUrl: null,
          onOpen: jest.fn(),
          onDismiss: jest.fn(),
        },
      },
    });
    expect(view.getByText('Mes locations').props.numberOfLines).toBe(1);
    expect(view.getByText('Prochaine location')).toBeTruthy();
  });
});
