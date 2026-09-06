import { useCallback, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Divider, List, Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { StatusPill } from '../../../components/common/StatusPill';
import type { Theme } from '../../../theme';
import type { Order } from '../../../types/agent';
import { agentApi } from '../../../services/agentApi';
import { useOrderStripePayment } from '../../../hooks/useOrderStripePayment';
import { formatCurrency } from '../../../utils/formatters';
import { resolveOrderPricing } from '../../../utils/orderAmounts';
import { OrderStatusHistoryTimeline } from './OrderStatusHistoryTimeline';

function formatWhen(locale: string, iso: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

function SummaryRow({
  label,
  value,
  colors,
  bold,
}: {
  label: string;
  value: string;
  colors: Theme['colors'];
  bold?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: 12 }}>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, flex: 1 }}>
        {label}
      </Text>
      <Text
        variant={bold ? 'titleMedium' : 'bodyMedium'}
        style={{ fontWeight: bold ? '700' : '400', maxWidth: '52%', textAlign: 'right' }}
      >
        {value}
      </Text>
    </View>
  );
}

type Props = {
  order: Order;
  locale: string;
  cardStyle?: object;
  onRefetch?: () => void | Promise<void>;
  onNotify?: (message: string) => void;
  onAwaitingPayment?: (params: {
    orderIds: string[];
    phoneE164: string;
    source: 'retry';
    orderNumbers?: string[];
  }) => void;
};

function paymentChipColors(
  status: string | undefined,
  c: Theme['colors']
): { backgroundColor: string; textColor: string } {
  if (!status) {
    return { backgroundColor: c.divider, textColor: c.text.secondary };
  }
  if (status === 'paid') {
    return { backgroundColor: `${c.success.light}55`, textColor: c.success.dark };
  }
  if (status === 'authorized' || status === 'capture_pending') {
    return { backgroundColor: `${c.info.light}55`, textColor: c.info.dark };
  }
  if (status === 'failed') {
    return { backgroundColor: `${c.error.light}55`, textColor: c.error.dark };
  }
  return { backgroundColor: `${c.warning.light}90`, textColor: c.warning.dark };
}

function isStripeCardOrder(order: Order): boolean {
  return order.payment_source === 'credit_card';
}

function showRetryPayNow(order: Order): boolean {
  return (
    order.current_status === 'pending_payment' &&
    order.payment_timing === 'pay_now' &&
    order.payment_status !== 'paid'
  );
}

