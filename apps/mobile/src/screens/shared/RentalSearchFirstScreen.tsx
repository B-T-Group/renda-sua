import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { useDefaultRentalCatalog } from '../../hooks/useDefaultRentalCatalog';
import { useSearchFirstMyRentals } from '../../hooks/useMyRentalsLandingEntry';
import {
  RentalSearchFirstView,
  type RentalSearchMode,
} from '../../components/rentals/search/RentalSearchFirstView';
import type { RentalSearchCardModel } from '../../components/rentals/search/RentalSearchResultCard';
import { useTheme } from '../../contexts/ThemeContext';
import { useMarket } from '../../hooks/useMarket';
import { useRentalCatalogGeoParams } from '../../hooks/useRentalCatalogGeoParams';
import type { GuestRootStackParamList } from '../../navigation/types';
import {
  searchRentals,
  subscribeRentalAvailability,
  suggestRentals,
  topRentalCategories,
  type RentalSearchHit,
  type RentalSuggestion,
  type RentalTopCategory,
} from '../../services/rentalSearchApi';
import storage from '../../services/storage/StorageService';
import { useStore } from '../../stores/RootStore';
import {
  formatSearchStayRange,
  marketTimeZone,
  MAX_RENTAL_SEARCH_DAYS,
  nearbyRanges,
  rangeFromNextStart,
  subscribeRentalSearchStay,
  type RentalDateRange,
} from '../../utils/rentals/rentalSearchDates';
import { loadRecentSearches, rememberSearch } from '../../utils/rentals/recentRentalSearches';
import { searchRentAction } from '../../utils/rentals/searchRentAction';
import { splitTopCategories } from '../../utils/rentals/rentalCategoryIcon';
import {
  allDaySelectionsForRange,
  dailyTotalDiffersFromQuote,
  quoteRentalSelections,
} from '../../utils/rentals/rentalSearchPreset';

const LEGACY_SORTS = ['relevance', 'newest', 'cheapest', 'expensive'] as const;
const LIST_SORTS = ['recommended', 'relevance'] as const;
type SortName = (typeof LEGACY_SORTS)[number] | (typeof LIST_SORTS)[number];

