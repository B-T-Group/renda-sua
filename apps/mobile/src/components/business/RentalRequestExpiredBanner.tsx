import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { brandFaceStyle } from '../../theme/fonts';

/** Approved 26 Nov 2026 notice accent — softer than warning.light (the old solid amber fill). */
const AMBER_EDGE = '#E8A23A';

export function RentalRequestExpiredBanner({
  window,
  who,
  onView,
  onDismiss,
  testID = 'rental-request-expired-state',
  style,
}: {
  window: 'sla' | 'start';
  who?: string;
  onView?: () => void;
  onDismiss?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius, shadows } = useTheme();
  const reason =
    window === 'start'
      ? t(
          'business.dashboard.rentalRequests.expiredStartReason',
          "You didn't reply before the start time. The renter can send a new request."
        )
      : t(
          'business.dashboard.rentalRequests.expiredSlaReason',
          "You didn't reply within 24 hours. The renter can send a new request."
        );
  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[
        styles.card,
        shadows.sm,
        {
          padding: spacing.md,
          paddingLeft: spacing.md + 4,
          borderRadius: borderRadius.card,
          borderColor: colors.divider,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      <View style={[styles.edge, { backgroundColor: AMBER_EDGE }]} />
      <View style={styles.header}>
        <View style={[styles.clock, { backgroundColor: colors.warningTint }]}>
          <MaterialCommunityIcons name="clock-outline" size={18} color={AMBER_EDGE} />
        </View>
        <View style={styles.copy}>
          <Text style={[brandFaceStyle('700'), styles.title, { color: colors.text.primary }]}>
            {t('business.dashboard.rentalRequests.expiredTitle', 'Request expired')}
          </Text>
          {who ? (
            <Text style={[brandFaceStyle('600'), typography.bodySmall, { color: colors.text.primary, marginTop: 2 }]}>
              {who}
            </Text>
          ) : null}
          <Text style={[typography.bodySmall, { color: colors.text.secondary, marginTop: 4 }]}>{reason}</Text>
          {onView ? (
            <Pressable
              testID="rental-request-expiry-view"
              accessibilityRole="button"
              accessibilityLabel={t('business.dashboard.rentalRequests.viewRequest', 'View request')}
              onPress={onView}
              style={[styles.viewBtn, { backgroundColor: colors.primary.main, marginTop: spacing.sm }]}
            >
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary.contrast} />
              <Text style={[brandFaceStyle('600'), styles.viewLabel, { color: colors.primary.contrast }]}>
                {t('business.dashboard.rentalRequests.viewRequest', 'View request')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {onDismiss ? (
          <Pressable
            testID="rental-request-expiry-dismiss"
            accessibilityRole="button"
            accessibilityLabel={t('business.dashboard.rentalRequests.dismissNotice', 'Dismiss')}
            onPress={onDismiss}
            hitSlop={8}
            style={[styles.dismiss, { backgroundColor: colors.surfaceInput }]}
          >
            <MaterialCommunityIcons name="close" size={16} color={colors.text.secondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  edge: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  clock: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
  },
  viewBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 36,
  },
  viewLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  dismiss: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
