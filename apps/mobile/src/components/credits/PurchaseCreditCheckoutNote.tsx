import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { PurchaseCreditPreview } from '../../types/purchaseCredits';
import { formatCurrency } from '../../utils/formatters';

function scopeText(
  applicability: string,
  t: (key: string, fallback: string) => string
): string {
  if (applicability === 'specific_business') {
    return t('accounts.purchaseCredits.onePartner', 'One partner store');
  }
  if (applicability === 'partner_businesses') {
    return t('accounts.purchaseCredits.allPartners', 'Rendasua partner stores');
  }
  return t('accounts.purchaseCredits.anyStore', 'Any store');
}

export function PurchaseCreditCheckoutNote({
  credits,
}: {
  credits?: PurchaseCreditPreview | null;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  if (!credits?.total) return null;
  const scopes = (credits.allocations ?? [])
    .map((row) => scopeText(row.applicability, t))
    .filter((label, index, all) => all.indexOf(label) === index);

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: colors.successTint,
          borderColor: colors.success.main + '44',
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
          gap: spacing.xs,
        },
      ]}
    >
      <Text variant="bodyMedium" style={{ color: colors.success.dark, fontWeight: '600' }}>
        {t(
          'accounts.purchaseCredits.checkoutApply',
          '{{amount}} in store credits will apply',
          {
            amount: formatCurrency(credits.total, credits.currency),
          }
        )}
      </Text>
      {scopes.length > 0 ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {scopes.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1 },
});