export const RentalSearchFirstScreen = observer(function RentalSearchFirstScreen({
  withAuth = false,
  applyTopSafeArea = true,
  initialQuery = '',
  initialDates = null,
  initialCategoryId = null,
}: {
  withAuth?: boolean;
  applyTopSafeArea?: boolean;
  initialQuery?: string;
  initialDates?: RentalDateRange | null;
  initialCategoryId?: string | null;
}) {
  const { i18n } = useTranslation();
  const { flags } = useClientFlags();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation();
  const { auth } = useStore();
  const myRentals = useSearchFirstMyRentals(
    flags.rentals_my_rentals_entry_enabled,
    auth.isAuthenticated,
    flags.rentals_client_tab_enabled
  );
  const { selectedMarket } = useMarket();
  const geo = useRentalCatalogGeoParams();
  const defaultList = flags.rentals_default_list_enabled === true;
  const [mode, setMode] = useState<RentalSearchMode>(initialQuery ? 'results' : 'landing');
  const [returnMode, setReturnMode] = useState<RentalSearchMode>('landing');
  const [query, setQuery] = useState(initialQuery);
  const [dates, setDates] = useState<RentalDateRange | null>(initialDates);
  const [draftDates, setDraftDates] = useState<RentalDateRange | null>(null);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [pendingRentId, setPendingRentId] = useState<string | null>(null);
  const [categories, setCategories] = useState<RentalTopCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<RentalSuggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [hits, setHits] = useState<RentalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [sort, setSort] = useState<SortName>(defaultList ? 'recommended' : 'relevance');
  const promotedSort = useRef(defaultList);
  const [takeHome, setTakeHome] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [datesSkipped, setDatesSkipped] = useState(Boolean(initialDates));
  const [notifyState, setNotifyState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!geo.ready) return;
    const ctrl = new AbortController();
    setCategoriesLoading(true);
    void topRentalCategories(
      { country_code: geo.country_code, state: geo.state, limit: 12 },
      { signal: ctrl.signal }
    )
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));
    return () => ctrl.abort();
  }, [geo.ready, geo.country_code, geo.state]);

  useEffect(() => {
    if (!defaultList || promotedSort.current) return;
    promotedSort.current = true;
    setSort('recommended');
  }, [defaultList]);

  useEffect(() => {
    void loadRecentSearches(storage).then(setRecent);
  }, []);

  useEffect(
    () =>
      subscribeRentalSearchStay((next) => {
        setDates(next);
        setDraftDates(next);
        setDatesSkipped(true);
      }),
    []
  );

  const catalog = useDefaultRentalCatalog({
    enabled: defaultList,
    ready: geo.ready,
    active: mode !== 'typing',
    country: geo.country_code,
    state: geo.state,
    query,
    categoryId,
    dates,
    sort,
  });

  useEffect(() => {
    if (defaultList) return;
    if (mode !== 'results' && mode !== 'browse') return;
    if (!geo.ready) return;
    const ctrl = new AbortController();
    setLoading(true);
    void searchRentals(
      {
        q: query.trim() || undefined,
        country_code: geo.country_code,
        state: geo.state,
        category_id: categoryId ?? undefined,
        sort: sort === 'relevance' ? undefined : sort,
        operation_mode: takeHome ? 'take_home' : undefined,
        start_date: dates?.startDate,
        end_date: dates?.endDate,
        limit: 20,
      },
      { signal: ctrl.signal }
    )
      .then((page) => setHits(page.listings ?? []))
      .catch(() => setHits([]))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [defaultList, mode, query, categoryId, sort, takeHome, dates, geo.ready, geo.country_code, geo.state]);

  useEffect(() => {
    if (mode !== 'typing' || query.trim().length < 2 || !geo.ready) {
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void suggestRentals(
        { q: query.trim(), country_code: geo.country_code, state: geo.state },
        { signal: ctrl.signal }
      )
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [mode, query, geo.ready, geo.country_code, geo.state]);

  const openListing = useCallback(
    (listingId: string, range: RentalDateRange | null, openRequest = Boolean(range)) => {
      const parent = navigation.getParent() ?? navigation;
      (parent as { navigate: (name: string, params: object) => void }).navigate('RentalListingDetail', {
        listingId,
        ...(range ? { startDate: range.startDate, endDate: range.endDate } : {}),
        ...(openRequest ? { openRequest: true } : {}),
      });
    },
    [navigation]
  );

  const login = useCallback(() => {
    const parent = navigation.getParent() ?? navigation;
    (parent as unknown as NativeStackNavigationProp<GuestRootStackParamList>).navigate('GuestTabs', {
      screen: 'GuestAuth',
      params: { screen: 'Login' },
    });
  }, [navigation]);

  const commitQuery = useCallback(
    (term: string) => {
      const clean = term.trim();
      if (clean.length >= 2) void rememberSearch(clean, storage).then(setRecent);
      setMode(clean ? 'results' : returnMode === 'typing' ? 'landing' : returnMode);
    },
    [returnMode]
  );

  const onApplyDates = useCallback(() => {
    if (!draftDates || draftDates.dayCount < 1 || draftDates.dayCount > MAX_RENTAL_SEARCH_DAYS) return;
    setDates(draftDates);
    setDateSheetOpen(false);
    setDatesSkipped(true);
    if (pendingRentId) {
      const listingId = pendingRentId;
      setPendingRentId(null);
      openListing(listingId, draftDates);
    }
  }, [draftDates, openListing, pendingRentId]);

  const visibleHits = defaultList ? catalog.hits : hits;
  const cards: RentalSearchCardModel[] = useMemo(
    () => visibleHits.map((hit) => toCard(hit, dates, i18n.language, defaultList)),
    [dates, defaultList, i18n.language, visibleHits]
  );
  const { shown, extra } = splitTopCategories(categories);

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <RentalSearchFirstView
        topInset={applyTopSafeArea ? insets.top : 0}
        timeZone={marketTimeZone(geo.country_code)}
        marketLabel={marketCaption(selectedMarket)}
        mode={mode}
        query={query}
        dates={dates}
        draftDates={draftDates}
        dateSheetOpen={dateSheetOpen}
        categories={shown}
        moreCategories={extra}
        moreOpen={moreOpen}
        suggestions={suggestions}
        recent={recent}
        cards={cards}
        activeCategoryId={categoryId}
        takeHome={takeHome}
        sortLabel={sort}
        datesSkipped={datesSkipped}
        loading={defaultList ? catalog.loading : loading}
        defaultList={defaultList}
        total={catalog.total}
        loadingMore={catalog.loadingMore}
        hasMore={catalog.hasMore}
        categoriesLoading={categoriesLoading}
        notifyState={notifyState}
        nearby={dates ? nearbyRanges(dates) : []}
        similar={categories.filter((row) => row.id !== categoryId).slice(0, 3)}
        bottomInset={tabBarHeight}
        myRentals={myRentals}
        onQueryChange={setQuery}
        onClearQuery={
          defaultList
            ? () => {
                setQuery('');
                setMode('landing');
              }
            : undefined
        }
        onLoadMore={catalog.loadMore}
        onFocusQuery={() => {
          if (mode !== 'typing') setReturnMode(mode);
          setMode('typing');
        }}
        onSubmitQuery={() => commitQuery(query)}
        onBack={() => setMode(mode === 'typing' ? returnMode : 'landing')}
        onOpenDates={() => {
          setDraftDates(dates);
          setDateSheetOpen(true);
        }}
        onSkipDates={() => setDatesSkipped(true)}
        onDraftDates={setDraftDates}
        onApplyDates={onApplyDates}
        onCloseDates={() => {
          setDateSheetOpen(false);
          setPendingRentId(null);
        }}
        onCategory={(id) => {
          setCategoryId(categoryId === id ? null : id);
          if (defaultList) {
            if (mode === 'typing') setMode(query.trim() ? 'results' : 'landing');
            return;
          }
          if (mode === 'landing' || mode === 'typing') setMode('browse');
        }}
        onMore={() => setMoreOpen((open) => !open)}
        onBrowseAll={() => {
          setCategoryId(null);
          setMode('browse');
        }}
        onSuggestion={(row) => {
          if (row.kind === 'category') {
            setCategoryId(row.id);
            setQuery('');
            setMode('browse');
            return;
          }
          setQuery(row.label);
          commitQuery(row.label);
        }}
        onRecent={(term) => {
          setQuery(term);
          commitQuery(term);
        }}
        onRent={(id) => {
          if (searchRentAction(dates, flags.rentals_day_hours_picker_enabled === true) === 'request') {
            // With the day-and-hours picker on, the request screen opens it; the search date sheet is the old range picker.
            openListing(id, dates, true);
            return;
          }
          setPendingRentId(id);
          setDraftDates(null);
          setDateSheetOpen(true);
        }}
        onSeeDates={(id) => {
          const hit = visibleHits.find((row) => row.listing.id === id);
          const next = rangeFromNextStart(hit?.nextAvailableDate ?? '', dates?.dayCount ?? hit?.dayCount ?? 1);
          if (next) setDates(next);
        }}
        onToggleTakeHome={() => setTakeHome((value) => !value)}
        onToggleCheapest={() => setSort((value) => (value === 'cheapest' ? 'relevance' : 'cheapest'))}
        onCycleSort={() =>
          setSort((value) => {
            const order = (defaultList ? LIST_SORTS : LEGACY_SORTS) as readonly SortName[];
            const index = order.indexOf(value);
            return order[(index + 1) % order.length];
          })
        }
        onNearby={setDates}
        onNotify={() => {
          if (!dates) return;
          if (!withAuth || !auth.isAuthenticated) {
            login();
            return;
          }
          setNotifyState('saving');
          void subscribeRentalAvailability({
            q: query.trim() || undefined,
            category_id: categoryId ?? undefined,
            country_code: geo.country_code,
            state: geo.state,
            start_date: dates.startDate,
            end_date: dates.endDate,
          })
            .then(() => setNotifyState('saved'))
            .catch(() => setNotifyState('idle'));
        }}
      />
    </View>
  );
});

