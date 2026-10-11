import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Chip, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InventoryCatalogCard } from '../../components/browse/InventoryCatalogCard';
import { RestockBellButton } from '../../components/browse/RestockBellButton';
import { StatusPill } from '../../components/common/StatusPill';
import { FavoritesIllustration } from '../../components/illustrations/FavoritesIllustration';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import type { ClientRootStackParamList } from '../../navigation/types';
import { fetchItemLikes } from '../../services/itemLikesApi';
import { useStore } from '../../stores/RootStore';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import { useRestockAlerts } from '../../hooks/useRestockAlerts';
import {
  useRestockLikes,
  type RestockLikesFilter,
} from '../../hooks/useRestockLikes';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

function UserLikesScreenBase() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const route = useRoute<RouteProp<ClientRootStackParamList, 'UserLikes'>>();
  const { cart } = useStore();
  const { flags } = useClientFlags();
  const restockEnabled = flags.restock_alerts_v1;

  const restockAlerts = useRestockAlerts();
  const restockLikes = useRestockLikes();

  // Apply filter from route params if provided
  useEffect(() => {
    if (route.params?.filter && restockEnabled && restockAlerts.enabled) {
      restockLikes.setFilter(route.params.filter);
    }
  }, [route.params?.filter, restockEnabled, restockAlerts.enabled]);

  const [items, setItems] = useState<CatalogInventoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appendError, setAppendError] = useState<string | null>(null);
  const [hiddenItemIds, setHiddenItemIds] = useState<Set<string>>(new Set());
  const loadingMoreRef = useRef(false);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (!replace) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      try {
        if (replace) setError(null);
        setAppendError(null);
        const data = await fetchItemLikes(nextPage, 20);
        setTotalPages(data.totalPages);
        setPage(data.page);
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
      } catch (e: any) {
        const message =
          e?.message || t('items.likes.loadError', 'Failed to load favorites');
        if (replace) setError(message);
        else setAppendError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
        if (!replace) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [t]
  );

  useEffect(() => {
    if (!restockEnabled || !restockAlerts.enabled) {
      void load(1, true);
    }
  }, [restockEnabled, restockAlerts.enabled, load]);

  useEffect(() => {
    if (restockEnabled && restockAlerts.enabled) {
      void restockLikes.load(1, true);
    }
  }, [restockEnabled, restockAlerts.enabled]);

  const onRefresh = useCallback(() => {
    if (restockEnabled && restockAlerts.enabled) {
      restockLikes.refresh();
    } else {
      setRefreshing(true);
      void load(1, true);
    }
  }, [restockEnabled, restockAlerts.enabled, restockLikes, load]);

  const openItem = useCallback(
    (inventoryItemId: string) => {
      navigation.navigate('InventoryItemDetail', { inventoryItemId });
    },
    [navigation]
  );

  const visibleItems =
    restockEnabled && restockAlerts.enabled
      ? restockLikes.items
      : items.filter((item) => !hiddenItemIds.has(item.item_id || item.item?.id));

  const handleLikedChange = useCallback((itemId: string, liked: boolean) => {
    setHiddenItemIds((prev) => {
      const next = new Set(prev);
      if (liked) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const handleFilterChange = useCallback(
    (filter: RestockLikesFilter) => {
      restockLikes.setFilter(filter);
    },
    [restockLikes]
  );

  const isLoading =
    restockEnabled && restockAlerts.enabled
      ? restockLikes.loading && restockLikes.items.length === 0
      : loading && items.length === 0;

  const currentError =
    restockEnabled && restockAlerts.enabled ? restockLikes.error : error;

  const currentRefreshing =
    restockEnabled && restockAlerts.enabled ? restockLikes.refreshing : refreshing;

  const currentLoadingMore =
    restockEnabled && restockAlerts.enabled ? restockLikes.loadingMore : loadingMore;

  const currentAppendError =
    restockEnabled && restockAlerts.enabled
      ? restockLikes.appendError
      : appendError;

  const currentPage =
    restockEnabled && restockAlerts.enabled ? restockLikes.page : page;

  const currentTotalPages =
    restockEnabled && restockAlerts.enabled
      ? restockLikes.totalPages
      : totalPages;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (currentError && visibleItems.length === 0) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text style={{ color: colors.error.main, marginBottom: spacing.sm }}>
          {currentError}
        </Text>
        <Button
          mode="contained"
          onPress={() => {
            if (restockEnabled && restockAlerts.enabled) {
              restockLikes.refresh();
            } else {
              void load(1, true);
            }
          }}
        >
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  const renderRestockCard = useCallback(
    (item: any) => {
      const isSoldOut = item.available_quantity === 0;
      const isBackInStock =
        item.back_in_stock === true && item.restocked_at !== null;
      const alertState = item.alert_state || 'disarmed';
      const isAlertExpired = alertState === 'expired';

      return (
        <View style={{ marginBottom: spacing.md }}>
          <View
            style={[
              {
                backgroundColor: colors.background.paper,
                borderRadius: spacing.sm,
                overflow: 'hidden',
              },
            ]}
          >
            {isBackInStock && (
              <View style={{ padding: spacing.sm }}>
                <StatusPill
                  label={t('restockAlerts.backInStock', 'Back in stock')}
                  color={colors.success.main}
                />
              </View>
            )}
            <View
              style={{
                flexDirection: 'row',
                padding: spacing.md,
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <Pressable onPress={() => openItem(item.id)}>
                  <Text variant="titleMedium" numberOfLines={2}>
                    {item.item?.name || '—'}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.text.secondary, marginTop: 4 }}
                  >
                    {item.business_location?.business_name || '—'}
                  </Text>
                </Pressable>
              </View>
              {isSoldOut && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <RestockBellButton
                    itemId={item.item_id}
                    itemName={item.item?.name || '—'}
                    enabled={alertState === 'armed'}
                    onToggle={restockAlerts.toggleItemAlert}
                    muted={alertState === 'disarmed' || isAlertExpired}
                  />
                  <MaterialCommunityIcons
                    name="heart"
                    size={24}
                    color={colors.error.main}
                  />
                </View>
              )}
              {!isSoldOut && (
                <MaterialCommunityIcons
                  name="heart"
                  size={24}
                  color={colors.error.main}
                />
              )}
            </View>
          </View>
        </View>
      );
    },
    [
      colors,
      spacing,
      t,
      openItem,
      restockAlerts.toggleItemAlert,
    ]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      {restockEnabled && restockAlerts.enabled && (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.xs,
          }}
        >
          <Chip
            selected={restockLikes.filter === 'all'}
            onPress={() => handleFilterChange('all')}
            mode="outlined"
          >
            {t('restockAlerts.filterAll', 'All')}
          </Chip>
          <Chip
            selected={restockLikes.filter === 'back_in_stock'}
            onPress={() => handleFilterChange('back_in_stock')}
            mode="outlined"
          >
            {t('restockAlerts.filterBackInStock', 'Back in stock')}
          </Chip>
        </View>
      )}
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={currentRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FavoritesIllustration size={110} />
            <Text
              variant="titleMedium"
              style={{ marginTop: spacing.md, textAlign: 'center' }}
            >
              {restockEnabled &&
              restockAlerts.enabled &&
              restockLikes.filter === 'back_in_stock'
                ? t(
                    'restockAlerts.emptyBackInStock',
                    'Nothing back yet. We'll tell you.'
                  )
                : t('items.likes.emptyTitle', 'No favorites yet')}
            </Text>
            {(!restockEnabled ||
              !restockAlerts.enabled ||
              restockLikes.filter === 'all') && (
              <Text
                style={[
                  typography.body2,
                  {
                    color: colors.text.secondary,
                    textAlign: 'center',
                    marginTop: spacing.xs,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                {t(
                  'items.likes.emptyMessage',
                  'Tap the heart on any product to save it here.'
                )}
              </Text>
            )}
            <Button
              mode="contained"
              onPress={() =>
                navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse' })
              }
            >
              {t('items.likes.browseCta', 'Browse items')}
            </Button>
          </View>
        }
        ListFooterComponent={
          currentAppendError ? (
            <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ color: colors.error.main, marginBottom: spacing.xs }}>
                {currentAppendError}
              </Text>
              <Button
                mode="text"
                onPress={() => {
                  if (restockEnabled && restockAlerts.enabled) {
                    void restockLikes.load(currentPage + 1, false);
                  } else {
                    void load(page + 1, false);
                  }
                }}
              >
                {t('common.retry', 'Retry')}
              </Button>
            </View>
          ) : currentLoadingMore ? (
            <ActivityIndicator
              color={colors.primary.main}
              style={{ marginVertical: spacing.md }}
            />
          ) : null
        }
        renderItem={({ item }) =>
          restockEnabled && restockAlerts.enabled ? (
            renderRestockCard(item)
          ) : (
            <View style={{ marginBottom: spacing.md }}>
              <InventoryCatalogCard
                item={item}
                primaryLabel={t('cart.buyNow', 'Buy now')}
                onPrimaryPress={() => openItem(item.id)}
                onItemPress={openItem}
                onAddToCart={(selectionId) => {
                  cart.addFromCatalog(
                    item,
                    1,
                    selectionId,
                    t('orders.variant.defaultOption', 'Default')
                  );
                }}
                inCartQuantity={cart.quantityForListing(item.id)}
                onLikedChange={handleLikedChange}
              />
            </View>
          )
        }
        onEndReached={() => {
          if (restockEnabled && restockAlerts.enabled) {
            if (
              currentPage < currentTotalPages &&
              !restockLikes.loadingMore &&
              !restockLikes.loading
            ) {
              void restockLikes.load(currentPage + 1, false);
            }
          } else {
            if (page < totalPages && !loadingMoreRef.current) {
              void load(page + 1, false);
            }
          }
        }}
        onEndReachedThreshold={0.4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
});

export default observer(UserLikesScreenBase);
