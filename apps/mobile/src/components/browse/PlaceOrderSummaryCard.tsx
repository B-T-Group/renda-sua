import { useState, type ReactNode } from 'react';
import { Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Button, Card, Divider, Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCatalogMoney } from '../../utils/catalogInventoryDisplay';

type Fulfillment = 'delivery' | 'pickup' | 'shipping';

export interface PlaceOrderSummaryCardProps {
  thumb: string | null;
  itemName: string;
  storeName: string;
  currency: string;
  unitMoney: string;
  quantity: number;
  subtotal: number;
  fulfillment: Fulfillment;
  fulfillmentPending?: boolean;
  deliveryFeeLoading: boolean;
  deliveryFeeError: string | null;
  deliveryAddressMissing: boolean;
  deliveryAmount: number;
  deliveryFullBefore: number;
  showFirstDeliveryDiscount: boolean;
  firstDeliveryDiscountAmount: number;
  discountDraft: string;
  onDiscountDraftChange: (v: string) => void;
  onApplyDiscount: () => void;
  onClearDiscount: () => void;
  discountLoading: boolean;
  discountError: string | null;
  appliedDiscountCode: string | null;
  discountPercentage: number;
  discountAmount: number;
  grandTotal: number;
  showTaxAtCheckoutNotice?: boolean;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, flex: 1, paddingRight: 8 }}>
        {label}
      </Text>
      <View style={{ maxWidth: '55%', alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

export function PlaceOrderSummaryCard({
  thumb,
  itemName,
  storeName,
  currency,
  unitMoney,
  quantity,
  subtotal,
  fulfillment,
  fulfillmentPending = false,
  deliveryFeeLoading,
  deliveryFeeError,
  deliveryAddressMissing,
  deliveryAmount,
  deliveryFullBefore,
  showFirstDeliveryDiscount,
  firstDeliveryDiscountAmount,
  discountDraft,
  onDiscountDraftChange,
  onApplyDiscount,
  onClearDiscount,
  discountLoading,
  discountError,
  appliedDiscountCode,
  discountPercentage,
  discountAmount,
  grandTotal,
  showTaxAtCheckoutNotice = false,
}: PlaceOrderSummaryCardProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const showStrikethrough = deliveryFullBefore > deliveryAmount + 0.0001;
  const [couponExpanded, setCouponExpanded] = useState(false);
  const couponVisible = couponExpanded || !!appliedDiscountCode;

  return (
    <Card style={{ borderRadius: borderRadius.md, marginBottom: spacing.md }}>
      <Card.Content>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={{ width: 72, height: 72, borderRadius: 8 }} resizeMode="cover" />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 8,
                backgroundColor: colors.pageBackground,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <MaterialCommunityIcons name="image-off-outline" size={28} color={colors.text.disabled} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="titleMedium" numberOfLines={3}>
              {itemName}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
              {storeName}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
              {unitMoney} × {quantity}
            </Text>
          </View>
        </View>

        <Divider style={{ marginBottom: spacing.sm }} />

        <Row label={t('client.placeOrder.summary.subtotal', 'Subtotal')}>
          <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
            {formatCatalogMoney(subtotal, currency)}
          </Text>
        </Row>

        <Row
          label={
            fulfillment === 'shipping'
              ? t('client.placeOrder.summary.shippingFee', 'Shipping fee')
              : t('client.placeOrder.summary.deliveryFee', 'Delivery fee')
          }
        >
          {fulfillmentPending ? (
            <Text variant="bodySmall" style={{ color: colors.primary.main, textAlign: 'right', fontWeight: '600' }}>
              {t('client.placeOrder.summary.chooseFulfillment', 'Choose delivery or pickup')}
            </Text>
          ) : fulfillment === 'pickup' ? (
            <Text variant="bodyMedium" style={{ fontWeight: '600', color: colors.secondary.main }}>
              {t('client.placeOrder.summary.deliveryFeeWaived', 'Waived')}
            </Text>
          ) : deliveryFeeLoading ? (
            <ActivityIndicator size="small" />
          ) : deliveryAddressMissing ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary, textAlign: 'right' }}>
              {t(
                'client.placeOrder.summary.deliveryFeeAddressRequired',
                'Choose a delivery address to see shipping.'
              )}
            </Text>
          ) : deliveryFeeError ? (
            <Text variant="bodySmall" style={{ color: colors.error.main, textAlign: 'right' }}>
              {t('client.placeOrder.summary.deliveryFeeError', 'Unable to calculate')}
            </Text>
          ) : showStrikethrough ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
              <Text
                variant="bodySmall"
                style={{ textDecorationLine: 'line-through', color: colors.text.secondary }}
              >
                {formatCatalogMoney(deliveryFullBefore, currency)}
              </Text>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                {formatCatalogMoney(deliveryAmount, currency)}
              </Text>
            </View>
          ) : (
            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
              {formatCatalogMoney(deliveryAmount, currency)}
            </Text>
          )}
        </Row>

        {showFirstDeliveryDiscount ? (
          <Row label={t('client.placeOrder.summary.firstDeliveryDiscount', 'First delivery discount')}>
            <Text variant="bodyMedium" style={{ fontWeight: '600', color: colors.secondary.main }}>
              −{formatCatalogMoney(firstDeliveryDiscountAmount, currency)}
            </Text>
          </Row>
        ) : null}

        <Divider style={{ marginVertical: spacing.sm }} />

        {couponVisible ? (
          <>
            <Text variant="labelLarge" style={{ marginBottom: spacing.xs, color: colors.text.secondary }}>
              {t('client.placeOrder.discountCode.label', 'Discount code')}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.xs }}>
              <TextInput
                mode="outlined"
                style={{ flex: 1 }}
                value={discountDraft}
                onChangeText={onDiscountDraftChange}
                placeholder={t('client.placeOrder.discountCode.placeholder', 'Code')}
                editable={!discountLoading}
              />
              <Button mode="contained" onPress={() => void onApplyDiscount()} loading={discountLoading} disabled={!discountDraft.trim()}>
                {t('client.placeOrder.discountCode.apply', 'Apply')}
              </Button>
            </View>
            {appliedDiscountCode && discountPercentage > 0 ? (
              <Text variant="bodySmall" style={{ color: colors.secondary.main, marginBottom: spacing.xs }}>
                {t('client.placeOrder.discountCode.applied', '{{pct}}% off with {{code}}', {
                  pct: discountPercentage,
                  code: appliedDiscountCode,
                })}
              </Text>
            ) : null}
            {appliedDiscountCode ? (
              <Button mode="text" compact onPress={onClearDiscount}>
                {t('client.placeOrder.discountCode.clear', 'Remove code')}
              </Button>
            ) : null}
            {discountError ? (
              <Text variant="bodySmall" style={{ color: colors.error.main, marginBottom: spacing.sm }}>
                {discountError}
              </Text>
            ) : null}
          </>
        ) : (
          <View style={{ alignItems: 'flex-start', marginBottom: spacing.xs }}>
            <Button
              mode="text"
              compact
              icon="ticket-percent-outline"
              onPress={() => setCouponExpanded(true)}
            >
              {t('client.placeOrder.discountCode.haveCoupon', 'Have a coupon?')}
            </Button>
          </View>
        )}

        {discountAmount > 0 ? (
          <Row label={t('client.placeOrder.summary.discount', 'Discount')}>
            <Text variant="bodyMedium" style={{ fontWeight: '600', color: colors.secondary.main }}>
              −{formatCatalogMoney(discountAmount, currency)}
            </Text>
          </Row>
        ) : null}

        {showTaxAtCheckoutNotice ? (
          <Row label={t('orders.tax', 'Tax')}>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
              {t(
                'client.placeOrder.summary.taxCalculatedAtCheckout',
                'Calculated at checkout'
              )}
            </Text>
          </Row>
        ) : null}

        <Divider style={{ marginVertical: spacing.sm }} />

        <Row
          label={
            showTaxAtCheckoutNotice
              ? t('client.placeOrder.summary.totalBeforeTax', 'Total (before tax)')
              : t('client.placeOrder.summary.total', 'Total')
          }
        >
          <Text variant="titleMedium" style={{ fontWeight: '700', color: colors.primary.main }}>
            {formatCatalogMoney(grandTotal, currency)}
          </Text>
        </Row>

        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.md, textAlign: 'center' }}>
          {t('client.placeOrder.summary.securePayment', 'Secure payment')}
        </Text>
      </Card.Content>
    </Card>
  );
}
