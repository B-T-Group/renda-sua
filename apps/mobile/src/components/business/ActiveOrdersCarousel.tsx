import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Platform, UIManager, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { PagedCarousel } from '../common/PagedCarousel';
import { ActiveOrderCard } from './ActiveOrderCard';
import type { BusinessOrder } from '../../types/business/orders';
import {
  buildActiveOrderCardModel,
  type ActiveOrderCardModel,
} from '../../utils/buildActiveOrderCardModel';
import { useOrderViewModelContext } from '../../orders/model/useOrderViewModelContext';
import { useLanguage } from '../../hooks/useLanguage';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface ActiveOrdersCarouselProps {
  orders: BusinessOrder[];
  onOpenOrder: (order: BusinessOrder, model: ActiveOrderCardModel) => void;
  onPressCta: (order: BusinessOrder, model: ActiveOrderCardModel) => void;
}

export function ActiveOrdersCarousel({
  orders,
  onOpenOrder,
  onPressCta,
}: ActiveOrdersCarouselProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const vmCtx = useOrderViewModelContext();
  const { currentLanguage } = useLanguage();
  const locale = currentLanguage === 'fr' ? 'fr-FR' : 'en-US';
  const [pageWidth, setPageWidth] = useState(0);
  const prevIdsRef = useRef<string[]>([]);
  const fade = useRef(new Animated.Value(1)).current;

  const models = useMemo(
    () =>
      orders.map((order) => ({
        order,
        model: buildActiveOrderCardModel(order, vmCtx.t, locale),
      })),
    [orders, vmCtx.t, locale]
  );

  useEffect(() => {
    const nextIds = orders.map((o) => o.id);
    const removed = prevIdsRef.current.some((id) => !nextIds.includes(id));
    if (removed && prevIdsRef.current.length > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      fade.setValue(0.85);
      Animated.timing(fade, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
    prevIdsRef.current = nextIds;
  }, [orders, fade]);

  const renderItem = useCallback(
    ({
      item,
      width,
    }: {
      item: { order: BusinessOrder; model: ActiveOrderCardModel };
      index: number;
      width: number;
    }) => (
      <ActiveOrderCard
        model={item.model}
        width={width}
        onPressCard={() => onOpenOrder(item.order, item.model)}
        onPressCta={() => onPressCta(item.order, item.model)}
      />
    ),
    [onOpenOrder, onPressCta]
  );

  if (orders.length === 0) return null;

  return (
    <Animated.View
      style={{ opacity: fade, marginBottom: spacing.md }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - pageWidth) > 1) setPageWidth(w);
      }}
      accessibilityRole="summary"
      accessibilityLabel={t(
        'business.dashboard.activeOrders.sectionA11y',
        'Active orders, {{count}}',
        { count: orders.length }
      )}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
          paddingHorizontal: 0,
        }}
      >
        <Text
          style={[
            typography.overline,
            { color: colors.text.secondary, letterSpacing: 0.8 },
          ]}
        >
          {t('business.dashboard.activeOrders.sectionTitle', 'Active orders')}
        </Text>
        <Text variant="labelLarge" style={{ color: colors.primary.main }}>
          {orders.length}
        </Text>
      </View>
      {pageWidth > 0 ? (
        <PagedCarousel
          data={models}
          keyExtractor={(item) => item.order.id}
          renderItem={renderItem}
          pageWidth={pageWidth}
          autoAdvanceMs={null}
          showDots={orders.length > 1}
          accessibilityLabelForIndex={(index, total) =>
            t(
              'business.dashboard.activeOrders.pageA11y',
              'Order {{current}} of {{total}}',
              { current: index + 1, total }
            )
          }
        />
      ) : (
        <View style={{ minHeight: 180 }} />
      )}
    </Animated.View>
  );
}
