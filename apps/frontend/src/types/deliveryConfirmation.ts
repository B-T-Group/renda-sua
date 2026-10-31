export type AgentConfirmMessageKey =
  | 'agent.waiting'
  | 'agent.nonstripe'
  | 'agent.fallback.cta';

export interface DeliveryProofPhoto {
  photoUrl: string;
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  agentId: string | null;
}

export interface DeliveryProofPhotoInput {
  photoUrl: string;
  capturedAt: string;
  latitude: number;
  longitude: number;
  note?: string;
}

/** GET /orders/:id/delivery-confirmation — UI source of truth. */
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
  agentMessageKey: AgentConfirmMessageKey;
  giftBuyerCanConfirm: boolean;
  photos: DeliveryProofPhoto[];
}

export const CLIENT_CONFIRM_COMPLETABLE_STATUSES = [
  'out_for_delivery',
  'awaiting_client_confirmation',
  'pending_auto_complete',
] as const;
