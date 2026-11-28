import React from 'react';
import { Pressable, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { exportOrderNeedsAction } from '../../utils/exportOrders/exportOrderStatus';
import { ExportOrderStatusBadge } from './ExportOrderStatusBadge';
import type { ExportOrderRow } from '../../services/exportOrdersApi';

function itemsSummary(order: ExportOrderRow, more: (count: number) => string): string | null {
  const lines = order.lines ?? [];
  if (lines.length === 0) return null;
  const first = `${lines[0].quantity} × ${lines[0].product_name}`;
  return lines.length > 1 ? `${first} ${more(lines.length - 1)}` : first;
}

export function ExportOrderListCard({ order, onPress }: { order: ExportOrderRow; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const needsAction = exportOrderNeedsAction(order.status);
  const accent = needsAction ? colors.warning.main : colors.primary.main;
  const summary = itemsSummary(order, (count) => t('exportOrders.moreItems', '+{{count}} more', { count }));
  return (
    <Pressable
      testID={`export-order-row-${order.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.card,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: needsAction ? `${accent}66` : colors.divider,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: borderRadius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${accent}14`,
        }}
      >
        <MaterialCommunityIcons name="airplane" size={24} color={accent} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="titleMedium">{order.bc_number}</Text>
        {summary ? (
          <Text variant="bodySmall" numberOfLines={1} style={{ color: colors.text.secondary }}>
            {summary}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
          <ExportOrderStatusBadge status={order.status} />
          {order.created_at ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {new Date(order.created_at).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text.secondary} />
    </Pressable>
  );
}
