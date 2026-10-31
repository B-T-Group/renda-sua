import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppModal } from '../../../components/common/AppModal';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useMainTabContentBottomPadding, useTabBarOverlayHeight } from '../../../hooks/useMainTabContentBottomPadding';
import { useOrderDetail } from '../../../hooks/useOrderDetail';
import { useAgentOrders } from '../../../hooks/useAgentOrders';
import { useActiveDeliveryPinForComplete } from '../../../hooks/useActiveDeliveryPinForComplete';
import { useFailedDeliveryReasons } from '../../../hooks/useFailedDeliveryReasons';
import { useAgentVerificationStatus } from '../../../hooks/useAgentVerificationStatus';
import { useOpenOrders } from '../../../hooks/useOpenOrders';
import { useIsStripeRail } from '../../../hooks/useIsStripeRail';
import { agentApi } from '../../../services/agentApi';
import type { Order } from '../../../types/agent';
import { Portal, Dialog, Button, Text as PaperText, Snackbar } from 'react-native-paper';
import { DedicatedReleaseCard } from '../../../components/dedicated/DedicatedReleaseCard';
import { DedicatedHeadsUpCard } from '../../../components/dedicated/DedicatedHeadsUpCard';
import { AgentClaimConfirmDialog } from '../../../components/dialogs/AgentClaimConfirmDialog';
import { ClaimTopupFormDialog } from '../../../components/dialogs/ClaimTopupFormDialog';
import { MarkPaidCashExceptionDialog } from '../../../components/dialogs/MarkPaidCashExceptionDialog';
import { RequestPayAtDeliveryDialog } from '../../../components/dialogs/RequestPayAtDeliveryDialog';
import { SimpleMessageDialog } from '../../../components/dialogs/SimpleMessageDialog';
import { CompleteDeliveryPinDialog } from '../../../components/dialogs/CompleteDeliveryPinDialog';
import { ClientCouldNotConfirmSheet } from '../../../components/dialogs/ClientCouldNotConfirmSheet';
import { AgentWaitingForClientCard } from '../../../components/agent/AgentWaitingForClientCard';
import { DeliveryCompleteSuccessModal } from '../../../components/dialogs/DeliveryCompleteSuccessModal';
import { ConfirmActionDialog } from '../../../components/dialogs/ConfirmActionDialog';
import { ActionLoadingDialog } from '../../../components/feedback/ActionLoadingDialog';
import { hasCashExceptionBlockingDeposit } from '../../../utils/depositResume';
import { AgentOrderInlineDelivery } from '../../../components/agent/AgentOrderInlineDelivery';
import { AgentOrderStatusUrgencyRow } from '../../../components/agent/AgentOrderStatusUrgencyRow';
import { AgentOrderDetailMoreSheet } from '../../../components/agent/AgentOrderDetailMoreSheet';
import { useStore } from '../../../stores/RootStore';
import { resolveDefaultClaimTopupPhone } from '../../../utils/defaultClaimTopupPhone';
import { claimAwaitingParams } from '../../../utils/claimAwaitingNav';
import {
  agentIdVerificationPending,
  agentNeedsIdUpload,
  agentNeedsMomoSetup,
} from '../../../utils/agentClaimSetupGate';
import { mergeOrderForDeliverySuccess } from '../../../utils/mergeOrderForDeliverySuccess';
import { orderNeedsPayAtDeliveryAgentActions } from '../../../utils/orderPaymentAgentActions';
import { resolveAmountDueAfterDeposit } from '../../../utils/depositResume';
import type { OrderDetailScreenProps } from './types';
import { ExpandableSection } from '../../../components/common/ExpandableSection';
import {
  buildDeliveryOrderViewModel,
  type OrderViewModelContext,
} from '../../../orders/model';
import { orderStatusStripeColor } from '../../../utils/clientOrderListDisplay';
import {
  agentOrderDetailMoreItems,
  type AgentOrderMoreItemId,
} from '../../../utils/agentOrderDetailMoreItems';
import { resolveAgentOrderPrimaryCta } from '../../../utils/resolveAgentOrderPrimaryCta';
import { useDeliveryConfirmation } from '../../../hooks/useDeliveryConfirmation';
import { captureAndUploadDeliveryProof } from '../../../services/deliveryProofUpload';
import { resolveUsesLegacyPin } from '../../../utils/deliveryConfirmationUi';
import type { DeliveryProofPhotoInput } from '../../../types/deliveryConfirmation';

export const AgentOrderDetailMoreRegisterContext = createContext<{
  setMorePress: (press: (() => void) | null) => void;
}>({ setMorePress: () => undefined });

type Props = OrderDetailScreenProps;

const CARD_PADDING = 16;
const SECTION_GAP = 16;

type LifecycleActionKey = 'pickUp' | 'outForDelivery';

const LIFECYCLE_ACTION_CONFIRM: Record<
  LifecycleActionKey,
  { titleKey: string; titleDef: string; messageKey: string; messageDef: string }
> = {
  pickUp: {
    titleKey: 'agent.orders.detail.actionConfirm.pickUpTitle',
    titleDef: 'Confirm pickup',
    messageKey: 'agent.orders.detail.actionConfirm.pickUpMessage',
    messageDef: 'Mark this order as picked up from the business?',
  },
  outForDelivery: {
    titleKey: 'agent.orders.detail.actionConfirm.outForDeliveryTitle',
    titleDef: 'Confirm out for delivery',
    messageKey: 'agent.orders.detail.actionConfirm.outForDeliveryMessage',
    messageDef: 'Mark this order as out for delivery at the customer address?',
  },
};

