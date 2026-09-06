import { Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Divider, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { OrderItem } from '../../types/agent';
import type { BusinessOrder } from '../../types/business/orders';
import { orderItemImageUrl } from '../../utils/clientOrderListDisplay';
import {
  businessOrderLineCount,
  businessOrderUnitsCount,
} from '../../utils/businessOrderListDisplay';
import { formatCurrency } from '../../utils/formatters';

const THUMB = 56;

function itemName(item: OrderItem): string {
  return item.item?.name ?? item.item_name ?? '—';
}

type Props = {
  order: BusinessOrder;
  locale: string;
  cardStyle: object;
};

export function BusinessOrderItemsCard({ order, locale, cardStyle }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const cur = order.currency || 'XAF';
  const items = order.order_items ?? [];
  const lineCount = businessOrderLineCount(order);
  const units = businessOrderUnitsCount(order);

  return (
    <View style={cardStyle}>
      <Text variant="titleSmall" style={{ fontWeight: '700' }}>
        {t('business.orders.itemsHeader', 'Order items ({{lines}} · {{units}} units)', {
          lines: lineCount,
          units,
        })}
      </Text>
      <Divider style={{ marginVertical: spacing.sm }} />
      {items.map((oi, idx) => {
        const uri = orderItemImageUrl(oi);
        const lineTotal =
          oi.total_price ?? (oi.unit_price != null ? oi.unit_price * (oi.quantity || 1) : undefined);
        return (
          <View
            key={oi.id}
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              marginBottom: idx < items.length - 1 ? spacing.md : 0,
              paddingBottom: idx < items.length - 1 ? spacing.md : 0,
              borderBottomWidth: idx < items.length - 1 ? 1 : 0,
              borderBottomColor: colors.divider,
            }}
          >
            <View
              style={{
                width: THUMB,
                height: THUMB,
                borderRadius: borderRadius.sm,
                backgroundColor: colors.divider,
                overflow: 'hidden',
              }}
            >
              {uri ? <Image source={{ uri }} style={{ width: THUMB, height: THUMB }} resizeMode="cover" /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyLarge" style={{ fontWeight: '600' }} numberOfLines={2}>
                {itemName(oi)}
              </Text>
              {oi.variant_name ? (
                <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                  {oi.variant_name}
                </Text>
              ) : null}
              <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
                {t('orders.quantity', 'Qty')}: {oi.quantity}
                {oi.unit_price != null ? ` · ${formatCurrency(oi.unit_price, cur, locale)}` : ''}
              </Text>
              {oi.special_instructions ? (
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4, fontStyle: 'italic' }}>
                  {oi.special_instructions}
                </Text>
              ) : null}
            </View>
            {lineTotal != null ? (
              <Text variant="bodyMedium" style={{ fontWeight: '600', alignSelf: 'center' }}>
                {formatCurrency(lineTotal, cur, locale)}
              </Text>
            ) : null}
          </View>
        );
      })}
      {order.special_instructions ? (
        <>
          <Divider style={{ marginVertical: spacing.sm }} />
          <Text variant="labelMedium" style={{ color: colors.text.secondary }}>
            {t('business.orders.detailOrderNotes', 'Order notes')}
          </Text>
          <Text variant="bodyMedium" style={{ marginTop: spacing.xxs }}>
            {order.special_instructions}
          </Text>
        </>
      ) : null}
    </View>
  );
}
