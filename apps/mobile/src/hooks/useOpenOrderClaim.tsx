import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { AgentClaimConfirmDialog } from '../components/dialogs/AgentClaimConfirmDialog';
import { ClaimTopupFormDialog } from '../components/dialogs/ClaimTopupFormDialog';
import { SimpleMessageDialog } from '../components/dialogs/SimpleMessageDialog';
import { ActionLoadingDialog } from '../components/feedback/ActionLoadingDialog';
import { useAgentLocationFeatures } from './useAgentLocationFeatures';
import { agentApi } from '../services/agentApi';
import { useStore } from '../stores/RootStore';
import type { Order } from '../types/agent';
import { resolveDefaultClaimTopupPhone } from '../utils/defaultClaimTopupPhone';
import { claimAwaitingParams } from '../utils/claimAwaitingNav';

type ClaimFns = {
  orders: Order[];
  refetch: () => Promise<unknown>;
  claimOrder: (orderId: string) => Promise<unknown>;
  claimOrderWithTopup: (orderId: string, phone?: string) => Promise<{
    phoneNumber?: string;
    paymentTransaction?: { id?: string };
  }>;
  isStripeRail: boolean;
};

/** Claim confirm / top-up flow shared by Home and Available Orders. */
export function useOpenOrderClaim({
  orders,
  refetch,
  claimOrder,
  claimOrderWithTopup,
  isStripeRail,
}: ClaimFns) {
  const { t } = useTranslation();
  const { auth } = useStore();
  const navigation = useNavigation<any>();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [topupOrderId, setTopupOrderId] = useState<string | null>(null);
  const [topupPhone, setTopupPhone] = useState('');
  const [claimConfirm, setClaimConfirm] = useState<{ order: Order; holdAmount: number } | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);
  const location = useAgentLocationFeatures();

  const showStripeUnavailable = useCallback(() => {
    setInfoDialog({
      title: t('agent.claimOrder.stripeFundingUnavailableTitle', 'Claim unavailable'),
      message: t(
        'agent.claimOrder.stripeFundingUnavailableBody',
        'This order requires account funding, but Mobile Money top-up is not available in your country. Please contact support.'
      ),
    });
  }, [t]);

  const onLocationBlocked = useCallback(() => {
    if (location.consent === 'not_shown') {
      void location.promptPermissionsWithDisclosure?.();
      return;
    }
    if (location.consent === 'deferred') {
      Alert.alert(
        t('agent.locationTracking.deferredNudgeTitle', 'Location required'),
        t('agent.locationTracking.deferredNudgeMessage', 'Accept location disclosure and enable location permissions.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('agent.locationTracking.enableTracking', 'Enable tracking'), onPress: () => void location.runPermissionFlow?.() },
        ]
      );
      return;
    }
    if (location.consent === 'accepted' && !location.osForegroundGranted) {
      Alert.alert(
        t('agent.locationTracking.enableSettingsTitle', 'Enable location'),
        t('agent.locationTracking.enableSettingsMessage', 'Turn on location in your device settings.'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          { text: t('agent.locationTracking.openSettings', 'Open device settings'), onPress: () => void Linking.openSettings() },
        ]
      );
    }
  }, [location, t]);

  const openConfirm = useCallback((order: Order, holdAmount: number) => {
    setClaimConfirm({ order, holdAmount: isStripeRail ? 0 : holdAmount });
  }, [isStripeRail]);

  const startClaim = useCallback(async (order: Order) => {
    if (!location.canClaim) {
      onLocationBlocked();
      return;
    }
    setClaimingId(order.id);
    try {
      const availability = await agentApi.orders.getClaimAvailability(order.id);
      if (!availability.orderOpenStatus) {
        setInfoDialog({
          title: t('orders.orderNoLongerOpenTitle', { defaultValue: 'Order not available' }),
          message: availability.message || t('orders.orderNoLongerOpenMessage', { defaultValue: 'This order is no longer available.' }),
        });
        await refetch();
        return;
      }
      if (availability.hasEnoughFundsForHold) {
        openConfirm(order, availability.holdAmount ?? 0);
        return;
      }
      if (isStripeRail) {
        showStripeUnavailable();
        return;
      }
      setTopupPhone(await resolveDefaultClaimTopupPhone(auth.user));
      setTopupOrderId(order.id);
    } catch (e) {
      setInfoDialog({
        title: t('common.error'),
        message: e instanceof Error ? e.message : t('messages.orderClaimError', { defaultValue: 'Failed to claim order' }),
      });
    } finally {
      setClaimingId(null);
    }
  }, [auth.user, isStripeRail, location.canClaim, onLocationBlocked, openConfirm, refetch, showStripeUnavailable, t]);

  const confirmClaim = useCallback(async (order: Order) => {
    if (!location.canClaim) {
      onLocationBlocked();
      return;
    }
    setClaimingId(order.id);
    try {
      const availability = await agentApi.orders.getClaimAvailability(order.id);
      if (!availability.orderOpenStatus) {
        setInfoDialog({
          title: t('orders.orderNoLongerOpenTitle', { defaultValue: 'Order not available' }),
          message: availability.message || t('orders.orderNoLongerOpenMessage', { defaultValue: 'This order is no longer available.' }),
        });
        await refetch();
        return;
      }
      if (availability.needsTopUpToClaim) {
        if (isStripeRail) {
          showStripeUnavailable();
          return;
        }
        setTopupPhone(await resolveDefaultClaimTopupPhone(auth.user));
        setTopupOrderId(order.id);
        return;
      }
      await claimOrder(order.id);
    } catch (e) {
      setInfoDialog({
        title: t('common.error'),
        message: e instanceof Error ? e.message : t('messages.orderClaimError', { defaultValue: 'Failed to claim order' }),
      });
    } finally {
      setClaimingId(null);
    }
  }, [auth.user, claimOrder, isStripeRail, location.canClaim, onLocationBlocked, refetch, showStripeUnavailable, t]);

  const confirmTopup = useCallback(async (phoneE164: string) => {
    const id = topupOrderId;
    if (!id) return;
    setClaimingId(id);
    try {
      const availability = await agentApi.orders.getClaimAvailability(id);
      if (!availability.orderOpenStatus) {
        setTopupOrderId(null);
        await refetch();
        return;
      }
      if (availability.hasEnoughFundsForHold) {
        setTopupOrderId(null);
        const order = orders.find((o) => o.id === id);
        if (order) openConfirm(order, availability.holdAmount ?? 0);
        return;
      }
      if (isStripeRail) {
        setTopupOrderId(null);
        showStripeUnavailable();
        return;
      }
      if (!location.canClaim) {
        onLocationBlocked();
        return;
      }
      setTopupOrderId(null);
      const response = await claimOrderWithTopup(id, phoneE164);
      const order = orders.find((item) => item.id === id);
      const awaiting = claimAwaitingParams({
        orderId: id,
        orderNumber: order?.order_number,
        phoneE164,
        currency: order?.currency,
        response,
      });
      if (!awaiting) {
        setInfoDialog({
          title: t('common.error'),
          message: t('messages.orderClaimError', { defaultValue: 'Failed to claim order' }),
        });
        return;
      }
      navigation.navigate('ClaimAwaitingPayment', awaiting);
    } catch (e) {
      setInfoDialog({
        title: t('common.error'),
        message: e instanceof Error ? e.message : t('messages.orderClaimError', { defaultValue: 'Failed to claim order' }),
      });
    } finally {
      setClaimingId(null);
    }
  }, [claimOrderWithTopup, isStripeRail, location.canClaim, navigation, onLocationBlocked, openConfirm, orders, refetch, showStripeUnavailable, t, topupOrderId]);

  const dialogs: ReactNode = (
    <>
      <AgentClaimConfirmDialog
        visible={!!claimConfirm}
        order={claimConfirm?.order ?? null}
        holdAmount={claimConfirm?.holdAmount ?? 0}
        onDismiss={() => setClaimConfirm(null)}
        onConfirm={() => {
          if (!claimConfirm) return;
          const next = claimConfirm.order;
          setClaimConfirm(null);
          void confirmClaim(next);
        }}
      />
      <ClaimTopupFormDialog
        visible={!!topupOrderId}
        order={topupOrderId ? orders.find((o) => o.id === topupOrderId) ?? null : null}
        phone={topupPhone}
        onChangePhone={setTopupPhone}
        onDismiss={() => setTopupOrderId(null)}
        onConfirm={(e164) => void confirmTopup(e164)}
        confirming={!!topupOrderId && claimingId === topupOrderId}
      />
      <SimpleMessageDialog
        visible={!!infoDialog}
        title={infoDialog?.title ?? ''}
        message={infoDialog?.message ?? ''}
        dismissLabel={t('common.ok', { defaultValue: 'OK' })}
        onDismiss={() => setInfoDialog(null)}
      />
      <ActionLoadingDialog
        visible={!!claimingId || location.disclosurePermissionLoading}
        action={claimingId ? 'claim' : 'generic_update'}
        message={
          claimingId
            ? t('agent.claimOrder.processing', 'Claiming order…')
            : t('agent.locationTracking.disclosureProcessing', 'Setting up location…')
        }
      />
    </>
  );

  return {
    startClaim,
    claimingId,
    locationCanClaim: location.canClaim,
    onLocationBlocked,
    disclosurePermissionLoading: location.disclosurePermissionLoading,
    dialogs,
  };
}
