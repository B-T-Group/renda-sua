import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { businessApi } from '../services/businessApi';
import { agentApi } from '../services/agentApi';
import { clientApi } from '../services/clientApi';
import type { ActionItemDto } from '../types/actions';
import type { ActionNeededItemProps } from '../components/common/ActionNeededItem';
import type { BusinessRootStackParamList } from '../navigation/types';
import type {
  RootStackParamList as AgentRootStackParamList,
  MainTabParamList as AgentTabParamList,
} from '../navigation/AgentRootNavigator';
import type { ClientRootStackParamList } from '../navigation/types';
import {
  dismissAllActions,
  filterDismissedActions,
  readDismissedActions,
} from '../utils/actionsNeededDismissStorage';
import {
  notifyActionsNeededRefresh,
  subscribeActionsNeededRefresh,
} from '../utils/actionsNeededSync';
import {
  navigateBusinessOrdersTab,
  navigateBusinessRentals,
  navigateBusinessSaleItems,
} from '../utils/navigateBusinessTabs';
import { useBusinessReachability } from './useBusinessReachability';
import { useIsStripeRail } from './useIsStripeRail';
import { useProfileMe } from './useProfileMe';

type BusinessNav = NativeStackNavigationProp<BusinessRootStackParamList>;
type AgentNav = NativeStackNavigationProp<AgentRootStackParamList & AgentTabParamList>;
type ClientNav = NativeStackNavigationProp<ClientRootStackParamList>;

type Persona = 'business' | 'agent' | 'client';

interface UseActionsNeededResult {
  items: ActionNeededItemProps[];
  totalCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  dismissAll: () => Promise<void>;
}

