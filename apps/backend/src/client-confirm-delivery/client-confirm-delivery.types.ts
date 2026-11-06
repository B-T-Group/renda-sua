import type { DeliveryConfirmationMethod } from './client-confirm-delivery.constants';
import type { ClientConfirmMarketConfig } from './client-confirm-market-config.service';

export interface ClientConfirmOrder {
  id: string;
  order_number?: string | null;
  current_status: string;
  fulfillment_method?: string | null;
  fulfillment_country?: string | null;
  payment_timing?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_source?: string | null;
  pay_after_merchant_confirm?: boolean | null;
  reconciliation_status?: string | null;
  total_amount?: number | null;
  deposit_amount?: number | null;
  deposit_status?: string | null;
  delivery_pin_hash?: string | null;
  delivery_confirmation_method?: string | null;
  client_confirmation_requested_at?: string | null;
  client_confirmed_at?: string | null;
  auto_complete_deadline_at?: string | null;
  delivery_proof_submitted_at?: string | null;
  awaiting_confirm_reminder_1h_at?: string | null;
  awaiting_confirm_reminder_24h_at?: string | null;
  awaiting_confirm_support_ticket_id?: string | null;
  delivered_at?: string | null;
  completed_at?: string | null;
  report_window_ends_at?: string | null;
  dispute_type?: string | null;
  dispute_reason?: string | null;
  dispute_opened_at?: string | null;
  assigned_agent_id?: string | null;
  business_id?: string | null;
  client_id?: string | null;
  is_third_party_recipient?: boolean | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_notify_whatsapp?: boolean | null;
  payer_name?: string | null;
  payer_country?: string | null;
  client?: { id?: string; user_id?: string | null } | null;
  assigned_agent?: { id?: string; user_id?: string | null; status?: string | null } | null;
  business?: { id?: string; user_id?: string | null; name?: string | null } | null;
  business_location?: { address?: { country?: string | null } | null } | null;
}

export interface DeliveryProofPhotoInput {
  photoUrl: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  note?: string;
}

export interface DeliveryConfirmationState {
  orderId: string;
  status: string;
  usesLegacyPin: boolean;
  isClientConfirmFlow: boolean;
  isStripeRail: boolean;
  graceElapsed: boolean;
  graceMinutes: number;
  autoCompleteHours: number;
  autoCompleteDeadlineAt: string | null;
  requestedAt: string | null;
  canSubmitFallback: boolean;
  agentMessageKey: 'agent.waiting' | 'agent.nonstripe' | 'agent.fallback.cta';
  giftBuyerCanConfirm: boolean;
  photos: Array<{
    photoUrl: string;
    capturedAt: string;
    latitude: number | null;
    longitude: number | null;
    agentId: string | null;
  }>;
  market: ClientConfirmMarketConfig;
  /** Spec B4: fields the client confirm screen renders. */
  accessible: true;
  viewerRole: 'client' | 'agent' | 'business';
  serverNow: string;
  deliveredAt: string | null;
  completedAt: string | null;
  reminderAt: string | null;
  reportWindowEndsAt: string | null;
  disputeType: string | null;
  disputeOpenedAt: string | null;
  canComplete: boolean;
  canReport: boolean;
  canReportAfterCompletion: boolean;
  confirmVariant: DeliveryConfirmVariant;
}

/** P5: the confirm screen never dead-ends; it renders one of these. */
export type DeliveryConfirmVariant =
  | 'not_delivered_yet'
  | 'awaiting'
  | 'disputed'
  | 'completed_can_report'
  | 'completed'
  | 'closed';

/** P4: wrong account. No order data leaks. */
export interface DeliveryConfirmationForbidden {
  orderId: string;
  accessible: false;
  reason: 'other_account';
}

export interface DeliveryReportInput {
  type: 'issue' | 'delivery_failed';
  reason: string;
  note?: string;
  photoUrls?: string[];
  itemIds?: string[];
}

export interface DeliveryReportResult {
  success: boolean;
  status: string;
  ticketId?: string | null;
  reportId?: string | null;
  postCompletionClaim?: boolean;
  message: string;
}

export interface ConfirmReceiptResult {
  success: boolean;
  alreadyComplete: boolean;
  orderId: string;
  status: string;
  message: string;
  confirmationMethod?: DeliveryConfirmationMethod;
}

export interface RecipientProblemResult {
  success: boolean;
  status: string;
  ticketId?: string | null;
  postCompletionClaim?: boolean;
  message: string;
}

export type RecipientDeliveryAction = 'received' | 'problem';
