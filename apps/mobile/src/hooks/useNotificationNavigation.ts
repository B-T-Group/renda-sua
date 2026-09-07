/**
 * Maps a user_message (entity_type + entity_id + message_type) to a navigation
 * action the user can trigger from the notification center.
 *
 * When the target belongs to another enrolled persona, switches first then navigates.
 */

import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { UserMessage } from '../types/messages';
import { useStore } from '../stores/RootStore';
import type { BroadcastActionType } from '../types/adminBroadcast';
import type { PersonaSlug } from '../types/persona';

export interface NotificationNavTarget {
  /** Call this to navigate to the entity detail screen. */
  navigate: () => void;
  /** Short label describing where you will land, for the chevron row. */
  label: string;
}

function inferPersonaForMessage(
  msg: UserMessage,
  active: PersonaSlug,
  enrolled: PersonaSlug[]
): PersonaSlug | null {
  const { entity_type, message_type } = msg;
  switch (entity_type) {
    case 'business_referral_review':
    case 'agent':
      return 'agent';
    case 'sale_item':
    case 'business':
    case 'rental_listing':
      return 'business';
    case 'business_inventory':
      return message_type === 'STOCK_AVAILABILITY' ? 'business' : 'client';
    case 'rental_booking':
      if (active === 'client' || active === 'business') return active;
      if (enrolled.includes('client')) return 'client';
      if (enrolled.includes('business')) return 'business';
      return null;
    case 'order':
      if (active === 'client' || active === 'agent' || active === 'business') {
        return active;
      }
      if (enrolled.includes('client')) return 'client';
      if (enrolled.includes('business')) return 'business';
      if (enrolled.includes('agent')) return 'agent';
      return null;
    default:
      return null;
  }
}

function actionFromMessage(msg: UserMessage): BroadcastActionType {
  const payload = msg.message_payload;
  const fromPayload =
    typeof payload?.action_type === 'string' ? payload.action_type : undefined;
  if (
    fromPayload === 'app_upgrade' ||
    fromPayload === 'business_account_setup' ||
    fromPayload === 'generic'
  ) {
    return fromPayload;
  }
  if (msg.message_type === 'ADMIN_APP_UPGRADE') return 'app_upgrade';
  if (msg.message_type === 'ADMIN_ACCOUNT_SETUP') return 'business_account_setup';
  return 'generic';
}

