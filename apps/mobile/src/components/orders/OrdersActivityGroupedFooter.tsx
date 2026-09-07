import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ExpandableSection } from '../common/ExpandableSection';
import { useTheme } from '../../contexts/ThemeContext';

export interface OrdersActivityGroupedFooterProps<
  T extends { id: string; current_status?: string | null },
> {
  completed: T[];
  cancelled: T[];
  renderOrder: (order: T) => React.ReactNode;
}

/**
 * Collapsed completed + cancelled blocks for the bottom of an orders FlatList.
 */
export function OrdersActivityGroupedFooter<
  T extends { id: string; current_status?: string | null },
>({ completed, cancelled, renderOrder }: OrdersActivityGroupedFooterProps<T>) {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  if (completed.length === 0 && cancelled.length === 0) {
    return null;
  }

  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      {completed.length > 0 ? (
        <ExpandableSection
          title={t('orders.sections.completedOrders', 'Completed orders')}
          count={completed.length}
          defaultExpanded={false}
        >
          <View style={{ gap: spacing.sm }}>
            {completed.map((order) => (
              <View key={order.id}>{renderOrder(order)}</View>
            ))}
          </View>
        </ExpandableSection>
      ) : null}
      {cancelled.length > 0 ? (
        <ExpandableSection
          title={t('orders.sections.cancelledOrders', 'Cancelled orders')}
          count={cancelled.length}
          defaultExpanded={false}
        >
          <View style={{ gap: spacing.sm }}>
            {cancelled.map((order) => (
              <View key={order.id}>{renderOrder(order)}</View>
            ))}
          </View>
        </ExpandableSection>
      ) : null}
    </View>
  );
}