function buildBusinessItems(
  actions: ActionItemDto[],
  navigation: BusinessNav,
  t: ReturnType<typeof useTranslation>['t'],
  mainInterest: string
): ActionNeededItemProps[] {
  return actions.map((action) => {
    switch (action.kind) {
      case 'item_rejected':
        return {
          kind: action.kind,
          title: t('actionsNeeded.business.itemRejected.title', 'Items rejected'),
          subtitle: t('actionsNeeded.business.itemRejected.subtitle', 'Update and resubmit for review.'),
          icon: 'alert-circle-outline',
          count: action.count,
          priority: action.priority,
          onPress: () =>
            action.primaryId
              ? navigation.navigate('BusinessItemDetail', { itemId: action.primaryId })
              : navigateBusinessSaleItems(navigation, mainInterest, {
                  moderationStatus: 'rejected',
                }),
        };
      case 'rental_rejected':
        return {
          kind: action.kind,
          title: t('actionsNeeded.business.rentalRejected.title', 'Rental listings rejected'),
          subtitle: t('actionsNeeded.business.rentalRejected.subtitle', 'Update and resubmit for review.'),
          icon: 'alert-circle-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => {
            if (!action.primaryId) {
              navigateBusinessRentals(navigation, mainInterest, {
                tab: 'catalog',
                moderationStatus: 'rejected',
              });
              return;
            }
            void (async () => {
              const { rentalsApi } = await import('../services/rentalsApi');
              const listing = await rentalsApi.getListing(action.primaryId!, undefined, {
                withAuth: true,
              });
              if (listing?.rental_item?.id) {
                navigation.navigate('BusinessRentalItemDetail', {
                  itemId: listing.rental_item.id,
                });
                return;
              }
              navigateBusinessRentals(navigation, mainInterest, {
                tab: 'catalog',
                moderationStatus: 'rejected',
              });
            })();
          },
        };
      case 'item_proposal_pending':
        return {
          kind: action.kind,
          title: t('actionsNeeded.business.itemProposal.title', 'AI suggestions ready'),
          subtitle: t(
            'actionsNeeded.business.itemProposal.subtitle',
            '{{count}} item(s) have AI-proposed improvements to review.',
            { count: action.count }
          ),
          icon: 'creation',
          count: action.count,
          priority: action.priority,
          onPress: () =>
            action.primaryId
              ? navigation.navigate('BusinessItemAiProposal', { itemId: action.primaryId })
              : navigateBusinessSaleItems(navigation, mainInterest, {
                  moderationStatus: 'proposal_pending',
                }),
        };
      case 'rental_proposal_pending':
        return {
          kind: action.kind,
          title: t('actionsNeeded.business.rentalProposal.title', 'AI suggestions ready for rentals'),
          subtitle: t(
            'actionsNeeded.business.rentalProposal.subtitle',
            '{{count}} listing(s) have AI-proposed improvements.',
            { count: action.count }
          ),
          icon: 'creation',
          count: action.count,
          priority: action.priority,
          onPress: () => {
            if (action.primaryId) {
              navigation.navigate('BusinessRentalAiProposal', {
                listingId: action.primaryId,
              });
              return;
            }
            navigateBusinessRentals(navigation, mainInterest, {
              tab: 'catalog',
              moderationStatus: 'proposal_pending',
            });
          },
        };
      case 'orders_pending':
        return {
          kind: action.kind,
          title: t('actionsNeeded.business.ordersPending.title', 'Pending orders'),
          subtitle: t(
            'actionsNeeded.business.ordersPending.subtitle',
            '{{count}} order(s) waiting to be confirmed.',
            { count: action.count }
          ),
          icon: 'clipboard-list-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => navigateBusinessOrdersTab(navigation),
        };
      case 'failed_deliveries':
        return {
          kind: action.kind,
          title: t('actionsNeeded.business.failedDeliveries.title', 'Failed deliveries'),
          subtitle: t(
            'actionsNeeded.business.failedDeliveries.subtitle',
            '{{count}} failed delivery(ies) need resolution.',
            { count: action.count }
          ),
          icon: 'truck-alert-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => navigation.navigate('BusinessFailedDeliveriesList'),
        };
      case 'cash_reconciliation':
        return {
          kind: action.kind,
          title: t('actionsNeeded.business.cashReconciliation.title', 'Cash reconciliation'),
          subtitle: t(
            'actionsNeeded.business.cashReconciliation.subtitle',
            '{{count}} order(s) need cash payment collection.',
            { count: action.count }
          ),
          icon: 'cash-multiple',
          count: action.count,
          priority: action.priority,
          onPress: () => navigateBusinessOrdersTab(navigation, { cashReconciliation: true }),
        };
      case 'location_transfer_pending':
        return {
          kind: action.kind,
          title: t(
            'actionsNeeded.business.locationTransferPending.title',
            'Location transfers awaiting decision'
          ),
          subtitle: action.primaryLabel
            ? t(
                'actionsNeeded.business.locationTransferPending.subtitleNamed',
                'From {{name}} — tap to accept or reject.',
                { name: action.primaryLabel }
              )
            : t(
                'actionsNeeded.business.locationTransferPending.subtitle',
                '{{count}} transfer(s) need your review.',
                { count: action.count }
              ),
          icon: 'swap-horizontal',
          count: action.count,
          priority: action.priority,
          onPress: () => {
            navigation.navigate('BusinessLocationsList', {
              transferRequestId: action.primaryId,
            });
          },
        };
      case 'ai_image_cleanup_ready':
        return {
          kind: action.kind,
          title: t(
            'actionsNeeded.business.aiImageCleanupReady.title',
            'Photos ready to review'
          ),
          subtitle: action.primaryLabel
            ? t(
                'actionsNeeded.business.aiImageCleanupReady.subtitleNamed',
                'Review before & after for "{{name}}".',
                { name: action.primaryLabel }
              )
            : t(
                'actionsNeeded.business.aiImageCleanupReady.subtitle',
                '{{count}} cleaned photo(s) waiting for your review.',
                { count: action.count }
              ),
          icon: 'auto-fix',
          count: action.count,
          priority: action.priority,
          onPress: () => {
            if (action.primaryId) {
              navigation.navigate('BusinessAiImageCleanupReview', {
                jobId: action.primaryId,
              });
              return;
            }
            navigateBusinessSaleItems(navigation, mainInterest);
          },
        };
      case 'ai_image_cleanup_applied':
        return {
          kind: action.kind,
          title: t(
            'actionsNeeded.business.aiImageCleanupApplied.title',
            'Photos updated'
          ),
          subtitle: action.primaryLabel
            ? t(
                'actionsNeeded.business.aiImageCleanupApplied.subtitleNamed',
                'Updated photos applied for "{{name}}".',
                { name: action.primaryLabel }
              )
            : t(
                'actionsNeeded.business.aiImageCleanupApplied.subtitle',
                '{{count}} photo(s) were updated automatically.',
                { count: action.count }
              ),
          icon: 'check-decagram-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => {
            if (action.primaryId) {
              navigation.navigate('BusinessAiImageCleanupReview', {
                jobId: action.primaryId,
              });
              return;
            }
            navigateBusinessSaleItems(navigation, mainInterest);
          },
        };
      default:
        return {
          kind: action.kind,
          title: action.kind,
          icon: 'information-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => {},
        };
    }
  });
}

