/**
 * Appels API côté agent – utilise apiClient (fetch + Bearer).
 * Tous les chemins sont relatifs à la base API (ex: /api).
 */

import { api } from './apiClient';
import type { ActionsNeededDto } from '../types/actions';
import { getLocationConsentPlatform } from '../utils/agentLocationConsentPlatform';
import type {
  Order,
  OpenOrdersResponse,
  OrdersResponse,
  OrderActionResponse,
  OrderCancelResponse,
  CancellationPreview,
  AgentEarningsSummaryResponse,
  AgentEarnings,
  FailedDeliveryReason,
  UserAddress,
} from '../types/agent';

import type { CreateOrderPayload, CreateOrderResponse } from '../types/clientOrder';
import type { CheckoutPreflightRequest, ResolvedCheckoutConfig } from '../types/checkout';
import type { OrderOfferResponse } from '../types/orderOffer';
import type { DiscountCodeValidateResponse, ItemDeliveryFeeResponse } from '../types/placeOrderPricing';
import type { MeResponse, MeUser, SetMyPhoneResponse, UpdateMeResponse, UpdateMyEmailResponse } from '../types/me';
import type { PersonaSlug } from '../types/persona';
import type {
  PushTokenStatusResponse,
  RegisterPushTokenBody,
  RegisterPushTokenResponse,
} from '../types/notificationsApi';
import type {
  AccountInfoResponse,
  InitiateMobilePaymentBody,
  InitiateMobilePaymentResponse,
  WithdrawalConfigResponse,
} from '../types/accountWallet';
import type {
  CreateRatingBody,
  CreateRatingResponse,
  EntityRatingsResponse,
  OrderRatingEligibilityResponse,
  RatingAggregateResponse,
} from '../types/ratingsApi';
import type {
  InitiateStripePaymentBody,
  InitiateStripePaymentResponse,
  StripeClientConfigResponse,
  StripeConnectLinkResponse,
  StripeConnectStatusResponse,
  StripeTransactionStatusResponse,
  StripeWithdrawBody,
  StripeWithdrawResponse,
} from '../types/stripe';
import type {
  CreateRecipientPayload,
  DeleteRecipientResponse,
  GetRecipientsParams,
  RecipientResponse,
  RecipientsListResponse,
  UpdateRecipientPayload,
} from '../types/recipient';
import {
  normalizeRecipientResponse,
  normalizeRecipientsList,
} from '../utils/recipientsApi';

export type { MeResponse, MeUser, SetMyPhoneResponse, UpdateMeResponse, UpdateMyEmailResponse };

export interface CompleteDeliveryRequest {
  orderId: string;
  pin?: string;
  overwriteCode?: string;
  pinMessageId?: string;
  useLatestSharedPin?: boolean;
}

export type PersonaId = 'client' | 'agent' | 'business';

export interface MessageMention {
  mentionedUserId: string;
  persona: PersonaId;
  displayName: string;
  textOffset?: number | null;
  textLength?: number | null;
}

export interface MentionableParticipant {
  userId: string;
  persona: PersonaId;
  displayName: string;
}

export interface DeliveryPinStructuredContent {
  status: 'active' | 'superseded' | 'revoked';
  pinVersion: number;
  sharedToUserId: string;
  sharedToDisplayName?: string;
  pin?: string;
  maskedDisplay: string;
}

export interface QuickMessageStructuredContent {
  templateId: string;
  taggedUserIds: string[];
  taggedPersonas: string[];
  bodyI18nKey: string;
  bodyDefault: string;
}

export interface QuickMessageTemplate {
  id: string;
  buttonLabelKey: string;
  buttonLabelEn: string;
  buttonLabelFr: string;
  bodyI18nKey: string;
  bodyDefaultEn: string;
  tagPersonas: PersonaId[];
}