export function OrderClientSummaryCard({
  order,
  locale,
  cardStyle,
  onRefetch,
  onNotify,
  onAwaitingPayment,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { pay: payWithStripeSheet } = useOrderStripePayment();
  const [historyOpen, setHistoryOpen] = useState(true);
  const [retrying, setRetrying] = useState(false);

  const pricing = useMemo(() => resolveOrderPricing(order), [order]);
  const cur = order.currency || 'XAF';
  const history = order.order_status_history ?? [];
  const payLabel = order.payment_status
    ? t(`common.paymentStatus.${order.payment_status}`, order.payment_status)
    : '—';

  const paymentChipStyle = useMemo(
    () => paymentChipColors(order.payment_status, colors),
    [order.payment_status, colors]
  );

  const canRetry = showRetryPayNow(order) && !!onRefetch && !!onNotify;

  const handleRetryPayment = useCallback(async () => {
    if (!onRefetch || !onNotify) return;
    setRetrying(true);
    try {
      const stripeOrder = isStripeCardOrder(order);
      const response = await agentApi.orders.retryPayment(
        order.id,
        stripeOrder ? { stripe_payment_method: 'payment_sheet' } : undefined
      );
      if (stripeOrder) {
        if (response.payment_intent_client_secret) {
          const payResult = await payWithStripeSheet({
            clientSecret: response.payment_intent_client_secret,
            transactionId: response.payment_transaction?.transaction_id,
          });
          if (payResult.status === 'cancelled') {
            onNotify(t('orders.retryPayment.cancelled', 'Payment cancelled.'));
            return;
          }
          if (payResult.status === 'failed') {
            onNotify(
              payResult.message ||
                t('orders.retryPayment.error', 'Failed to retry payment')
            );
            return;
          }
          onNotify(
            payResult.status === 'authorized'
              ? order.fulfillment_method === 'pickup' ||
                order.payment_timing === 'pay_at_pickup'
                ? t(
                    'orders.retryPayment.authorizedPickup',
                    'Card authorized. You will be charged when you collect your order at the store.'
                  )
                : t(
                    'orders.retryPayment.authorized',
                    'Card authorized. You will be charged when the delivery agent picks up your order.'
                  )
              : t('orders.retryPayment.success', 'Payment completed successfully.')
          );
        } else if (response.checkout_url) {
          await Linking.openURL(response.checkout_url);
          onNotify(
            t(
              'orders.retryPayment.successStripe',
              'Opening secure card payment in your browser.'
            )
          );
        } else {
          onNotify(t('orders.retryPayment.error', 'Failed to retry payment'));
          return;
        }
      } else {
        const phoneE164 = order.client?.user?.phone_number?.trim() || '';
        if (onAwaitingPayment) {
          onAwaitingPayment({
            orderIds: [order.id],
            phoneE164,
            source: 'retry',
            orderNumbers: order.order_number ? [order.order_number] : undefined,
          });
        } else {
          onNotify(
            t(
              'orders.retryPayment.success',
              'Payment retry started. Please check your phone to approve.'
            )
          );
          await onRefetch();
        }
        return;
      }
      await onRefetch();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : t('orders.retryPayment.error', 'Failed to retry payment');
      onNotify(msg);
    } finally {
      setRetrying(false);
    }
  }, [onAwaitingPayment, onNotify, onRefetch, order, payWithStripeSheet, t]);

  return (
    <View style={cardStyle ?? undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialCommunityIcons name="receipt-text-outline" size={22} color={colors.primary.main} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
            {t('orders.clientManage.summaryTitle', 'Payment & summary')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
            {t('orders.clientManage.summarySubtitle', 'Amounts, payment, and status updates')}
          </Text>
        </View>
      </View>

      <Divider style={{ marginBottom: spacing.sm }} />

      <SummaryRow
        label={t('orders.clientManage.orderDate', 'Order date')}
        value={formatWhen(locale, order.created_at)}
        colors={colors}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 12 }}>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, flex: 1 }}>
          {t('orders.clientManage.paymentLabel', 'Payment')}
        </Text>
        <StatusPill
          label={payLabel}
          backgroundColor={paymentChipStyle.backgroundColor}
          textColor={paymentChipStyle.textColor}
          style={{ maxWidth: '56%' }}
        />
      </View>

      {canRetry ? (
        <View style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>
          <Button
            mode="contained"
            buttonColor={colors.warning.main}
            textColor={colors.text.primary}
            onPress={() => void handleRetryPayment()}
            loading={retrying}
            disabled={retrying}
          >
            {t('orders.retryPayment.cta', 'Retry payment')}
          </Button>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
            {t(
              isStripeCardOrder(order)
                ? 'orders.retryPayment.helperStripe'
                : 'orders.retryPayment.helper',
              isStripeCardOrder(order)
                ? 'Complete card payment in the payment sheet or browser.'
                : 'You can also cancel the order if you changed your mind.'
            )}
          </Text>
        </View>
      ) : null}

      <SummaryRow
        label={t('client.placeOrder.summary.subtotal', 'Subtotal')}
        value={formatCurrency(pricing.subtotal, cur, locale)}
        colors={colors}
      />
      <SummaryRow
        label={t('client.placeOrder.summary.deliveryFee', 'Delivery fee')}
        value={formatCurrency(pricing.deliveryFee, cur, locale)}
        colors={colors}
      />
      {pricing.tax > 0.005 ? (
        <SummaryRow
          label={t('orders.clientManage.taxLabel', 'Tax')}
          value={formatCurrency(pricing.tax, cur, locale)}
          colors={colors}
        />
      ) : null}

      <Divider style={{ marginVertical: spacing.sm }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
          {t('client.placeOrder.summary.total', 'Total')}
        </Text>
        <Text variant="headlineSmall" style={{ color: colors.primary.main, fontWeight: '800' }}>
          {formatCurrency(pricing.total, cur, locale)}
        </Text>
      </View>

      {history.length > 0 ? (
        <List.Accordion
          title={t('orders.clientManage.historyTitle', 'Status history')}
          description={t('orders.clientManage.historyCount', '{{count}} updates', { count: history.length })}
          expanded={historyOpen}
          onPress={() => setHistoryOpen((o) => !o)}
          titleStyle={{ fontWeight: '700', color: colors.text.primary, fontSize: 15 }}
          descriptionStyle={{ color: colors.text.secondary, fontSize: 12 }}
          style={{ backgroundColor: colors.pageBackground, borderRadius: borderRadius.sm, marginHorizontal: -4 }}
        >
          <OrderStatusHistoryTimeline entries={history} locale={locale} />
        </List.Accordion>
      ) : (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, fontStyle: 'italic' }}>
          {t('orders.clientManage.historyEmpty', 'No status changes recorded yet.')}
        </Text>
      )}
    </View>
  );
}
