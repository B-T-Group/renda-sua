import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessOrder } from '../../types/business/orders';
import { isCookedFoodStartCookingPriority } from '../../utils/cookedFoodOrder';

interface Props {
  orders: BusinessOrder[];
  onOpenOrder: (orderId: string) => void;
}

export function CookedFoodStartCookingCarousel({ orders, onOpenOrder }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const priority = orders.filter((o) => isCookedFoodStartCookingPriority(o));
  if (priority.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: spacing.sm }}>
        {t('orders.cookedFood.startCookingTitle', 'Start cooking')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {priority.map((order) => (
          <View
            key={order.id}
            style={[
              styles.card,
              shadows.sm,
              {
                borderColor: colors.warning.main,
                backgroundColor: colors.background.paper,
                borderRadius: borderRadius.lg,
                marginRight: spacing.sm,
                padding: spacing.md,
                maxWidth: 280,
              },
            ]}
          >
            <Text variant="titleSmall" style={{ fontWeight: '700' }}>
              #{order.order_number}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginVertical: spacing.xs }}>
              {t(
                'orders.cookedFood.startCookingCard',
                'Paid cooked-food pickup — start preparing now.'
              )}
            </Text>
            <Button mode="contained" onPress={() => onOpenOrder(order.id)}>
              {t('orders.cookedFood.openOrder', 'Open order')}
            </Button>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
});
