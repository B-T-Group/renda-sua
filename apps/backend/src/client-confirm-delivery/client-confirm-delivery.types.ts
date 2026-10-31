import type { DeliveryConfirmationMethod } from './client-confirm-delivery.constants';
import type { ClientConfirmMarketConfig } from './client-confirm-market-config.service';

export interface ClientConfirmOrder {
  id: string;
  order_number?: string | null;
  current_status: string;
  fulfillment_method?: string | null;
  fulfillment_country?: string | null;
  payment_timing?: string | null;
  payment_status?: string | null;
  reconciliation_status?: string | null;
  delivery_pin_hash?: string | null;
  delivery_confirmation_method?: string | null;
  client_confirmation_requested_at?: string | null;
  client_confirmed_at?: string | null;
  auto_complete_deadline_at?: string | null;
  delivery_proof_submitted_at?: string | null;
  awaiting_confirm_reminder_1h_at?: string | null;
  awaiting_confirm_reminder_24h_at?: string | null;
  awaiting_confirm_support_ticket_id?: string | null;
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
}

export interface ConfirmReceiptResult {
  success: boolean;
  alreadyComplete: boolean;
  orderId: string;
  status: string;
  message: string;
  confirmationMethod?: DeliveryConfirmationMethod;
}

export type RecipientDeliveryAction = 'received' | 'problem';
