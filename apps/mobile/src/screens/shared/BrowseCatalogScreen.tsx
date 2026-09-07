import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Chip, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { TabAwareSnackbar } from '../../components/feedback/TabAwareSnackbar';
import { useInventoryCatalog } from '../../hooks/useInventoryCatalog';
import { useInventoryCatalogFacets } from '../../hooks/useInventoryCatalogFacets';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import { useStockAvailabilityChecks } from '../../hooks/useStockAvailabilityChecks';
import { useCatalogFeedComposition } from '../../hooks/useCatalogFeedComposition';
import { useCatalogStopDeals } from '../../hooks/useCatalogStopDeals';
import { useCatalogStopEssentials } from '../../hooks/useCatalogStopEssentials';
import { useCatalogStopFeaturedStore } from '../../hooks/useCatalogStopFeaturedStore';
import { useCatalogStopTopInCategory } from '../../hooks/useCatalogStopTopInCategory';
import { useCatalogStopBagComplements } from '../../hooks/useCatalogStopBagComplements';
import { useStore } from '../../stores/RootStore';
import { useMarket } from '../../hooks/useMarket';
import { MarketSelector } from '../../components/market/MarketSelector';
import { MarketSwitchBanner } from '../../components/market/MarketSwitchBanner';
import type { CatalogInventoryItem, InventorySortMode } from '../../types/inventoryCatalog';
import type { CatalogFilterState } from '../../types/catalogFilter';
import type { Order } from '../../types/agent';
import type { CatalogFeedRow } from '../../hooks/useCatalogFeedComposition';
import { buildCatalogFilterOptions } from '../../utils/catalogFilterOptions';
import { InventoryCatalogCard } from '../../components/browse/InventoryCatalogCard';
import { InventoryCatalogGridTile } from '../../components/browse/InventoryCatalogGridTile';
import { BrowseCatalogListHeader } from '../../components/browse/BrowseCatalogListHeader';
import { CatalogBrowseSearchBar } from '../../components/browse/CatalogBrowseSearchBar';
import { CatalogBrowseFilterSheet } from '../../components/browse/CatalogBrowseFilterSheet';
import { CatalogItemSkeleton } from '../../components/browse/CatalogItemSkeleton';
import { CatalogEmptyIllustration } from '../../components/illustrations/CatalogEmptyIllustration';
import { CatalogFeedStop } from '../../components/browse/CatalogFeedStop';
import { CATALOG_SORT_OPTIONS } from '../../constants/catalogSortOptions';
import { FOOD_CATEGORY_NAME } from '../../utils/foodAvailability';
import { useCatalogOrigin } from '../../hooks/useCatalogOrigin';
import { useHeroCarouselActions } from '../../hooks/useHeroCarouselActions';
import { BrowseFtueNudge } from '../../hooks/useBrowseFtueNudge';

