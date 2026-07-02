export const MESSAGE_TYPES = [
  'TEXT',
  'DELIVERY_PIN',
  'SYSTEM',
  'PAYMENT',
  'LOCATION',
  'IMAGE',
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export type DeliveryPinPayloadStatus = 'active' | 'superseded' | 'revoked';

export type DeliveryPinRevokedReason =
  | 'order_completed'
  | 'order_cancelled'
  | 'pin_regenerated'
  | 'manual_resend';

export interface DeliveryPinPayloadV1 {
  version: 1;
  status: DeliveryPinPayloadStatus;
  pinVersion: number;
  sharedToUserId: string;
  pinCiphertext: string;
  maskedDisplay: '****';
  supersededByMessageId?: string;
  revokedAt?: string;
  revokedReason?: DeliveryPinRevokedReason;
}

export interface DeliveryPinStructuredContent {
  status: DeliveryPinPayloadStatus;
  pinVersion: number;
  sharedToUserId: string;
  sharedToDisplayName?: string;
  pin?: string;
  maskedDisplay: string;
  supersededByMessageId?: string;
  revokedAt?: string;
  revokedReason?: DeliveryPinRevokedReason;
}

export interface StructuredMessageDisplayRef {
  i18nKey: string;
  params?: Record<string, string>;
}

export interface StructuredMessageCreateContext {
  orderId: string;
  senderUserId: string;
  senderPersona: import('../users/persona.types').PersonaId;
  order: import('./messaging.types').MessagingOrder;
}

export interface StructuredMessageEnrichContext {
  viewerUserId: string;
  viewerPersona: import('../users/persona.types').PersonaId;
  order: import('./messaging.types').MessagingOrder;
}

export interface StructuredMessageHandler {
  readonly type: MessageType;
  validateCreate?(ctx: StructuredMessageCreateContext): void | Promise<void>;
  buildDisplayMessage(ctx: StructuredMessageCreateContext): string;
  enrichForViewer(
    payload: Record<string, unknown>,
    ctx: StructuredMessageEnrichContext
  ): Record<string, unknown> | null;
  resolveRecipients?(
    order: import('./messaging.types').MessagingOrder,
    payload: Record<string, unknown>
  ): Array<{ userId: string; type: 'mentioned' | 'default_route' }>;
  pushNotificationType?: string;
}
