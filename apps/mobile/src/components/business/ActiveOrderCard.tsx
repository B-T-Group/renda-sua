import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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

function readyCtaIcon(ctaKey: string): string | undefined {
  if (ctaKey !== 'business.dashboard.activeOrders.cta.markReady') return undefined;
  return 'check-circle';
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

function fulfillmentIcon(fulfillmentKey: string): React.ComponentProps<
  typeof MaterialCommunityIcons
>['name'] {
  if (fulfillmentKey.endsWith('.pickup')) return 'store-marker-outline';
  if (fulfillmentKey.endsWith('.shipping')) return 'truck-cargo-container';
  return 'bike';
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
  const fulfillmentLabel = t(
    model.fulfillmentKey,
    model.fulfillmentDefault
  );
  const lineSummaries = model.lineSummaries ?? [];
  const cardWidth = Number.isFinite(width)
    ? Math.max(0, width - spacing.md * 2)
    : undefined;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          width: cardWidth,
          alignSelf: 'center',
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
          {
            opacity: pressed ? 0.96 : 1,
            paddingBottom: model.showCta ? spacing.sm : 16,
          },
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

        <View
          style={[
            styles.fulfillmentRow,
            {
              marginTop: spacing.sm,
              gap: spacing.sm,
              backgroundColor: colors.primaryTint,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={fulfillmentIcon(model.fulfillmentKey)}
            size={18}
            color={colors.primary.main}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              variant="labelMedium"
              style={{ color: colors.primary.main, fontWeight: '700' }}
              numberOfLines={1}
            >
              {fulfillmentLabel}
            </Text>
            {model.slotLabel ? (
              <Text
                variant="bodySmall"
                style={{ color: colors.text.secondary, marginTop: 2 }}
                numberOfLines={2}
              >
                {model.slotLabel}
              </Text>
            ) : null}
          </View>
        </View>

        {lineSummaries.length > 0 ? (
          <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
            {lineSummaries.map((line) => (
              <View key={line.id} style={styles.lineRow}>
                <Text
                  variant="labelMedium"
                  style={{
                    color: colors.primary.main,
                    fontWeight: '700',
                    minWidth: 28,
                  }}
                >
                  {line.quantity}×
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.text.primary, flex: 1, minWidth: 0 }}
                  numberOfLines={2}
                >
                  {line.name}
                </Text>
              </View>
            ))}
            {(model.moreLinesCount ?? 0) > 0 ? (
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {t(
                  'business.dashboard.activeOrders.moreItems',
                  '+{{count}} more',
                  { count: model.moreLinesCount }
                )}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.metaRow, { marginTop: spacing.sm, gap: spacing.sm }]}>
          <Text
            variant="bodyMedium"
            style={{ color: colors.text.primary, fontWeight: '600' }}
          >
            {model.totalLabel}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary }}
            numberOfLines={1}
          >
            {receivedLabel}
          </Text>
        </View>
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
      {model.showCta ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Button
            mode="contained"
            icon={readyCtaIcon(model.ctaKey)}
            onPress={onPressCta}
            style={{ borderRadius: borderRadius.md }}
            contentStyle={{ minHeight: 44 }}
          >
            {t(model.ctaKey, model.ctaDefault)}
          </Button>
        </View>
      ) : null}
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
  fulfillmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
