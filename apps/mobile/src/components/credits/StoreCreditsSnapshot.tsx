import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { StoreCreditsIllustration } from '../illustrations/StoreCreditsIllustration';
import { formatCurrency } from '../../utils/formatters';
import { purchaseCreditScopeLabel } from '../../utils/purchaseCredits';
import type { PurchaseCreditGrant } from '../../types/purchaseCredits';

type Props = {
  grants: PurchaseCreditGrant[];
  totalRemaining: number;
  currency: string;
  nearestExpiry: string | null;
  primaryGrant: PurchaseCreditGrant | null;
  onShop: () => void;
  onViewDetails: () => void;
};

export function StoreCreditsSnapshot({
  grants,
  totalRemaining,
  currency,
  nearestExpiry,
  primaryGrant,
  onShop,
  onViewDetails,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();

  const scopeLine = useMemo(() => {
    if (!primaryGrant) return '';
    if (grants.length > 1) {
      return t(
        'accounts.purchaseCredits.snapshotMulti',
        '{{count}} credit balances ready to shop',
        { count: grants.length }
      );
    }
    return purchaseCreditScopeLabel(primaryGrant, t);
  }, [grants.length, primaryGrant, t]);

  if (totalRemaining <= 0 || !primaryGrant) return null;

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
      accessibilityRole="text"
      accessibilityLabel={t(
        'accounts.purchaseCredits.snapshotA11y',
        'Store credits available'
      )}
    >
      <View style={styles.top}>
        <StoreCreditsIllustration
          size={72}
          accessibilityLabel={t(
            'accounts.purchaseCredits.illustrationLabel',
            'Store credits'
          )}
        />
        <View style={[styles.copy, { minWidth: 0, flex: 1 }]}>
          <Text
            variant="titleSmall"
            style={{ color: colors.text.primary, fontWeight: '700' }}
          >
            {t('accounts.purchaseCredits.snapshotTitle', 'Store credits')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {scopeLine}
          </Text>
          {nearestExpiry ? (
            <Text variant="labelSmall" style={{ color: colors.warning.dark }}>
              {t('accounts.purchaseCredits.expires', 'Expires')}{' '}
              {nearestExpiry.slice(0, 10)}
            </Text>
          ) : null}
        </View>
      </View>
      <Text
        variant="headlineSmall"
        style={{
          color: colors.success.main,
          fontWeight: '800',
          marginTop: spacing.sm,
        }}
      >
        {formatCurrency(totalRemaining, currency)}
      </Text>
      <View style={[styles.actions, { gap: spacing.sm, marginTop: spacing.sm }]}>
        <Button mode="contained" onPress={onShop} style={styles.btn}>
          {t('accounts.purchaseCredits.shop', 'Shop now')}
        </Button>
        <Button mode="text" onPress={onViewDetails} style={styles.btn}>
          {t('accounts.purchaseCredits.viewDetails', 'View details')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { gap: 4 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  btn: { flex: 1 },
});