const CatalogCardRow = memo(function CatalogCardRow({
  item,
  buyLabel,
  paddingH,
  inCartQuantity,
  onPrimaryPress,
  onItemPress,
  onAddToCart,
  onStorePress,
  onCheckAvailability,
  availabilityPending,
  availabilitySending,
}: {
  item: CatalogInventoryItem;
  buyLabel: string;
  paddingH: number;
  inCartQuantity: number;
  onPrimaryPress: (
    i: CatalogInventoryItem,
    selectionId?: string | null
  ) => void;
  onItemPress?: (id: string) => void;
  onAddToCart?: (
    i: CatalogInventoryItem,
    selectionId?: string | null
  ) => void;
  onStorePress?: (inventoryItemId: string, businessLocationId: string) => void;
  onCheckAvailability?: (inventoryItemId: string) => void;
  availabilityPending?: boolean;
  availabilitySending?: boolean;
}) {
  const handlePrimary = useCallback(
    (selectionId: string | null) => onPrimaryPress(item, selectionId),
    [item, onPrimaryPress]
  );
  const handleAdd = useCallback(
    (selectionId: string | null) => onAddToCart?.(item, selectionId),
    [item, onAddToCart]
  );
  const handleCheckAvailability = useCallback(() => {
    onCheckAvailability?.(item.id);
  }, [item.id, onCheckAvailability]);
  const handleStorePress = useCallback(
    (businessLocationId: string) => {
      onStorePress?.(item.id, businessLocationId);
    },
    [item.id, onStorePress]
  );
  return (
    <View style={{ paddingHorizontal: paddingH }}>
      <InventoryCatalogCard
        item={item}
        onPrimaryPress={handlePrimary}
        primaryLabel={buyLabel}
        onItemPress={onItemPress}
        onAddToCart={onAddToCart ? handleAdd : undefined}
        inCartQuantity={inCartQuantity}
        onStorePress={onStorePress ? handleStorePress : undefined}
        onCheckAvailability={
          onCheckAvailability ? handleCheckAvailability : undefined
        }
        availabilityPending={availabilityPending}
        availabilitySending={availabilitySending}
      />
    </View>
  );
});

const CatalogGridTile = memo(function CatalogGridTile({
  item,
  onItemPress,
}: {
  item: CatalogInventoryItem;
  onItemPress?: (id: string) => void;
}) {
  const handlePress = useCallback(
    (id: string) => {
      onItemPress?.(id);
    },
    [onItemPress]
  );

  return (
    <InventoryCatalogGridTile
      item={item}
      onPress={handlePress}
    />
  );
});

export interface BrowseCatalogScreenProps {
  onLoginRequired?: () => void;
  onGuestBuyNow?: (
    item: CatalogInventoryItem,
    selectionId?: string | null
  ) => void;
  onClientPlaceOrder?: (
    item: CatalogInventoryItem,
    selectionId?: string | null
  ) => void;
  onAddToCart?: (
    item: CatalogInventoryItem,
    selectionId?: string | null
  ) => void;
  onItemPress?: (inventoryItemId: string) => void;
  onCollectionPress?: (slug: string) => void;
  onStorePress?: (businessLocationId: string) => void;
  onSeeAllStores?: () => void;
  homeOrders?: Order[];
  homeOrdersTotalActive?: number;
  onOpenHomeOrder?: (order: Order) => void;
  onSeeAllHomeOrders?: () => void;
  /** Available delivery agents near the client; hidden when 0. */
  nearbyAgentsCount?: number;
  /** When true, catalog list + facets use authenticated GET /inventory-items (Bearer + persona). */
  inventoryRequestsWithAuth?: boolean;
  /** Optional control rendered beside the sticky search bar (e.g. notification bell). */
  headerTrailing?: React.ReactNode;
  /** Optional control on the market row, right-aligned (e.g. assistant icon). */
  headerMarketTrailing?: React.ReactNode;
  /**
   * When false, skip top safe-area inset (parent already applied it — e.g. client home
   * with Actions needed above the catalog). Defaults to true.
   */
  applyTopSafeArea?: boolean;
  /** Restrict the list to cooked food and use Food-tab copy and filters. */
  foodOnly?: boolean;
}

