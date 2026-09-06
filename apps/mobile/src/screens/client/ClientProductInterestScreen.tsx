import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useProductInterest } from '../../hooks/useProductInterest';
import type { ProductInterestRow } from '../../services/productInterestApi';
import { useTheme } from '../../contexts/ThemeContext';

export default function ClientProductInterestScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const navigation = useNavigation<any>();
  const { listClient } = useProductInterest();
  const [rows, setRows] = useState<ProductInterestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listClient(1, 50);
      setRows(data?.items ?? []);
    } catch {
      setError(
        t('productInterest.loadError', 'Could not load interest submissions')
      );
    } finally {
      setLoading(false);
    }
  }, [listClient, t]);

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
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} />
      }
      ListHeaderComponent={
        <Text variant="headlineSmall" style={{ marginBottom: spacing.md }}>
          {t('productInterest.clientTitle', 'My interest requests')}
        </Text>
      }
      ListEmptyComponent={
        <Text style={{ color: colors.text.secondary }}>
          {error ||
            t('productInterest.emptyClient', 'No interest submissions yet.')}
        </Text>
      }
      renderItem={({ item }) => (
        <View
          style={{
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.divider,
          }}
        >
          <Text variant="titleMedium">
            {item.item?.name || t('productInterest.unknownItem', 'Item')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {item.business_location?.name || item.business?.name || '—'}
          </Text>
          {item.client_note ? (
            <Text variant="bodyMedium" style={{ marginTop: spacing.xs }}>
              {item.client_note}
            </Text>
          ) : null}
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {new Date(item.created_at).toLocaleString()}
          </Text>
          <Button
            mode="text"
            onPress={() =>
              navigation.navigate('InventoryItemDetail', {
                inventoryItemId: item.business_inventory_id,
              })
            }
          >
            {t('productInterest.viewItem', 'View item')}
          </Button>
        </View>
      )}
    />
  );
}
