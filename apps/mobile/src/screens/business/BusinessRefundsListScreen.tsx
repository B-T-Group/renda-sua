import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Appbar, Card, Chip, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BusinessRootStackParamList } from '@/navigation/types';
import { useOrderRefunds } from '@/hooks/useOrderRefunds';
import { spacing } from '@/theme';

type Props = NativeStackScreenProps<BusinessRootStackParamList, 'BusinessRefundsList'>;

interface RefundRow {
  id: string;
  reason: string;
  status: string;
  destination?: string | null;
  created_at: string;
  order?: {
    id: string;
    order_number: string;
    currency?: string;
    subtotal?: number;
  };
}

export default function BusinessRefundsListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { listRefundRequests, loading } = useOrderRefunds();
  const [rows, setRows] = useState<RefundRow[]>([]);

  const load = useCallback(async () => {
    const data = await listRefundRequests();
    setRows((data?.refundRequests as RefundRow[]) ?? []);
  }, [listRefundRequests]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.root}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('orders.refunds.centerTitle', 'Refund Center')} />
      </Appbar.Header>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text variant="bodyMedium" style={styles.empty}>
            {t('orders.refunds.empty', 'No pending refund requests.')}
          </Text>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => item.order?.id && navigation.navigate('BusinessOrderDetail', { orderId: item.order.id })}>
            <Card.Content>
              <Text variant="titleMedium">{item.order?.order_number ?? '—'}</Text>
              <Text variant="bodySmall">{t(`orders.refunds.reasons.${item.reason}`, item.reason)}</Text>
              {item.destination ? (
                <Chip compact style={styles.chip}>
                  {item.destination === 'stripe'
                    ? t('orders.refunds.destination.card', 'Card refund')
                    : t('orders.refunds.destination.wallet', 'Wallet')}
                </Chip>
              ) : null}
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: spacing.md, gap: spacing.sm },
  card: { marginBottom: spacing.sm },
  chip: { alignSelf: 'flex-start', marginTop: spacing.xs },
  empty: { textAlign: 'center', marginTop: spacing.xl, opacity: 0.7 },
});
