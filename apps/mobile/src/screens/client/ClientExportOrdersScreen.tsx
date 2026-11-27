import { FlatList, RefreshControl, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientExportOrders } from '../../hooks/useClientExportOrders';
import type { ExportOrderSummary } from '../../services/exportOrdersApi';

function ExportOrderRow({ row }: { row: ExportOrderSummary }) {
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.divider,
      }}
    >
      <Text variant="titleMedium">{row.bc_number || row.id.slice(0, 8)}</Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {row.business?.name || '—'} · {new Date(row.created_at).toLocaleDateString()}
      </Text>
      <Text variant="labelSmall" style={{ marginTop: 4 }}>
        {row.status}
      </Text>
    </View>
  );
}

export default function ClientExportOrdersScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { rows, loading, error, load } = useClientExportOrders();

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
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      ListHeaderComponent={
        <Text variant="bodyMedium" style={{ marginBottom: spacing.md, color: colors.text.secondary }}>
          {t('exportOrders.myOrdersHint', 'Track bon de commande, proforma approval, and delivery.')}
        </Text>
      }
      ListEmptyComponent={
        <Text style={{ color: colors.text.secondary }}>
          {error || t('exportOrders.empty', 'No export orders yet.')}
        </Text>
      }
      renderItem={({ item }) => <ExportOrderRow row={item} />}
    />
  );
}
