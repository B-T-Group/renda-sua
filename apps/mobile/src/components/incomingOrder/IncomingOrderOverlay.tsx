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
import { CookedFoodConfirmOrderDialog } from '../business/CookedFoodConfirmOrderDialog';
import { IncomingOrderView } from './IncomingOrderView';
import type { BusinessOrder } from '../../types/business/orders';
import type { ConfirmOrderPayload } from '../../types/business/orders';
import { resolveAcceptanceDeadline } from '../../utils/resolveAcceptanceDeadline';
import { shouldUseCookedFoodConfirmModal } from '../../utils/cookedFoodOrder';
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

  const needsReadyInConfirm = useMemo(
    () =>
      orderForDialog != null && shouldUseCookedFoodConfirmModal(orderForDialog),
    [orderForDialog]
  );

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
    incomingOrder.visible &&
    !incomingOrder.showCancelDialog &&
    !incomingOrder.showConfirmDialog;
  const slotPast = useActionableDeliverySlotPast(
    incomingOrder.visible ? incomingOrder.details : null,
    incomingOrder.uiState
  );

  const finishFirstOrderGuidance = useCallback(
    async (orderId: string, order: BusinessOrder) => {
      if (!showFirstOrderGuidance) return;
      await ensureFirstOrderPinForOrder(order, {
        businessId: order.business_id,
        ordersTotal: aggregates?.ordersTotal,
        isLegacyNudgeConverted: legacyConverted,
        source: 'overlay',
      });
      trackFirstOrderConfirmed({ order_id: orderId });
    },
    [aggregates?.ordersTotal, legacyConverted, showFirstOrderGuidance]
  );

  const handleConfirm = useCallback(() => {
    const orderId = incomingOrder.orderId;
    const order = orderForDialog;
    if (showFirstOrderGuidance && orderId) {
      trackFirstOrderConfirmStarted({ order_id: orderId });
    }
    if (needsReadyInConfirm) {
      incomingOrder.openConfirm();
      return;
    }
    void (async () => {
      try {
        await incomingOrder.confirm();
        if (orderId && order) {
          await finishFirstOrderGuidance(orderId, order);
        }
      } catch {
        // IncomingOrderStore surfaces the error message.
      }
    })();
  }, [
    finishFirstOrderGuidance,
    incomingOrder,
    needsReadyInConfirm,
    orderForDialog,
    showFirstOrderGuidance,
  ]);

  const handleCookedConfirm = useCallback(
    async (payload: ConfirmOrderPayload) => {
      const orderId = incomingOrder.orderId;
      const order = orderForDialog;
      const res = await incomingOrder.confirm({
        ready_in_minutes: payload.ready_in_minutes,
      });
      if (res.success && orderId && order) {
        await finishFirstOrderGuidance(orderId, order);
      }
      return {
        success: res.success,
        message: res.message,
        pay_after_merchant_confirm: res.pay_after_merchant_confirm,
      };
    },
    [finishFirstOrderGuidance, incomingOrder, orderForDialog]
  );

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
        <CookedFoodConfirmOrderDialog
          visible={incomingOrder.showConfirmDialog}
          order={orderForDialog}
          onDismiss={() => {
            if (incomingOrder.uiState === 'resolved') {
              incomingOrder.onConfirmed();
              return;
            }
            incomingOrder.closeConfirm();
          }}
          onConfirm={handleCookedConfirm}
        />
      ) : null}
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
