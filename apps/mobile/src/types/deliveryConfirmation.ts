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
  // MoMo Delivered → client Complete (optional: older APIs omit them)
  accessible?: true;
  viewerRole?: 'client' | 'agent' | 'business';
  serverNow?: string;
  deliveredAt?: string | null;
  completedAt?: string | null;
  reminderAt?: string | null;
  reportWindowEndsAt?: string | null;
  market?: { reportWindowHours?: number; momoAutoCompleteHours?: number };
  disputeType?: 'issue' | 'delivery_failed' | null;
  disputeOpenedAt?: string | null;
  canComplete?: boolean;
  canReport?: boolean;
  canReportAfterCompletion?: boolean;
  confirmVariant?: DeliveryConfirmVariant;
  supportTicketId?: string | null;
}

export type DeliveryConfirmVariant =
  | 'not_delivered_yet'
  | 'awaiting'
  | 'disputed'
  | 'completed_can_report'
  | 'completed'
  | 'closed';

/** Same endpoint, when the signed-in account does not own the order. No order data. */
export interface DeliveryConfirmationForbidden {
  orderId: string;
  accessible: false;
  reason: 'other_account';
}

export type DeliveryReportType = 'issue' | 'delivery_failed';
export const ISSUE_REASONS = ['missing_items', 'wrong_items', 'damaged', 'other'] as const;
export const DELIVERY_FAILED_REASONS = ['courier_didnt_come', 'not_received', 'other'] as const;

export interface DeliveryReportInput {
  type: DeliveryReportType;
  reason: string;
  note?: string;
}

export const CLIENT_CONFIRM_COMPLETABLE_STATUSES = [
  'out_for_delivery',
  'awaiting_client_confirmation',
  'pending_auto_complete',
] as const;

export type ClientConfirmCompletableStatus =
  (typeof CLIENT_CONFIRM_COMPLETABLE_STATUSES)[number];
