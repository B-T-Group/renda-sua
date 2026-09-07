import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, IconButton, SegmentedButtons, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ClientOrderListRow } from '../../components/client/ClientOrderListRow';
import { SearchInput } from '../../components/common/SearchInput';
import { OrdersActivityGroupedFooter } from '../../components/orders/OrdersActivityGroupedFooter';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientOrders } from '../../hooks/useClientOrders';
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';
import { useOrdersActivityPartition } from '../../hooks/useOrdersActivityPartition';
import { sortOrdersByModifiedDesc } from '../../utils/orderListSort';
import {
  type OrderHubFilter,
  matchesOrderHub,
  orderToPhaseInput,
  resolveOrderPhase,
} from '../../utils/orderPhase';
import type { ClientRootStackParamList } from '../../navigation/types';
import type { Order } from '../../types/agent';

/** Lightweight summary chip replaces heavy StatTile cards */
function SummaryChip({
  icon,
  color,
  value,
  label,
}: {
  icon: string;
  color: string;
  value: number;
  label: string;
}) {
  const { colors } = useTheme();
  if (value === 0) return null;
  return (
    <View style={[styles.summaryChip, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <MaterialCommunityIcons name={icon as never} size={15} color={color} />
      <Text style={[styles.summaryChipValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryChipLabel, { color: colors.text.secondary }]}>{label}</Text>
    </View>
  );
}

export default function ClientOrdersScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const locale = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const { orders, loading, error, stats, fetchOrders, refresh } = useClientOrders();
  const listBottomPadding = useMainTabContentBottomPadding();
  const [hubSegment, setHubSegment] = useState<OrderHubFilter>('all');
  const [searchDraft, setSearchDraft] = useState('');
  const navigation = useNavigation();
  const rootNav = navigation.getParent<NativeStackNavigationProp<ClientRootStackParamList>>();

  const listData = useMemo(() => {
    const filtered = orders.filter((order) =>
      matchesOrderHub(resolveOrderPhase(orderToPhaseInput(order), 'client'), hubSegment)
    );
    return sortOrdersByModifiedDesc(filtered);
  }, [hubSegment, orders]);

  const groupInactive = hubSegment === 'all' || hubSegment === 'past';
  const { active, completed, cancelled, hasInactive } = useOrdersActivityPartition(
    listData,
    groupInactive
  );

  const applySearch = useCallback(() => {
    void fetchOrders(searchDraft.trim() ? { search: searchDraft.trim() } : {});
  }, [fetchOrders, searchDraft]);

  const clearSearch = useCallback(() => {
    setSearchDraft('');
    void fetchOrders({});
  }, [fetchOrders]);

  const onSearchSubmit = useCallback(() => {
    applySearch();
  }, [applySearch]);

  const renderItem = useCallback(
    ({ item }: { item: Order }) => (
      <ClientOrderListRow
        order={item}
        locale={locale}
        onPress={() => rootNav?.navigate('OrderDetail', { orderId: item.id })}
        onOrderMutated={refresh}
        onRatePress={(mode) =>
          rootNav?.navigate('OrderDetail', { orderId: item.id, rate: mode })
        }
      />
    ),
    [locale, refresh, rootNav]
  );

  const listHeader = useMemo(
    () => (
      <View style={{ paddingTop: spacing.md }}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text variant="headlineSmall" style={[typography.h5, { color: colors.text.primary }]}>
              {t('client.orders.title', 'My orders')}
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: 4 }}>
              {t('client.orders.subtitle', 'Track the status and history of your orders')}
            </Text>
          </View>
          <IconButton
            icon="refresh"
            mode="contained-tonal"
            onPress={() => void refresh()}
            accessibilityLabel={t('common.refresh', 'Refresh')}
          />
        </View>

        {loading && orders.length === 0 ? (
          <ActivityIndicator style={{ marginVertical: spacing.lg }} size="large" />
        ) : null}

        {error ? (
          <View style={[styles.banner, { borderColor: colors.error.main, backgroundColor: colors.surface, marginBottom: spacing.md }]}>
            <Text style={{ color: colors.error.main, flex: 1 }}>{error}</Text>
            <Button mode="text" onPress={() => void refresh()} compact>
              {t('common.retry', 'Retry')}
            </Button>
          </View>
        ) : null}

        {!loading || orders.length > 0 ? (
          <>
            {/* Search bar */}
            <View style={[styles.searchRow, { marginBottom: spacing.sm }]}>
              <SearchInput
                value={searchDraft}
                onChangeText={setSearchDraft}
                onSubmitEditing={onSearchSubmit}
                onClear={clearSearch}
                placeholder={t('client.orders.searchPlaceholder', 'Order number, store...')}
                containerStyle={styles.searchInput}
              />
            </View>

            {/* Summary chips — lightweight replacement for StatTile grid */}
            {stats.total > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.summaryRow, { paddingBottom: spacing.xs }]}
              >
                <SummaryChip
                  icon="shopping"
                  color={colors.primary.main}
                  value={stats.total}
                  label={t('client.orders.stats.total', 'Total')}
                />
                <SummaryChip
                  icon="clock-outline"
                  color={colors.warning.main}
                  value={stats.pending}
                  label={t('client.orders.stats.pending', 'Pending')}
                />
                <SummaryChip
                  icon="truck-delivery"
                  color={colors.info.main}
                  value={stats.active}
                  label={t('client.orders.stats.active', 'Active')}
                />
                <SummaryChip
                  icon="check-circle"
                  color={colors.success.main}
                  value={stats.delivered}
                  label={t('client.orders.stats.delivered', 'Delivered')}
                />
              </ScrollView>
            ) : null}

            <SegmentedButtons
              value={hubSegment}
              onValueChange={(value) => setHubSegment(value as OrderHubFilter)}
              buttons={[
                {
                  value: 'all',
                  label: t('orders.hub.all', 'All'),
                },
                {
                  value: 'action_needed',
                  label: t('orders.hub.actionNeeded', 'Action needed'),
                },
                {
                  value: 'waiting',
                  label: t('orders.hub.waiting', 'Waiting'),
                },
                {
                  value: 'past',
                  label: t('orders.hub.past', 'Past'),
                },
              ]}
              style={{ marginBottom: spacing.md, marginTop: spacing.xs }}
            />

            {hasInactive && active.length > 0 ? (
              <Text
                variant="titleSmall"
                style={{
                  color: colors.text.primary,
                  fontWeight: '700',
                  marginBottom: spacing.sm,
                }}
              >
                {t('orders.sections.activeOrders', 'Active orders')}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    ),
    [
      active.length,
      clearSearch,
      colors,
      error,
      hasInactive,
      loading,
      onSearchSubmit,
      orders.length,
      searchDraft,
      spacing,
      stats,
      t,
      hubSegment,
      typography.h5,
      refresh,
    ]
  );

  const listFooter = useMemo(
    () =>
      groupInactive ? (
        <OrdersActivityGroupedFooter
          completed={completed}
          cancelled={cancelled}
          renderOrder={(order) => (
            <ClientOrderListRow
              order={order}
              locale={locale}
              onPress={() => rootNav?.navigate('OrderDetail', { orderId: order.id })}
              onOrderMutated={refresh}
              onRatePress={(mode) =>
                rootNav?.navigate('OrderDetail', { orderId: order.id, rate: mode })
              }
            />
          )}
        />
      ) : null,
    [
      cancelled,
      completed,
      groupInactive,
      locale,
      refresh,
      rootNav,
    ]
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.pageBackground }]} edges={['top']}>
      <FlatList
        data={active}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={{ paddingBottom: listBottomPadding, paddingHorizontal: spacing.md }}
        refreshControl={<RefreshControl refreshing={loading && orders.length > 0} onRefresh={() => void refresh()} />}
        ListEmptyComponent={
          loading || hasInactive ? null : (
            <View style={{ padding: spacing.lg }}>
              <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
                {hubSegment === 'action_needed'
                  ? t(
                      'orders.hub.emptyActionNeeded',
                      'Nothing needs your attention right now.'
                    )
                  : hubSegment === 'waiting'
                    ? t('orders.hub.emptyWaiting', 'No orders waiting.')
                    : hubSegment === 'past'
                      ? t('orders.hub.emptyPast', 'No past orders yet.')
                      : t(
                          'orders.hub.emptyAll',
                          'When you place an order, it will appear here.'
                        )}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1 },
  summaryRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryChipValue: {
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  summaryChipLabel: {
    fontSize: 12,
    fontWeight: '500',
    includeFontPadding: false,
  },
  banner: { padding: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
