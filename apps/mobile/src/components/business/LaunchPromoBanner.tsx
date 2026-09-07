import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useBusinessVerificationStatus } from '@/hooks/useBusinessVerificationStatus';
import { useProfileMe } from '@/hooks/useProfileMe';
import {
  dismissLaunchPromo,
  isLaunchPromoDismissed,
} from '@/utils/launchPromoBanner';

export function LaunchPromoBanner() {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const { me } = useProfileMe();
  const { status, loading } = useBusinessVerificationStatus();
  const promo = status?.launchPromo;
  const businessId = me?.business?.id?.trim() ?? '';
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!businessId || !promo?.claimedAt || promo.ordersRemaining <= 0) {
      setDismissed(true);
      return;
    }
    void isLaunchPromoDismissed(businessId, promo.claimedAt).then((value) => {
      if (!cancelled) setDismissed(value);
    });
    return () => {
      cancelled = true;
    };
  }, [businessId, promo?.claimedAt, promo?.ordersRemaining]);

  const onDismiss = useCallback(() => {
    if (!businessId || !promo?.claimedAt) return;
    setDismissed(true);
    void dismissLaunchPromo(businessId, promo.claimedAt);
  }, [businessId, promo?.claimedAt]);

  if (
    loading ||
    !promo ||
    promo.ordersRemaining <= 0 ||
    dismissed ||
    !businessId
  ) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderLeftColor: colors.success.main,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingRight: spacing.xl,
        },
      ]}
    >
      <Pressable
        onPress={onDismiss}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('common.dismiss', 'Dismiss')}
        style={styles.dismiss}
      >
        <MaterialCommunityIcons
          name="close"
          size={20}
          color={colors.text.secondary}
        />
      </Pressable>

      <View style={styles.titleRow}>
        <MaterialCommunityIcons
          name="tag-outline"
          size={16}
          color={colors.success.main}
        />
        <Text
          variant="labelLarge"
          style={{
            color: colors.text.primary,
            fontWeight: '600',
            flex: 1,
            minWidth: 0,
          }}
          numberOfLines={2}
        >
          {t('business.launchPromo.bannerTitle', '0% commission launch promo')}
        </Text>
      </View>
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginTop: 4 }}
        numberOfLines={3}
      >
        {t('business.launchPromo.bannerBody', {
          defaultValue:
            'You still have {{remaining}} of {{total}} orders with 0% item commission.',
          remaining: promo.ordersRemaining,
          total: promo.zeroCommissionOrders ?? promo.ordersRemaining,
        })}
      </Text>
      {promo.status === 'claimed' ? (
        <Text
          variant="labelSmall"
          style={{ color: colors.warning.dark, marginTop: 4 }}
          numberOfLines={2}
        >
          {t('business.launchPromo.identifyReminder', {
            defaultValue:
              'Complete identification within {{days}} days to keep this promo.',
            days: promo.identificationWindowDays ?? 30,
          })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 8,
  },
  dismiss: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
});
