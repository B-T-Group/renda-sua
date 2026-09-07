import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Divider, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCatalogMoney } from '../../utils/catalogInventoryDisplay';

export interface CartCheckoutSummaryCardProps {
  currency: string;
  subtotal: number;
  deliveryLabel: string;
  feeTitle?: string;
  deliveryMuted?: boolean;
  deliveryPending?: boolean;
  discountAmount: number;
  showTaxAtCheckout: boolean;
  grandTotal: number;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, flex: 1, paddingRight: 8 }}>
        {label}
      </Text>
      <View style={{ maxWidth: '55%', alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

export function CartCheckoutSummaryCard({
  currency,
  subtotal,
  deliveryLabel,
  feeTitle,
  deliveryMuted,
  deliveryPending = false,
  discountAmount,
  showTaxAtCheckout,
  grandTotal,
}: CartCheckoutSummaryCardProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          marginBottom: spacing.sm,
          padding: spacing.md,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ marginBottom: spacing.sm, fontWeight: '700' }}>
        {t('checkout.summary', 'Order summary')}
      </Text>

      <Row label={t('cart.subtotal', 'Subtotal')}>
        <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
          {formatCatalogMoney(subtotal, currency)}
        </Text>
      </Row>

      <Row label={feeTitle ?? t('checkout.deliveryFee', 'Delivery')}>
        <Text
          variant="bodyMedium"
          style={{
            fontWeight: '600',
            color: deliveryPending
              ? colors.primary.main
              : deliveryMuted
                ? colors.text.secondary
                : colors.text.primary,
            textAlign: 'right',
          }}
        >
          {deliveryLabel}
        </Text>
      </Row>

      {discountAmount > 0 ? (
        <Row label={t('checkout.discount', 'Discount')}>
          <Text variant="bodyMedium" style={{ fontWeight: '600', color: colors.success.main }}>
            −{formatCatalogMoney(discountAmount, currency)}
          </Text>
        </Row>
      ) : null}

      {showTaxAtCheckout ? (
        <Row label={t('orders.tax', 'Tax')}>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
            {t('checkout.taxCalculatedAtCheckout', 'Calculated at checkout')}
          </Text>
        </Row>
      ) : null}

      <Divider style={{ marginVertical: spacing.sm }} />

      <Row
        label={
          showTaxAtCheckout
            ? t('checkout.totalBeforeTax', 'Total (before tax)')
            : t('cart.total', 'Total')
        }
      >
        <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.primary.main }}>
          {formatCatalogMoney(grandTotal, currency)}
        </Text>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
});
