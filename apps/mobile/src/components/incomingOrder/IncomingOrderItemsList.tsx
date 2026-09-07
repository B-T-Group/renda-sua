import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { IncomingOrderDetails } from '../../types/incomingOrder';
import { orderItemImageUrl } from '../../utils/clientOrderListDisplay';
import type { OrderItem } from '../../types/agent';

const THUMB_SIZE = 56;

type Line = NonNullable<IncomingOrderDetails['order_items']>[number];

function lineImageUrl(item: Line): string | null {
  return orderItemImageUrl(item as OrderItem);
}

function ItemThumb({ uri }: { uri: string | null }) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const label = uri
    ? t('incomingOrder.itemImage', 'Product image')
    : t('incomingOrder.itemImagePlaceholder', 'Product image placeholder');
  return (
    <View
      style={[
        styles.thumb,
        {
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: borderRadius.md,
          backgroundColor: colors.divider,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
          resizeMode="cover"
        />
      ) : (
        <MaterialCommunityIcons
          name="package-variant"
          size={28}
          color={colors.text.secondary}
        />
      )}
    </View>
  );
}

export function IncomingOrderItemsList({
  items,
}: {
  items: NonNullable<IncomingOrderDetails['order_items']>;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((item, idx) => (
        <View
          key={item.id ?? `${item.item_name ?? 'item'}-${idx}`}
          style={[
            styles.itemRow,
            { borderColor: colors.divider ?? colors.text.disabled + '40' },
          ]}
        >
          <ItemThumb uri={lineImageUrl(item)} />
          <View
            style={[
              styles.qtyBadge,
              {
                backgroundColor: colors.primaryTint,
                borderRadius: borderRadius.sm,
                marginLeft: spacing.sm,
              },
            ]}
          >
            <Text
              variant="labelMedium"
              style={{ color: colors.primary.main, fontWeight: '700' }}
            >
              {item.quantity ?? 1}×
            </Text>
          </View>
          <Text
            variant="bodyMedium"
            style={{
              color: colors.text.primary,
              flex: 1,
              minWidth: 0,
              marginLeft: spacing.sm,
            }}
            numberOfLines={2}
          >
            {item.item_name || item.item?.name || t('incomingOrder.item', 'Item')}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 36,
  },
});
