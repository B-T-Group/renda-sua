import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Snackbar } from 'react-native-paper';
import { EntityActionRow } from '../common/EntityActionRow';
import { useOrderRatingEligibility } from '../../hooks/useOrderRatingEligibility';
import { agentApi } from '../../services/agentApi';
import type { Order } from '../../types/agent';
import {
  clientCanCancelOrder,
  clientCanConfirmReceipt,
  clientShowDeliveryPin,
} from '../../utils/clientOrderActions';
import { trackCancellationEvent } from '../../utils/cancellationAnalytics';
import { CancellationConfirmSheet } from './CancellationConfirmSheet';
import { SendDeliveryPinButton } from './SendDeliveryPinButton';

type Props = {
  order: Order;
  onOrderMutated?: () => void;
  /** Navigate to the order detail with the rating mode that is actually available. */
  onRatePress?: (mode: 'agent' | 'item') => void;
};

export function ClientOrderRowActions({ order, onOrderMutated, onRatePress }: Props) {
  const { t } = useTranslation();
  const showPin = clientShowDeliveryPin(order);
  const isPickup = order.fulfillment_method === 'pickup';
  const showCancel = clientCanCancelOrder(order);
  const showReceipt = clientCanConfirmReceipt(order);
  const [receiptBusy, setReceiptBusy] = useState(false);

  const { eligibility } = useOrderRatingEligibility(
    order.id,
    !!onRatePress && order.current_status === 'complete'
  );
  const rateMode: 'agent' | 'item' | null = eligibility?.canRateAgent
    ? 'agent'
    : eligibility?.canRateItem
      ? 'item'
      : null;
  const showRate = !!onRatePress && rateMode !== null;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  if (!showPin && !showCancel && !showRate && !showReceipt) {
    return null;
  }

  const actions = [
    showReceipt
      ? {
          id: 'confirmReceipt',
          label: t('orders.shipping.confirmReceipt', 'I received my order'),
          icon: 'package-check',
          mode: 'contained' as const,
          loading: receiptBusy,
          disabled: receiptBusy,
        }
      : null,
    showRate
      ? {
          id: 'rate',
          label: t('rating.rateOrderCta', 'Rate this order'),
          icon: 'star-outline',
          mode: 'outlined' as const,
        }
      : null,
    showCancel
      ? {
          id: 'cancel',
          label: t('orderActions.cancelOrder', 'Cancel order'),
          icon: 'close-circle-outline',
          mode: 'outlined' as const,
          destructive: true,
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    icon?: string;
    mode?: 'outlined' | 'contained';
    destructive?: boolean;
    loading?: boolean;
    disabled?: boolean;
  }>;

  return (
    <>
      {showPin ? (
        <SendDeliveryPinButton
          orderId={order.id}
          pinAudience={isPickup ? 'business' : 'agent'}
          onSent={onOrderMutated}
          onError={(msg) => setSnack(msg)}
          compact
        />
      ) : null}
      {actions.length > 0 ? (
        <EntityActionRow
          layout="column"
          actions={actions}
          onActionPress={(id) => {
            if (id === 'confirmReceipt') {
              void (async () => {
                if (receiptBusy) return;
                setReceiptBusy(true);
                try {
                  await agentApi.orders.confirmReceipt(order.id);
                  onOrderMutated?.();
                } catch (e: unknown) {
                  setSnack(
                    e instanceof Error
                      ? e.message
                      : t('orders.shipping.receiptFailed', 'Failed to confirm receipt')
                  );
                } finally {
                  setReceiptBusy(false);
                }
              })();
            }
            if (id === 'rate' && rateMode) onRatePress?.(rateMode);
            if (id === 'cancel') {
              setCancelOpen(true);
              trackCancellationEvent('cancellation_dialog_opened', {
                orderId: order.id,
                orderStatus: order.current_status ?? '',
                paymentSource: (order as { payment_source?: string }).payment_source ?? '',
              });
            }
          }}
        />
      ) : null}

      <CancellationConfirmSheet
        visible={cancelOpen}
        order={order}
        onDismiss={() => setCancelOpen(false)}
        onSuccess={() => {
          setCancelOpen(false);
          setSnack(t('orderActions.cancelSuccess', 'Order cancelled successfully.'));
          onOrderMutated?.();
        }}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </>
  );
}
