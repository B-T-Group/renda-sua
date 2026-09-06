/**
 * OrderListView
 *
 * Extracts the list-based order display into a standalone, reusable component.
 * This separation allows the OpenOrdersScreen (and future screens) to swap
 * between list and map views without duplicating data-fetching logic.
 *
 * Usage:
 *   <OrderListView
 *     orders={orders}
 *     onAccept={handleAccept}
 *     onViewDetails={handleViewDetails}
 *     busyOrderId={busyOrderId}
 *     ListHeaderComponent={<SearchBar />}
 *     refreshing={loading}
 *     onRefresh={refetch}
 *   />
 */

import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { OrderCardCompact } from '../agent/OrderCardCompact';
import type { Order } from '../../types/agent';

export interface OrderListViewProps {
  orders: Order[];
  onAccept: (order: Order) => void;
  onViewDetails: (orderId: string) => void;
  busyOrderId?: string | null;
  ListHeaderComponent?: React.ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentBottomPadding?: number;
}

export function OrderListView({
  orders,
  onAccept,
  onViewDetails,
  busyOrderId,
  ListHeaderComponent,
  refreshing = false,
  onRefresh,
  contentBottomPadding = 24,
}: OrderListViewProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <FlatList
      data={orders}
      keyExtractor={(item) => item.id}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary.main]} />
        ) : undefined
      }
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={
        !refreshing ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="package-variant-closed" size={44} color={colors.text.disabled} />
            <Text variant="titleSmall" style={{ color: colors.text.secondary, marginTop: 10, textAlign: 'center' }}>
              {t('agent.orders.noAvailableOrders', 'No available orders right now')}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.disabled, marginTop: 4, textAlign: 'center' }}>
              {t('agent.orders.noAvailableOrdersHint', 'Check back soon or go online to receive alerts')}
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <OrderCardCompact
          order={item}
          onAccept={() => onAccept(item)}
          onViewDetails={() => onViewDetails(item.id)}
          isBusy={busyOrderId === item.id}
        />
      )}
      contentContainerStyle={{ paddingBottom: contentBottomPadding }}
    />
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    gap: 4,
  },
});
