import type { PersonaId } from '../../users/persona.types';
import type { MessagingOrder } from '../messaging.types';

export const MESSAGE_TYPES = [
  'TEXT',
  'DELIVERY_PIN',
  'RENTAL_START_PIN',
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
  [key: string]: unknown;
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
  [key: string]: unknown;
}

export interface StructuredMessageDisplayRef {
  i18nKey: string;
  params?: Record<string, string>;
}

export interface StructuredMessageCreateContext {
  orderId: string;
  senderUserId: string;
  senderPersona: PersonaId;
  order: MessagingOrder;
}

export interface StructuredMessageEnrichContext {
  viewerUserId: string;
  viewerPersona: PersonaId;
  order: MessagingOrder;
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
    order: MessagingOrder,
    payload: Record<string, unknown>
  ): Array<{ userId: string; type: 'mentioned' | 'default_route' }>;
  pushNotificationType?: string;
}
