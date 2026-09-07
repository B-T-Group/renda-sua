import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { PagedCarousel } from '../common/PagedCarousel';
import { ClientHomeOrderCard } from './ClientHomeOrderCard';
import type { Order } from '../../types/agent';
import {
  buildClientHomeOrderCardModel,
  type ClientHomeOrderCardModel,
} from '../../utils/buildClientHomeOrderCardModel';

export interface ClientHomeOrdersStripProps {
  orders: Order[];
  totalActive: number;
  onOpenOrder: (order: Order) => void;
  onSeeAll?: () => void;
}

export function ClientHomeOrdersStrip({
  orders,
  totalActive,
  onOpenOrder,
  onSeeAll,
}: ClientHomeOrdersStripProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  const [pageWidth, setPageWidth] = useState(0);

  const models = useMemo(
    () =>
      orders.map((order) => ({
        order,
        model: buildClientHomeOrderCardModel(order),
      })),
    [orders]
  );

  const renderItem = useCallback(
    ({
      item,
      width,
    }: {
      item: { order: Order; model: ClientHomeOrderCardModel };
      index: number;
      width: number;
    }) => (
      <ClientHomeOrderCard
        model={item.model}
        width={width}
        onPressCard={() => onOpenOrder(item.order)}
        onPressCta={() => onOpenOrder(item.order)}
      />
    ),
    [onOpenOrder]
  );

  if (models.length === 0) return null;

  return (
    <View
      style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
      onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
    >
      <View
        style={[
          styles.header,
          { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
        ]}
      >
        <Text
          variant="titleSmall"
          style={[typography.subtitle2, { color: colors.text.primary, fontWeight: '700' }]}
        >
          {t('client.home.liveOrders.title', 'In progress')}
        </Text>
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: colors.primaryTint,
              borderRadius: borderRadius.full,
            },
          ]}
        >
          <Text
            variant="labelSmall"
            style={{ color: colors.primary.main, fontWeight: '700' }}
          >
            {totalActive}
          </Text>
        </View>
      </View>

      {pageWidth > 0 ? (
        <PagedCarousel
          data={models}
          keyExtractor={(item) => item.order.id}
          renderItem={renderItem}
          pageWidth={pageWidth}
          autoAdvanceMs={null}
          showDots={models.length > 1}
        />
      ) : null}

      {onSeeAll && totalActive > orders.length ? (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.seeAll,
            {
              marginHorizontal: spacing.md,
              marginTop: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            variant="labelMedium"
            style={{ color: colors.primary.main, fontWeight: '600' }}
          >
            {t('client.home.liveOrders.seeAll', 'View all {{count}} orders', {
              count: totalActive,
            })}
          </Text>
          <MaterialCommunityIcons
            name="arrow-right"
            size={16}
            color={colors.primary.main}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
