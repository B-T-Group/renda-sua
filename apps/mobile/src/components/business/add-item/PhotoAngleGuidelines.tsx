import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';

type Tip = {
  icon: React.ComponentProps<typeof Icon>['source'];
  titleKey: string;
  titleDefault: string;
  bodyKey: string;
  bodyDefault: string;
};

const TIPS: Tip[] = [
  {
    icon: 'camera-front',
    titleKey: 'business.onboarding.firstSale.upload.tips.frontTitle',
    titleDefault: 'Front view',
    bodyKey: 'business.onboarding.firstSale.upload.tips.frontBody',
    bodyDefault: 'Clear shot of the front — this becomes your main photo.',
  },
  {
    icon: 'axis-z-rotate-clockwise',
    titleKey: 'business.onboarding.firstSale.upload.tips.sideTitle',
    titleDefault: 'Side view',
    bodyKey: 'business.onboarding.firstSale.upload.tips.sideBody',
    bodyDefault: 'Show thickness, size, and details from the side.',
  },
  {
    icon: 'camera-rear',
    titleKey: 'business.onboarding.firstSale.upload.tips.backTitle',
    titleDefault: 'Back view',
    bodyKey: 'business.onboarding.firstSale.upload.tips.backBody',
    bodyDefault: 'Add the back if it looks different (labels, ports, design).',
  },
  {
    icon: 'white-balance-sunny',
    titleKey: 'business.onboarding.firstSale.upload.tips.clearTitle',
    titleDefault: 'Clear & bright',
    bodyKey: 'business.onboarding.firstSale.upload.tips.clearBody',
    bodyDefault: 'Sharp focus, good light, and a simple background.',
  },
];

type Props = {
  compact?: boolean;
};

export function PhotoAngleGuidelines({ compact = false }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  if (compact) {
    return (
      <View
        style={[
          styles.compact,
          {
            backgroundColor: colors.primaryTint,
            borderRadius: borderRadius.md,
            padding: spacing.sm,
            marginBottom: spacing.md,
          },
        ]}
      >
        <Icon source="lightbulb-on-outline" size={18} color={colors.primary.main} />
        <Text
          variant="bodySmall"
          style={{ color: colors.text.primary, flex: 1, minWidth: 0, marginLeft: spacing.sm }}
        >
          {t(
            'business.onboarding.firstSale.upload.tips.compact',
            'Tip: front, side, and back shots help buyers trust your listing.'
          )}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.lg,
          marginBottom: spacing.md,
          padding: spacing.md,
        },
      ]}
    >
      <Text
        variant="titleSmall"
        style={{ color: colors.text.primary, fontWeight: '700', marginBottom: spacing.xs }}
      >
        {t(
          'business.onboarding.firstSale.upload.tips.title',
          'Photo tips for a great listing'
        )}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
      >
        {t(
          'business.onboarding.firstSale.upload.tips.subtitle',
          'A few clear angles sell better than one busy photo.'
        )}
      </Text>
      {TIPS.map((tip) => (
        <View key={tip.titleKey} style={[styles.tipRow, { marginBottom: spacing.sm }]}>
          <View
            style={[
              styles.iconBubble,
              {
                backgroundColor: colors.primaryTint,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Icon source={tip.icon} size={20} color={colors.primary.main} />
          </View>
          <View style={styles.tipCopy}>
            <Text variant="labelLarge" style={{ color: colors.text.primary, fontWeight: '600' }}>
              {t(tip.titleKey, tip.titleDefault)}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
              {t(tip.bodyKey, tip.bodyDefault)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBubble: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tipCopy: { flex: 1, minWidth: 0 },
  compact: { flexDirection: 'row', alignItems: 'center' },
});
