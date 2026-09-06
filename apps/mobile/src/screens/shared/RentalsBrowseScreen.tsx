import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Button, IconButton, Menu, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchInput } from '../../components/common/SearchInput';
import { CatalogItemSkeleton } from '../../components/browse/CatalogItemSkeleton';
import { MarketSelector } from '../../components/market/MarketSelector';
import { MarketSwitchBanner } from '../../components/market/MarketSwitchBanner';
import { RentalListingCard } from '../../components/rentals/RentalListingCard';
import { RentalLocationsStrip } from '../../components/rentals/RentalLocationsStrip';
import { RentalsHowItWorksStrip } from '../../components/rentals/RentalsHowItWorksStrip';
import { RentalOperationModeInfoSheet } from '../../components/rentals/RentalOperationModeInfoSheet';
import { RentalsEmptyIllustration } from '../../components/illustrations/RentalsEmptyIllustration';
import { useTheme } from '../../contexts/ThemeContext';
import { useMarket } from '../../hooks/useMarket';
import { useRentalCategories } from '../../hooks/useRentalCategories';
import { useRentalListings } from '../../hooks/useRentalListings';
import { useRentalOrigin } from '../../hooks/useRentalOrigin';
import { useRentalTopLocations } from '../../hooks/useRentalTopLocations';
import type { RentalListingRow, RentalListingsSortMode, RentalOperationMode } from '../../types/rentals';

const SORT_OPTIONS: Array<{ key: RentalListingsSortMode; labelKey: string; labelDefault: string }> = [
  { key: 'relevance', labelKey: 'rentals.catalog.sortRelevance', labelDefault: 'Relevance' },
  { key: 'newest', labelKey: 'rentals.catalog.sortNewest', labelDefault: 'Recently updated' },
  { key: 'fastest', labelKey: 'rentals.catalog.sortFastest', labelDefault: 'Closest to you' },
  { key: 'cheapest', labelKey: 'rentals.catalog.sortCheapest', labelDefault: 'Lowest price / day' },
  { key: 'expensive', labelKey: 'rentals.catalog.sortExpensive', labelDefault: 'Highest price / day' },
];

export interface RentalsBrowseScreenProps {
  withAuth?: boolean;
  onOpenListing: (listingId: string) => void;
  headerExtra?: ReactNode;
}