function buildBusinessReachabilityItem(params: {
  canAcceptOrders: boolean;
  hasPush: boolean;
  whatsappReady: boolean;
  pushDenied: boolean;
  pushMissingToken: boolean;
  navigation: BusinessNav;
  t: ReturnType<typeof useTranslation>['t'];
}): ActionNeededItemProps | null {
  if (!params.canAcceptOrders) return null;
  if (params.hasPush && params.whatsappReady) return null;
  const missingPush = !params.hasPush;
  const missingWhatsapp = !params.whatsappReady;
  let subtitle = params.t(
    'actionsNeeded.business.reachability.subtitle',
    'Keep push or WhatsApp ready so new orders reach your team right away.'
  );
  if (missingPush && missingWhatsapp) {
    subtitle = params.t(
      'actionsNeeded.business.reachability.subtitleBoth',
      'Push notifications and WhatsApp order alerts are both not ready.'
    );
  } else if (params.pushDenied) {
    subtitle = params.t(
      'actionsNeeded.business.reachability.subtitlePushDenied',
      'Push notifications are blocked on this device. Turn them on or rely on WhatsApp alerts.'
    );
  } else if (params.pushMissingToken) {
    subtitle = params.t(
      'actionsNeeded.business.reachability.subtitlePushToken',
      'This device still needs push registration for instant order alerts.'
    );
  } else if (missingWhatsapp) {
    subtitle = params.t(
      'actionsNeeded.business.reachability.subtitleWhatsapp',
      'WhatsApp order alerts are off. Turn them on as a backup alert channel.'
    );
  }
  return {
    kind: 'order_alerts',
    title: params.t(
      'actionsNeeded.business.reachability.title',
      'Set up order alerts'
    ),
    subtitle,
    icon: 'bell-ring-outline',
    count: 1,
    priority: missingPush && missingWhatsapp ? 'critical' : 'high',
    onPress: () =>
      params.navigation.navigate(
        missingPush ? 'NotificationPermission' : 'NotificationPreferences'
      ),
  };
}

function filterAgentRailActions(
  actions: ActionItemDto[],
  paymentRail: 'stripe' | 'mobile_money' | null
): ActionItemDto[] {
  if (paymentRail === 'stripe') {
    return actions.filter((action) => action.kind !== 'id_verification');
  }
  if (paymentRail === 'mobile_money') {
    return actions.filter((action) => action.kind !== 'setup_payouts');
  }
  return actions;
}

