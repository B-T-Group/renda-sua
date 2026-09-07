import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

const STEPS = [
  { key: 'request', icon: 'calendar-clock' as const },
  { key: 'confirm', icon: 'store-check' as const },
  { key: 'pickup', icon: 'handshake-outline' as const },
] as const;

export const RentalsHowItWorksStrip = memo(function RentalsHowItWorksStrip() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();

  const labels: Record<(typeof STEPS)[number]['key'], { title: string; body: string }> = {
    request: {
      title: t('rentals.catalog.howItWorks.requestTitle', 'Request'),
      body: t('rentals.catalog.howItWorks.requestBody', 'Pick dates and send a request'),
    },
    confirm: {
      title: t('rentals.catalog.howItWorks.confirmTitle', 'Confirm'),
      body: t('rentals.catalog.howItWorks.confirmBody', 'Business checks availability'),
    },
    pickup: {
      title: t('rentals.catalog.howItWorks.pickupTitle', 'Pickup'),
      body: t('rentals.catalog.howItWorks.pickupBody', 'Use it and return on time'),
    },
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          marginTop: spacing.md,
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          padding: spacing.md,
        },
      ]}
    >
      <Text style={[typography.subtitle2, { color: colors.text.primary, marginBottom: spacing.sm }]}>
        {t('rentals.catalog.howItWorks.title', 'How rentals work')}
      </Text>
      <View style={styles.row}>
        {STEPS.map((step, i) => (
          <View key={step.key} style={styles.col}>
            <MaterialCommunityIcons name={step.icon} size={22} color={colors.primary.main} />
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.primary.main, marginTop: spacing.xxs },
              ]}
            >
              <Text style={[typography.caption, { color: colors.primary.contrast, fontWeight: '700' }]}>
                {i + 1}
              </Text>
            </View>
            <Text
              style={[
                typography.caption,
                { color: colors.text.primary, fontWeight: '700', marginTop: spacing.xxs, textAlign: 'center' },
              ]}
              numberOfLines={1}
            >
              {labels[step.key].title}
            </Text>
            <Text
              style={[
                typography.caption,
                { color: colors.text.secondary, marginTop: 2, textAlign: 'center', fontSize: 11 },
              ]}
              numberOfLines={2}
            >
              {labels[step.key].body}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
