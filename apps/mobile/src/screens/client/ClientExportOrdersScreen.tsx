import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useExportOrders } from '../../hooks/useExportOrders';
import { ExportOrderListCard } from '../../components/exportOrders/ExportOrderListCard';
import { ExportOrderIllustration } from '../../components/illustrations/ExportOrderIllustration';
import type { ExportOrderRow } from '../../services/exportOrdersApi';
import type { ClientRootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ClientRootStackParamList>;

function EmptyState({ error, onRetry, onBrowse }: { error: string | null; onRetry: () => void; onBrowse: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
      <ExportOrderIllustration label={t('exportOrders.submitted.illustration', 'Purchase order received')} />
      <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
        {error || t('exportOrders.empty', 'No export orders yet.')}
      </Text>
      {error ? (
        <Button mode="outlined" onPress={onRetry}>
          {t('common.retry', 'Retry')}
        </Button>
      ) : (
        <Button mode="contained" onPress={onBrowse}>
          {t('exportOrders.browse', 'Browse exports')}
        </Button>
      )}
    </View>
  );
}

export default function ClientExportOrdersScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
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

  const browseExports = useCallback(() => {
    navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse', params: { segment: 'exports' } });
  }, [navigation]);

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
        <View style={{ marginBottom: spacing.sm, gap: spacing.xxs }}>
          <Text variant="headlineSmall">{t('exportOrders.myOrders', 'My export orders')}</Text>
          <Text style={{ color: colors.text.secondary }}>
            {t('exportOrders.myOrdersHint', 'Track your purchase order, proforma approval, and delivery.')}
          </Text>
        </View>
      }
      ListEmptyComponent={<EmptyState error={error} onRetry={() => void load()} onBrowse={browseExports} />}
      renderItem={({ item }) => (
        <ExportOrderListCard
          order={item}
          onPress={() => navigation.navigate('ClientExportOrderDetail', { orderId: item.id })}
        />
      )}
    />
  );
}
