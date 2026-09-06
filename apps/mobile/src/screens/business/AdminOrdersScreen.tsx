import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { Button, SegmentedButtons, Text } from 'react-native-paper';
import { AdminOrderCard } from '../../components/admin/orders/AdminOrderCard';
import { useTheme } from '../../contexts/ThemeContext';
import { useAdminOrdersList } from '../../hooks/useAdminOrdersList';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type { AdminOrderQueue, AdminOrderRow } from '../../types/adminOrders';

type Props = NativeStackScreenProps<
  BusinessRootStackParamList,
  'AdminOrders'
>;

export default function AdminOrdersScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const list = useAdminOrdersList();

  const openOrder = useCallback(
    (orderId: string) => navigation.navigate('AdminOrderDetail', { orderId }),
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: AdminOrderRow }) => (
      <AdminOrderCard order={item} onPress={openOrder} />
    ),
    [openOrder]
  );

  if (list.profileLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!list.canAccess) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text
          variant="titleMedium"
          style={{ color: colors.text.primary, textAlign: 'center' }}
        >
          {t('admin.orders.accessDenied', 'Access denied')}
        </Text>
        <Text
          style={[
            typography.body2,
            {
              color: colors.text.secondary,
              textAlign: 'center',
              marginTop: spacing.xs,
            },
          ]}
        >
          {t(
            'admin.orders.accessDeniedHelp',
            'Order operations needs the cross-business orders permission on your account.'
          )}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <SegmentedButtons
          value={list.queue}
          onValueChange={(value) => list.changeQueue(value as AdminOrderQueue)}
          buttons={[
            {
              value: 'at_risk',
              label: `${t('admin.orders.queueAtRisk', 'Needs attention')} (${list.counts.at_risk})`,
            },
            {
              value: 'all',
              label: `${t('admin.orders.queueAll', 'All')} (${list.counts.total})`,
            },
          ]}
        />
        <RNTextInput
          value={list.search}
          onChangeText={list.onSearchChange}
          placeholder={t(
            'admin.orders.searchPlaceholder',
            'Order number, client, or business'
          )}
          placeholderTextColor={colors.text.secondary}
          returnKeyType="search"
          style={{
            borderWidth: 1,
            borderColor: colors.divider,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            color: colors.text.primary,
            backgroundColor: colors.surface,
          }}
        />
        <Text style={[typography.caption, { color: colors.text.secondary }]}>
          {t('admin.orders.criticalCount', '{{count}} critical', {
            count: list.counts.critical,
          })}
          {' · '}
          {t('admin.orders.warningCount', '{{count}} warning', {
            count: list.counts.warning,
          })}
        </Text>
      </View>

      {list.loading && !list.refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={list.orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: spacing.md,
            gap: spacing.md,
            paddingBottom: spacing.xl,
          }}
          refreshControl={
            <RefreshControl
              refreshing={list.refreshing}
              onRefresh={list.refresh}
            />
          }
          ListEmptyComponent={
            <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
              {list.error ||
                (list.queue === 'at_risk'
                  ? t(
                      'admin.orders.emptyAtRisk',
                      'Nothing needs attention right now.'
                    )
                  : t('admin.orders.noOrders', 'No orders found'))}
            </Text>
          }
          ListFooterComponent={
            list.totalPages > 1 ? (
              <View style={[styles.pager, { marginTop: spacing.md }]}>
                <Button
                  disabled={list.page <= 1}
                  onPress={() => list.setPage(Math.max(1, list.page - 1))}
                >
                  {t('common.previous', 'Previous')}
                </Button>
                <Text
                  style={[typography.caption, { color: colors.text.secondary }]}
                >
                  {t('admin.orders.pageOf', 'Page {{page}} of {{total}}', {
                    page: list.page,
                    total: list.totalPages,
                  })}
                </Text>
                <Button
                  disabled={list.page >= list.totalPages}
                  onPress={() =>
                    list.setPage(Math.min(list.totalPages, list.page + 1))
                  }
                >
                  {t('common.next', 'Next')}
                </Button>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
