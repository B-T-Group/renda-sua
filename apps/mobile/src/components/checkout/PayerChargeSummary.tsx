import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { formatPayerChargeEstimate } from '../../utils/diasporaCheckout';
import type { CheckoutDiaspora } from '../../types/checkout';

export interface PayerChargeSummaryProps {
  diaspora: CheckoutDiaspora | null | undefined;
  /** Locale for currency formatting (e.g. 'en-CA', 'fr-CA'). */
  locale?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Payer charge summary (optional FX estimate).
 * Shows indicative foreign exchange estimate with disclaimer when available.
 * Only renders when diaspora.payer_charge_estimate is present.
 */
export function PayerChargeSummary({
  diaspora,
  locale,
  style,
}: PayerChargeSummaryProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const formattedEstimate = useMemo(
    () => formatPayerChargeEstimate(diaspora, locale),
    [diaspora, locale]
  );

  if (!formattedEstimate) return null;

  return (
    <View style={[styles.container, { gap: spacing.xs }, style]}>
      <View style={styles.row}>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t('diaspora.estimatedCharge', 'Estimated charge (your bank)')}
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: colors.text.primary, fontWeight: '600' }}
        >
          {formattedEstimate}
        </Text>
      </View>
      <View style={styles.disclaimer}>
        <MaterialCommunityIcons
          name="information-outline"
          size={14}
          color={colors.text.secondary}
        />
        <Text
          variant="bodySmall"
          style={[styles.disclaimerText, { color: colors.text.secondary }]}
        >
          {t('diaspora.fxDisclaimer', 'Estimate only. Your bank sets the final exchange rate.')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  disclaimerText: {
    flex: 1,
    minWidth: 0,
  },
});