function BrowseCatalogScreenInner({
  onLoginRequired,
  onGuestBuyNow,
  onClientPlaceOrder,
  onAddToCart,
  onItemPress,
  onCollectionPress,
  onStorePress,
  onSeeAllStores,
  homeOrders,
  homeOrdersTotalActive = 0,
  onOpenHomeOrder,
  onSeeAllHomeOrders,
  nearbyAgentsCount = 0,
  inventoryRequestsWithAuth = false,
  headerTrailing,
  headerMarketTrailing,
  applyTopSafeArea = true,
  foodOnly = false,
}: BrowseCatalogScreenProps) {
  const { t } = useTranslation();
  const { cart, auth } = useStore();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  const tabBarHeight = useBottomTabBarHeight();
  const bottomPad = tabBarHeight + spacing.lg;
  const isWideHero = width >= 640;
  const listRef = useRef<Animated.FlatList<CatalogInventoryItem>>(null);
  const { onHeroSlidePress } = useHeroCarouselActions(() => {
    listRef.current?.scrollToOffset({ offset: 280, animated: true });
  });

  const scrollY = useRef(new Animated.Value(0)).current;

  // Guests default to "Nearest" so results are proximity-ordered.
  // Authenticated users keep "For you" (relevance) as the default.
  const defaultSort: InventorySortMode = inventoryRequestsWithAuth ? 'relevance' : 'fastest';
  const [sort, setSort] = useState<InventorySortMode>(defaultSort);

  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilterState>({
    category: '',
    subcategory: '',
    brand: '',
    business: '',
    collection: '',
  });
  const [snack, setSnack] = useState<string | null>(null);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const {
    requestCheck,
    isPending: isAvailabilityPending,
    isSending: isAvailabilitySending,
    snack: availabilitySnack,
    clearSnack: clearAvailabilitySnack,
  } = useStockAvailabilityChecks({
    isAuthenticated: auth.isAuthenticated,
    onLoginRequired,
  });

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchDraft.trim()), 450);
    return () => clearTimeout(id);
  }, [searchDraft]);

  // Market-store-driven country code: same for guests and authed users.
  // Delivery address is not affected — market only drives catalog browsing.
  const { selectedMarket, hydrated: marketHydrated, pendingPromptCountry } = useMarket();
  const catalogCountryCode = selectedMarket?.countryCode;
  const catalogState = selectedMarket?.stateCode ?? undefined;
  const catalogReady = marketHydrated;

  const { origin: catalogOrigin } = useCatalogOrigin(sort, catalogReady);

  const { facetItems, facetLoading, refetchFacets } = useInventoryCatalogFacets({
    withAuth: inventoryRequestsWithAuth,
    countryCode: catalogCountryCode,
    state: catalogState,
    food_only: foodOnly || undefined,
    enabled: catalogReady,
  });

  const filterOptions = useMemo(
    () =>
      buildCatalogFilterOptions(
        facetItems,
        foodOnly ? FOOD_CATEGORY_NAME : catalogFilters.category
      ),
    [facetItems, catalogFilters.category, foodOnly]
  );

  const stopsEnabled =
    catalogReady && debouncedSearch.length === 0 && !foodOnly;

  const { items, loading, loadingMore, error, loadMore, refetch, total } = useInventoryCatalog({
    search: debouncedSearch,
    sort,
    countryCode: catalogCountryCode,
    state: catalogState,
    origin: catalogOrigin,
    category: catalogFilters.category,
    subcategory: catalogFilters.subcategory,
    brand: catalogFilters.brand,
    business_name: catalogFilters.business,
    collection: catalogFilters.collection,
    food_only: foodOnly || undefined,
    withAuth: inventoryRequestsWithAuth,
    enabled: catalogReady,
  });

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (catalogFilters.category) n += 1;
    if (catalogFilters.subcategory) n += 1;
    if (catalogFilters.brand) n += 1;
    if (catalogFilters.business) n += 1;
    if (catalogFilters.collection) n += 1;
    return n;
  }, [catalogFilters]);

  // Non-category filter count for Top in Category stop
  // (category filter alone shouldn't suppress the category rail)
  const nonCategoryFilterCount = useMemo(() => {
    let n = 0;
    if (catalogFilters.subcategory) n += 1;
    if (catalogFilters.brand) n += 1;
    if (catalogFilters.business) n += 1;
    if (catalogFilters.collection) n += 1;
    return n;
  }, [catalogFilters]);

  // Compose feed items (inventory + mid-feed stops)
  const suppressStops =
    foodOnly ||
    debouncedSearch.length > 0 ||
    activeFilterCount > 0;

  const dealsStopEnabled = stopsEnabled && !suppressStops && sort !== 'deals';
  // Top in category shows on All browse + when category filter active
  // Only suppress for search or non-category filters (brand, business, collection, subcategory)
  const categoryStopEnabled =
    stopsEnabled &&
    !foodOnly &&
    debouncedSearch.length === 0 &&
    nonCategoryFilterCount === 0;
  const essentialsStopEnabled = stopsEnabled && !suppressStops;
  const featuredStoreStopEnabled = stopsEnabled && !suppressStops;
  const bagComplementsStopEnabled = stopsEnabled && !suppressStops && cart.items.length > 0;

  // New dedicated stop hooks using backend /catalog/stops/* endpoints
  const {
    items: dealsStopItems,
    loading: dealsStopLoading,
    refetch: refetchDealsStop,
  } = useCatalogStopDeals({
    countryCode: catalogCountryCode,
    state: catalogState,
    origin: catalogOrigin,
    limit: 4,
    enabled: dealsStopEnabled,
  });

  const {
    items: topInCategoryItems,
    categoryName: topInCategoryName,
    loading: topInCategoryLoading,
    refetch: refetchTopInCategory,
  } = useCatalogStopTopInCategory({
    category: catalogFilters.category,
    subcategory: catalogFilters.subcategory,
    countryCode: catalogCountryCode,
    state: catalogState,
    origin: catalogOrigin,
    limit: 6,
    enabled: categoryStopEnabled,
  });

  const {
    collections: essentialsCollections,
    loading: essentialsLoading,
    refetch: refetchEssentials,
  } = useCatalogStopEssentials({
    countryCode: catalogCountryCode,
    state: catalogState,
    origin: catalogOrigin,
    limit: 8,
    enabled: essentialsStopEnabled,
  });

  const {
    stores: featuredStores,
    loading: featuredStoreLoading,
    refetch: refetchFeaturedStore,
  } = useCatalogStopFeaturedStore({
    countryCode: catalogCountryCode,
    state: catalogState,
    origin: catalogOrigin,
    limit: 8,
    enabled: featuredStoreStopEnabled,
  });

  const {
    items: bagComplementsItems,
    loading: bagComplementsLoading,
    refetch: refetchBagComplements,
  } = useCatalogStopBagComplements({
    cartLines: cart.items,
    enabled: bagComplementsStopEnabled,
  });

  const feedRows = useCatalogFeedComposition({
    inventoryItems: items,
    suppressStops,
    dealsItems: dealsStopItems,
    dealsLoading: dealsStopLoading,
    topInCategoryItems,
    topInCategoryName,
    topInCategoryLoading,
    bagComplementsItems,
    bagComplementsLoading,
    collections: essentialsCollections,
    collectionsLoading: essentialsLoading,
    stores: featuredStores,
    storesLoading: featuredStoreLoading,
  });

  const resultsLabel = useMemo(() => {
    if (foodOnly) {
      if (loading && items.length === 0) {
        return t('foods.results.loading', 'Loading dishes…');
      }
      if (total === 0) return t('foods.results.none', 'No dishes to show');
      return t('foods.results.count', '{{count}} dishes', { count: total });
    }
    if (loading && items.length === 0) return t('public.items.results.loading', 'Loading items…');
    if (total === 0) return t('public.items.results.none', 'No items to show');
    return t('public.items.results.count', '{{count}} items', { count: total });
  }, [foodOnly, loading, items.length, total, t]);

  const sortSummaryLabel = useMemo(() => {
    const opt = CATALOG_SORT_OPTIONS.find((o) => o.key === sort);
    const label = opt ? t(opt.labelKey, opt.labelDefault) : '';
    return `${t('public.items.sortLabel', 'Sort')}: ${label}`;
  }, [sort, t]);



  const collectionFilterOptions = useMemo(
    () => essentialsCollections.map((c) => ({ slug: c.slug, name: c.name })),
    [essentialsCollections]
  );


  const { trackView } = useTrackItemView();

  const onPrimary = useCallback(
    (catalogItem: CatalogInventoryItem, selectionId?: string | null) => {
      trackView(catalogItem.id);
      if (onGuestBuyNow) {
        onGuestBuyNow(catalogItem, selectionId);
        return;
      }
      if (onClientPlaceOrder) {
        onClientPlaceOrder(catalogItem, selectionId);
        return;
      }
      if (onLoginRequired) {
        onLoginRequired();
        return;
      }
      setSnack(t('public.items.purchaseComingSoon', 'Ordering from the catalog in the app is coming soon.'));
    },
    [onClientPlaceOrder, onGuestBuyNow, onLoginRequired, t, trackView]
  );

  const handleAddToCart = useCallback(
    (catalogItem: CatalogInventoryItem, selectionId?: string | null) => {
      if (!onAddToCart) return;
      trackView(catalogItem.id);
      onAddToCart(catalogItem, selectionId);
    },
    [onAddToCart, trackView]
  );

  const handleItemPress = useCallback(
    (inventoryItemId: string) => {
      trackView(inventoryItemId);
      onItemPress?.(inventoryItemId);
    },
    [onItemPress, trackView]
  );

  const handleStorePress = useCallback(
    (inventoryItemId: string, businessLocationId: string) => {
      trackView(inventoryItemId);
      onStorePress?.(businessLocationId);
    },
    [onStorePress, trackView]
  );

  const buyLabel = t('public.items.buyNow', 'Buy');

  const previewItems = useMemo(() => {
    if (loading && !loadingMore) return [];
    return items.slice(0, 6);
  }, [items, loading, loadingMore]);

  const previewLoading = loading && !loadingMore;

  const canLoadMore = !loading && !loadingMore && items.length > 0 && items.length < total;

  const isSearchFetching =
    searchDraft.trim() !== debouncedSearch ||
    (loading && debouncedSearch.length > 0);

  const onListRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      const tasks: Promise<unknown>[] = [refetch(), refetchFacets()];
      if (dealsStopEnabled) tasks.push(refetchDealsStop());
      if (categoryStopEnabled) tasks.push(refetchTopInCategory());
      if (essentialsStopEnabled) tasks.push(refetchEssentials());
      if (featuredStoreStopEnabled) tasks.push(refetchFeaturedStore());
      if (bagComplementsStopEnabled) tasks.push(refetchBagComplements());
      await Promise.all(tasks);
    } finally {
      setPullRefreshing(false);
    }
  }, [
    refetch,
    refetchFacets,
    dealsStopEnabled,
    refetchDealsStop,
    categoryStopEnabled,
    refetchTopInCategory,
    essentialsStopEnabled,
    refetchEssentials,
    featuredStoreStopEnabled,
    refetchFeaturedStore,
    bagComplementsStopEnabled,
    refetchBagComplements,
  ]);

  const onClearFilterField = useCallback((field: keyof CatalogFilterState) => {
    if (field === 'category') {
      setCatalogFilters((prev) => ({ ...prev, category: '', subcategory: '' }));
      return;
    }
    setCatalogFilters((prev) => ({ ...prev, [field]: '' }));
  }, []);

  const onClearAllFilters = useCallback(() => {
    setCatalogFilters({
      category: '',
      subcategory: '',
      brand: '',
      business: '',
      collection: '',
    });
  }, []);

  const onSeeAllDeals = useCallback(() => {
    setSort('deals');
  }, []);

  const listHeaderElement = useMemo(
    () => (
      <>
        {pendingPromptCountry ? (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            <MarketSwitchBanner />
          </View>
        ) : null}
        <BrowseCatalogListHeader
          scrollY={scrollY}
          theme={theme}
          isWideHero={isWideHero}
          resultsLabel={resultsLabel}
          total={total}
          homeOrders={homeOrders}
          homeOrdersTotalActive={homeOrdersTotalActive}
          onOpenHomeOrder={onOpenHomeOrder}
          onSeeAllHomeOrders={onSeeAllHomeOrders}
          nearbyAgentsCount={nearbyAgentsCount}
          onHeroSlidePress={onHeroSlidePress}
          nudgeSlot={foodOnly ? undefined : <BrowseFtueNudge />}
          foodOnly={foodOnly}
          catalogFilters={catalogFilters}
          onClearFilterField={onClearFilterField}
          onClearAllFilters={onClearAllFilters}
          onOpenFilterSheet={() => setFilterSheetVisible(true)}
          activeFilterCount={activeFilterCount}
          sortSummaryLabel={sortSummaryLabel}
          error={error}
          itemsLength={items.length}
          onListRefresh={onListRefresh}
          dealsSpotlightItems={[]}
          dealsSpotlightLoading={false}
          onDealSpotlightItemPress={undefined}
          onSeeAllDeals={undefined}
          featuredCollections={[]}
          collectionsLoading={false}
          onCollectionPress={undefined}
          featuredStores={[]}
          storesLoading={false}
          onStorePress={undefined}
          onSeeAllStores={undefined}
          previewItems={[]}
          previewLoading={false}
          onPreviewItemPress={undefined}
        />
      </>
    ),
    [
      pendingPromptCountry,
      spacing.md,
      spacing.sm,
      scrollY,
      theme,
      isWideHero,
      resultsLabel,
      total,
      homeOrders,
      homeOrdersTotalActive,
      onOpenHomeOrder,
      onSeeAllHomeOrders,
      nearbyAgentsCount,
      onHeroSlidePress,
      catalogFilters,
      onClearFilterField,
      onClearAllFilters,
      activeFilterCount,
      sortSummaryLabel,
      error,
      items.length,
      onListRefresh,
      foodOnly,
    ]
  );

  const renderFeedRow = useCallback(
    ({ item: row }: { item: CatalogFeedRow }) => {
      if (row.type === 'stop') {
        return (
          <View style={{ width: '100%', paddingHorizontal: spacing.md }}>
            <CatalogFeedStop
              stop={row.stop}
              onItemPress={onItemPress ? handleItemPress : undefined}
              onCollectionPress={onCollectionPress}
              onStorePress={onStorePress}
              onSeeAllDeals={onSeeAllDeals}
              onSeeAllStores={onSeeAllStores}
            />
          </View>
        );
      }
      
      // Product pair row (2 columns)
      return (
        <View style={[styles.productRow, { gap: spacing.xs, paddingHorizontal: spacing.md }]}>
          <View style={styles.productColumn}>
            <CatalogGridTile
              item={row.left}
              onItemPress={onItemPress ? handleItemPress : undefined}
            />
          </View>
          {row.right ? (
            <View style={styles.productColumn}>
              <CatalogGridTile
                item={row.right}
                onItemPress={onItemPress ? handleItemPress : undefined}
              />
            </View>
          ) : (
            <View style={styles.productColumn} />
          )}
        </View>
      );
    },
    [
      spacing.md,
      spacing.xs,
      onItemPress,
      handleItemPress,
      onCollectionPress,
      onStorePress,
      onSeeAllDeals,
      onSeeAllStores,
    ]
  );

  const keyExtractorRow = useCallback((row: CatalogFeedRow, index: number) => {
    if (row.type === 'stop') {
      return row.stop.id;
    }
    return row.id;
  }, []);

  const listEmpty = useMemo(() => {
    if (loading && items.length === 0) {
      return <CatalogItemSkeleton count={6} />;
    }
    if (error) return null;
    const hasFilters = activeFilterCount > 0 || debouncedSearch.length > 0;
    return (
      <View style={styles.centerPad}>
        <CatalogEmptyIllustration />
        <Text style={[typography.subtitle2, { color: colors.text.primary, textAlign: 'center', marginTop: spacing.md }]}>
          {foodOnly
            ? hasFilters
              ? t('foods.empty.noMatches', 'No dishes match your search')
              : t('foods.empty.noDishes', 'No restaurants near you yet')
            : t('public.items.emptyTitle', 'No items found')}
        </Text>
        <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs }]}>
          {foodOnly
            ? hasFilters
              ? t('foods.empty.tryAgain', 'Try another dish name or clear the filters.')
              : t('foods.empty.checkBack', 'Check back soon as restaurants join the platform.')
            : t('public.items.empty', 'No listings match your search.')}
        </Text>
        {hasFilters && !foodOnly ? (
          <Text style={[typography.caption, { color: colors.text.disabled, marginTop: spacing.sm, textAlign: 'center' }]}>
            {t('public.items.emptyHint', 'Try clearing filters or adjusting your search.')}
          </Text>
        ) : null}
        {activeFilterCount > 0 ? (
          <Chip icon="filter-off" style={{ marginTop: spacing.md }} onPress={onClearAllFilters}>
            {t('public.items.emptyClearFilters', 'Clear all filters')}
          </Chip>
        ) : null}
      </View>
    );
  }, [
    activeFilterCount,
    colors.text.disabled,
    colors.text.secondary,
    debouncedSearch.length,
    error,
    foodOnly,
    loading,
    items.length,
    onClearAllFilters,
    spacing.md,
    spacing.sm,
    t,
    typography.body2,
    typography.caption,
  ]);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.pageBackground }]}
      edges={applyTopSafeArea ? ['top'] : []}
    >
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
        <View style={styles.searchRow}>
          <View style={styles.searchFlex}>
            <CatalogBrowseSearchBar
              theme={theme}
              value={searchDraft}
              onChangeText={setSearchDraft}
              loading={isSearchFetching}
              placeholder={
                foodOnly
                  ? t('foods.searchPlaceholder', 'Search dishes')
                  : undefined
              }
            />
          </View>
          {headerTrailing}
        </View>
        <View style={styles.marketRow}>
          <View style={styles.marketSelectorWrap}>
            <MarketSelector />
          </View>
          {headerMarketTrailing}
        </View>
      </View>
      <Animated.FlatList<CatalogFeedRow>
        ref={listRef}
        data={feedRows}
        keyExtractor={keyExtractorRow}
        ListHeaderComponent={listHeaderElement}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={renderFeedRow}
        refreshControl={
          <RefreshControl
            refreshing={pullRefreshing}
            onRefresh={onListRefresh}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
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
          items.length === 0 ? { flexGrow: 1 } : null,
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
      />
      <CatalogBrowseFilterSheet
        visible={filterSheetVisible}
        onDismiss={() => setFilterSheetVisible(false)}
        sort={sort}
        onSortChange={setSort}
        values={catalogFilters}
        onChange={setCatalogFilters}
        categories={filterOptions.categories}
        subcategories={filterOptions.subcategories}
        brands={filterOptions.brands}
        businesses={filterOptions.businesses}
        collectionOptions={collectionFilterOptions}
        disabled={facetLoading && facetItems.length === 0}
        foodOnly={foodOnly}
      />
      <TabAwareSnackbar
        visible={!!(availabilitySnack ?? snack)}
        onDismiss={() => {
          clearAvailabilitySnack();
          setSnack(null);
        }}
        duration={4000}
      >
        {availabilitySnack ?? snack}
      </TabAwareSnackbar>
    </SafeAreaView>
  );
}

export const BrowseCatalogScreen = observer(BrowseCatalogScreenInner);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchSticky: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchFlex: {
    flex: 1,
    minWidth: 0,
  },
  marketRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  marketSelectorWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  centerPad: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 },
  footer: { paddingVertical: 16, alignItems: 'center' },
  productRow: {
    flexDirection: 'row',
    width: '100%',
  },
  productColumn: {
    flex: 1,
  },
});
