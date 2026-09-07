import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import type { DeliveryOrderViewModel, ProductListItem } from '../../orders/model';

export interface DeliveryPackageCardProps {
  packageInfo: DeliveryOrderViewModel['packageInfo'];
}

function packageSummary(
  info: DeliveryOrderViewModel['packageInfo'],
  t: (key: string, defaultValue: string, options?: Record<string, unknown>) => string
): string {
  const parts = [
    t('orders.delivery.package.itemCount', '{{count}} items', {
      count: info.itemCount,
    }),
    t('orders.delivery.package.packageCount', '{{count}} packages', {
      count: info.packageCount,
    }),
  ];
  if (info.weightLabel) parts.push(info.weightLabel);
  if (info.dimensionsLabel) parts.push(info.dimensionsLabel);
  return parts.join(' · ');
}

function ItemRow({ item, currency }: { item: ProductListItem; currency?: string | null }) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.itemRow, { borderBottomColor: colors.divider, paddingVertical: spacing.sm }]}>
      <Text variant="bodyMedium" numberOfLines={2} style={{ color: colors.text.primary }}>
        {item.name}
      </Text>
      <Text variant="labelSmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
        {t('agent.orders.detail.quantity', 'Quantity')}: {item.quantity}
        {currency && item.unitPrice != null ? ` · ${item.unitPrice} ${currency}` : ''}
      </Text>
    </View>
  );
}

export function DeliveryPackageCard({ packageInfo }: DeliveryPackageCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ fontWeight: '700' }}>
        {t('orders.delivery.packageInfo', 'Package information')}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {packageSummary(packageInfo, t as never)}
      </Text>
      {packageInfo.properties.length > 0 ? (
        <View style={[styles.chipRow, { gap: spacing.xs }]}>
          {packageInfo.properties.map((p) => (
            <StatusPill
              key={p.id}
              compact
              label={p.label}
              backgroundColor={colors.primaryTint}
              textColor={colors.primary.main}
              borderColor={colors.primary.main + '44'}
            />
          ))}
        </View>
      ) : null}
      {packageInfo.items.map((item) => (
        <ItemRow key={item.id} item={item} currency={item.currency} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  itemRow: { borderBottomWidth: StyleSheet.hairlineWidth },
});
