import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Banner, Text } from 'react-native-paper';
import { SearchInput } from '@/components/common/SearchInput';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/contexts/ThemeContext';
import type { BusinessRootStackParamList } from '@/navigation/types';
import { useBusinessOrdersList } from '@/hooks/business/useBusinessOrdersList';
import { BusinessOrderListRow } from '@/components/business/BusinessOrderListRow';
import { OrdersActivityGroupedFooter } from '@/components/orders/OrdersActivityGroupedFooter';
import { useOrdersActivityPartition } from '@/hooks/useOrdersActivityPartition';
import { useMainTabContentBottomPadding } from '@/hooks/useMainTabContentBottomPadding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BusinessOrder } from '@/types/business/orders';
import { businessOrderItemTitle } from '@/utils/businessOrderListDisplay';
import {
  BUSINESS_ORDER_QUEUE_FILTERS,
  type BusinessOrderQueue,
  matchesBusinessOrderQueue,
  orderToPhaseInput,
  resolveOrderPhase,
} from '@/utils/orderPhase';

export type BusinessOrdersListViewProps = {
  cashMode?: boolean;
  onOpenOrder: (orderId: string) => void;
};

/** Shared orders list UI for owner business and location delegates. */
export function BusinessOrdersListView({
  cashMode = false,
  onOpenOrder,
}: BusinessOrdersListViewProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const tabListBottomPadding = useMainTabContentBottomPadding(24);
  const listBottomPadding =
    route.name === 'BusinessOrders'
      ? tabListBottomPadding
      : 24 + insets.bottom;
  const initialFilters = useMemo(
    () =>
      cashMode ? { reconciliation_status: 'pending_manual_reconciliation' } : undefined,
    [cashMode]
  );
  const { orders, loading, error, applyFilters, refresh } = useBusinessOrdersList(initialFilters);
  const [search, setSearch] = useState('');
  const [queueFilter, setQueueFilter] = useState<BusinessOrderQueue>('all');

  useEffect(() => {
    if (cashMode) {
      applyFilters({ reconciliation_status: 'pending_manual_reconciliation' });
    }
  }, [cashMode, applyFilters]);

  const filtered = useMemo(() => {
    const queuedOrders = cashMode
      ? orders
      : orders.filter((order) =>
          matchesBusinessOrderQueue(
            resolveOrderPhase(orderToPhaseInput(order), 'business'),
            queueFilter
          )
        );
    const q = search.trim().toLowerCase();
    if (!q) return queuedOrders;
    return queuedOrders.filter((o) => {
      const client = [o.client?.user?.first_name, o.client?.user?.last_name].join(' ').toLowerCase();
      const items = businessOrderItemTitle(o).toLowerCase();
      return (
        o.order_number?.toLowerCase().includes(q) ||
        o.current_status?.toLowerCase().includes(q) ||
        client.includes(q) ||
        items.includes(q)
      );
    });
  }, [cashMode, orders, queueFilter, search]);

  const groupInactive = !cashMode && queueFilter === 'all';
  const {
    active: listActive,
    completed: listCompleted,
    cancelled: listCancelled,
    hasInactive,
  } = useOrdersActivityPartition(filtered, groupInactive);

  const onSearch = useCallback(
    (text: string) => {
      setSearch(text);
      if (text.trim()) {
        applyFilters({ ...initialFilters, search: text.trim() });
      } else if (cashMode) {
        applyFilters({ reconciliation_status: 'pending_manual_reconciliation' });
      } else {
        applyFilters({});
      }
    },
    [applyFilters, cashMode, initialFilters]
  );

  const handleMutated = useCallback(() => {
    void refresh();
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: BusinessOrder }) => (
      <BusinessOrderListRow
        order={item}
        onPressDetails={() => onOpenOrder(item.id)}
        onOrderMutated={handleMutated}
      />
    ),
    [onOpenOrder, handleMutated]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      {cashMode ? (
        <Banner visible icon="cash">
          {t(
            'business.orders.cashBanner',
            'Orders needing cash exception reconciliation'
          )}
        </Banner>
      ) : null}
      <SearchInput
        placeholder={t('business.orders.search', 'Search orders')}
        value={search}
        onChangeText={onSearch}
        onClear={() => onSearch('')}
        containerStyle={styles.search}
      />
      {!cashMode ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.queueFiltersScroll}
          contentContainerStyle={[
            styles.queueFilters,
            {
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              paddingTop: spacing.xs,
              paddingBottom: spacing.sm,
            },
          ]}
        >
          {BUSINESS_ORDER_QUEUE_FILTERS.map((filter) => {
            const selected = queueFilter === filter;
            const defaults: Record<BusinessOrderQueue, string> = {
              confirm: 'Confirm',
              prep: 'Prep',
              pickup: 'Pickup',
              issues: 'Issues',
              all: 'All',
            };
            return (
              <Pressable
                key={filter}
                onPress={() => setQueueFilter(filter)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.queueChip,
                  {
                    borderColor: selected ? colors.primary.main : colors.divider,
                    backgroundColor: selected ? colors.primaryTint : colors.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.queueChipLabel,
                    { color: selected ? colors.primary.main : colors.text.primary },
                  ]}
                >
                  {t(`orders.queue.${filter}`, defaults[filter])}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {error ? (
        <Text style={{ color: colors.error.main, padding: 16 }}>{error}</Text>
      ) : null}
      {loading && filtered.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={listActive}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.listFlex}
          contentContainerStyle={[styles.list, { paddingBottom: listBottomPadding }]}
          ListHeaderComponent={
            hasInactive && listActive.length > 0 ? (
              <Text
                variant="titleSmall"
                style={{
                  color: colors.text.primary,
                  fontWeight: '700',
                  marginBottom: 8,
                }}
              >
                {t('orders.sections.activeOrders', 'Active orders')}
              </Text>
            ) : null
          }
          ListFooterComponent={
            groupInactive ? (
              <OrdersActivityGroupedFooter
                completed={listCompleted}
                cancelled={listCancelled}
                renderOrder={(order) => (
                  <BusinessOrderListRow
                    order={order}
                    onPressDetails={() => onOpenOrder(order.id)}
                    onOrderMutated={handleMutated}
                  />
                )}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void refresh()} />
          }
          ListEmptyComponent={
            hasInactive ? null : (
              <Text style={{ textAlign: 'center', marginTop: 24, color: colors.text.secondary }}>
                {cashMode
                  ? t('business.orders.empty', 'No orders found')
                  : t('orders.queue.empty', 'No items in this queue.')}
              </Text>
            )
          }
        />
      )}
    </View>
  );
}

type OrdersRouteParams = {
  cashReconciliation?: boolean;
};

export default function BusinessOrdersListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const route = useRoute();
  const params = (route.params ?? {}) as OrdersRouteParams;
  const cashMode = params.cashReconciliation === true;
  return (
    <BusinessOrdersListView
      cashMode={cashMode}
      onOpenOrder={(orderId) =>
        navigation.navigate('BusinessOrderDetail', { orderId })
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  search: { margin: 12 },
  queueFiltersScroll: { flexGrow: 0, flexShrink: 0 },
  queueFilters: { alignItems: 'center' },
  queueChip: {
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  queueChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
  },
  listFlex: { flex: 1 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
});
