import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Banner,
  Button,
  Chip,
  Menu,
  Searchbar,
  Text,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useInventoryCatalog } from '../../hooks/useInventoryCatalog';
import { useInventoryStore } from '../../hooks/useInventoryStore';
import { useCatalogOrigin } from '../../hooks/useCatalogOrigin';
import { useStoreBrowseContext } from '../../hooks/useStoreBrowseContext';
import { useStoreFeedComposition } from '../../hooks/useStoreFeedComposition';
import type { CatalogFeedRow } from '../../hooks/useCatalogFeedComposition';
import { formatDistanceKm } from '../../utils/formatDistanceKm';
import { useGuestCatalogCountry } from '../../hooks/useGuestCatalogCountry';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import { BrowseCartFab } from '../../components/browse/BrowseCartFab';
import { BusinessFollowButton } from '../../components/browse/BusinessFollowButton';
import { CatalogFeedStop } from '../../components/browse/CatalogFeedStop';
import { InventoryCatalogGridTile } from '../../components/browse/InventoryCatalogGridTile';
import { StatusPill } from '../../components/common/StatusPill';
import { StoreDefaultAvatar } from '../../components/illustrations/StoreDefaultAvatar';
import { businessApi } from '../../services/businessApi';
import { shadows } from '../../theme';
import { storeAvatarPalette } from '../../utils/storeAvatarPalette';
import type { BusinessLocation } from '../../types/business/locations';
import type { InventorySortMode } from '../../types/inventoryCatalog';
import type {
  BusinessRootStackParamList,
  ClientRootStackParamList,
  GuestRootStackParamList,
} from '../../navigation/types';
import { useStore } from '../../stores/RootStore';
import { getEnv } from '../../config/auth0';
import { storeWebUrl } from '../../utils/storeWebUrl';

const SEARCH_DEBOUNCE_MS = 300;

type Props =
  | NativeStackScreenProps<GuestRootStackParamList, 'StoreDetail'>
  | NativeStackScreenProps<ClientRootStackParamList, 'StoreDetail'>
  | NativeStackScreenProps<BusinessRootStackParamList, 'StoreDetail'>;

