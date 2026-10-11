import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Chip, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InventoryCatalogCard } from '../../components/browse/InventoryCatalogCard';
import { RestockBellButton } from '../../components/browse/RestockBellButton';
import { RestockToast } from '../../components/browse/RestockToast';
import { StatusPill } from '../../components/common/StatusPill';
import { FavoritesIllustration } from '../../components/illustrations/FavoritesIllustration';
import { useTheme } from '../../contexts/ThemeContext';
import { useRestockBellToggle } from '../../hooks/useRestockBellToggle';
import { useRestockHint } from '../../hooks/useRestockHint';
import { useRestockLikes } from '../../hooks/useRestockLikes';
import type { ClientRootStackParamList } from '../../navigation/types';
import type { RestockLikedItem, RestockLikesFilter } from '../../services/restockAlertsApi';
import { useStore } from '../../stores/RootStore';
import { isBellOn, showsRestockBell } from '../../utils/restockAlertsUi';

export interface RestockLikesViewProps {
  /** Server flag is off for this market: parent falls back to the classic list. */
  onUnavailable: () => void;
}

/** Likes with restock bell states, Back in stock chip and All | Back in stock filter (#343). */
export function RestockLikesView({ onUnavailable }: RestockLikesViewProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const route = useRoute<RouteProp<ClientRootStackParamList, 'UserLikes'>>();
  const { cart } = useStore();
  const paramFilter: RestockLikesFilter =
    route.params?.filter === 'back_in_stock' ? 'back_in_stock' : 'all';

  const likes = useRestockLikes(paramFilter);
  const { setFilter, patchAlert, removeItem } = likes;

  // Digest push / deep link while the screen is already mounted.
  useEffect(() => {
    setFilter(paramFilter);
  }, [paramFilter, setFilter]);

  useEffect(() => {
    if (likes.unavailable) onUnavailable();
  }, [likes.unavailable, onUnavailable]);

  const bell = useRestockBellToggle(patchAlert);

  const firstSoldOutId = useMemo(
    () => likes.items.find((i) => showsRestockBell(i))?.id ?? null,
    [likes.items]
  );
  const hint = useRestockHint(firstSoldOutId != null);

  const openItem = useCallback(
    (inventoryItemId: string) => navigation.navigate('InventoryItemDetail', { inventoryItemId }),
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: RestockLikedItem }) => {
      const hasBell = showsRestockBell(item);
      const showHintHere = hasBell && item.id === firstSoldOutId && hint.visible;
      return (
        <View style={{ marginBottom: spacing.md }}>
          {item.back_in_stock || hasBell ? (
            <View style={styles.badgeRow}>
              {item.back_in_stock ? (
                <StatusPill
                  label={t('restockAlerts.backInStock', 'Back in stock')}
                  backgroundColor={colors.primaryTint}
                  textColor={colors.primary.main}
                  icon="bell-ring-outline"
                  compact
                />
              ) : (
                <View />
              )}
              {hasBell ? (
                <RestockBellButton
                  itemId={item.item_id}
                  itemName={item.item?.name ?? ''}
                  enabled={isBellOn(item.restock_alert.state)}
                  busy={bell.pendingId === item.item_id}
                  onToggle={(id, next) => void bell.toggle(id, next)}
                />
              ) : null}
            </View>
          ) : null}
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
            onLikedChange={(id, liked) => {
              if (!liked) removeItem(id);
            }}
          />
          {showHintHere ? (
            <View
              style={[
                styles.hint,
                { backgroundColor: colors.primaryTint, borderRadius: spacing.sm },
              ]}
            >
              <Text style={[typography.body2, { flex: 1, color: colors.text.primary }]}>
                {t('restockAlerts.hint', "We'll let you know when it's back.")}
              </Text>
              <Pressable
                onPress={hint.dismiss}
                style={styles.hintClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.close', 'Close')}
              >
                <MaterialCommunityIcons name="close" size={18} color={colors.text.secondary} />
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    },
    [bell, cart, colors, firstSoldOutId, hint, openItem, removeItem, spacing, t, typography]
  );

  const filterChips = (
    <View style={[styles.filters, { padding: spacing.md, paddingBottom: spacing.xs, gap: spacing.sm }]}>
      {(['all', 'back_in_stock'] as const).map((f) => {
        const label =
          f === 'all'
            ? t('restockAlerts.filterAll', 'All')
            : t('restockAlerts.filterBackInStock', 'Back in stock');
        return (
          <Chip
            key={f}
            mode="outlined"
            selected={likes.filter === f}
            onPress={() => likes.setFilter(f)}
            style={styles.chip}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: likes.filter === f }}
          >
            {label}
          </Chip>
        );
      })}
    </View>
  );

  if (likes.loading && likes.items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
        {filterChips}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary.main} />
        </View>
      </View>
    );
  }

  if (likes.error && likes.items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
        {filterChips}
        <View style={[styles.center, { padding: spacing.lg }]}>
          <Text style={{ color: colors.error.main, marginBottom: spacing.sm }}>{likes.error}</Text>
          <Button mode="contained" onPress={likes.refresh}>
            {t('common.retry', 'Retry')}
          </Button>
        </View>
      </View>
    );
  }

  const backInStockEmpty = likes.filter === 'back_in_stock';

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      {filterChips}
      <FlatList
        data={likes.items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          flexGrow: 1,
        }}
        refreshControl={<RefreshControl refreshing={likes.refreshing} onRefresh={likes.refresh} />}
        onEndReached={likes.loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FavoritesIllustration size={110} />
            <Text variant="titleMedium" style={{ marginTop: spacing.md, textAlign: 'center' }}>
              {backInStockEmpty
                ? t('restockAlerts.emptyBackInStock', "Nothing back yet. We'll tell you.")
                : t('items.likes.emptyTitle', 'No favorites yet')}
            </Text>
            {backInStockEmpty ? null : (
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
                {t('items.likes.emptyMessage', 'Tap the heart on any product to save it here.')}
              </Text>
            )}
            <Button
              mode="contained"
              style={{ marginTop: backInStockEmpty ? spacing.md : 0 }}
              onPress={() => navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse' })}
            >
              {t('items.likes.browseCta', 'Browse items')}
            </Button>
          </View>
        }
        ListFooterComponent={
          likes.appendError ? (
            <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
              <Text style={{ color: colors.error.main, marginBottom: spacing.xs }}>
                {likes.appendError}
              </Text>
              <Button mode="text" onPress={likes.retryLoadMore}>
                {t('common.retry', 'Retry')}
              </Button>
            </View>
          ) : likes.loadingMore ? (
            <ActivityIndicator color={colors.primary.main} style={{ marginVertical: spacing.md }} />
          ) : null
        }
      />
      <RestockToast toast={bell.toast} onUndo={bell.undo} onDismiss={bell.dismissToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row' },
  chip: { minHeight: 44, justifyContent: 'center' },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hint: { flexDirection: 'row', alignItems: 'center', padding: 12, marginTop: 8 },
  hintClose: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
});