export function RentalsBrowseScreen({
  withAuth: _withAuth,
  onOpenListing,
  headerExtra,
}: RentalsBrowseScreenProps) {
  void _withAuth;
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const bottomPad = tabBarHeight + spacing.lg;

  const [sort, setSort] = useState<RentalListingsSortMode>('relevance');
  const [categoryId, setCategoryId] = useState('');
  const [operationMode, setOperationMode] = useState<RentalOperationMode | ''>('');
  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [modeInfoOpen, setModeInfoOpen] = useState(false);
  const [locationFilterId, setLocationFilterId] = useState('');
  const prevMarketIdRef = useRef<string | null>(null);

  const { selectedMarket, hydrated: marketHydrated } = useMarket();
  const catalogReady = marketHydrated;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchDraft.trim()), 450);
    return () => clearTimeout(id);
  }, [searchDraft]);

  useEffect(() => {
    const marketId = selectedMarket?.id ?? null;
    if (prevMarketIdRef.current && prevMarketIdRef.current !== marketId) {
      setLocationFilterId('');
    }
    prevMarketIdRef.current = marketId;
  }, [selectedMarket?.id]);

  const showLocationsStrip =
    catalogReady &&
    debouncedSearch.length === 0 &&
    !categoryId &&
    !operationMode;

  const wantsOrigin = sort === 'fastest' || showLocationsStrip;
  const { origin, needsOrigin } = useRentalOrigin(wantsOrigin, catalogReady);
  const showLocationHint = sort === 'fastest' && needsOrigin && !origin;

  const { categories, refetch: refetchCategories } = useRentalCategories();
  const { listings, loading, loadingMore, error, total, loadMore, refetch } = useRentalListings({
    sort,
    q: debouncedSearch,
    category_id: categoryId || undefined,
    operation_mode: operationMode || undefined,
    origin,
    business_location_id: locationFilterId || undefined,
    enabled: catalogReady,
  });

  const { locations: topLocations, loading: topLocationsLoading, refetch: refetchTopLocations } =
    useRentalTopLocations({
      enabled: showLocationsStrip,
      origin,
    });

  const sortLabel = useMemo(() => {
    const opt = SORT_OPTIONS.find((o) => o.key === sort);
    return opt ? t(opt.labelKey, opt.labelDefault) : '';
  }, [sort, t]);

  const marketLabel = useMemo(() => {
    if (!selectedMarket) return '';
    const statePart = selectedMarket.stateCode
      ? selectedMarket.stateName ?? selectedMarket.stateCode
      : t('market.selector.allStates', 'All');
    return `${selectedMarket.name} · ${statePart}`;
  }, [selectedMarket, t]);

  const onListRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([refetch(), refetchCategories(), refetchTopLocations()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [refetch, refetchCategories, refetchTopLocations]);

  const canLoadMore = !loading && !loadingMore && listings.length > 0 && listings.length < total;

  const renderItem = useCallback(
    ({ item }: { item: RentalListingRow }) => (
      <View style={{ paddingHorizontal: spacing.md }}>
        <RentalListingCard listing={item} onPress={onOpenListing} />
      </View>
    ),
    [onOpenListing, spacing.md]
  );

  const listHeader = useMemo(
    () => (
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Text variant="headlineSmall" style={[typography.h5, { color: colors.text.primary }]}>
          {t('rentals.catalog.heroEyebrow', 'Rentals')}
        </Text>
        <Text style={[typography.body2, { color: colors.text.secondary, marginTop: 4 }]}>
          {selectedMarket
            ? t('rentals.catalog.subtitleMarket', 'Showing rentals in {{market}}', {
                market: marketLabel,
              })
            : t(
                'rentals.catalog.subtitle',
                'Browse verified business-operated rentals in your region.'
              )}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <MarketSelector catalogContext="rentals" />
        </View>
        <MarketSwitchBanner />
        {headerExtra ? <View style={{ marginTop: spacing.sm }}>{headerExtra}</View> : null}

        <RentalsHowItWorksStrip />

        {showLocationsStrip ? (
          <RentalLocationsStrip
            locations={topLocations}
            loading={topLocationsLoading}
            selectedLocationId={locationFilterId || undefined}
            onSelectLocation={(id) =>
              setLocationFilterId((prev) => (prev === id ? '' : id))
            }
          />
        ) : null}

        {showLocationHint ? (
          <Text
            style={[
              typography.caption,
              { color: colors.warning.dark, marginTop: spacing.xs },
            ]}
          >
            {t(
              'rentals.catalog.locationHint',
              'Enable location access to sort rentals closest to you.'
            )}
          </Text>
        ) : null}

        <View style={[styles.toolbar, { marginTop: spacing.md, gap: spacing.sm }]}>
          <Menu
            visible={sortMenuOpen}
            onDismiss={() => setSortMenuOpen(false)}
            anchor={
              <Button
                mode="outlined"
                icon="sort"
                onPress={() => setSortMenuOpen(true)}
                compact
                style={{ borderColor: colors.divider }}
              >
                {t('rentals.catalog.filterSort', 'Sort by')}: {sortLabel}
              </Button>
            }
          >
            {SORT_OPTIONS.map((opt) => (
              <Menu.Item
                key={opt.key}
                onPress={() => {
                  setSort(opt.key);
                  setSortMenuOpen(false);
                }}
                title={t(opt.labelKey, opt.labelDefault)}
              />
            ))}
          </Menu>
          <Text style={[typography.caption, { color: colors.text.secondary }]}>
            {loading && listings.length === 0
              ? t('rentals.loading', 'Loading rentals')
              : t('rentals.catalog.results', '{{count}} listings', { count: total })}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chips, { paddingVertical: spacing.sm, gap: spacing.xs }]}
        >
          <Pressable
            onPress={() => setCategoryId('')}
            style={[
              styles.chip,
              {
                borderRadius: borderRadius.full ?? 999,
                backgroundColor: !categoryId ? colors.primary.main : colors.surface,
                borderColor: colors.divider,
              },
            ]}
          >
            <Text
              style={{
                color: !categoryId ? colors.primary.contrast : colors.text.secondary,
                fontWeight: '600',
                fontSize: 13,
              }}
            >
              {t('rentals.catalog.all', 'All')}
            </Text>
          </Pressable>
          {categories.map((c) => {
            const selected = categoryId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCategoryId(selected ? '' : c.id)}
                style={[
                  styles.chip,
                  {
                    borderRadius: borderRadius.full ?? 999,
                    backgroundColor: selected ? colors.primary.main : colors.surface,
                    borderColor: colors.divider,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? colors.primary.contrast : colors.text.secondary,
                    fontWeight: '600',
                    fontSize: 13,
                  }}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.modeRow, { marginTop: spacing.xs }]}>
          <Text style={[typography.caption, { color: colors.text.secondary, flex: 1 }]}>
            {t('rentals.catalog.filterMode', 'Mode')}
          </Text>
          <IconButton
            icon="help-circle-outline"
            size={20}
            onPress={() => setModeInfoOpen(true)}
            accessibilityLabel={t('rentals.catalog.modeInfo.title', 'Rental modes')}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chips, { paddingBottom: spacing.sm, gap: spacing.xs }]}
        >
          {(
            [
              { id: '' as const, label: t('rentals.catalog.modeAll', 'All modes') },
              {
                id: 'business_operated' as const,
                label: t('rentals.catalog.modeOperated', 'Operated'),
              },
              {
                id: 'take_home' as const,
                label: t('rentals.catalog.modeTakeHome', 'Take-home'),
              },
            ] as const
          ).map((opt) => {
            const selected = operationMode === opt.id;
            return (
              <Pressable
                key={opt.id || 'all-modes'}
                onPress={() => setOperationMode(opt.id)}
                style={[
                  styles.chip,
                  {
                    borderRadius: borderRadius.full ?? 999,
                    backgroundColor: selected ? colors.info.main : colors.surface,
                    borderColor: colors.divider,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? '#fff' : colors.text.secondary,
                    fontWeight: '600',
                    fontSize: 13,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <View
            style={[
              styles.errorBanner,
              {
                borderColor: colors.error.main,
                backgroundColor: colors.surface,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <Text style={{ color: colors.error.main, flex: 1 }}>
              {t('client.rentals.loadError', 'Could not load rentals.')}
            </Text>
            <Button mode="text" onPress={() => void refetch()} compact>
              {t('common.retry', 'Retry')}
            </Button>
          </View>
        ) : null}
      </View>
    ),
    [
      borderRadius.full,
      categories,
      categoryId,
      colors,
      error,
      headerExtra,
      listings.length,
      loading,
      locationFilterId,
      marketLabel,
      operationMode,
      refetch,
      selectedMarket,
      showLocationHint,
      showLocationsStrip,
      sortLabel,
      sortMenuOpen,
      spacing,
      t,
      topLocations,
      topLocationsLoading,
      total,
      typography,
    ]
  );

  const listEmpty = useMemo(() => {
    if (loading && listings.length === 0) {
      return <CatalogItemSkeleton count={4} />;
    }
    if (error) return null;
    return (
      <View style={styles.centerPad}>
        <RentalsEmptyIllustration />
        <Text style={[typography.subtitle2, { color: colors.text.primary, textAlign: 'center', marginTop: spacing.md }]}>
          {t('rentals.catalog.emptyTitle', 'No rentals here yet')}
        </Text>
        <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs }]}>
          {t('rentals.catalog.noResults', 'No listings match your filters')}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.text.disabled, marginTop: spacing.sm, textAlign: 'center' },
          ]}
        >
          {t(
            'rentals.catalog.noResultsHint',
            'Try different keywords or clear filters to see all rentals.'
          )}
        </Text>
        {categoryId || debouncedSearch || operationMode || locationFilterId ? (
          <Button
            mode="outlined"
            style={{ marginTop: spacing.md }}
            onPress={() => {
              setCategoryId('');
              setSearchDraft('');
              setDebouncedSearch('');
              setOperationMode('');
              setLocationFilterId('');
            }}
          >
            {t('rentals.catalog.clearFilters', 'Clear filters')}
          </Button>
        ) : null}
      </View>
    );
  }, [
    categoryId,
    colors,
    debouncedSearch,
    error,
    listings.length,
    loading,
    locationFilterId,
    operationMode,
    spacing,
    t,
    typography,
  ]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]} edges={['top']}>
      <View
        style={[
          styles.searchSticky,
          {
            paddingHorizontal: spacing.md,
            paddingTop: spacing.xs,
            paddingBottom: spacing.sm,
            backgroundColor: colors.pageBackground,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        <SearchInput
          value={searchDraft}
          onChangeText={setSearchDraft}
          placeholder={t('rentals.catalog.searchPlaceholder', 'Search by name, business, location, or tags…')}
        />
      </View>
      <FlatList
        data={listings}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={listHeader}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={() => void onListRefresh()}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
        onEndReached={() => {
          if (canLoadMore) loadMore();
        }}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={
          <View style={[styles.footer, { paddingBottom: bottomPad }]}>
            {loadingMore ? <ActivityIndicator color={colors.primary.main} /> : null}
          </View>
        }
        contentContainerStyle={[
          { paddingBottom: spacing.md },
          listings.length === 0 ? { flexGrow: 1 } : null,
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />
      <RentalOperationModeInfoSheet visible={modeInfoOpen} onDismiss={() => setModeInfoOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchSticky: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  chips: { flexDirection: 'row', alignItems: 'center' },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  centerPad: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 },
  footer: { paddingVertical: 16, alignItems: 'center' },
});