function buildAgentItems(
  actions: ActionItemDto[],
  navigation: AgentNav,
  t: ReturnType<typeof useTranslation>['t']
): ActionNeededItemProps[] {
  return actions.map((action) => {
    switch (action.kind) {
      case 'setup_payouts':
        return {
          kind: action.kind,
          title: t('actionsNeeded.agent.setupPayouts.title', 'Set up payouts'),
          subtitle: t(
            'actionsNeeded.agent.setupPayouts.subtitle',
            'Complete payout setup to become active.'
          ),
          icon: 'wallet-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => navigation.navigate('AgentAccounts'),
        };
      case 'id_verification':
        return {
          kind: action.kind,
          title: t('actionsNeeded.agent.idVerification.title', 'ID verification required'),
          subtitle: t('actionsNeeded.agent.idVerification.subtitle', 'Upload your ID to start delivering.'),
          icon: 'shield-account-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => navigation.navigate('Documents'),
        };
      case 'open_deliveries':
        return {
          kind: action.kind,
          title: t('actionsNeeded.agent.openDeliveries.title', 'Deliveries available'),
          subtitle: t(
            'actionsNeeded.agent.openDeliveries.subtitle',
            '{{count}} delivery(ies) available to claim.',
            { count: action.count }
          ),
          icon: 'package-variant',
          count: action.count,
          priority: action.priority,
          onPress: () => navigation.navigate('OpenOrders' as any),
        };
      case 'active_orders':
        return {
          kind: action.kind,
          title: t('actionsNeeded.agent.activeOrders.title', 'Active deliveries'),
          subtitle: t(
            'actionsNeeded.agent.activeOrders.subtitle',
            '{{count}} delivery(ies) in progress.',
            { count: action.count }
          ),
          icon: 'truck-delivery-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => navigation.navigate('Orders' as any),
        };
      default:
        return {
          kind: action.kind,
          title: action.kind,
          icon: 'information-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => {},
        };
    }
  });
}

function buildClientItems(
  actions: ActionItemDto[],
  navigation: ClientNav,
  t: ReturnType<typeof useTranslation>['t']
): ActionNeededItemProps[] {
  return actions.map((action) => {
    switch (action.kind) {
      case 'orders_pending_payment':
        return {
          kind: action.kind,
          title: t('actionsNeeded.client.ordersPendingPayment.title', 'Orders awaiting payment'),
          subtitle: t(
            'actionsNeeded.client.ordersPendingPayment.subtitle',
            '{{count}} order(s) need your attention.',
            { count: action.count }
          ),
          icon: 'credit-card-clock-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => navigation.navigate('ClientMainTabs', { screen: 'ClientOrders' } as any),
        };
      case 'active_delivery':
        return {
          kind: action.kind,
          title: t('actionsNeeded.client.activeDelivery.title', 'Order on its way'),
          subtitle: t(
            'actionsNeeded.client.activeDelivery.subtitle',
            '{{count}} order(s) currently being delivered.',
            { count: action.count }
          ),
          icon: 'truck-delivery-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => navigation.navigate('ClientMainTabs', { screen: 'ClientOrders' } as any),
        };
      case 'rental_payment_due':
      case 'rentals_payment_due':
        return {
          kind: action.kind,
          title: t('actionsNeeded.client.rentalPaymentDue.title', 'Rental payment due'),
          subtitle: t(
            'actionsNeeded.client.rentalPaymentDue.subtitle',
            '{{count}} rental booking(s) need payment.',
            { count: action.count }
          ),
          icon: 'credit-card-outline',
          count: action.count,
          priority: action.priority,
          onPress: () =>
            action.primaryId
              ? navigation.navigate('RentalBookingDetail', { bookingId: action.primaryId })
              : navigation.navigate('ClientMyRentals'),
        };
      case 'rental_pin_ready':
      case 'rentals_pin_ready':
        return {
          kind: action.kind,
          title: t('actionsNeeded.client.rentalPinReady.title', 'Share pickup PIN'),
          subtitle: t(
            'actionsNeeded.client.rentalPinReady.subtitle',
            '{{count}} rental(s) ready — send your start PIN to the business.',
            { count: action.count }
          ),
          icon: 'key-outline',
          count: action.count,
          priority: action.priority,
          onPress: () =>
            action.primaryId
              ? navigation.navigate('RentalBookingDetail', { bookingId: action.primaryId })
              : navigation.navigate('ClientMyRentals'),
        };
      case 'rental_request_available':
      case 'rentals_request_available':
        return {
          kind: action.kind,
          title: t('actionsNeeded.client.rentalOfferReady.title', 'Rental offer ready'),
          subtitle: t(
            'actionsNeeded.client.rentalOfferReady.subtitle',
            '{{count}} request(s) accepted — book now before the offer expires.',
            { count: action.count }
          ),
          icon: 'calendar-check-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => navigation.navigate('ClientMyRentals'),
        };
      case 'rental_action_needed':
      case 'rentals_action_needed':
        return {
          kind: action.kind,
          title: t('actionsNeeded.client.rentalActionNeeded.title', 'Rentals need attention'),
          subtitle: t(
            'actionsNeeded.client.rentalActionNeeded.subtitle',
            '{{count}} rental(s) waiting for your next step.',
            { count: action.count }
          ),
          icon: 'calendar-clock-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => navigation.navigate('ClientMyRentals'),
        };
      default:
        return {
          kind: action.kind,
          title: action.kind,
          icon: 'information-outline',
          count: action.count,
          priority: action.priority,
          onPress: () => {},
        };
    }
  });
}