/** Client PII only after the order is claimed / assigned to an agent. */
function showClientPiiToAgent(order: Order): boolean {
  if (order.assigned_agent_id) return true;
  const s = order.current_status;
  return [
    'assigned_to_agent',
    'picked_up',
    'in_transit',
    'out_for_delivery',
    'awaiting_client_confirmation',
    'pending_auto_complete',
    'disputed',
    'delivered',
    'complete',
  ].includes(s);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderDetailAgentView({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { auth, ordersSignal } = useStore();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { colors, typography, borderRadius } = theme;
  const { order, earnings, loading, error, refetch: refetchOrder, applyOrderFromActionResponse } =
    useOrderDetail(orderId);
  const {
    pickUp,
    outForDelivery,
    completeDelivery,
    markDelivered,
    clientCouldNotConfirm,
    initiatePayAtDeliveryPayment,
    markPaidInCashException,
    dropOrder,
    requestPickupDelay,
    failDelivery,
    refetch: refetchOrders,
  } = useAgentOrders();
  const { reasons } = useFailedDeliveryReasons('fr');
  const { agentStatus, isVerified, idDocumentStatus, refetch: refetchVerification } =
    useAgentVerificationStatus();
  const { canClaim: ordersCanClaim, refetch: refetchOpenOrders } = useOpenOrders();
  const { isStripeRail } = useIsStripeRail();
  const { state: confirmState, refetch: refetchConfirm } = useDeliveryConfirmation(
    orderId,
    order?.current_status,
    order?.fulfillment_method
  );
  const usesLegacyPin = resolveUsesLegacyPin(confirmState);
  const [fallbackSheetVisible, setFallbackSheetVisible] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetchVerification();
      void refetchOpenOrders();
    }, [refetchVerification, refetchOpenOrders])
  );

  const deliveryVm = useMemo(() => {
    if (!order) return null;
    const ctx: OrderViewModelContext = {
      t: (key, defaultValue, options) =>
        String(t(key, { defaultValue: defaultValue ?? key, ...(options ?? {}) })),
      now: new Date(),
      locale: i18n.language,
    };
    return buildDeliveryOrderViewModel(order, ctx);
  }, [order, t, i18n.language]);
  const [actionLoading, setActionLoading] = useState(false);
  const [failModalVisible, setFailModalVisible] = useState(false);
  const [failReasonId, setFailReasonId] = useState('');
  const [failNotes, setFailNotes] = useState('');
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const {
    autoSharedPin,
    autoPinMessageId,
    resolvingSharedPin,
    noSharedPin,
    resetSharedPinState,
  } = useActiveDeliveryPinForComplete(orderId, completeModalVisible);
  const [deliverySuccessOrder, setDeliverySuccessOrder] = useState<Order | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [ticketType, setTicketType] = useState<'complaint' | 'dispute' | 'question'>('complaint');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [showClaimTopupModal, setShowClaimTopupModal] = useState(false);
  const [claimTopupPhone, setClaimTopupPhone] = useState('');
  const [claimConfirmHold, setClaimConfirmHold] = useState<number | null>(null);
  const [claimInfoDialog, setClaimInfoDialog] = useState<{ title: string; message: string } | null>(null);
  const [lifecycleActionConfirm, setLifecycleActionConfirm] = useState<LifecycleActionKey | null>(null);
  const [showRequestPayAtDeliveryDialog, setShowRequestPayAtDeliveryDialog] = useState(false);
  const [showCashExceptionDialog, setShowCashExceptionDialog] = useState(false);
  const [payAtDeliveryDialogLoading, setPayAtDeliveryDialogLoading] = useState(false);
  const tabScrollBottomPad = useMainTabContentBottomPadding(16);
  const tabBarOverlay = useTabBarOverlayHeight();
  const stickyBottomPad = tabBarOverlay + 12;
  const [dropConfirmVisible, setDropConfirmVisible] = useState(false);
  const [dropSnack, setDropSnack] = useState<string | null>(null);
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const { setMorePress } = useContext(AgentOrderDetailMoreRegisterContext);

  const prevVerifiedRef = useRef(isVerified);
  useEffect(() => {
    const wasVerified = prevVerifiedRef.current === true;
    prevVerifiedRef.current = isVerified;
    if (isVerified && !wasVerified) {
      void refetchOpenOrders();
    }
  }, [isVerified, refetchOpenOrders]);

  const goBack = useCallback(() => {
    refetchOrders();
    navigation.goBack();
  }, [navigation, refetchOrders]);

  const refreshAfterOrderAction = useCallback(async () => {
    ordersSignal.notifyStatusChanged();
    await refetchOrder();
    void refetchOrders();
  }, [ordersSignal, refetchOrder, refetchOrders]);

  const runAction = useCallback(
    async (fn: () => Promise<unknown>) => {
      setActionLoading(true);
      try {
        const result = await fn();
        applyOrderFromActionResponse(result);
        await refreshAfterOrderAction();
      } catch (e) {
        Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.genericError', 'Something went wrong.'));
      } finally {
        setActionLoading(false);
      }
    },
    [applyOrderFromActionResponse, refreshAfterOrderAction, t]
  );

  const handleLifecycleActionConfirm = useCallback(() => {
    const action = lifecycleActionConfirm;
    setLifecycleActionConfirm(null);
    if (!action) return;
    if (action === 'pickUp') void runAction(() => pickUp(orderId));
    else void runAction(() => outForDelivery(orderId));
  }, [lifecycleActionConfirm, orderId, outForDelivery, pickUp, runAction]);

  const handleConfirmDropOrder = useCallback(async () => {
    setDropConfirmVisible(false);
    setActionLoading(true);
    try {
      await dropOrder(orderId);
      void refetchOrders();
      navigation.goBack();
    } catch (e: unknown) {
      setDropSnack(
        e instanceof Error
          ? e.message
          : t('agent.orders.detail.dropOrderError', 'Could not drop this order.')
      );
    } finally {
      setActionLoading(false);
    }
  }, [dropOrder, navigation, orderId, refetchOrders, t]);

  const handleRunningLate = useCallback(async () => {
    setActionLoading(true);
    try {
      await requestPickupDelay(orderId);
      setDropSnack(
        t(
          'agent.orders.detail.runningLateSuccess',
          'Pickup deadline extended. Head to the store now.'
        )
      );
      try {
        await refetchOrder();
      } catch {
        // Extension already succeeded; stale UI is better than a false error.
      }
    } catch (e: unknown) {
      setDropSnack(
        e instanceof Error
          ? e.message
          : t(
              'agent.orders.detail.runningLateError',
              'Could not extend the pickup deadline.'
            )
      );
    } finally {
      setActionLoading(false);
    }
  }, [orderId, refetchOrder, requestPickupDelay, t]);

  const moreItems = useMemo(
    () =>
      order
        ? agentOrderDetailMoreItems({
            status: order.current_status,
            assignedAgentId: order.assigned_agent_id,
            pickupExtensionMinutes: order.pickup_extension_minutes,
            needsPayAtDeliveryActions: orderNeedsPayAtDeliveryAgentActions(order),
            cashExceptionBlocked: hasCashExceptionBlockingDeposit(order),
          })
        : [],
    [order]
  );

  const openMore = useCallback(() => setMoreSheetVisible(true), []);

  useEffect(() => {
    if (moreItems.length === 0) {
      setMorePress(null);
      return () => setMorePress(null);
    }
    setMorePress(() => openMore);
    return () => setMorePress(null);
  }, [moreItems.length, openMore, setMorePress]);

  const handleMoreSelect = useCallback((id: AgentOrderMoreItemId) => {
    if (id === 'runningLate') void handleRunningLate();
    else if (id === 'release') setDropConfirmVisible(true);
    else if (id === 'reportIssue') setReportModalVisible(true);
    else if (id === 'failDelivery') setFailModalVisible(true);
    else setShowCashExceptionDialog(true);
  }, [handleRunningLate]);

  const handlePayAtDeliveryRequestSubmit = useCallback(
    async (phoneOverride?: string) => {
      setPayAtDeliveryDialogLoading(true);
      try {
        const res = await initiatePayAtDeliveryPayment(orderId, phoneOverride);
        applyOrderFromActionResponse(res);
        setShowRequestPayAtDeliveryDialog(false);
        await refreshAfterOrderAction();
        Alert.alert(
          t('common.done', { defaultValue: 'Done' }),
          t('agent.orders.payAtDelivery.successRequest', { defaultValue: 'Payment request sent to the client.' })
        );
      } catch (error: any) {
        Alert.alert(t('common.error'), error instanceof Error ? error.message : t('common.genericError', 'Something went wrong.'));
      } finally {
        setPayAtDeliveryDialogLoading(false);
      }
    },
    [applyOrderFromActionResponse, initiatePayAtDeliveryPayment, orderId, refreshAfterOrderAction, t]
  );

  const handleCashExceptionConfirm = useCallback(
    async (notes: string) => {
      setPayAtDeliveryDialogLoading(true);
      try {
        const res = await markPaidInCashException(orderId, notes);
        applyOrderFromActionResponse(res);
        setShowCashExceptionDialog(false);
        await refreshAfterOrderAction();
        Alert.alert(
          t('common.done', { defaultValue: 'Done' }),
          usesLegacyPin
            ? t('agent.orders.payAtDelivery.successCash', {
                defaultValue: 'Cash exception recorded. Business reconciliation required.',
              })
            : t(
                'orders.clientConfirm.payReceivedNext',
                'Payment received. Ask the client to confirm receipt in the app.'
              )
        );
      } catch (error: any) {
        Alert.alert(t('common.error'), error instanceof Error ? error.message : t('common.genericError', 'Something went wrong.'));
      } finally {
        setPayAtDeliveryDialogLoading(false);
      }
    },
    [applyOrderFromActionResponse, markPaidInCashException, orderId, refreshAfterOrderAction, t, usesLegacyPin]
  );

  const showStripeClaimFundingUnavailable = useCallback(() => {
    setClaimInfoDialog({
      title: t('agent.claimOrder.stripeFundingUnavailableTitle', 'Claim unavailable'),
      message: t(
        'agent.claimOrder.stripeFundingUnavailableBody',
        'This order requires account funding, but Mobile Money top-up is not available in your country. Please contact support.'
      ),
    });
  }, [t]);

  const handleFail = useCallback(async () => {
    if (!failReasonId) {
      Alert.alert(t('common.error'), t('agent.orders.detail.selectFailureReason', 'Please choose a reason.'));
      return;
    }
    setActionLoading(true);
    try {
      const res = await failDelivery(orderId, failReasonId, failNotes || undefined);
      applyOrderFromActionResponse(res);
      setFailModalVisible(false);
      setFailReasonId('');
      setFailNotes('');
      await refreshAfterOrderAction();
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.genericError', 'Something went wrong.'));
    } finally {
      setActionLoading(false);
    }
  }, [applyOrderFromActionResponse, failDelivery, orderId, failReasonId, failNotes, refreshAfterOrderAction, t]);

  const closeCompleteModal = useCallback(() => {
    setCompleteModalVisible(false);
    setCompleteError(null);
    resetSharedPinState();
  }, [resetSharedPinState]);

  const finishCompleteDelivery = useCallback(
    async (params: {
      pin?: string;
      useLatestSharedPin?: boolean;
      pinMessageId?: string;
    }) => {
      const orderSnapshot = order;
      setActionLoading(true);
      setCompleteError(null);
      try {
        const res = await completeDelivery(orderId, params);
        applyOrderFromActionResponse(res);
        closeCompleteModal();
        setDeliverySuccessOrder(
          orderSnapshot ? mergeOrderForDeliverySuccess(orderSnapshot, res.order ?? null) : res.order ?? null
        );
        void refreshAfterOrderAction();
      } catch (e) {
        const msg = e instanceof Error ? e.message : t('common.genericError', 'Something went wrong.');
        setCompleteError(msg);
        Alert.alert(t('common.error'), msg);
      } finally {
        setActionLoading(false);
      }
    },
    [
      applyOrderFromActionResponse,
      closeCompleteModal,
      completeDelivery,
      order,
      orderId,
      refreshAfterOrderAction,
      t,
    ]
  );

  const handleCompleteWithSharedPin = useCallback(async () => {
    await finishCompleteDelivery({
      useLatestSharedPin: true,
      pinMessageId: autoPinMessageId ?? undefined,
    });
  }, [autoPinMessageId, finishCompleteDelivery]);

  const handleCompleteDeliverySubmit = useCallback(
    async (pin: string) => {
      const trimmed = pin.trim();
      if (trimmed.length !== 4) {
        setCompleteError(t('orders.completeDelivery.invalidPin', 'The PIN must be exactly 4 digits.'));
        return;
      }
      await finishCompleteDelivery({ pin: trimmed });
    },
    [finishCompleteDelivery, t]
  );

  const handleMarkDelivered = useCallback(async () => {
    setActionLoading(true);
    try {
      const latest = (await refetchConfirm()) ?? confirmState;
      if (latest?.usesLegacyPin === true) {
        setCompleteModalVisible(true);
        setCompleteError(null);
        return;
      }
      const res = await markDelivered(orderId);
      applyOrderFromActionResponse(res);
      await refreshAfterOrderAction();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.genericError', 'Something went wrong.'));
    } finally {
      setActionLoading(false);
    }
  }, [
    applyOrderFromActionResponse,
    confirmState,
    markDelivered,
    orderId,
    refetchConfirm,
    refreshAfterOrderAction,
    t,
  ]);

  const handleFallbackSubmit = useCallback(
    async (photos: DeliveryProofPhotoInput[], note: string) => {
      if (photos.length < 1) return;
      setActionLoading(true);
      setFallbackError(null);
      try {
        const withNote = note.trim() ? photos.map((p) => ({ ...p, note: note.trim() })) : photos;
        const res = await clientCouldNotConfirm(orderId, withNote);
        applyOrderFromActionResponse(res);
        setFallbackSheetVisible(false);
        await refreshAfterOrderAction();
        await refetchConfirm();
      } catch (e: unknown) {
        setFallbackError(e instanceof Error ? e.message : t('common.genericError', 'Something went wrong.'));
      } finally {
        setActionLoading(false);
      }
    },
    [applyOrderFromActionResponse, clientCouldNotConfirm, orderId, refetchConfirm, refreshAfterOrderAction, t]
  );

  const closeReportModal = useCallback(() => {
    setReportModalVisible(false);
    setTicketType('complaint');
    setTicketSubject('');
    setTicketDescription('');
  }, []);

  const handleSubmitTicket = useCallback(async () => {
    if (!ticketSubject.trim()) {
      Alert.alert(t('common.error'), t('support.subjectRequired', { defaultValue: 'Sujet requis.' }));
      return;
    }
    setTicketSubmitting(true);
    try {
      await agentApi.support.createTicket({
        orderId,
        type: ticketType,
        subject: ticketSubject.trim(),
        description: ticketDescription.trim() || undefined,
      });
      closeReportModal();
      Alert.alert(
        t('support.ticketCreatedTitle', { defaultValue: 'Ticket créé' }),
        t('support.ticketCreated', { defaultValue: 'Votre demande a été envoyée au support.' })
      );
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('common.genericError', 'Something went wrong.'));
    } finally {
      setTicketSubmitting(false);
    }
  }, [closeReportModal, orderId, t, ticketDescription, ticketSubject, ticketType]);

  const handleConfirmClaim = useCallback(async () => {
    setClaimLoading(true);
    try {
      const availability = await agentApi.orders.getClaimAvailability(orderId);
      if (!availability.orderOpenStatus) {
        setClaimInfoDialog({
          title: t('orders.orderNoLongerOpenTitle', 'Commande non disponible'),
          message: availability.message || t('orders.orderNoLongerOpenMessage', 'Cette commande n\'est plus réclamable.'),
        });
        await refetchOrder();
        return;
      }
      if (availability.needsTopUpToClaim) {
        if (isStripeRail) {
          showStripeClaimFundingUnavailable();
          return;
        }
        setClaimTopupPhone(await resolveDefaultClaimTopupPhone(auth.user));
        setShowClaimTopupModal(true);
        return;
      }
      await agentApi.orders.claimOrder(orderId);
      await refreshAfterOrderAction();
    } catch (e) {
      setClaimInfoDialog({
        title: t('common.error'),
        message: e instanceof Error ? e.message : t('agent.claimOrder.failure', 'Could not claim this order.'),
      });
    } finally {
      setClaimLoading(false);
    }
  }, [auth.user, isStripeRail, orderId, refreshAfterOrderAction, showStripeClaimFundingUnavailable, t]);

  const goToDocuments = useCallback(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Documents' as never);
      return;
    }
    (navigation as { navigate: (name: string) => void }).navigate('Documents');
  }, [navigation]);

  const goToMomoSetup = useCallback(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('MobilePaymentPhones' as never);
      return;
    }
    (navigation as { navigate: (name: string) => void }).navigate('MobilePaymentPhones');
  }, [navigation]);

  /** Aligné web `AvailableOrderCard` : fonds OK → confirmation ; sinon → top-up. */
  const handleClaimStart = useCallback(async () => {
    if (!order) return;
    if (!ordersCanClaim) {
      const idPending = agentIdVerificationPending({
        isStripeRail,
        isVerified,
        idDocumentStatus,
      });
      const needsId = agentNeedsIdUpload({
        isStripeRail,
        isVerified,
        idDocumentStatus,
      });
      const needsMomo = agentNeedsMomoSetup({
        isStripeRail,
        isVerified,
        idDocumentStatus,
      });

      if (idPending) {
        setClaimInfoDialog({
          title: t('agent.openOrders.idPendingTitle', 'ID under review'),
          message: t(
            'agent.openOrders.idPendingBody',
            'We received your identification document. A reviewer will approve it soon. You can claim deliveries once your account is verified.'
          ),
        });
        return;
      }
      if (needsId) {
        goToDocuments();
        return;
      }
      if (needsMomo) {
        goToMomoSetup();
        return;
      }
      setClaimInfoDialog({
        title: t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim'),
        message: t(
          'agent.openOrders.previewBanner',
          'These deliveries are available in your country. Complete verification to claim them.'
        ),
      });
      return;
    }
    setClaimLoading(true);
    try {
      const availability = await agentApi.orders.getClaimAvailability(orderId);
      if (!availability.orderOpenStatus) {
        setClaimInfoDialog({
          title: t('orders.orderNoLongerOpenTitle', 'Commande non disponible'),
          message: availability.message || t('orders.orderNoLongerOpenMessage', 'Cette commande n\'est plus réclamable.'),
        });
        await refetchOrder();
        return;
      }
      if (availability.hasEnoughFundsForHold) {
        setClaimConfirmHold(availability.holdAmount ?? 0);
        return;
      }
      if (isStripeRail) {
        showStripeClaimFundingUnavailable();
        return;
      }
      setClaimTopupPhone(await resolveDefaultClaimTopupPhone(auth.user));
      setShowClaimTopupModal(true);
    } catch (e) {
      setClaimInfoDialog({
        title: t('common.error'),
        message: e instanceof Error ? e.message : 'Échec vérification',
      });
    } finally {
      setClaimLoading(false);
    }
  }, [
    auth.user,
    goToDocuments,
    goToMomoSetup,
    idDocumentStatus,
    isStripeRail,
    isVerified,
    order,
    orderId,
    ordersCanClaim,
    refetchOrder,
    showStripeClaimFundingUnavailable,
    t,
  ]);

  const handleClaimWithTopup = useCallback(async (phoneE164: string) => {
    if (!order) return;
    setClaimLoading(true);
    try {
      const availability = await agentApi.orders.getClaimAvailability(orderId);
      if (!availability.orderOpenStatus) {
        setShowClaimTopupModal(false);
        setClaimTopupPhone('');
        setClaimInfoDialog({
          title: t('orders.orderNoLongerOpenTitle', 'Commande non disponible'),
          message: availability.message || t('orders.orderNoLongerOpenMessage', 'Cette commande n\'est plus réclamable.'),
        });
        await refetchOrder();
        return;
      }
      if (availability.hasEnoughFundsForHold) {
        setShowClaimTopupModal(false);
        setClaimTopupPhone('');
        setClaimConfirmHold(availability.holdAmount ?? 0);
        return;
      }
      if (isStripeRail) {
        setShowClaimTopupModal(false);
        setClaimTopupPhone('');
        showStripeClaimFundingUnavailable();
        return;
      }
      const response = await agentApi.orders.claimOrderWithTopup(orderId, phoneE164);
      setShowClaimTopupModal(false);
      setClaimTopupPhone('');
      const awaiting = claimAwaitingParams({
        orderId,
        orderNumber: order.order_number,
        phoneE164,
        currency: order.currency,
        response,
      });
      if (!awaiting) {
        setClaimInfoDialog({
          title: t('common.error'),
          message: t('agent.claimOrder.failure', 'Could not claim this order.'),
        });
        return;
      }
      navigation.navigate('ClaimAwaitingPayment', awaiting);
    } catch (e) {
      setClaimInfoDialog({
        title: t('common.error'),
        message: e instanceof Error ? e.message : t('agent.claimOrder.failure', 'Could not claim this order.'),
      });
    } finally {
      setClaimLoading(false);
    }
  }, [isStripeRail, navigation, order, orderId, refetchOrder, showStripeClaimFundingUnavailable, t]);

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: CARD_PADDING,
    marginBottom: SECTION_GAP,
  };

  if (loading && !order) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <Text style={[styles.errorText, { color: colors.error.main }, typography.body2]}>
          {error || t('agent.orders.detail.notFound', 'Order not found')}
        </Text>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.primary.main, borderRadius: borderRadius.md }]} onPress={goBack}>
          <Text style={[styles.backBtnText, { color: colors.primary.contrast }, typography.button]}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  const status = order.current_status;
  const showClientPii = showClientPiiToAgent(order);
  const needsPayAtDeliveryActions = orderNeedsPayAtDeliveryAgentActions(order);
  const agentAmountDue = resolveAmountDueAfterDeposit(order);
  const statusLabel = t(`common.orderStatus.${status}`, status);
  const primaryCta = resolveAgentOrderPrimaryCta({
    status,
    assignedAgentId: order.assigned_agent_id,
    agentSuspended: agentStatus === 'suspended',
    needsPayAtDeliveryActions,
    canSubmitFallback: confirmState?.canSubmitFallback === true,
  });
  const showWaitingCard =
    status === 'awaiting_client_confirmation' || status === 'pending_auto_complete';
  const payAtDeliveryPaid =
    order.payment_timing === 'pay_at_delivery' &&
    (order.payment_status === 'paid' || order.payment_status === 'authorized');
  const claimButtonLabel = ordersCanClaim
    ? t('agent.openOrders.claimButton', 'Réclamer')
    : agentIdVerificationPending({
          isStripeRail,
          isVerified,
          idDocumentStatus,
        })
      ? t('agent.openOrders.idPendingCta', 'Pending ID approval')
      : !isStripeRail && !isVerified && idDocumentStatus === 'rejected'
        ? t('agent.openOrders.idRejectedCta', 'Re-upload ID')
        : agentNeedsIdUpload({
              isStripeRail,
              isVerified,
              idDocumentStatus,
            })
          ? t('agent.openOrders.uploadIdToClaim', 'Upload ID to claim')
          : t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim');
  const earningsForCard = deliveryVm
    ? {
        ...deliveryVm.earnings,
        commission: earnings?.totalEarnings ?? deliveryVm.earnings.commission,
        estimatedTotal:
          earnings?.totalEarnings ?? deliveryVm.earnings.estimatedTotal,
      }
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: primaryCta ? footerHeight : tabScrollBottomPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {deliveryVm ? (
          <AgentOrderInlineDelivery
            vm={deliveryVm}
            earnings={earningsForCard}
            maskDeliveryContact={!showClientPii}
          />
        ) : null}

        {showWaitingCard && confirmState ? (
          <AgentWaitingForClientCard state={confirmState} payAtDeliveryPaid={payAtDeliveryPaid} />
        ) : null}

        <AgentOrderStatusUrgencyRow
          statusLabel={statusLabel}
          statusColor={orderStatusStripeColor(order.current_status || '', colors)}
          urgency={deliveryVm?.urgency ?? null}
        />

        <DedicatedReleaseCard order={order} onReleased={goBack} onRefresh={refetchOrder} />

        <DedicatedHeadsUpCard
          orderId={order?.id}
          enabled={status === 'ready_for_pickup' && !order?.assigned_agent_id}
        />

        <View style={[styles.headerCard, cardStyle]}>
          <Text style={[styles.orderNum, { color: colors.primary.main }, typography.h5]}>
            #{order.order_number}
          </Text>
          <Text style={[styles.placedOn, { color: colors.text.secondary }, typography.caption]}>
            {t('agent.orders.detail.placedOn')} {formatDate(order.created_at)}
          </Text>
          {deliveryVm?.distanceLabel ? (
            <Text style={[styles.placedOn, { color: colors.text.secondary }, typography.caption]}>
              {deliveryVm.distanceLabel}
            </Text>
          ) : null}
        </View>

        {(order.special_instructions ||
          order.preferred_delivery_time ||
          order.requires_fast_delivery ||
          order.estimated_delivery_time ||
          order.actual_delivery_time ||
          deliveryVm?.deliveryWindowLabel) && (
          <ExpandableSection title={t('agent.orders.detail.deliveryInfo', 'Delivery info')}>
            {deliveryVm?.deliveryWindowLabel ? (
              <Text style={[styles.sectionValue, { color: colors.text.primary }, typography.body2]}>
                {deliveryVm.deliveryWindowLabel}
              </Text>
            ) : null}
            {order.special_instructions ? (
              <Text style={[styles.sectionValue, { color: colors.text.primary }, typography.body2]}>
                {t('agent.orders.detail.specialInstructions')}: {order.special_instructions}
              </Text>
            ) : null}
            {order.preferred_delivery_time ? (
              <Text style={[styles.sectionValue, { color: colors.text.primary }, typography.body2]}>
                {t('agent.orders.detail.preferredDeliveryTime')}: {formatDate(order.preferred_delivery_time)}
              </Text>
            ) : null}
            {order.requires_fast_delivery ? (
              <Text style={[styles.sectionValue, { color: colors.primary.main }, typography.body2]}>
                {t('agent.orders.detail.requiresFastDelivery')}
              </Text>
            ) : null}
            {order.estimated_delivery_time ? (
              <Text style={[styles.sectionValue, { color: colors.text.secondary }, typography.caption]}>
                {t('agent.orders.detail.estimatedDeliveryTime', 'Estimated')}: {formatDate(order.estimated_delivery_time)}
              </Text>
            ) : null}
            {order.actual_delivery_time ? (
              <Text style={[styles.sectionValue, { color: colors.text.secondary }, typography.caption]}>
                {t('agent.orders.detail.actualDeliveryTime', 'Delivered')}: {formatDate(order.actual_delivery_time)}
              </Text>
            ) : null}
          </ExpandableSection>
        )}

        {/* Montants – progressive disclosure */}
        <ExpandableSection title={t('agent.orders.detail.financial', 'Amounts')}>
          {order.subtotal != null && (
            <View style={styles.financialRow}>
              <Text style={[styles.financialLabel, { color: colors.text.secondary }, typography.body2]}>
                {t('agent.orders.detail.subtotal')}
              </Text>
              <Text style={[styles.financialValue, { color: colors.text.primary }, typography.body2]}>
                {order.subtotal} {order.currency}
              </Text>
            </View>
          )}
          {(order.base_delivery_fee != null || order.delivery_commission != null) && (
            <View style={styles.financialRow}>
              <Text style={[styles.financialLabel, { color: colors.text.secondary }, typography.body2]}>
                {t('agent.orders.detail.deliveryFee')}
              </Text>
              <Text style={[styles.financialValue, { color: colors.text.primary }, typography.body2]}>
                {order.base_delivery_fee ?? order.delivery_commission ?? 0} {order.currency}
              </Text>
            </View>
          )}
          {order.tax_amount != null && order.tax_amount > 0 && (
            <View style={styles.financialRow}>
              <Text style={[styles.financialLabel, { color: colors.text.secondary }, typography.body2]}>
                {t('agent.orders.detail.tax')}
              </Text>
              <Text style={[styles.financialValue, { color: colors.text.primary }, typography.body2]}>
                {order.tax_amount} {order.currency}
              </Text>
            </View>
          )}
          {order.total_amount != null && (
            <View style={[styles.financialRow, styles.financialRowTotal]}>
              <Text style={[styles.financialLabel, { color: colors.text.primary }, typography.subtitle2]}>
                {t('agent.orders.detail.total')}
              </Text>
              <Text style={[styles.financialValue, { color: colors.text.primary }, typography.subtitle2]}>
                {order.total_amount} {order.currency}
              </Text>
            </View>
          )}
          {(order.deposit_amount ?? 0) > 0 && order.deposit_status === 'paid' ? (
            <>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, { color: colors.text.secondary }, typography.body2]}>
                  {t('agent.orders.detail.depositPaid', 'Deposit paid')}
                </Text>
                <Text style={[styles.financialValue, { color: colors.text.primary }, typography.body2]}>
                  {order.deposit_amount} {order.currency}
                </Text>
              </View>
              {agentAmountDue != null ? (
                <View style={[styles.financialRow, styles.financialRowTotal]}>
                  <Text style={[styles.financialLabel, { color: colors.text.primary }, typography.subtitle2]}>
                    {t('agent.orders.detail.amountDue', 'Amount due')}
                  </Text>
                  <Text style={[styles.financialValue, { color: colors.primary.main }, typography.subtitle2]}>
                    {agentAmountDue} {order.currency}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </ExpandableSection>
      </ScrollView>

      {primaryCta ? (
        <View
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
          style={[
            styles.stickyActions,
            {
              borderTopColor: colors.divider,
              backgroundColor: colors.surface,
              paddingBottom: stickyBottomPad,
            },
          ]}
        >
          {primaryCta === 'claim' ? (
            <Pressable
              style={[
                styles.actionBtn,
                {
                  backgroundColor: ordersCanClaim ? colors.primary.main : colors.surface,
                  borderWidth: ordersCanClaim ? 0 : 1,
                  borderColor: colors.primary.main,
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={handleClaimStart}
              disabled={actionLoading || claimLoading}
            >
              {claimLoading ? (
                <ActivityIndicator size="small" color={ordersCanClaim ? colors.primary.contrast : colors.primary.main} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={ordersCanClaim ? 'hand-back-right-outline' : 'lock-outline'}
                    size={20}
                    color={ordersCanClaim ? colors.primary.contrast : colors.primary.main}
                  />
                  <Text style={[styles.actionBtnText, { color: ordersCanClaim ? colors.primary.contrast : colors.primary.main }, typography.button]}>
                    {claimButtonLabel}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
          {primaryCta === 'pickUp' ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primary.main, borderRadius: borderRadius.md }]}
              onPress={() => setLifecycleActionConfirm('pickUp')}
              disabled={actionLoading}
            >
              <MaterialCommunityIcons name="package-variant" size={20} color={colors.primary.contrast} />
              <Text style={[styles.actionBtnText, { color: colors.primary.contrast }, typography.button]}>
                {t('agent.orders.detail.pickUp')}
              </Text>
            </Pressable>
          ) : null}
          {primaryCta === 'outForDelivery' ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primary.main, borderRadius: borderRadius.md }]}
              onPress={() => setLifecycleActionConfirm('outForDelivery')}
              disabled={actionLoading}
            >
              <MaterialCommunityIcons name="map-marker-path" size={20} color={colors.primary.contrast} />
              <Text style={[styles.actionBtnText, { color: colors.primary.contrast }, typography.button]}>
                {t('agent.orders.detail.outForDelivery')}
              </Text>
            </Pressable>
          ) : null}
          {primaryCta === 'requestPayment' ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.success.main, borderRadius: borderRadius.md }]}
              onPress={() => setShowRequestPayAtDeliveryDialog(true)}
              disabled={actionLoading || payAtDeliveryDialogLoading}
            >
              <MaterialCommunityIcons name="cellphone-message" size={20} color={colors.primary.contrast} />
              <Text style={[styles.actionBtnText, { color: colors.primary.contrast }, typography.button]}>
                {t('agent.orders.payAtDelivery.requestPayment', { defaultValue: 'Request payment' })}
              </Text>
            </Pressable>
          ) : null}
          {primaryCta === 'markDelivered' ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primary.main, borderRadius: borderRadius.md }]}
              onPress={() => void handleMarkDelivered()}
              disabled={actionLoading}
            >
              <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary.contrast} />
              <Text style={[styles.actionBtnText, { color: colors.primary.contrast }, typography.button]}>
                {t('agent.orders.detail.markDelivered')}
              </Text>
            </Pressable>
          ) : null}
          {primaryCta === 'clientCouldNotConfirm' ? (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primary.main, borderRadius: borderRadius.md }]}
              onPress={() => {
                setFallbackError(null);
                setFallbackSheetVisible(true);
              }}
              disabled={actionLoading}
            >
              <MaterialCommunityIcons name="camera" size={20} color={colors.primary.contrast} />
              <Text style={[styles.actionBtnText, { color: colors.primary.contrast }, typography.button]}>
                {t('orders.clientConfirm.agentFallbackCta', "Client couldn't confirm")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <AppModal visible={failModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }, typography.h6]}>
              {t('agent.orders.detail.deliveryFailed')}
            </Text>
            <Text style={[styles.modalLabel, { color: colors.text.secondary }, typography.caption]}>
              {t('agent.orders.detail.failureReason', 'Reason')}
            </Text>
            <ScrollView style={styles.reasonList}>
              {reasons.filter((r) => r.is_active).map((r) => (
                <Pressable
                  key={r.id}
                  style={[
                    styles.reasonItem,
                    { borderColor: failReasonId === r.id ? colors.primary.main : colors.divider },
                  ]}
                  onPress={() => setFailReasonId(r.id)}
                >
                  <Text style={[styles.reasonText, { color: colors.text.primary }, typography.body2]}>
                    {r.reason_fr ?? r.reason ?? r.reason_en ?? ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[styles.modalLabel, { color: colors.text.secondary }, typography.caption]}>
              {t('agent.orders.detail.failureNotesOptional', 'Notes (optional)')}
            </Text>
            <TextInput
              style={[styles.notesInput, { borderColor: colors.divider, color: colors.text.primary }, typography.body2]}
              value={failNotes}
              onChangeText={setFailNotes}
              placeholder={t('agent.orders.detail.failureNotesPlaceholder', 'Notes...')}
              placeholderTextColor={colors.text.disabled}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.text.secondary, borderRadius: borderRadius.md }]}
                onPress={() => {
                  setFailModalVisible(false);
                  setFailReasonId('');
                  setFailNotes('');
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.primary.contrast }, typography.button]}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.error.main, borderRadius: borderRadius.md }]}
                onPress={handleFail}
                disabled={actionLoading || !failReasonId}
              >
                <Text style={[styles.modalBtnText, { color: colors.primary.contrast }, typography.button]}>
                  {t('agent.orders.detail.confirmFailure', 'Confirm failure')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </AppModal>

      {usesLegacyPin || completeModalVisible ? (
        <CompleteDeliveryPinDialog
          visible={completeModalVisible}
          onDismiss={closeCompleteModal}
          onSubmit={(pin) => void handleCompleteDeliverySubmit(pin)}
          onSubmitSharedPin={() => void handleCompleteWithSharedPin()}
          submitting={actionLoading}
          errorText={completeError}
          onPinEdited={() => setCompleteError(null)}
          autoSharedPin={autoSharedPin}
          resolvingSharedPin={resolvingSharedPin}
          noSharedPin={noSharedPin}
        />
      ) : null}

      <ClientCouldNotConfirmSheet
        visible={fallbackSheetVisible}
        submitting={actionLoading}
        errorText={fallbackError}
        onDismiss={() => setFallbackSheetVisible(false)}
        onCapture={() => captureAndUploadDeliveryProof(orderId)}
        onSubmit={(photos, note) => void handleFallbackSubmit(photos, note)}
      />

      <DeliveryCompleteSuccessModal
        visible={deliverySuccessOrder !== null}
        order={deliverySuccessOrder}
        onClose={() => setDeliverySuccessOrder(null)}
      />

      <ClaimTopupFormDialog
        visible={showClaimTopupModal}
        order={order ?? null}
        phone={claimTopupPhone}
        onChangePhone={setClaimTopupPhone}
        onDismiss={() => {
          setShowClaimTopupModal(false);
          setClaimTopupPhone('');
        }}
        onConfirm={(e164) => void handleClaimWithTopup(e164)}
        confirming={claimLoading}
      />

      <RequestPayAtDeliveryDialog
        visible={showRequestPayAtDeliveryDialog}
        order={order ?? null}
        onDismiss={() => setShowRequestPayAtDeliveryDialog(false)}
        onSendRequest={handlePayAtDeliveryRequestSubmit}
        submitting={payAtDeliveryDialogLoading}
      />

      <MarkPaidCashExceptionDialog
        visible={showCashExceptionDialog}
        order={order ?? null}
        onDismiss={() => setShowCashExceptionDialog(false)}
        onConfirm={handleCashExceptionConfirm}
        submitting={payAtDeliveryDialogLoading}
      />

      <AgentClaimConfirmDialog
        visible={claimConfirmHold !== null}
        order={order}
        holdAmount={claimConfirmHold ?? 0}
        onDismiss={() => setClaimConfirmHold(null)}
        onConfirm={() => {
          setClaimConfirmHold(null);
          void handleConfirmClaim();
        }}
      />

      <SimpleMessageDialog
        visible={!!claimInfoDialog}
        title={claimInfoDialog?.title ?? ''}
        message={claimInfoDialog?.message ?? ''}
        dismissLabel={t('common.ok')}
        onDismiss={() => setClaimInfoDialog(null)}
      />

      <Portal>
        <Dialog visible={lifecycleActionConfirm !== null} onDismiss={() => setLifecycleActionConfirm(null)}>
          {lifecycleActionConfirm
            ? [
                <Dialog.Title key="lifecycle-confirm-title" style={{ color: colors.text.primary }}>
                  {t(LIFECYCLE_ACTION_CONFIRM[lifecycleActionConfirm].titleKey, {
                    defaultValue: LIFECYCLE_ACTION_CONFIRM[lifecycleActionConfirm].titleDef,
                  })}
                </Dialog.Title>,
                <Dialog.Content key="lifecycle-confirm-content">
                  <PaperText variant="bodyMedium" style={{ color: colors.text.secondary }}>
                    {t(LIFECYCLE_ACTION_CONFIRM[lifecycleActionConfirm].messageKey, {
                      defaultValue: LIFECYCLE_ACTION_CONFIRM[lifecycleActionConfirm].messageDef,
                    })}
                  </PaperText>
                </Dialog.Content>,
                <Dialog.Actions key="lifecycle-confirm-actions">
                  <Button onPress={() => setLifecycleActionConfirm(null)}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
                  <Button mode="contained" onPress={handleLifecycleActionConfirm} disabled={actionLoading}>
                    {t('common.confirm', { defaultValue: 'Confirm' })}
                  </Button>
                </Dialog.Actions>,
              ]
            : null}
        </Dialog>
      </Portal>

      <ConfirmActionDialog
        visible={dropConfirmVisible}
        title={t('agentOrder.release.confirmTitle', 'Release this order?')}
        message={t(
          'agentOrder.release.confirmBody',
          "It will go back to other agents. You won't be able to deliver it."
        )}
        cancelLabel={t('agentOrder.release.cancel', 'Keep order')}
        confirmLabel={t('agentOrder.release.confirmCta', 'Release')}
        destructive
        loading={actionLoading}
        onDismiss={() => setDropConfirmVisible(false)}
        onConfirm={() => void handleConfirmDropOrder()}
      />

      <AgentOrderDetailMoreSheet
        visible={moreSheetVisible}
        items={moreItems}
        onClose={() => setMoreSheetVisible(false)}
        onSelect={handleMoreSelect}
      />

      <AppModal visible={reportModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }, typography.h6]}>
              {t('support.reportIssue', 'Signaler un problème')}
            </Text>

            <Text style={[styles.modalLabel, { color: colors.text.secondary }, typography.caption]}>
              {t('support.type', { defaultValue: 'Type' })}
            </Text>
            <View style={styles.ticketTypeRow}>
              {([
                { id: 'complaint', label: t('support.types.complaint', 'Plainte') },
                { id: 'dispute', label: t('support.types.dispute', 'Litige') },
                { id: 'question', label: t('support.types.question', 'Question') },
              ] as const).map((opt) => {
                const selected = ticketType === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[
                      styles.ticketTypeChip,
                      {
                        borderColor: selected ? colors.primary.main : colors.divider,
                        backgroundColor: selected ? colors.primaryTint : 'transparent',
                      },
                    ]}
                    onPress={() => setTicketType(opt.id)}
                    disabled={ticketSubmitting}
                  >
                    <Text style={[styles.ticketTypeText, { color: selected ? colors.primary.main : colors.text.secondary }, typography.caption]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.modalLabel, { color: colors.text.secondary }, typography.caption]}>
              {t('support.subject', 'Sujet')}
            </Text>
            <TextInput
              style={[styles.textInput, { borderColor: colors.divider, color: colors.text.primary }, typography.body2]}
              value={ticketSubject}
              onChangeText={setTicketSubject}
              placeholder={t('support.subjectPlaceholder', 'Résumé du problème')}
              placeholderTextColor={colors.text.disabled}
              autoCapitalize="sentences"
            />

            <Text style={[styles.modalLabel, { color: colors.text.secondary }, typography.caption]}>
              {t('support.description', 'Description')}
            </Text>
            <TextInput
              style={[styles.notesInput, { borderColor: colors.divider, color: colors.text.primary }, typography.body2]}
              value={ticketDescription}
              onChangeText={setTicketDescription}
              placeholder={t('support.descriptionPlaceholder', 'Décrivez ce qui s’est passé...')}
              placeholderTextColor={colors.text.disabled}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.text.secondary, borderRadius: borderRadius.md }]}
                onPress={closeReportModal}
                disabled={ticketSubmitting}
              >
                <Text style={[styles.modalBtnText, { color: colors.primary.contrast }, typography.button]}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.primary.main, borderRadius: borderRadius.md }]}
                onPress={handleSubmitTicket}
                disabled={ticketSubmitting || !ticketSubject.trim()}
              >
                {ticketSubmitting ? (
                  <ActivityIndicator size="small" color={colors.primary.contrast} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.primary.contrast }, typography.button]}>
                    {t('support.submit', 'Envoyer')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </AppModal>

      <Snackbar visible={!!dropSnack} onDismiss={() => setDropSnack(null)} duration={5000}>
        {dropSnack}
      </Snackbar>

      <ActionLoadingDialog
        visible={actionLoading || claimLoading}
        action={claimLoading && !actionLoading ? 'claim' : 'generic_update'}
        message={
          claimLoading && !actionLoading
            ? t('agent.orders.detail.claimInProgress', 'Claiming order…')
            : t('agent.orders.detail.statusUpdateLoading', 'Updating order…')
        }
        subtitle={
          claimLoading && !actionLoading
            ? t('agent.orders.detail.claimInProgressSubtitle', 'Securing your delivery…')
            : t('agent.orders.detail.statusUpdateSubtitle', 'Almost there…')
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16 },
  headerCard: {},
  orderNum: {},
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusChipText: {},
  placedOn: {},
  sectionTitle: { marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionValue: { marginBottom: 4 },
  financialRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  financialRowTotal: { marginTop: 4 },
  financialLabel: {},
  financialValue: {},
  stickyActions: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  actionBtnText: {},
  errorText: { marginBottom: 16 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: { padding: 20, maxHeight: '80%' },
  modalContentScroll: { maxHeight: '85%' },
  modalScrollInner: { maxHeight: 400 },
  modalTitle: { marginBottom: 16 },
  modalLabel: { marginBottom: 8 },
  ticketTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  ticketTypeChip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  ticketTypeText: {},
  reasonList: { maxHeight: 160, marginBottom: 12 },
  reasonItem: { borderWidth: 1, padding: 12, marginBottom: 8, borderRadius: 8 },
  reasonText: {},
  textInput: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    minHeight: 48,
    marginBottom: 12,
  },
  notesInput: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  modalBtnText: {},
});
