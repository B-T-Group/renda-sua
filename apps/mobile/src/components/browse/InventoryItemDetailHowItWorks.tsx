import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type FlowKey = 'delivery' | 'pickup';
type ThemeColors = ReturnType<typeof useTheme>['colors'];
type Translate = ReturnType<typeof useTranslation>['t'];

interface Flow {
  key: FlowKey;
  tabLabel: string;
  icon: IconName;
  accent: string;
  title: string;
  body: string;
  steps: string[];
}

function deliveryFlow(t: Translate, accent: string): Flow {
  return {
    key: 'delivery',
    tabLabel: t('items.detail.howItWorks.delivery.tab', 'Delivery'),
    icon: 'truck-fast-outline',
    accent,
    title: t('items.detail.howItWorks.delivery.title', 'Pay at delivery'),
    body: t(
      'items.detail.howItWorks.delivery.body',
      'Nothing charged now — pay when the courier hands you your order.'
    ),
    steps: [
      t('items.detail.howItWorks.delivery.step1', 'Order now'),
      t('items.detail.howItWorks.delivery.step2', 'Courier delivers'),
      t('items.detail.howItWorks.delivery.step3', 'Pay on the spot'),
    ],
  };
}

function pickupFlow(t: Translate, accent: string): Flow {
  return {
    key: 'pickup',
    tabLabel: t('items.detail.howItWorks.pickup.tab', 'Pickup'),
    icon: 'storefront-outline',
    accent,
    title: t('items.detail.howItWorks.pickup.title', 'Pay at pickup'),
    body: t(
      'items.detail.howItWorks.pickup.body',
      'Order in the app, collect it at the store, and pay when you pick it up.'
    ),
    steps: [
      t('items.detail.howItWorks.pickup.step1', 'Order ahead'),
      t('items.detail.howItWorks.pickup.step2', 'Store prepares'),
      t('items.detail.howItWorks.pickup.step3', 'Pay and collect'),
    ],
  };
}

function FlowTab({
  flow,
  selected,
  colors,
  onSelect,
}: {
  flow: Flow;
  selected: boolean;
  colors: ThemeColors;
  onSelect: (key: FlowKey) => void;
}) {
  const { typography, borderRadius, shadows } = useTheme();
  return (
    <Pressable
      onPress={() => onSelect(flow.key)}
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
}

function HowItWorksTabs({
  flows,
  activeKey,
  colors,
  onSelect,
}: {
  flows: Flow[];
  activeKey: FlowKey;
  colors: ThemeColors;
  onSelect: (key: FlowKey) => void;
}) {
  const { spacing, borderRadius } = useTheme();
  return (
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
      {flows.map((flow) => (
        <FlowTab
          key={flow.key}
          flow={flow}
          selected={flow.key === activeKey}
          colors={colors}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

function FlowSteps({ flow, colors }: { flow: Flow; colors: ThemeColors }) {
  const { typography, spacing, borderRadius } = useTheme();
  return (
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
      {flow.steps.map((step, i) => (
        <View key={`${flow.key}-${step}`} style={styles.stepRow}>
          <View style={[styles.stepIndex, { backgroundColor: flow.accent + '22' }]}>
            <Text style={[styles.stepIndexText, { color: flow.accent }]}>{i + 1}</Text>
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
  );
}

function HowItWorksActive({ flow, colors }: { flow: Flow; colors: ThemeColors }) {
  const { typography, spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.md }}>
      <View style={styles.activeHeader}>
        <View style={[styles.iconCircle, { backgroundColor: flow.accent + '14' }]}>
          <MaterialCommunityIcons name={flow.icon} size={20} color={flow.accent} />
        </View>
        <View style={styles.activeText}>
          <Text
            style={[typography.subtitle2, { color: colors.text.primary, fontWeight: '700' }]}
            numberOfLines={2}
          >
            {flow.title}
          </Text>
          <Text
            style={[typography.caption, { color: colors.text.secondary, marginTop: 4, lineHeight: 18 }]}
          >
            {flow.body}
          </Text>
        </View>
      </View>
      <FlowSteps flow={flow} colors={colors} />
    </View>
  );
}

export function InventoryItemDetailHowItWorks() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const flows: Flow[] = [
    deliveryFlow(t, colors.primary.main),
    pickupFlow(t, colors.info.main),
  ];
  const [selectedKey, setSelectedKey] = useState<FlowKey>('delivery');
  const active = flows.find((f) => f.key === selectedKey) ?? flows[0];

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
      <HowItWorksTabs
        flows={flows}
        activeKey={active.key}
        colors={colors}
        onSelect={setSelectedKey}
      />
      <HowItWorksActive flow={active} colors={colors} />
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
