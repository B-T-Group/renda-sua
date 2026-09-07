import { observer } from 'mobx-react-lite';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useCountdown } from '../../hooks/useCountdown';
import { useActionableDeliverySlotPast } from '../../hooks/useActionableDeliverySlotPast';
import { useDashboardAggregates } from '../../hooks/business/useDashboardAggregates';
import { useStore } from '../../stores/RootStore';
import { AppModal } from '../common/AppModal';
import { BusinessCancelOrderDialog } from '../business/BusinessCancelOrderDialog';
import { IncomingOrderView } from './IncomingOrderView';
import type { BusinessOrder } from '../../types/business/orders';
import { resolveAcceptanceDeadline } from '../../utils/resolveAcceptanceDeadline';
import {
  FIRST_ORDER_ONBOARDING_NUDGE_ID,
  shouldShowFirstOrderOverlayGuidance,
} from '../../utils/firstOrderJourney';
import {
  trackFirstOrderConfirmStarted,
  trackFirstOrderConfirmed,
} from '../../utils/firstOrderAnalytics';
import { ensureFirstOrderPinForOrder } from '../../utils/firstOrderPinSync';

function IncomingOrderOverlayBase() {
  const { incomingOrder, ftue } = useStore();
  const { colors } = useTheme();
  const { data: aggregates } = useDashboardAggregates(incomingOrder.visible);

  const handleExpire = useCallback(() => {
    // Keep overlay open through grace; server auto-declines.
  }, []);

  const deadline = resolveAcceptanceDeadline(incomingOrder.details);
  const countdownSeconds = useCountdown(
    incomingOrder.visible ? deadline : null,
    handleExpire
  );
  const secondsLeft = deadline ? countdownSeconds : null;

  const orderForDialog = useMemo(() => {
    if (!incomingOrder.details) return null;
    return incomingOrder.details as unknown as BusinessOrder;
  }, [incomingOrder.details]);

  const legacyConverted = !ftue.isNudgeEligible(FIRST_ORDER_ONBOARDING_NUDGE_ID);
  const showFirstOrderGuidance = useMemo(() => {
    if (!incomingOrder.details || !incomingOrder.orderId) return false;
    return shouldShowFirstOrderOverlayGuidance({
      orderId: incomingOrder.orderId,
      businessId: incomingOrder.details.business_id,
      ordersTotal: aggregates?.ordersTotal,
      isLegacyNudgeConverted: legacyConverted,
    });
  }, [
    aggregates?.ordersTotal,
    incomingOrder.details,
    incomingOrder.orderId,
    legacyConverted,
  ]);

  const showInterrupt =
    incomingOrder.visible && !incomingOrder.showCancelDialog;
  const slotPast = useActionableDeliverySlotPast(
    incomingOrder.visible ? incomingOrder.details : null,
    incomingOrder.uiState
  );

  const handleConfirm = useCallback(() => {
    const orderId = incomingOrder.orderId;
    const order = orderForDialog;
    void (async () => {
      if (showFirstOrderGuidance && orderId) {
        trackFirstOrderConfirmStarted({ order_id: orderId });
      }
      try {
        await incomingOrder.confirm();
        if (showFirstOrderGuidance && orderId && order) {
          await ensureFirstOrderPinForOrder(order, {
            businessId: order.business_id,
            ordersTotal: aggregates?.ordersTotal,
            isLegacyNudgeConverted: legacyConverted,
            source: 'overlay',
          });
          trackFirstOrderConfirmed({ order_id: orderId });
        }
      } catch {
        // IncomingOrderStore surfaces the error message.
      }
    })();
  }, [
    aggregates?.ordersTotal,
    incomingOrder,
    legacyConverted,
    orderForDialog,
    showFirstOrderGuidance,
  ]);

  if (!incomingOrder.visible) return null;

  return (
    <>
      <AppModal
        visible={showInterrupt}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          if (incomingOrder.uiState === 'confirming' || slotPast) return;
          incomingOrder.dismiss();
        }}
      >
        <View style={[styles.fill, { backgroundColor: colors.pageBackground }]}>
          <IncomingOrderView
            uiState={incomingOrder.uiState}
            details={incomingOrder.details}
            message={incomingOrder.message}
            secondsLeft={secondsLeft}
            isSlotPast={slotPast}
            showFirstOrderGuidance={showFirstOrderGuidance}
            onDismiss={() => incomingOrder.dismiss()}
            onConfirm={handleConfirm}
            onBusy={() => void incomingOrder.markBusy()}
            onDecline={() => incomingOrder.openCancel()}
          />
        </View>
      </AppModal>
      {orderForDialog ? (
        <BusinessCancelOrderDialog
          visible={incomingOrder.showCancelDialog}
          order={orderForDialog}
          onDismiss={() => incomingOrder.closeCancel()}
          onSubmit={async (notes) => {
            await incomingOrder.decline(notes);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export const IncomingOrderOverlay = observer(IncomingOrderOverlayBase);
