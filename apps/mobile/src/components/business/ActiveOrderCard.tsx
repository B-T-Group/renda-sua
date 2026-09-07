import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { StatusPill } from '../common/StatusPill';
import { orderStatusStripeColor } from '../../utils/clientOrderListDisplay';
import {
  receivedAgoParts,
  type ActiveOrderCardModel,
  type ActiveOrderCardUrgency,
} from '../../utils/buildActiveOrderCardModel';

export interface ActiveOrderCardProps {
  model: ActiveOrderCardModel;
  width: number;
  onPressCard: () => void;
  onPressCta: () => void;
}

function urgencyBorder(
  urgency: ActiveOrderCardUrgency,
  colors: ReturnType<typeof useTheme>['colors']
): string {
  if (urgency === 'warning') return colors.warning.main;
  if (urgency === 'primary') return colors.primary.main;
  if (urgency === 'info') return colors.info.main;
  return colors.divider;
}

export function ActiveOrderCard({
  model,
  width,
  onPressCard,
  onPressCta,
}: ActiveOrderCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const stripe = orderStatusStripeColor(model.status, colors);
  const borderColor = urgencyBorder(model.urgency, colors);
  const ago = useMemo(() => receivedAgoParts(model.createdAt), [model.createdAt]);
  const receivedLabel =
    ago.count != null
      ? t(ago.key, ago.defaultValue, { count: ago.count })
      : t(ago.key, ago.defaultValue);
  const itemLabel = t(
    'business.dashboard.activeOrders.itemCount',
    '{{count}} items',
    { count: model.itemCount }
  );

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          width: Math.max(0, width - spacing.md * 2),
          marginHorizontal: spacing.md,
          borderRadius: borderRadius.lg,
          borderColor,
          backgroundColor: colors.background.paper,
        },
      ]}
    >
      <Pressable
        onPress={onPressCard}
        accessibilityRole="button"
        accessibilityLabel={t(
          'business.dashboard.activeOrders.cardA11y',
          'Order {{number}}, {{title}}',
          {
            number: model.orderNumber,
            title: t(model.titleKey, model.titleDefault),
          }
        )}
        style={({ pressed }) => [
          styles.body,
          { opacity: pressed ? 0.96 : 1, paddingBottom: spacing.sm },
        ]}
      >
        <Text
          variant="titleMedium"
          style={{ color: colors.text.primary, fontWeight: '700' }}
          numberOfLines={1}
        >
          {t(model.titleKey, model.titleDefault)}
        </Text>
        <Text
          variant="labelLarge"
          style={{ color: colors.primary.main, marginTop: spacing.xxs }}
          numberOfLines={1}
        >
          {t('business.dashboard.activeOrders.orderNumber', 'Order #{{number}}', {
            number: model.orderNumber,
          })}
        </Text>
        {model.customerName ? (
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.secondary, marginTop: spacing.xxs }}
            numberOfLines={1}
          >
            {model.customerName}
          </Text>
        ) : null}
        <View style={[styles.metaRow, { marginTop: spacing.sm, gap: spacing.sm }]}>
          <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
            {itemLabel}
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.primary, fontWeight: '600' }}
          >
            {model.totalLabel}
          </Text>
        </View>
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: spacing.xs }}
          numberOfLines={1}
        >
          {receivedLabel}
        </Text>
        <View style={[styles.statusRow, { marginTop: spacing.sm }]}>
          <StatusPill
            compact
            label={t(
              `common.orderStatus.${model.status}`,
              model.status.replace(/_/g, ' ')
            )}
            backgroundColor={`${stripe}28`}
            borderColor={`${stripe}55`}
            textColor={colors.text.primary}
            leadingDot={model.urgency === 'warning'}
          />
        </View>
        <Text
          variant="bodyMedium"
          style={{ color: colors.text.secondary, marginTop: spacing.sm }}
          numberOfLines={2}
        >
          {t(model.subtitleKey, model.subtitleDefault)}
        </Text>
      </Pressable>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Button
          mode="contained"
          onPress={onPressCta}
          style={{ borderRadius: borderRadius.md }}
          contentStyle={{ minHeight: 44 }}
        >
          {t(model.ctaKey, model.ctaDefault)}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  body: {
    padding: 16,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
