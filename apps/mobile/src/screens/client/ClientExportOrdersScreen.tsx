import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useExportOrders } from '../../hooks/useExportOrders';
import { ExportOrderStatusBadge } from '../../components/exportOrders/ExportOrderStatusBadge';
import type { ExportOrderRow } from '../../services/exportOrdersApi';
import type { ClientRootStackParamList } from '../../navigation/types';

export default function ClientExportOrdersScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const { listMine } = useExportOrders();
  const [rows, setRows] = useState<ExportOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows((await listMine(1, 50))?.items ?? []);
    } catch {
      setError(t('exportOrders.loadError', 'Could not load your export orders'));
    } finally {
      setLoading(false);
    }
  }, [listMine, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && rows.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      data={rows}
      keyExtractor={(row) => row.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.sm }}>
          <Text variant="headlineSmall">{t('exportOrders.myOrders', 'My export orders')}</Text>
          <Text style={{ color: colors.text.secondary }}>
            {t('exportOrders.myOrdersHint', 'Track your purchase order, proforma approval, and delivery.')}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text.secondary }}>
            {error || t('exportOrders.empty', 'No export orders yet.')}
          </Text>
          {error ? (
            <Button mode="outlined" onPress={() => void load()}>
              {t('common.retry', 'Retry')}
            </Button>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          testID={`export-order-row-${item.id}`}
          onPress={() => navigation.navigate('ClientExportOrderDetail', { orderId: item.id })}
          style={{
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.divider,
            gap: spacing.xs,
          }}
        >
          <Text variant="titleMedium">{item.bc_number}</Text>
          <ExportOrderStatusBadge status={item.status} />
          {item.created_at ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}