async function fetchActions(persona: Persona): Promise<ActionItemDto[]> {
  if (persona === 'business') {
    const res = await businessApi.dashboard.getActions();
    return res.data?.actions ?? [];
  }
  if (persona === 'agent') {
    const res = await agentApi.dashboard.getActions();
    return res.data?.actions ?? [];
  }
  const res = await clientApi.dashboard.getActions();
  return res.data?.actions ?? [];
}

export function useActionsNeeded(persona: Persona | null): UseActionsNeededResult {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { status } = useIsStripeRail(persona === 'agent');
  const reachability = useBusinessReachability(persona === 'business');
  const { me } = useProfileMe(persona === 'business');
  const mainInterest = me?.business?.main_interest ?? 'sell_items';
  const paymentRail = status?.paymentRail ?? null;
  const [items, setItems] = useState<ActionNeededItemProps[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rawActions, setRawActions] = useState<ActionItemDto[]>([]);

  const applyActions = useCallback(
    async (actions: ActionItemDto[]) => {
      if (!persona) {
        setItems([]);
        setTotalCount(0);
        setRawActions([]);
        return;
      }
      const dismissed = await readDismissedActions(persona);
      const visible = filterDismissedActions(actions, dismissed);
      const railVisible =
        persona === 'agent' ? filterAgentRailActions(visible, paymentRail) : visible;
      let built: ActionNeededItemProps[] = [];
      if (persona === 'business') {
        built = buildBusinessItems(railVisible, navigation, t, mainInterest);
        const reachabilityItem = buildBusinessReachabilityItem({
          canAcceptOrders: reachability.canAcceptOrders,
          hasPush: reachability.hasPush,
          whatsappReady: reachability.whatsappReady,
          pushDenied: reachability.pushDenied,
          pushMissingToken: reachability.pushMissingToken,
          navigation,
          t,
        });
        if (reachabilityItem) {
          built = [reachabilityItem, ...built];
        }
      } else if (persona === 'agent') {
        built = buildAgentItems(railVisible, navigation, t);
      } else {
        built = buildClientItems(railVisible, navigation, t);
      }
      setItems(built);
      const localCount =
        persona === 'business' && reachability.needsAttention ? 1 : 0;
      setTotalCount(railVisible.reduce((s, a) => s + a.count, 0) + localCount);
      setRawActions(actions);
    },
    [navigation, paymentRail, persona, reachability, t, mainInterest]
  );

  const load = useCallback(async () => {
    if (!persona) {
      setItems([]);
      setTotalCount(0);
      setRawActions([]);
      return;
    }
    setLoading(true);
    try {
      const actions = await fetchActions(persona);
      await applyActions(actions);
    } catch {
      setItems([]);
      setTotalCount(0);
      setRawActions([]);
    } finally {
      setLoading(false);
    }
  }, [persona, applyActions]);

  const dismissAll = useCallback(async () => {
    if (!persona || rawActions.length === 0) return;
    await dismissAllActions(
      persona,
      rawActions.map((a) => ({ kind: a.kind, count: a.count }))
    );
    await applyActions(rawActions);
    notifyActionsNeededRefresh();
  }, [persona, rawActions, applyActions]);

  useEffect(() => {
    if (persona !== 'agent' || rawActions.length === 0) return;
    void applyActions(rawActions);
  }, [paymentRail, persona, rawActions, applyActions]);

  useEffect(() => {
    if (!persona) return undefined;
    return subscribeActionsNeededRefresh(() => {
      if (rawActions.length > 0) {
        void applyActions(rawActions);
      } else {
        void load();
      }
    });
  }, [persona, rawActions, applyActions, load]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return { items, totalCount, loading, refresh: load, dismissAll };
}
