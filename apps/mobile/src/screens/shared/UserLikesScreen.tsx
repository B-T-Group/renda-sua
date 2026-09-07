import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InventoryCatalogCard } from '../../components/browse/InventoryCatalogCard';
import { FavoritesIllustration } from '../../components/illustrations/FavoritesIllustration';
import { useTheme } from '../../contexts/ThemeContext';
import type { ClientRootStackParamList } from '../../navigation/types';
import { fetchItemLikes } from '../../services/itemLikesApi';
import { useStore } from '../../stores/RootStore';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';

function UserLikesScreenBase() {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const { cart } = useStore();
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

  const load = useCallback(async (nextPage: number, replace: boolean) => {
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
  }, [t]);

  useEffect(() => {
    void load(1, true);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load(1, true);
  }, [load]);

  const openItem = useCallback(
    (inventoryItemId: string) => {
      navigation.navigate('InventoryItemDetail', { inventoryItemId });
    },
    [navigation]
  );

  const visibleItems = items.filter(
    (item) => !hiddenItemIds.has(item.item_id || item.item?.id)
  );

  const handleLikedChange = useCallback((itemId: string, liked: boolean) => {
    setHiddenItemIds((prev) => {
      const next = new Set(prev);
      if (liked) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  if (loading && items.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text style={{ color: colors.error.main, marginBottom: spacing.sm }}>
          {error}
        </Text>
        <Button mode="contained" onPress={() => void load(1, true)}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FavoritesIllustration size={110} />
            <Text
              variant="titleMedium"
              style={{ marginTop: spacing.md, textAlign: 'center' }}
            >
              {t('items.likes.emptyTitle', 'No favorites yet')}
            </Text>
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
          appendError ? (
            <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ color: colors.error.main, marginBottom: spacing.xs }}>
                {appendError}
              </Text>
              <Button mode="text" onPress={() => void load(page + 1, false)}>
                {t('common.retry', 'Retry')}
              </Button>
            </View>
          ) : loadingMore ? (
            <ActivityIndicator
              color={colors.primary.main}
              style={{ marginVertical: spacing.md }}
            />
          ) : null
        }
        renderItem={({ item }) => (
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
        )}
        onEndReached={() => {
          if (page < totalPages && !loadingMoreRef.current) {
            void load(page + 1, false);
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
