import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { CatalogCategoryRail } from '../../components/browse/CatalogCategoryRail';
import { useCatalogCategoryRail } from '../../hooks/useCatalogCategoryRail';
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
import type {
  CatalogInventoryItem,
  DiscoveryRecovery,
  DiscoverySortMode,
  InventorySortMode,
  RecoveryFilterName,
} from '../../types/inventoryCatalog';
import type { CatalogFilterState } from '../../types/catalogFilter';
import type { Order } from '../../types/agent';
import type { CatalogFeedRow } from '../../hooks/useCatalogFeedComposition';
import { buildCatalogFilterOptions } from '../../utils/catalogFilterOptions';
import { InventoryCatalogCard } from '../../components/browse/InventoryCatalogCard';
import { InventoryCatalogGridTile } from '../../components/browse/InventoryCatalogGridTile';
import { BrowseCatalogListHeader } from '../../components/browse/BrowseCatalogListHeader';
import {
  FoodsRestaurantCarousel,
  FoodsRestaurantList,
} from '../../components/browse/FoodsRestaurantList';
import { CatalogBrowseSearchBar } from '../../components/browse/CatalogBrowseSearchBar';
import { CatalogBrowseFilterSheet } from '../../components/browse/CatalogBrowseFilterSheet';
import { CatalogItemSkeleton } from '../../components/browse/CatalogItemSkeleton';
import { DiscoverySortSheet } from '../../components/browse/DiscoverySortSheet';
import { DiscoveryRecoveryLadder } from '../../components/browse/DiscoveryRecoveryLadder';
import { DashboardComposingOverlay } from '../../components/feedback/DashboardComposingOverlay';
import { useDashboardComposingSession } from '../../hooks/useDashboardComposingSession';
import { CatalogEmptyIllustration } from '../../components/illustrations/CatalogEmptyIllustration';
import { CatalogFeedStop } from '../../components/browse/CatalogFeedStop';
import { CATALOG_SORT_OPTIONS } from '../../constants/catalogSortOptions';
import { FOOD_CATEGORY_NAME } from '../../utils/foodAvailability';
import { useCatalogOrigin } from '../../hooks/useCatalogOrigin';
import { useCatalogStores } from '../../hooks/useCatalogStores';
import { useHeroCarouselActions } from '../../hooks/useHeroCarouselActions';
import { BrowseFtueNudge } from '../../hooks/useBrowseFtueNudge';
import { useReportTabBarScroll } from '../../navigation/floatingTabBarVisibility';

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
  onStorePress?: (
    businessLocationId: string,
    options?: { foodOnly?: boolean }
  ) => void;
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
  /** Initial merged-catalog segment, including alias-route navigation. */
  initialSegment?: 'all' | 'food';
  /** Opens the full category browser from the carousel More card. */
  onBrowseCategories?: () => void;
  /** Category chosen on the categories screen. */
  requestedCategory?: string;
  categoryRequestId?: number;
  /** Extra discovery content above the product grid (rails, buy again). */
  discoveryExtra?: React.ReactNode;
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
  foodOnly: legacyFoodOnly = false,
  initialSegment = 'all',
  onBrowseCategories,
  requestedCategory,
  categoryRequestId,
  discoveryExtra,
}: BrowseCatalogScreenProps) {
  const { t, i18n } = useTranslation();
  const { flags } = useClientFlags();
  const { cart, auth, persona } = useStore();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const { colors, typography, spacing } = theme;
  const { onScroll: reportTabBarScroll } = useReportTabBarScroll();
  const [catalogSegment, setCatalogSegment] = useState<'all' | 'food'>(
    legacyFoodOnly ? 'food' : initialSegment
  );
  useEffect(() => {
    setCatalogSegment(legacyFoodOnly ? 'food' : initialSegment);
  }, [initialSegment, legacyFoodOnly]);
  const foodOnly = legacyFoodOnly || catalogSegment === 'food';
  const [browsingAllRestaurants, setBrowsingAllRestaurants] = useState(false);
  const showAllRestaurants = foodOnly && browsingAllRestaurants;
  const tabBarHeight = useBottomTabBarHeight();
  const bottomPad = tabBarHeight + spacing.lg;
  const isWideHero = width >= 640;
  const listRef = useRef<FlashListRef<CatalogFeedRow>>(null);
  const headerScroll = useSharedValue(0);
  const { onHeroSlidePress } = useHeroCarouselActions(() => {
    listRef.current?.scrollToOffset({ offset: 280, animated: true });
  });

  const scrollY = useRef(new Animated.Value(0)).current;
  const onFeedScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollY.setValue(y);
      headerScroll.value = y;
      reportTabBarScroll(event);
    },
    [headerScroll, reportTabBarScroll, scrollY]
  );
  const stickyHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(headerScroll.value, [0, 48], [1, 0], Extrapolation.CLAMP),
    maxHeight: interpolate(headerScroll.value, [0, 72], [140, 0], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));

  // Discovery sort state (flag on: recommended/popular/rating/newest; flag off: legacy)
  const [sort, setSort] = useState<InventorySortMode | DiscoverySortMode>(() => {
    if (flags.discovery_sort_v1) {
      return debouncedSearch.length > 0 ? 'relevance' : 'recommended';
    }
    return inventoryRequestsWithAuth ? 'relevance' : 'fastest';
  });
  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  const [lastSearchText, setLastSearchText] = useState('');
  const [recovery, setRecovery] = useState<DiscoveryRecovery | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  
  // Reset sort to default when search text changes (flag on only)
  useEffect(() => {
    if (!flags.discovery_sort_v1) return;
    const currentSearch = debouncedSearch.trim();
    if (currentSearch !== lastSearchText) {
      setLastSearchText(currentSearch);
      if (currentSearch.length === 0) {
        // Browse: default to Recommended
        setSort('recommended');
      } else if (lastSearchText.length === 0) {
        // New search: reset to Best match
        setSort('relevance');
      }
      // Otherwise keep the current sort when refining the search
    }
  }, [debouncedSearch, flags.discovery_sort_v1, lastSearchText]);
  
  // Fetch recovery suggestions when empty results (flag on, total === 0, include_unavailable=true sent)
  useEffect(() => {
    if (!flags.discovery_sort_v1 || total !== 0 || loading) {
      setRecovery(null);
      return;
    }
    if (debouncedSearch.length === 0 && activeFilterCount === 0) {
      // Empty browse with no filters: no recovery needed
      setRecovery(null);
      return;
    }
    const controller = new AbortController();
    setRecoveryLoading(true);
    void fetchSearchRecovery(
      {
        search: debouncedSearch || undefined,
        category: catalogFilters.category || undefined,
        subcategory: catalogFilters.subcategory || undefined,
        brand: catalogFilters.brand || undefined,
        business_name: catalogFilters.business || undefined,
        collection: catalogFilters.collection || undefined,
        country_code: catalogCountryCode,
        state: catalogState,
        food_only: foodOnly || undefined,
      },
      { signal: controller.signal }
    )
      .then((envelope) => {
        if (controller.signal.aborted) return;
        if (envelope.success && envelope.data.enabled) {
          setRecovery(envelope.data);
        } else {
          setRecovery(null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setRecovery(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecoveryLoading(false);
      });
    return () => controller.abort();
  }, [
    flags.discovery_sort_v1,
    total,
    loading,
    debouncedSearch,
    activeFilterCount,
    catalogFilters.category,
    catalogFilters.subcategory,
    catalogFilters.brand,
    catalogFilters.business,
    catalogFilters.collection,
    catalogCountryCode,
    catalogState,
    foodOnly,
  ]);

  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilterState>({
    category: '',
    subcategory: '',
    brand: '',
    business: '',
    collection: '',
  });
  const [exportOnly, setExportOnly] = useState(false);
  useEffect(() => {
    if (!requestedCategory || !categoryRequestId) return;
    setCatalogFilters((prev) => ({
      ...prev,
      category: requestedCategory,
      subcategory: '',
    }));
  }, [requestedCategory, categoryRequestId]);
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

  const { origin: catalogOrigin } = useCatalogOrigin(catalogReady);

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

  const {
    items,
    loading,
    loadingMore,
    error,
    loadMore,
    refetch,
    total,
    effectiveSort,
    sortControl,
  } = useInventoryCatalog({
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
    export_only: exportOnly || undefined,
    withAuth: inventoryRequestsWithAuth,
    enabled: catalogReady && !showAllRestaurants,
    includeUnavailable: flags.discovery_sort_v1,
  });

  const {
    stores: restaurantPreview,
    loading: restaurantPreviewLoading,
    refetch: refetchRestaurantPreview,
  } = useCatalogStores({
    limit: 12,
    countryCode: catalogCountryCode,
    state: catalogState,
    origin: catalogOrigin,
    withAuth: inventoryRequestsWithAuth,
    enabled: catalogReady && foodOnly && !showAllRestaurants,
    foodOnly: true,
  });

  const {
    stores: restaurants,
    loading: restaurantsLoading,
    error: restaurantsError,
    refetch: refetchRestaurants,
  } = useCatalogStores({
    limit: 50,
    search: debouncedSearch,
    countryCode: catalogCountryCode,
    state: catalogState,
    origin: catalogOrigin,
    withAuth: inventoryRequestsWithAuth,
    enabled: catalogReady && showAllRestaurants,
    foodOnly: true,
  });

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (catalogFilters.category) n += 1;
    if (catalogFilters.subcategory) n += 1;
    if (catalogFilters.brand) n += 1;
    if (catalogFilters.business) n += 1;
    if (catalogFilters.collection) n += 1;
    if (exportOnly) n += 1;
    return n;
  }, [catalogFilters, exportOnly]);

  const isClientHome =
    auth.isAuthenticated && persona.activePersona === 'client' && !foodOnly;
  const firstCatalogLoading =
    isClientHome &&
    loading &&
    items.length === 0 &&
    activeFilterCount === 0 &&
    debouncedSearch.length === 0;
  const { showComposing } = useDashboardComposingSession(
    isClientHome ? 'client' : null,
    firstCatalogLoading
  );

  // Non-category filter count for Top in Category stop
  // (category filter alone shouldn't suppress the category rail)
  const nonCategoryFilterCount = useMemo(() => {
    let n = 0;
    if (catalogFilters.subcategory) n += 1;
    if (catalogFilters.brand) n += 1;
    if (catalogFilters.business) n += 1;
    if (catalogFilters.collection) n += 1;
    if (exportOnly) n += 1;
    return n;
  }, [catalogFilters, exportOnly]);

  // Compose feed items (inventory + mid-feed stops)
  const suppressStops =
    foodOnly ||
    debouncedSearch.length > 0 ||
    activeFilterCount > 0;

  const categoryRail = useCatalogCategoryRail({
    enabled: flags.catalog_experience_v1 && !suppressStops && catalogReady,
    countryCode: catalogCountryCode,
    state: catalogState,
    language: i18n.language,
  });

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

  const {
    items: exportStopItems,
    loading: exportStopLoading,
  } = useInventoryCatalog({
    search: '',
    sort: 'relevance',
    countryCode: catalogCountryCode,
    state: catalogState,
    origin: catalogOrigin,
    export_only: true,
    withAuth: inventoryRequestsWithAuth,
    enabled: stopsEnabled && !suppressStops && !foodOnly,
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
    exportItems: exportStopItems,
    exportLoading: exportStopLoading,
  });

  const resultsLabel = useMemo(() => {
    if (showAllRestaurants) {
      if (restaurantsLoading && restaurants.length === 0) {
        return t('foods.restaurants.loading', 'Loading restaurants…');
      }
      if (restaurants.length === 0) {
        return t('foods.restaurants.none', 'No restaurants to show');
      }
      return t('foods.restaurants.count', '{{count}} restaurants', {
        count: restaurants.length,
      });
    }
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
  }, [foodOnly, showAllRestaurants, restaurantsLoading, restaurants.length, loading, items.length, total, t]);

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
    ((showAllRestaurants ? restaurantsLoading : loading) && debouncedSearch.length > 0);

  const onListRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      const tasks: Promise<unknown>[] = [refetch(), refetchFacets()];
      if (showAllRestaurants) tasks.push(refetchRestaurants());
      else if (foodOnly) tasks.push(refetchRestaurantPreview());
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
    showAllRestaurants,
    foodOnly,
    refetchRestaurants,
    refetchRestaurantPreview,
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
    setExportOnly(false);
  }, []);

  const onToggleExportOnly = useCallback(() => {
    setExportOnly((prev) => !prev);
  }, []);

  const onClearExportOnly = useCallback(() => {
    setExportOnly(false);
  }, []);

  const onSeeAllExports = useCallback(() => {
    setExportOnly(true);
  }, []);

  const onSeeAllDeals = useCallback(() => {
    setSort('deals');
  }, []);
  
  // Discovery sort handlers
  const handleOpenSortSheet = useCallback(() => {
    if (!flags.discovery_sort_v1) {
      setFilterSheetVisible(true);
      return;
    }
    if (sortControl === 'enabled') {
      setSortSheetVisible(true);
    }
  }, [flags.discovery_sort_v1, sortControl]);
  
  const handleSelectSort = useCallback(
    (newSort: DiscoverySortMode) => {
      if (effectiveSort) {
        // Track analytics: sort changed
      }
      setSort(newSort);
    },
    [effectiveSort]
  );
  
  // Recovery ladder handlers
  const handleSearchCorrected = useCallback(
    (query: string) => {
      setSearchDraft(query);
      setDebouncedSearch(query);
    },
    []
  );
  
  const handleSearchOriginal = useCallback(
    (query: string) => {
      setSearchDraft(query);
      setDebouncedSearch(query);
    },
    []
  );
  
  const handleRemoveFilter = useCallback((filter: RecoveryFilterName) => {
    setCatalogFilters((prev) => {
      const next = { ...prev };
      if (filter === 'category') {
        next.category = '';
        next.subcategory = '';
      } else if (filter === 'subcategory') {
        next.subcategory = '';
      } else if (filter === 'brand') {
        next.brand = '';
      } else if (filter === 'business_name') {
        next.business = '';
      } else if (filter === 'location_name') {
        // location_name not in catalogFilters
      }
      return next;
    });
    if (filter === 'collection') {
      setCatalogFilters((prev) => ({ ...prev, collection: '' }));
    }
  }, []);
  
  const handleBrowseCategory = useCallback((categoryName: string) => {
    setCatalogFilters((prev) => ({ ...prev, category: categoryName, subcategory: '' }));
    setSearchDraft('');
    setDebouncedSearch('');
  }, []);

  const showExportsChip =
    !foodOnly &&
    (exportOnly || exportStopLoading || exportStopItems.length > 0);

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
          discoverySlot={
            categoryRail.items.length > 0 ? (
              <CatalogCategoryRail
                theme={theme}
                title={categoryRail.title}
                items={categoryRail.items}
                onSelect={(name) =>
                  setCatalogFilters((prev) => ({
                    ...prev,
                    category: prev.category === name ? '' : name,
                    subcategory: '',
                  }))
                }
                onMore={onBrowseCategories}
              />
            ) : undefined
          }
          foodOnly={foodOnly}
          restaurantsCarousel={
            foodOnly && !showAllRestaurants ? (
              <FoodsRestaurantCarousel
                stores={restaurantPreview}
                loading={restaurantPreviewLoading}
                onPress={(businessLocationId) =>
                  onStorePress?.(businessLocationId, { foodOnly: true })
                }
                onMore={() => {
                  setSearchDraft('');
                  setDebouncedSearch('');
                  setBrowsingAllRestaurants(true);
                }}
              />
            ) : null
          }
          showDishTools={!showAllRestaurants}
          restaurantsSlot={
            showAllRestaurants ? (
              <View>
                <Chip
                  icon="arrow-left"
                  mode="outlined"
                  onPress={() => {
                    setSearchDraft('');
                    setDebouncedSearch('');
                    setBrowsingAllRestaurants(false);
                  }}
                  style={{ alignSelf: 'flex-start', marginBottom: spacing.sm }}
                >
                  {t('foods.restaurants.backToDishes', 'Back to dishes')}
                </Chip>
                <FoodsRestaurantList
                  stores={restaurants}
                  loading={restaurantsLoading}
                  error={restaurantsError}
                  hasSearch={debouncedSearch.length > 0}
                  onPress={(businessLocationId) =>
                    onStorePress?.(businessLocationId, { foodOnly: true })
                  }
                  onRetry={() => {
                    void refetchRestaurants();
                  }}
                />
              </View>
            ) : null
          }
          catalogFilters={catalogFilters}
          onClearFilterField={onClearFilterField}
          onClearAllFilters={onClearAllFilters}
          onOpenFilterSheet={() => setFilterSheetVisible(true)}
          activeFilterCount={activeFilterCount}
          sortSummaryLabel={sortSummaryLabel}
          error={error}
          itemsLength={items.length}
          onListRefresh={onListRefresh}
          showExportsChip={showExportsChip}
          exportOnly={exportOnly}
          onToggleExportOnly={onToggleExportOnly}
          onClearExportOnly={onClearExportOnly}
        />
        {discoveryExtra}
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
      categoryRail.items,
      categoryRail.title,
      onBrowseCategories,
      catalogFilters,
      onClearFilterField,
      onClearAllFilters,
      activeFilterCount,
      sortSummaryLabel,
      error,
      items.length,
      onListRefresh,
      foodOnly,
      showAllRestaurants,
      restaurantPreview,
      restaurantPreviewLoading,
      restaurants,
      restaurantsLoading,
      restaurantsError,
      debouncedSearch,
      onStorePress,
      refetchRestaurants,
      spacing.sm,
      t,
      showExportsChip,
      exportOnly,
      onToggleExportOnly,
      onClearExportOnly,
      discoveryExtra,
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
              onSeeAllExports={onSeeAllExports}
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
      onSeeAllExports,
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
    
    // Discovery: show recovery ladder when flag on and recovery available
    if (flags.discovery_sort_v1 && recovery && !recoveryLoading) {
      return (
        <DiscoveryRecoveryLadder
          recovery={recovery}
          onSearchCorrected={handleSearchCorrected}
          onSearchOriginal={handleSearchOriginal}
          onRemoveFilter={handleRemoveFilter}
          onBrowseCategory={handleBrowseCategory}
          onItemPress={onItemPress ? handleItemPress : undefined}
        />
      );
    }
    
    const hasFilters =
      activeFilterCount > 0 || debouncedSearch.length > 0;
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

  if (showComposing) {
    return <DashboardComposingOverlay persona="client" />;
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.pageBackground }]}
      edges={applyTopSafeArea ? ['top'] : []}
    >
      <Reanimated.View
        style={[
          styles.searchSticky,
          stickyHeaderStyle,
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
                  ? showAllRestaurants
                    ? t('foods.restaurants.searchPlaceholder', 'Search restaurants')
                    : t('foods.searchPlaceholder', 'Search dishes')
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
      </Reanimated.View>
      <FlashList
        ref={listRef}
        data={showAllRestaurants ? [] : feedRows}
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
        onScroll={onFeedScroll}
        scrollEventThrottle={16}
        onEndReached={() => {
          if (!showAllRestaurants && canLoadMore) loadMore();
        }}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={showAllRestaurants ? null : listEmpty}
        ListFooterComponent={
          <View style={[styles.footer, { paddingBottom: bottomPad }]}>
            {loadingMore ? <ActivityIndicator color={colors.primary.main} /> : null}
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing.md }}
        showsVerticalScrollIndicator={false}
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
      
      {/* Discovery sort bottom sheet */}
      {flags.discovery_sort_v1 && effectiveSort && (
        <DiscoverySortSheet
          visible={sortSheetVisible}
          onDismiss={() => setSortSheetVisible(false)}
          selectedSort={effectiveSort}
          onSelectSort={handleSelectSort}
          isSearch={debouncedSearch.length > 0}
        />
      )}
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