function StoreDetailScreen({ route, navigation }: Props) {
  const { businessId: locationOrBusinessId, previewMode, foodOnly } = route.params;
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { auth, persona } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [previewLocations, setPreviewLocations] = useState<BusinessLocation[]>(
    []
  );
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');
  const [sortFilter, setSortFilter] = useState<InventorySortMode>('relevance');
  const { trackView } = useTrackItemView();
  const canAddToCart = !previewMode;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchDraft.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    if (!previewMode || persona.activePersona !== 'business') {
      setPreviewLocations([]);
      return;
    }
    let cancelled = false;
    void businessApi.locations.list().then((res) => {
      if (cancelled) return;
      setPreviewLocations(res.data?.business_locations ?? []);
    }).catch(() => {
      if (!cancelled) setPreviewLocations([]);
    });
    return () => {
      cancelled = true;
    };
  }, [previewMode, persona.activePersona]);

  const guestCountry = useGuestCatalogCountry();
  const withAuth = auth.isAuthenticated;
  const catalogReady = withAuth || !guestCountry.loading;
  const countryCode = withAuth ? undefined : guestCountry.countryCode;
  const { origin } = useCatalogOrigin(catalogReady);

  const storeQuery = useInventoryStore({
    businessId: locationOrBusinessId,
    countryCode,
    origin,
    withAuth: withAuth || !!previewMode,
    previewMode: !!previewMode,
    enabled: catalogReady,
  });

  const store = storeQuery.store;
  const storeMatchesRoute =
    Boolean(store) &&
    (store?.business_location_id === locationOrBusinessId ||
      store?.business_id === locationOrBusinessId);

  const catalog = useInventoryCatalog({
    search: debouncedSearch,
    sort: sortFilter,
    business_location_id: storeMatchesRoute
      ? store?.business_location_id
      : undefined,
    ...(previewMode && storeMatchesRoute && store?.business_id
      ? { business_id: store.business_id }
      : {}),
    // Geo is implied by the store location; do not pass the viewer's market/device
    // country or cross-market store pages can return an empty product list.
    withAuth: withAuth || !!previewMode,
    owner_preview: !!previewMode,
    origin,
    food_only: foodOnly === true || undefined,
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(collectionFilter ? { collection: collectionFilter } : {}),
    enabled: catalogReady && storeMatchesRoute && Boolean(store?.business_location_id),
  });

  const browse = useStoreBrowseContext({
    businessId: storeMatchesRoute ? locationOrBusinessId : undefined,
    foodOnly: foodOnly === true,
    ownerPreview: !!previewMode,
    withAuth: withAuth || !!previewMode,
    enabled: catalogReady && storeMatchesRoute,
  });

  const suppressStops =
    debouncedSearch.length > 0 ||
    categoryFilter.length > 0 ||
    collectionFilter.length > 0 ||
    sortFilter === 'deals';

  const feedRows = useStoreFeedComposition({
    inventoryItems: catalog.items,
    suppressStops,
    dealsItems: browse.context?.deals ?? [],
    popular: browse.context?.popular ?? [],
    collections: browse.context?.collections ?? [],
  });

  const openItem = useCallback(
    (inventoryItemId: string) => {
      if (!previewMode) {
        trackView(inventoryItemId);
      }
      const nav = navigation as { navigate: (name: string, params: object) => void };
      if (previewMode) {
        const catalogItem = catalog.items.find((i) => i.id === inventoryItemId);
        const itemId = catalogItem?.item?.id ?? catalogItem?.item_id;
        if (itemId) nav.navigate('BusinessItemDetail', { itemId });
        return;
      }
      nav.navigate('InventoryItemDetail', { inventoryItemId });
    },
    [catalog.items, navigation, previewMode, trackView]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        storeQuery.refetch(),
        catalog.refetch(),
        browse.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [browse, catalog, storeQuery]);

  const onShare = useCallback(async () => {
    const shareId =
      storeQuery.store?.business_location_id ?? locationOrBusinessId;
    const url = storeWebUrl(shareId, getEnv().apiUrl);
    const storeName = storeQuery.store?.name?.trim() || t('stores.unnamed', 'Store');
    await Share.share({
      message: t('stores.shareMessage', 'Check out {{name}} on Rendasua: {{url}}', {
        name: storeName,
        url,
      }),
      url,
    });
  }, [locationOrBusinessId, storeQuery.store?.business_location_id, storeQuery.store?.name, t]);

  const goAddProducts = useCallback(() => {
    if (persona.activePersona !== 'business') return;
    const locationId = store?.business_location_id ?? locationOrBusinessId;
    (navigation as { navigate: (name: string, params?: object) => void }).navigate(
      'BusinessAddItemFromImage',
      locationId ? { locationId } : undefined
    );
  }, [
    locationOrBusinessId,
    navigation,
    persona.activePersona,
    store?.business_location_id,
  ]);

  const goManageItems = useCallback(() => {
    if (!previewMode || persona.activePersona !== 'business') return;
    const locationId = store?.business_location_id ?? locationOrBusinessId;
    (navigation as { navigate: (name: string, params?: object) => void }).navigate(
      'BusinessItemsList',
      { locationId }
    );
  }, [
    locationOrBusinessId,
    navigation,
    persona.activePersona,
    previewMode,
    store?.business_location_id,
  ]);

  const selectPreviewLocation = useCallback(
    (locationId: string) => {
      setLocationMenuOpen(false);
      if (!locationId || locationId === store?.business_location_id) return;
      (
        navigation as {
          setParams: (params: {
            businessId: string;
            previewMode?: boolean;
          }) => void;
        }
      ).setParams({
        businessId: locationId,
        previewMode: true,
      });
    },
    [navigation, store?.business_location_id]
  );

  const name = store?.name?.trim() || t('stores.unnamed', 'Store');
  const distanceKm = formatDistanceKm(store?.distance_meters);
  const openingSoon = !!store?.is_storefront_visible && !store?.can_accept_orders;
  const isEmpty = !catalog.loading && catalog.items.length === 0;
  const palette = storeAvatarPalette(name);
  const selectedPreviewLocation = previewLocations.find(
    (loc) => loc.id === store?.business_location_id
  );

  const listHeader = (
    <View style={{ padding: spacing.md }}>
      {previewMode ? (
        <View style={{ marginBottom: spacing.md }}>
          <Banner visible icon="eye-outline">
            {t(
              'stores.previewBanner',
              'This is how customers see your store.'
            )}
          </Banner>
          {previewLocations.length > 1 ? (
            <View style={{ marginTop: spacing.sm }}>
              <Text
                variant="labelMedium"
                style={{ color: colors.text.secondary, marginBottom: spacing.xs }}
              >
                {t('stores.previewLocation', 'Preview location')}
              </Text>
              <Menu
                visible={locationMenuOpen}
                onDismiss={() => setLocationMenuOpen(false)}
                anchor={
                  <Button
                    mode="outlined"
                    icon="map-marker-outline"
                    onPress={() => setLocationMenuOpen(true)}
                    contentStyle={{ justifyContent: 'flex-start' }}
                  >
                    {selectedPreviewLocation?.name ??
                      store?.name ??
                      t('stores.previewLocation', 'Preview location')}
                  </Button>
                }
              >
                {previewLocations.map((loc) => (
                  <Menu.Item
                    key={loc.id}
                    onPress={() => selectPreviewLocation(loc.id)}
                    title={
                      loc.is_primary
                        ? `${loc.name} (${t('business.locations.primary', 'Primary')})`
                        : loc.name
                    }
                  />
                ))}
              </Menu>
            </View>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.headerCard,
          shadows.sm,
          {
            borderRadius: borderRadius.lg,
            borderColor: palette.bg + '33',
            backgroundColor: colors.surface,
            overflow: 'hidden',
          },
        ]}
      >
        <View
          style={[
            styles.heroBand,
            {
              backgroundColor: palette.bgSoft,
              borderBottomColor: palette.accent + '44',
            },
          ]}
        >
          <View style={styles.heroDecor}>
            <MaterialCommunityIcons
              name="storefront-outline"
              size={72}
              color={palette.bg + '33'}
            />
          </View>
          <View style={styles.heroDots}>
            <View style={[styles.dot, { backgroundColor: palette.accent }]} />
            <View style={[styles.dot, { backgroundColor: palette.bg }]} />
            <View
              style={[styles.dot, { backgroundColor: palette.accentSoft }]}
            />
          </View>
        </View>

        <View style={{ padding: spacing.md }}>
          <View style={styles.headerRow}>
            {store?.logo_url ? (
              <Image
                source={{ uri: store.logo_url }}
                style={[
                  styles.logo,
                  { borderColor: palette.bg + '44', backgroundColor: '#fff' },
                ]}
                resizeMode="contain"
              />
            ) : (
              <StoreDefaultAvatar name={name} size={72} />
            )}
            <View style={styles.headerBody}>
              <Text
                variant="headlineSmall"
                style={{ fontWeight: '800', color: colors.text.primary }}
                numberOfLines={2}
              >
                {name}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: colors.text.secondary, marginTop: 4 }}
              >
                {foodOnly
                  ? t('foods.restaurants.dishCount', '{{count}} dishes', {
                      count: catalog.total,
                    })
                  : t('stores.itemCount', '{{count}} items', {
                      count: store?.item_count ?? catalog.total,
                    })}
              </Text>
              {distanceKm ? (
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.primary.main, fontWeight: '700', marginTop: 4 }}
                >
                  {t('foods.distanceFromYou', '{{km}} km from you', { km: distanceKm })}
                </Text>
              ) : null}
              <View style={styles.badges}>
                {store?.is_verified ? (
                  <StatusPill
                    compact
                    icon="check-decagram"
                    label={t('stores.verified', 'Verified')}
                    backgroundColor={colors.success.main + '22'}
                    textColor={colors.success.main}
                  />
                ) : null}
                {openingSoon ? (
                  <StatusPill
                    compact
                    label={t('business.lifecycle.openingSoonBadge', 'Opening Soon')}
                    backgroundColor={colors.warning.main + '22'}
                    textColor={colors.warning.main}
                  />
                ) : null}
                {previewMode && store && !store.is_storefront_visible ? (
                  <StatusPill
                    compact
                    label={t('stores.notVisibleYet', 'Not visible to customers yet')}
                    backgroundColor={colors.warning.main + '22'}
                    textColor={colors.warning.main}
                  />
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            {!previewMode && store?.business_id ? (
              <BusinessFollowButton businessId={store.business_id} />
            ) : null}
            {store?.is_storefront_visible || previewMode ? (
              <Button
                mode="contained-tonal"
                icon="share-variant"
                compact
                onPress={() => void onShare()}
                buttonColor={palette.bgSoft}
                textColor={palette.bg}
              >
                {t('stores.share', 'Share store')}
              </Button>
            ) : null}
            {previewMode && !isEmpty ? (
              <Button
                mode="contained"
                icon="package-variant"
                compact
                onPress={goManageItems}
              >
                {t('stores.manageItems', 'Manage items')}
              </Button>
            ) : null}
          </View>
        </View>
      </View>

          {previewMode && isEmpty ? (
        <View
          style={[
            styles.coachCard,
            {
              marginTop: spacing.md,
              padding: spacing.md,
              borderRadius: borderRadius.md,
              backgroundColor: colors.primaryTint,
              borderColor: colors.primary.main + '33',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="storefront-plus-outline"
            size={28}
            color={colors.primary.main}
          />
          <Text variant="titleMedium" style={{ fontWeight: '800', marginTop: spacing.sm }}>
            {t('stores.previewEmptyTitle', 'Your store looks empty')}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, marginTop: spacing.xs }}
          >
            {t(
              'stores.previewEmptyBody',
              'Add products with photos and stock so customers have something to browse.'
            )}
          </Text>
          <Button
            mode="contained"
            style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
            onPress={goAddProducts}
          >
            {t('stores.addProducts', 'Add products')}
          </Button>
        </View>
      ) : null}

      {previewMode && !isEmpty ? (
        <View style={{ marginTop: spacing.md, gap: 4 }}>
          {catalog.items.some(
            (i) => !(i.item.item_images && i.item.item_images.length > 0)
          ) ? (
            <Text variant="bodySmall" style={{ color: colors.warning.main }}>
              {t('stores.completenessPhotos', 'Some products are missing photos')}
            </Text>
          ) : null}
          {catalog.items.some((i) => (i.computed_available_quantity ?? 0) <= 0) ? (
            <Text variant="bodySmall" style={{ color: colors.warning.main }}>
              {t('stores.completenessStock', 'Some products are out of stock')}
            </Text>
          ) : null}
          {store && !store.is_storefront_visible ? (
            <Text variant="bodySmall" style={{ color: colors.warning.main }}>
              {t(
                'stores.completenessHidden',
                'Your storefront is not visible to customers yet'
              )}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text
        variant="titleMedium"
        style={{ fontWeight: '800', marginTop: spacing.lg, marginBottom: spacing.sm }}
      >
        {t('stores.catalogTitle', 'Products')}
      </Text>

      <Searchbar
        placeholder={t('stores.catalogSearchPlaceholder', 'Search this store…')}
        value={searchDraft}
        onChangeText={setSearchDraft}
        style={{ marginBottom: spacing.sm }}
        inputStyle={{ minHeight: 0 }}
      />

      {(browse.context?.categories.length ?? 0) > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: spacing.sm }}
        >
          <Chip
            selected={!categoryFilter}
            onPress={() => setCategoryFilter('')}
            compact
          >
            {t('stores.allCategories', 'All')}
          </Chip>
          {browse.context?.categories.map((category) => {
            const selected = categoryFilter === category.name;
            return (
              <Chip
                key={category.id}
                selected={selected}
                onPress={() =>
                  setCategoryFilter(selected ? '' : category.name)
                }
                compact
              >
                {category.name}
              </Chip>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  const renderFeedRow = useCallback(
    ({ item: row }: { item: CatalogFeedRow }) => {
      if (row.type === 'stop') {
        return (
          <View style={{ width: '100%', paddingHorizontal: spacing.md }}>
            <CatalogFeedStop
              stop={row.stop}
              onItemPress={(id) => openItem(id)}
              onCollectionPress={(slug) => {
                setCollectionFilter(slug);
                setSortFilter('relevance');
              }}
              onSeeAllDeals={() => {
                setSortFilter('deals');
                setCategoryFilter('');
                setCollectionFilter('');
              }}
            />
          </View>
        );
      }

      return (
        <View
          style={[
            styles.productRow,
            { gap: spacing.xs, paddingHorizontal: spacing.md },
          ]}
        >
          <View style={styles.productColumn}>
            <InventoryCatalogGridTile
              item={row.left}
              onPress={(id) => openItem(id)}
            />
          </View>
          {row.right ? (
            <View style={styles.productColumn}>
              <InventoryCatalogGridTile
                item={row.right}
                onPress={(id) => openItem(id)}
              />
            </View>
          ) : (
            <View style={styles.productColumn} />
          )}
        </View>
      );
    },
    [openItem, spacing.md, spacing.xs]
  );

  const keyExtractorRow = useCallback((row: CatalogFeedRow) => {
    if (row.type === 'stop') return row.stop.id;
    return row.id;
  }, []);

  if (storeQuery.loading && !store) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (storeQuery.error && !store) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.pageBackground }]}
        edges={['bottom']}
      >
        <View style={styles.stateWrap}>
          <Text variant="bodyMedium" style={{ color: colors.error.main, textAlign: 'center' }}>
            {storeQuery.error}
          </Text>
          <Button
            mode="contained-tonal"
            icon="refresh"
            style={{ marginTop: 12 }}
            onPress={() => void storeQuery.refetch()}
          >
            {t('common.retry', 'Retry')}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.pageBackground }]}
      edges={['bottom']}
    >
      {catalog.loading && catalog.items.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={<ActivityIndicator style={{ marginTop: 24 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <FlatList
          data={feedRows}
          keyExtractor={keyExtractorRow}
          renderItem={renderFeedRow}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={() => {
            if (!catalog.loadingMore) void catalog.loadMore();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            !previewMode ? (
              <View style={styles.stateWrap}>
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.text.secondary, textAlign: 'center' }}
                >
                  {t('stores.catalogEmpty', 'No products available at this location right now.')}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            catalog.loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} />
            ) : null
          }
        />
      )}
      {canAddToCart ? <BrowseCartFab /> : null}
    </SafeAreaView>
  );
}

export default observer(StoreDetailScreen);

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerCard: { borderWidth: 1 },
  heroBand: {
    height: 88,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroDecor: {
    position: 'absolute',
    right: 12,
    top: 8,
  },
  heroDots: {
    position: 'absolute',
    left: 16,
    bottom: 14,
    flexDirection: 'row',
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headerBody: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 2,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  coachCard: { borderWidth: 1 },
  stateWrap: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  productRow: { flexDirection: 'row', width: '100%', marginBottom: 8 },
  productColumn: { flex: 1, minWidth: 0 },
});