export interface OrderMessage {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  message: string;
  created_at: string;
  updated_at: string;
  sender_persona?: PersonaId;
  message_type?: string;
  structured_content?:
    | DeliveryPinStructuredContent
    | QuickMessageStructuredContent
    | null;
  mention?: MessageMention | null;
  mentions?: MessageMention[];
  user?: {
    id: string;
    identifier?: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface OrderMessagesResponse {
  success: boolean;
  messages: OrderMessage[];
  error?: string;
}

export interface CreateOrderMessageResponse {
  success: boolean;
  message: OrderMessage;
  error?: string;
}

export interface MentionableParticipantsResponse {
  success: boolean;
  participants: MentionableParticipant[];
  error?: string;
}

export interface BatchOrderItemResult {
  orderId: string;
  success: boolean;
  message: string;
  order?: Order;
}

export interface BatchOrderResponse {
  success: boolean;
  results: BatchOrderItemResult[];
  message?: string;
}

/** Réponse GET /orders/:orderId/claim-availability (aligné backend) */
export interface ClaimAvailabilityResponse {
  success: boolean;
  orderOpenStatus: boolean;
  hasEnoughFundsForHold: boolean;
  needsTopUpToClaim: boolean;
  holdAmount: number;
  message: string;
}

const orders = {
  /**
   * Resolve checkout method, verification method, and validate cart BEFORE
   * starting guest verification or creating any orders. Works for both
   * authenticated and unauthenticated callers.
   *
   * The backend is the authoritative source of truth. The seller/business-owner
   * country determines the payment rail, not the buyer's Stripe status.
   */
  resolveCheckoutPreflight: (body: CheckoutPreflightRequest): Promise<ResolvedCheckoutConfig> =>
    api.post<ResolvedCheckoutConfig>('/orders/checkout/preflight', body),

  createOrder: (body: CreateOrderPayload): Promise<CreateOrderResponse> =>
    api.post<CreateOrderResponse>('/orders', body),

  getOpen: (): Promise<OpenOrdersResponse> =>
    api.get<OpenOrdersResponse>('/orders/open'),

  getList: (filters?: string): Promise<OrdersResponse> =>
    api.get<OrdersResponse>(filters ? `/orders?filters=${encodeURIComponent(filters)}` : '/orders'),

  getById: async (orderId: string): Promise<Order> => {
    const res = await api.get<{ success: boolean; order: Order }>(`/orders/${orderId}`);
    if (!res.success || !res.order) throw new Error((res as { message?: string }).message || 'Order not found');
    return res.order;
  },

  getDeliveryPin: async (orderId: string): Promise<{ pin: string }> => {
    const res = await api.get<{ pin?: string }>(`/orders/${orderId}/delivery-pin`);
    if (!res?.pin) throw new Error('PIN unavailable');
    return { pin: res.pin };
  },

  sendDeliveryPin: async (orderId: string): Promise<void> => {
    const res = await api.post<{ success: boolean }>(`/orders/${orderId}/messages/delivery-pin`, {});
    if (!res?.success) throw new Error('Failed to send delivery PIN');
  },

  getQuickMessageTemplates: async (
    orderId: string
  ): Promise<QuickMessageTemplate[]> => {
    const res = await api.get<{
      success: boolean;
      templates: QuickMessageTemplate[];
    }>(`/orders/${orderId}/messages/quick-templates`);
    return res?.templates ?? [];
  },

  sendQuickMessage: async (orderId: string, templateId: string): Promise<void> => {
    const res = await api.post<{ success: boolean }>(
      `/orders/${orderId}/messages/quick`,
      { templateId }
    );
    if (!res?.success) throw new Error('Failed to send quick message');
  },

  getActiveDeliveryPin: async (
    orderId: string
  ): Promise<{
    messageId: string;
    pin: string;
    pinVersion: number;
    sharedAt: string;
  } | null> => {
    const res = await api.get<{
      success: boolean;
      activePin: {
        messageId: string;
        pin: string;
        pinVersion: number;
        sharedAt: string;
      } | null;
    }>(`/orders/${orderId}/messages/active-delivery-pin`);
    return res?.activePin ?? null;
  },

  cancel: (body: { orderId: string; cancellationReasonId?: number; notes?: string }): Promise<OrderCancelResponse> =>
    api.post<OrderCancelResponse>('/orders/cancel', body),

  /** Client fallback after dispatch escalation found no agent: switch to store pickup, delivery fee waived. */
  switchToPickup: (body: { orderId: string }): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/switch-to-pickup', body),

  complete: (body: { orderId: string; notes?: string }): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/complete', body),

  confirmReceipt: async (orderId: string): Promise<OrderActionResponse> => {
    const res = await api.post<OrderActionResponse>(
      `/orders/${orderId}/confirm-receipt`,
      {}
    );
    if (res.success === false) {
      throw new Error(res.message || 'Failed to confirm receipt');
    }
    return res;
  },

  getCancellationPreview: (orderId: string): Promise<CancellationPreview> =>
    api.get<CancellationPreview>(`/orders/${orderId}/cancellation-preview`),

  /** Client: start pay-at-pickup mobile money (ready_for_pickup). */
  initiatePayAtPickupPayment: (
    orderId: string,
    phoneNumber?: string
  ): Promise<{
    success: boolean;
    message?: string;
    payment_transaction?: { transaction_id?: string | null };
  }> =>
    api.post(
      `/orders/${orderId}/initiate-pay-at-pickup-payment`,
      phoneNumber?.trim() ? { phone_number: phoneNumber.trim() } : {}
    ),

  /** Client: re-initiate pay-now payment (mobile money or Stripe PaymentSheet). */
  retryPayment: (
    orderId: string,
    body?: { stripe_payment_method?: 'payment_sheet' }
  ): Promise<{
    success: boolean;
    checkout_url?: string;
    payment_intent_client_secret?: string;
    payment_transaction?: { transaction_id?: string | null };
    message?: string;
  }> => api.post(`/orders/${orderId}/retry-payment`, body ?? {}),

  getOrderAgentLocation: (
    orderId: string
  ): Promise<{
    success: boolean;
    location?: { agentId: string; latitude: number; longitude: number; updatedAt: string };
    error?: string;
  }> => api.get(`/locations/orders/${orderId}/agent-location`),

  getItemDeliveryFee: async (
    itemId: string,
    opts?: { addressId?: string; requiresFastDelivery?: boolean }
  ): Promise<ItemDeliveryFeeResponse> => {
    const qs = new URLSearchParams();
    if (opts?.addressId) qs.set('addressId', opts.addressId);
    if (opts?.requiresFastDelivery) qs.set('requiresFastDelivery', 'true');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await api.get<ItemDeliveryFeeResponse>(`/orders/item/${itemId}/deliveryFee${suffix}`);
    if (!res.success) throw new Error(res.message || 'Failed to get delivery fee');
    return res;
  },

  validateDiscountCode: (code: string): Promise<DiscountCodeValidateResponse> =>
    api.get<DiscountCodeValidateResponse>(`/orders/discount-codes/validate?code=${encodeURIComponent(code.trim())}`),

  getAgentEarnings: async (orderId: string): Promise<AgentEarnings> => {
    const res = await api.get<{ success?: boolean } & AgentEarnings>(`/orders/${orderId}/agent-earnings`);
    return res as AgentEarnings;
  },

  getClaimAvailability: (orderId: string): Promise<ClaimAvailabilityResponse> =>
    api.get<ClaimAvailabilityResponse>(`/orders/${orderId}/claim-availability`),

  claimOrder: (orderId: string): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/claim_order', { orderId }),

  claimOrderWithTopup: (orderId: string, phone_number?: string): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/claim_order_with_topup', { orderId, phone_number }),

  dropOrder: (orderId: string): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/drop_order', { orderId }),

  requestPickupDelay: (orderId: string): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>(`/orders/${orderId}/pickup-delay`, {}),

  reportPickupIssue: (
    orderId: string,
    reason?: string
  ): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>(`/orders/${orderId}/report-pickup-issue`, {
      reason: reason || 'unspecified',
    }),

  /** Push-offer flow: fetch the active full-screen delivery offer details. */
  getOffer: (orderId: string): Promise<OrderOfferResponse> =>
    api.get<OrderOfferResponse>(`/orders/${orderId}/offer`),

  /**
   * App-open flow: fetch the current user's pending delivery offer (any
   * persona). Returns active=false when there is none.
   */
  getPendingOffer: (): Promise<OrderOfferResponse> =>
    api.get<OrderOfferResponse>('/orders/offers/pending'),

  /** Push-offer flow: accept the offer (atomic claim on the backend). */
  acceptOffer: (orderId: string): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/offer/accept', { orderId }),

  /** Push-offer flow: decline the offer. */
  declineOffer: (orderId: string): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/offer/decline', { orderId }),

  pickUp: (orderId: string, notes?: string): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/pick_up', { orderId, notes }),

  startTransit: (orderId: string, notes?: string): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/start_transit', { orderId, notes }),

  outForDelivery: (orderId: string, notes?: string): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/out_for_delivery', { orderId, notes }),

  deliver: (orderId: string, notes?: string): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/deliver', { orderId, notes }),

  /**
   * Nouveau flux (aligné web) : l'agent finalise la livraison avec PIN client (4 chiffres)
   * OU code overwrite business.
   */
  completeDelivery: (request: CompleteDeliveryRequest): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/orders/complete-delivery', request),

  initiatePayAtDeliveryPayment: (
    orderId: string,
    body?: { phone_number?: string }
  ): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>(`/orders/${orderId}/initiate-pay-at-delivery-payment`, body ?? {}),

  markPaidInCashException: (orderId: string, body?: { notes?: string }): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>(`/orders/${orderId}/mark-paid-in-cash-exception`, body ?? {}),

  /** Traitement en lot (batch) – aligné backend POST /orders/batch/* */
  batchPickUp: (orderIds: string[], notes?: string) =>
    api.post<BatchOrderResponse>('/orders/batch/pick_up', { orderIds, notes }),
  batchStartTransit: (orderIds: string[], notes?: string) =>
    api.post<BatchOrderResponse>('/orders/batch/start_transit', { orderIds, notes }),
  batchOutForDelivery: (orderIds: string[], notes?: string) =>
    api.post<BatchOrderResponse>('/orders/batch/out_for_delivery', { orderIds, notes }),

  getMessages: (orderId: string): Promise<OrderMessagesResponse> =>
    api.get<OrderMessagesResponse>(`/orders/${orderId}/messages`),

  sendMessage: (
    orderId: string,
    message: string,
    mentionedUserId?: string
  ): Promise<CreateOrderMessageResponse> =>
    api.post<CreateOrderMessageResponse>(`/orders/${orderId}/messages`, {
      message,
      ...(mentionedUserId ? { mentionedUserId } : {}),
    }),

  getMentionableParticipants: (orderId: string): Promise<MentionableParticipantsResponse> =>
    api.get<MentionableParticipantsResponse>(`/orders/${orderId}/mentionable-participants`),

  markMessagesRead: (orderId: string, lastReadMessageId: string): Promise<{ success: boolean }> =>
    api.post<{ success: boolean }>(`/orders/${orderId}/messages/read`, { lastReadMessageId }),
};

const agents = {
  getEarningsSummary: (): Promise<AgentEarningsSummaryResponse> =>
    api.get<AgentEarningsSummaryResponse>('/agents/earnings-summary'),

  getReferredBusinessesSummary: (): Promise<{
    success: boolean;
    referredBusinessCount: number;
    agentCode: string | null;
  }> => api.get('/agents/me/referred-businesses-summary'),

  getReferredBusinesses: (): Promise<{
    success: boolean;
    businesses: import('../types/referredBusiness').ReferredBusinessFollowUp[];
  }> => api.get('/agents/me/referred-businesses'),

  getReferralPayoutProjection: (): Promise<
    import('../types/referralProjectedPayout').ReferralProjectedPayout
  > => api.get('/agents/me/referral-payout-projection'),

  updateFocus: (
    focus: 'delivery' | 'commercial' | 'both'
  ): Promise<{
    success: boolean;
    agent?: { id: string; focus: string };
  }> => api.patch('/agents/me/focus', { focus }),

  getHoldPercentage: (): Promise<{ holdPercentage: number; isVerified?: boolean }> =>
    api.get('/agents/hold-percentage'),

  completeOnboarding: (): Promise<{ success: boolean }> =>
    api.post('/agents/complete_onboarding', {}),

  updateLocationTrackingConsent: (consent: string): Promise<{
    success: boolean;
    agent?: {
      id: string;
      location_tracking_consent_ios: string;
      location_tracking_consent_android: string;
      location_tracking_consent_web: string;
    };
  }> =>
    api.patch('/agents/me/location-tracking-consent', {
      consent,
      platform: getLocationConsentPlatform(),
    }),

  setAvailability: (
    available: boolean
  ): Promise<{ success: boolean; agent?: { id: string; is_available: boolean } }> =>
    api.patch('/agents/me/availability', { available }),
};

const clients = {
  getNearbyAgentsCount: (): Promise<{ count: number }> =>
    api.get<{ count: number }>('/clients/nearby-agents'),
};

const failedDeliveries = {
  fail: (params: { orderId: string; notes?: string; failure_reason_id: string }): Promise<OrderActionResponse> =>
    api.post<OrderActionResponse>('/failed-deliveries/fail', params),

  getReasons: (language?: string): Promise<{ success: boolean; reasons: FailedDeliveryReason[] }> =>
    api.get(language ? `/failed-deliveries/reasons?language=${language}` : '/failed-deliveries/reasons'),
};

function unwrapAddressRow(row: { address: UserAddress } | UserAddress): UserAddress | null {
  if (row && typeof row === 'object' && 'address' in row && row.address) return row.address;
  if (row && typeof row === 'object' && 'id' in row && 'address_line_1' in row) return row as UserAddress;
  return null;
}

function sortClientAddressesPrimaryFirst(list: UserAddress[]): UserAddress[] {
  return [...list].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return 0;
  });
}