function toCard(
  hit: RentalSearchHit,
  range: RentalDateRange | null,
  locale: string,
  catalog: boolean
): RentalSearchCardModel {
  const image = hit.listing?.rental_item?.rental_item_images?.[0];
  const pricePerDay = Number(hit.pricePerDay) || Number(hit.listing.base_price_per_day) || 0;
  const pricePerHour = Number(hit.listing.base_price_per_hour) || 0;
  const hourlyOnly = hit.listing.offers_daily === false;
  const windows = range && !hourlyOnly
    ? allDaySelectionsForRange(range, hit.listing.weekly_availability ?? [], pricePerDay)
    : [];
  const quote = windows.length ? quoteRentalSelections(windows, pricePerHour, pricePerDay) : null;
  return {
    id: hit.listing.id,
    name: hit.listing.rental_item?.name ?? '',
    imageUrl: image?.display_url ?? image?.image_url,
    pricePerDay,
    hourlyOnly,
    pricePerHour,
    currency: hit.listing.rental_item?.currency || 'XAF',
    available: hit.available,
    totalForDates: hourlyOnly ? null : quote == null ? hit.totalForDates : quote,
    totalIsEstimate: dailyTotalDiffersFromQuote(hit.totalForDates, quote),
    dayCount: hit.dayCount,
    nextAvailableDate: hit.nextAvailableDate,
    rangeLabel: range ? formatSearchStayRange(range, locale) : null,
    business: hit.listing.business_location?.name || hit.listing.rental_item?.business?.name || '',
    city: hit.listing.business_location?.address?.city || '',
    inspection: hit.inspection_enabled === true,
    catalog,
  };
}

function marketCaption(market: { name?: string; stateName?: string | null; stateCode?: string | null } | null): string {
  if (!market?.name) return '';
  const state = market.stateName || market.stateCode;
  return state ? `${market.name} \u00b7 ${state}` : market.name;
}
