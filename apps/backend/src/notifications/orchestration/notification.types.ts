export type NotificationCategory = 'actionable' | 'informational';

export type NotificationChannel = 'push' | 'whatsapp' | 'email' | 'sms';

export type NotificationDeliveryStatus =
  | 'requested'
  | 'queued'
  | 'attempted'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'clicked'
  | 'replied'
  | 'action_completed'
  | 'skipped';

/** Canonical notification event types used by the orchestrator. */
export type NotificationType =
  | 'wallet.credit'
  | 'order.created'
  | 'order.status.changed'
  | 'order.offer'
  | 'order.offer.cancelled'
  | 'order.no_agent'
  | 'order.acceptance.activate'
  | 'order.acceptance.escalation'
  | 'order.busy'
  | 'order.missed'
  | 'order.auto_declined'
  | 'order.payment_failed'
  | 'order.pickup.reminder'
  | 'order.pickup.at_risk'
  | 'order.pickup.overdue'
  | 'order.pickup.reassigned'
  | 'order.delivery_pin'
  | 'rental.request'
  | 'rental.request.accepted'
  | 'rental.request.rejected'
  | 'rental.booking.reserved'
  | 'rental.booking.confirmed'
  | 'rental.booking.cancelled'
  | 'rental.ending_soon'
  | 'rental.period_ended'
  | 'rental.start_pin'
  | 'verification.attention'
  | 'verification.approved'
  | 'verification.rejected'
  | 'ai.proposal.ready'
  | 'rating.prompt'
  | 'rating.received'
  | 'chat.message'
  | 'merchant.digest'
  | 'merchant.tip'
  | 'admin.broadcast';

export type NotificationPreferenceCategory =
  | 'order_updates'
  | 'chat'
  | 'marketplace'
  | 'reminders'
  | 'marketing';

export interface PushChannelPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** High-priority Expo options for interruptible offers */
  interruptible?: boolean;
}

export interface EmailChannelPayload {
  to: string;
  subject?: string;
  /** Resend template key or HTML body handled by adapter */
  templateKey?: string;
  html?: string;
  templateData?: Record<string, unknown>;
  preferredLanguage?: string | null;
}

export interface SmsChannelPayload {
  to: string;
  body: string;
}

export interface WhatsAppChannelPayload {
  /** Internal template key resolved by WhatsAppTemplateService */
  templateKey: string;
  variables: Record<string, string>;
  /** HTTPS CTA URL (universal link) */
  ctaUrl?: string;
  phoneE164?: string;
}

export interface NotifyRequest {
  type: NotificationType;
  category: NotificationCategory;
  recipientUserId: string;
  locale?: 'en' | 'fr';
  payload?: Record<string, unknown>;
  dedupeKey?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  preferenceCategory?: NotificationPreferenceCategory;
  /** When true, SMS may be used as final fallback (actionable). */
  allowSmsFallback?: boolean;
  channels: {
    push?: PushChannelPayload;
    email?: EmailChannelPayload;
    sms?: SmsChannelPayload;
    whatsapp?: WhatsAppChannelPayload;
  };
}

export interface ChannelAttemptResult {
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  providerMessageId?: string;
  error?: string;
  skippedReason?: string;
}

export interface NotifyResult {
  type: NotificationType;
  recipientUserId: string;
  attempts: ChannelAttemptResult[];
}

export interface UserNotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  whatsappOptedInAt: string | null;
  whatsappInformationalEnabled: boolean;
  marketingEnabled: boolean;
  orderUpdates: boolean;
  chat: boolean;
  marketplace: boolean;
  reminders: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
}

export interface PatchNotificationPreferencesDto {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  whatsappInformationalEnabled?: boolean;
  marketingEnabled?: boolean;
  orderUpdates?: boolean;
  chat?: boolean;
  marketplace?: boolean;
  reminders?: boolean;
}