const addresses = {
  /** Optional `X-Active-Persona` (and other) header overrides for this request. */
  getList: async (headerOverrides?: Record<string, string>): Promise<UserAddress[]> => {
    const res = await api.get<{
      success?: boolean;
      data?: { addresses?: Array<{ address: UserAddress } | UserAddress> };
    }>('/addresses', headerOverrides);
    const rows = res.data?.addresses;
    if (!rows?.length) return [];
    const mapped = rows.map(unwrapAddressRow).filter((a): a is UserAddress => a != null);
    return sortClientAddressesPrimaryFirst(mapped);
  },
  create: (body: {
    address_line_1: string;
    city: string;
    state: string;
    country: string;
    address_type?: string;
    postal_code?: string;
    address_line_2?: string;
    is_primary?: boolean;
    latitude?: number;
    longitude?: number;
  }) => api.post<{ success: boolean; data?: { address: UserAddress } }>('/addresses', body),
  update: (id: string, body: Partial<UserAddress>) =>
    api.put<{ success: boolean; data?: { address: UserAddress } }>(`/addresses/${id}`, body),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/addresses/${id}`),
};

const recipients = {
  getList: async (
    params?: GetRecipientsParams
  ): Promise<RecipientsListResponse> => {
    const qs = params?.country
      ? `?country=${encodeURIComponent(params.country)}`
      : '';
    const raw = await api.get<unknown>(`/recipients${qs}`);
    return normalizeRecipientsList(raw);
  },

  create: async (body: CreateRecipientPayload): Promise<RecipientResponse> => {
    const raw = await api.post<unknown>('/recipients', body);
    return normalizeRecipientResponse(raw);
  },

  update: async (
    id: string,
    body: UpdateRecipientPayload
  ): Promise<RecipientResponse> => {
    const raw = await api.patch<unknown>(`/recipients/${id}`, body);
    return normalizeRecipientResponse(raw);
  },

  delete: (id: string): Promise<DeleteRecipientResponse> =>
    api.delete<DeleteRecipientResponse>(`/recipients/${id}`),
};

export type SupportTicketType = 'dispute' | 'complaint' | 'question';

export interface CreateSupportTicketRequest {
  orderId: string;
  type: SupportTicketType;
  subject: string;
  description?: string;
}

export interface UserMessage {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  message: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  entity_type_info?: { id: string; comment: string };
}

export interface SupportTicket {
  id: string;
  order_id: string;
  user_id: string;
  type: string;
  status: string;
  subject: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  order?: { order_number: string };
}

export interface UpdateMyAgentLocationApiResponse {
  success: boolean;
  location?: {
    agentId: string;
    latitude: number;
    longitude: number;
    updatedAt: string;
  };
  error?: string;
}

const locations = {
  updateMyAgentLocation: (
    latitude: number,
    longitude: number
  ): Promise<UpdateMyAgentLocationApiResponse> =>
    api.post<UpdateMyAgentLocationApiResponse>('/locations/agent/me', { latitude, longitude }),
};

const messages = {
  getMyMessages: (params?: { entity_type?: string; entity_id?: string; search?: string; page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.entity_type) searchParams.set('entity_type', params.entity_type);
    if (params?.entity_id) searchParams.set('entity_id', params.entity_id);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page != null) searchParams.set('page', String(params.page));
    if (params?.limit != null) searchParams.set('limit', String(params.limit));
    const qs = searchParams.toString();
    return api.get<{ success: boolean; messages: UserMessage[] }>(`/messages${qs ? `?${qs}` : ''}`);
  },
  getEntityTypes: () =>
    api.get<{ success: boolean; entity_types: { id: string; comment: string }[] }>('/messages/entity-types'),
};

const support = {
  createTicket: (payload: CreateSupportTicketRequest) => api.post<SupportTicket>('/support/tickets', payload),
  getTickets: (): Promise<SupportTicket[]> =>
    api.get<SupportTicket[]>('/support/tickets').then((res) => (Array.isArray(res) ? res : [])),
  getTicket: (id: string): Promise<SupportTicket | null> =>
    api.get<SupportTicket | null>(`/support/tickets/${id}`).then((t) => t ?? null),
};

/** Payload pour POST /users (création profil agent après Auth0). */
export interface CreateUserPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  user_type_id: string;
  profile: { vehicle_type_id?: string; name?: string };
  address?: {
    address_line_1: string;
    country: string;
    city: string;
    state: string;
  };
  referral_agent_code?: string;
}

export interface CreateUserResponse {
  success: boolean;
  user?: { id: string };
  agent?: { id: string };
  identifier?: string;
}

export type AddPersonaBody = {
  vehicle_type_id?: string;
  agent_focus?: 'delivery' | 'commercial' | 'both';
  name?: string;
  main_interest?: 'sell_items' | 'rent_items';
  referral_agent_code?: string;
};

export type AddPersonaResponse = {
  success: boolean;
  client?: { id: string };
  agent?: { id: string };
  business?: { id: string };
  error?: string;
};

const users = {
  /** Complète le profil en base (à appeler après Auth0 signup + login, avec token). */
  createUser: (payload: CreateUserPayload): Promise<CreateUserResponse> =>
    api.post<CreateUserResponse>('/users', payload),

  /** Utilisateur courant (personas, agent, etc.). */
  getMe: (): Promise<MeResponse> => api.get<MeResponse>('/users/me'),

  /** Profil : enregistrer le numéro (Mobile Money, notifications). */
  setMyPhone: (body: { phoneNumber: string }): Promise<SetMyPhoneResponse> =>
    api.post<SetMyPhoneResponse>('/users/me/phone', body),

  updateMyEmail: (body: { email: string }): Promise<UpdateMyEmailResponse> =>
    api.post<UpdateMyEmailResponse>('/users/me/update-email', body),

  updateMe: (body: {
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    preferredLanguage?: 'en' | 'fr';
    timezone?: string;
  }): Promise<UpdateMeResponse> => api.post<UpdateMeResponse>('/users/me/update', body),

  startPhoneVerification: (body: { phone_number: string }): Promise<{ success: boolean; data: any }> =>
    api.post<{ success: boolean; data: any }>('/twilio-verify/start', body),

  verifyPhoneCode: (body: { phone_number: string; code: string }): Promise<{ success: boolean; data: any }> =>
    api.post<{ success: boolean; data: any }>('/twilio-verify/verify', body),

  setActivePersona: (persona: PersonaSlug): Promise<{ success: boolean; persona?: string }> =>
    api.post<{ success: boolean; persona?: string }>('/users/me/active-persona', { persona }),

  setActiveContext: (body:
    | { kind: 'persona'; persona: PersonaSlug }
    | { kind: 'delegation'; delegationId: string }
  ): Promise<{ success: boolean; kind?: string; persona?: string; delegationId?: string }> =>
    api.post('/users/me/active-context', body),

  addPersona: (
    persona: PersonaSlug,
    body?: AddPersonaBody
  ): Promise<AddPersonaResponse> =>
    api.post<AddPersonaResponse>(`/users/me/personas/${persona}`, body ?? {}),

  deleteMyAccount: (): Promise<{ success: boolean }> =>
    api.post<{ success: boolean }>('/users/me/delete'),
};

const accounts = {
  getInfo: (): Promise<AccountInfoResponse> => api.get<AccountInfoResponse>('/accounts/info'),
  withdrawalConfig: (accountId: string): Promise<WithdrawalConfigResponse> =>
    api.get<WithdrawalConfigResponse>(`/accounts/${accountId}/withdrawal-config`),
};

const mobilePayments = {
  initiate: (body: InitiateMobilePaymentBody): Promise<InitiateMobilePaymentResponse> =>
    api.post<InitiateMobilePaymentResponse>('/mobile-payments/initiate', body),
};

const stripe = {
  clientConfig: (): Promise<StripeClientConfigResponse> =>
    api.get<StripeClientConfigResponse>('/stripe-payments/config'),
  initiate: (body: InitiateStripePaymentBody): Promise<InitiateStripePaymentResponse> =>
    api.post<InitiateStripePaymentResponse>('/stripe-payments/initiate', body),
  transactionStatus: (
    transactionId: string
  ): Promise<StripeTransactionStatusResponse> =>
    api.get<StripeTransactionStatusResponse>(
      `/stripe-payments/transactions/${transactionId}/status`
    ),
  connectStatus: (): Promise<StripeConnectStatusResponse> =>
    api.get<StripeConnectStatusResponse>('/stripe-connect/status'),
  connectAccountLink: (body?: {
    returnUrl?: string;
    refreshUrl?: string;
    platform?: 'mobile' | 'web';
  }): Promise<StripeConnectLinkResponse> =>
    api.post<StripeConnectLinkResponse>('/stripe-connect/account-link', body ?? {}),
  connectLoginLink: (): Promise<StripeConnectLinkResponse> =>
    api.post<StripeConnectLinkResponse>('/stripe-connect/login-link', {}),
  withdraw: (body: StripeWithdrawBody): Promise<StripeWithdrawResponse> =>
    api.post<StripeWithdrawResponse>('/stripe-payments/withdraw', body),
};

const ratings = {
  create: (body: CreateRatingBody): Promise<CreateRatingResponse> =>
    api.post<CreateRatingResponse>('/ratings', body),
  getEligibility: (orderId: string): Promise<OrderRatingEligibilityResponse> =>
    api.get<OrderRatingEligibilityResponse>(`/ratings/order/${orderId}/eligibility`),
  getAggregate: (entityType: string, entityId: string): Promise<RatingAggregateResponse> =>
    api.get<RatingAggregateResponse>(`/ratings/aggregate/${entityType}/${entityId}`),
  getForEntity: (
    entityType: string,
    entityId: string,
    limit = 10,
    offset = 0
  ): Promise<EntityRatingsResponse> =>
    api.get<EntityRatingsResponse>(
      `/ratings/entity/${entityType}/${entityId}?limit=${limit}&offset=${offset}`
    ),
};

const notifications = {
  getPushTokenStatus: (expoPushToken?: string): Promise<PushTokenStatusResponse> => {
    const qs =
      expoPushToken && expoPushToken.trim().length > 0
        ? `?expoPushToken=${encodeURIComponent(expoPushToken.trim())}`
        : '';
    return api.get<PushTokenStatusResponse>(`/notifications/push-token/status${qs}`);
  },

  registerPushToken: (body: RegisterPushTokenBody): Promise<RegisterPushTokenResponse> =>
    api.post<RegisterPushTokenResponse>('/notifications/push-token', body),
};

export const agentApi = {
  orders,
  locations,
  agents,
  clients,
  failedDeliveries,
  addresses,
  recipients,
  support,
  messages,
  users,
  accounts,
  mobilePayments,
  stripe,
  notifications,
  ratings,
  dashboard: {
    getActions: (): Promise<{ success: boolean; data: ActionsNeededDto }> =>
      api.get<{ success: boolean; data: ActionsNeededDto }>('/dashboard/actions'),
  },
};
