import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type FlowKey = 'delivery' | 'pickup' | 'payAtDelivery';

interface Flow {
  key: FlowKey;
  tabLabel: string;
  icon: IconName;
  accent: string;
  title: string;
  body: string;
  steps: string[];
}

export interface InventoryItemDetailHowItWorksProps {
  /** When true, the client pays by card (Stripe rail) instead of mobile money. */
  isStripeRail?: boolean;
  /** Item supports in-store pickup checkout. */
  pickupEnabled?: boolean;
  /** Item supports pay-at-delivery (only offered on the mobile money rail). */
  payAtDeliveryEnabled?: boolean;
}

export function InventoryItemDetailHowItWorks({
  isStripeRail = false,
  pickupEnabled = false,
  payAtDeliveryEnabled = false,
}: InventoryItemDetailHowItWorksProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();

  const flows = useMemo((): Flow[] => {
    const list: Flow[] = [
      {
        key: 'delivery',
        tabLabel: t('items.detail.howItWorks.delivery.tab', 'Delivery'),
        icon: 'truck-fast-outline',
        accent: colors.primary.main,
        title: t('items.detail.howItWorks.delivery.title', 'Pay & get it delivered'),
        body: isStripeRail
          ? t(
              'items.detail.howItWorks.delivery.bodyCard',
              'Pay securely by card at checkout — a courier brings it to your door.'
            )
          : t(
              'items.detail.howItWorks.delivery.bodyMomo',
              'Pay with mobile money at checkout — a courier brings it to your door.'
            ),
        steps: [
          isStripeRail
            ? t('items.detail.howItWorks.delivery.step1Card', 'Pay by card')
            : t('items.detail.howItWorks.delivery.step1Momo', 'Pay MoMo'),
          t('items.detail.howItWorks.delivery.step2', 'Courier delivers'),
          t('items.detail.howItWorks.delivery.step3', 'Confirm receipt'),
        ],
      },
    ];

    if (pickupEnabled) {
      list.push({
        key: 'pickup',
        tabLabel: t('items.detail.howItWorks.pickup.tab', 'Store pickup'),
        icon: 'storefront-outline',
        accent: colors.info.main,
        title: t('items.detail.howItWorks.pickup.title', 'Pick up at the store'),
        body: t(
          'items.detail.howItWorks.pickup.body',
          'Order in the app and collect it at the store when it’s ready.'
        ),
        steps: [
          t('items.detail.howItWorks.pickup.step1', 'Order ahead'),
          t('items.detail.howItWorks.pickup.step2', 'Store prepares'),
          t('items.detail.howItWorks.pickup.step3', 'Collect in store'),
        ],
      });
    }

    if (payAtDeliveryEnabled && !isStripeRail) {
      list.push({
        key: 'payAtDelivery',
        tabLabel: t('items.detail.howItWorks.payAtDelivery.tab', 'Pay at delivery'),
        icon: 'hand-coin-outline',
        accent: colors.success.main,
        title: t('items.detail.howItWorks.payAtDelivery.title', 'Pay at delivery'),
        body: t(
          'items.detail.howItWorks.payAtDelivery.body',
          'Nothing charged now — pay when the courier hands you your order.'
        ),
        steps: [
          t('items.detail.howItWorks.payAtDelivery.step1', 'Order now'),
          t('items.detail.howItWorks.payAtDelivery.step2', 'Courier arrives'),
          t('items.detail.howItWorks.payAtDelivery.step3', 'Pay on the spot'),
        ],
      });
    }

    return list;
  }, [
    colors.info.main,
    colors.primary.main,
    colors.success.main,
    isStripeRail,
    payAtDeliveryEnabled,
    pickupEnabled,
    t,
  ]);

  const [selectedKey, setSelectedKey] = useState<FlowKey>(flows[0]?.key ?? 'delivery');

  useEffect(() => {
    if (!flows.some((f) => f.key === selectedKey)) {
      setSelectedKey(flows[0]?.key ?? 'delivery');
    }
  }, [flows, selectedKey]);

  const active = flows.find((f) => f.key === selectedKey) ?? flows[0];
  if (!active) return null;

  return (
    <View
      style={[
        styles.card,
        {
          marginTop: spacing.lg,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={t('items.detail.howItWorks.title', 'How it works')}
    >
      <Text style={[typography.subtitle1, { color: colors.text.primary, fontWeight: '700' }]}>
        {t('items.detail.howItWorks.title', 'How it works')}
      </Text>

      {flows.length > 1 ? (
        <View
          style={[
            styles.tabRow,
            {
              marginTop: spacing.sm,
              padding: 3,
              borderRadius: borderRadius.md,
              backgroundColor: colors.pageBackground,
            },
          ]}
          accessibilityRole="tablist"
        >
          {flows.map((flow) => {
            const selected = flow.key === active.key;
            return (
              <Pressable
                key={flow.key}
                onPress={() => setSelectedKey(flow.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={flow.tabLabel}
                style={[
                  styles.tab,
                  {
                    borderRadius: borderRadius.sm,
                    backgroundColor: selected ? colors.surface : 'transparent',
                  },
                  selected ? shadows.sm : null,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    typography.caption,
                    {
                      color: selected ? colors.text.primary : colors.text.secondary,
                      fontWeight: selected ? '700' : '500',
                      textAlign: 'center',
                    },
                  ]}
                >
                  {flow.tabLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ marginTop: spacing.md }}>
        <View style={styles.activeHeader}>
          <View style={[styles.iconCircle, { backgroundColor: active.accent + '14' }]}>
            <MaterialCommunityIcons name={active.icon} size={20} color={active.accent} />
          </View>
          <View style={styles.activeText}>
            <Text
              style={[typography.subtitle2, { color: colors.text.primary, fontWeight: '700' }]}
              numberOfLines={2}
            >
              {active.title}
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.text.secondary, marginTop: 4, lineHeight: 18 },
              ]}
            >
              {active.body}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.stepsCard,
            {
              marginTop: spacing.sm,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.sm,
              borderRadius: borderRadius.md,
              backgroundColor: colors.pageBackground,
            },
          ]}
        >
          {active.steps.map((step, i) => (
            <View key={`${active.key}-${step}`} style={styles.stepRow}>
              <View style={[styles.stepIndex, { backgroundColor: active.accent + '22' }]}>
                <Text style={[styles.stepIndexText, { color: active.accent }]}>{i + 1}</Text>
              </View>
              <Text
                style={[typography.body2, { color: colors.text.primary, flex: 1, minWidth: 0 }]}
                numberOfLines={2}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  tabRow: {
    flexDirection: 'row',
    gap: 2,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  activeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  activeText: { flex: 1, minWidth: 0 },
  stepsCard: { gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndexText: { fontSize: 11, fontWeight: '800' },
});