export function useNotificationNavigation(): (msg: UserMessage) => NotificationNavTarget | null {
  const navigation = useNavigation<any>();
  const { persona, stockAvailability, adminBroadcast, referralRejection } =
    useStore();
  const active = persona.activePersona as PersonaSlug;
  const enrolled = persona.personas;

  const withPersona = useCallback(
    (target: PersonaSlug | null, open: () => void): (() => void) => {
      return () => {
        if (
          target &&
          target !== active &&
          enrolled.includes(target) &&
          !persona.pickingPersona
        ) {
          void persona.selectPersona(target).then(open);
          return;
        }
        open();
      };
    },
    [active, enrolled, persona]
  );

  return useCallback(
    (msg: UserMessage): NotificationNavTarget | null => {
      const { entity_type, entity_id, message_type } = msg;
      const targetPersona = inferPersonaForMessage(msg, active, enrolled);

      switch (entity_type) {
        case 'business_referral_review': {
          if (!enrolled.includes('agent')) return null;
          return {
            label: 'referralRejection',
            navigate: withPersona('agent', () => {
              const payload = msg.message_payload ?? {};
              const businessName =
                (typeof payload.business_name === 'string' &&
                  payload.business_name) ||
                (typeof payload.businessName === 'string' &&
                  payload.businessName) ||
                '';
              const rejectionReason =
                (typeof payload.rejection_reason === 'string' &&
                  payload.rejection_reason) ||
                (typeof payload.rejectionReason === 'string' &&
                  payload.rejectionReason) ||
                msg.message ||
                '';
              referralRejection.show({
                reviewId: entity_id,
                businessId:
                  typeof payload.business_id === 'string'
                    ? payload.business_id
                    : undefined,
                businessName: businessName || '—',
                rejectionReason,
              });
            }),
          };
        }
        case 'order': {
          if (!targetPersona) return null;
          if (targetPersona === 'business') {
            return {
              label: 'orderDetail',
              navigate: withPersona('business', () =>
                navigation.navigate('BusinessOrderDetail', {
                  orderId: entity_id,
                  openMessages: message_type === 'DELIVERY_PIN',
                })
              ),
            };
          }
          if (targetPersona === 'client') {
            return {
              label: 'orderDetail',
              navigate: withPersona('client', () =>
                navigation.navigate('OrderDetail', {
                  orderId: entity_id,
                  openMessages: message_type === 'DELIVERY_PIN',
                })
              ),
            };
          }
          if (targetPersona === 'agent') {
            return {
              label: 'orderDetail',
              navigate: withPersona('agent', () =>
                navigation.navigate('MainTabs', {
                  screen: 'Orders',
                  params: {
                    screen: 'OrderDetail',
                    params: { orderId: entity_id },
                  },
                })
              ),
            };
          }
          return null;
        }

        case 'sale_item': {
          if (!enrolled.includes('business')) return null;
          const isProposal =
            message_type === 'AI_ITEM_PROPOSAL' ||
            (message_type !== 'ITEM_REJECTED' && msg.message?.includes('AI suggested'));
          return {
            label: isProposal ? 'reviewAiProposal' : 'itemDetail',
            navigate: withPersona('business', () =>
              navigation.navigate(
                isProposal ? 'BusinessItemAiProposal' : 'BusinessItemDetail',
                { itemId: entity_id }
              )
            ),
          };
        }

        case 'business_inventory': {
          if (message_type === 'STOCK_AVAILABILITY') {
            if (!enrolled.includes('business')) return null;
            return {
              label: 'stockAvailability',
              navigate: withPersona('business', () => {
                void stockAvailability.handleTap(msg.id);
              }),
            };
          }
          if (!enrolled.includes('client')) return null;
          return {
            label: 'itemDetail',
            navigate: withPersona('client', () =>
              navigation.navigate('InventoryItemDetail', {
                inventoryItemId: entity_id,
              })
            ),
          };
        }

        case 'rental_listing': {
          if (!enrolled.includes('business')) return null;
          const isRentalProposal =
            message_type === 'AI_RENTAL_PROPOSAL' ||
            (message_type !== 'RENTAL_REJECTED' && msg.message?.includes('AI suggested'));
          return {
            label: isRentalProposal ? 'reviewAiProposal' : 'rentalListingDetail',
            navigate: withPersona('business', () => {
              if (isRentalProposal) {
                navigation.navigate('BusinessRentalAiProposal', { listingId: entity_id });
                return;
              }
              void (async () => {
                const { rentalsApi } = await import('../services/rentalsApi');
                const listing = await rentalsApi.getListing(entity_id, undefined, {
                  withAuth: true,
                });
                if (listing?.rental_item?.id) {
                  navigation.navigate('BusinessRentalItemDetail', {
                    itemId: listing.rental_item.id,
                  });
                  return;
                }
                navigation.navigate('BusinessRentalsStudio', {
                  tab: 'catalog',
                  moderationStatus: message_type === 'RENTAL_REJECTED' ? 'rejected' : undefined,
                });
              })();
            }),
          };
        }

        case 'rental_booking': {
          if (targetPersona === 'business') {
            return {
              label: 'rentalBookingDetail',
              navigate: withPersona('business', () =>
                navigation.navigate('BusinessRentalBookingDetail', { bookingId: entity_id })
              ),
            };
          }
          if (targetPersona === 'client') {
            return {
              label: 'rentalBookingDetail',
              navigate: withPersona('client', () =>
                navigation.navigate('RentalBookingDetail', { bookingId: entity_id })
              ),
            };
          }
          return null;
        }

        case 'agent': {
          if (!enrolled.includes('agent')) return null;
          return {
            label: 'documents',
            navigate: withPersona('agent', () => navigation.navigate('Documents')),
          };
        }

        case 'business': {
          if (!enrolled.includes('business')) return null;
          return {
            label: 'businessDashboard',
            navigate: withPersona('business', () =>
              navigation.navigate('BusinessMainTabs', {
                screen: 'BusinessDashboard',
              })
            ),
          };
        }

        case 'admin_broadcast': {
          return {
            label: 'adminBroadcast',
            navigate: () => {
              const payload = msg.message_payload ?? {};
              const actionType = actionFromMessage(msg);
              const parts = (msg.message || '').split('\n\n');
              adminBroadcast.show({
                type: 'admin_broadcast',
                campaignId: entity_id,
                messageId: msg.id,
                actionType,
                title:
                  (typeof payload.title === 'string' && payload.title) ||
                  parts[0] ||
                  undefined,
                body:
                  (typeof payload.body_en === 'string' && payload.body_en) ||
                  parts.slice(1).join('\n\n') ||
                  msg.message,
                titleEn:
                  typeof payload.title_en === 'string' ? payload.title_en : undefined,
                bodyEn:
                  typeof payload.body_en === 'string' ? payload.body_en : undefined,
                titleFr:
                  typeof payload.title_fr === 'string' ? payload.title_fr : undefined,
                bodyFr:
                  typeof payload.body_fr === 'string' ? payload.body_fr : undefined,
              });
            },
          };
        }

        case 'document': {
          return {
            label: 'documents',
            navigate: () => navigation.navigate('Documents'),
          };
        }

        default:
          return null;
      }
    },
    [
      navigation,
      active,
      enrolled,
      withPersona,
      stockAvailability,
      adminBroadcast,
      referralRejection,
    ]
  );
}
