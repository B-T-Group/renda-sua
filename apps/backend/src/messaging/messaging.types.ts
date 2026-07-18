import type { PersonaId } from '../users/persona.types';

export interface OrderParticipant {
  userId: string;
  persona: PersonaId;
  displayName: string;
  /** true when this participant is the currently assigned agent */
  isAssigned?: boolean;
}

export interface ResolvedRecipient {
  userId: string;
  type: 'mentioned' | 'default_route';
}

export interface MentionableParticipant {
  userId: string;
  persona: PersonaId;
  displayName: string;
}

export interface MessageMention {
  mentionedUserId: string;
  persona: PersonaId;
  displayName: string;
  textOffset?: number | null;
  textLength?: number | null;
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
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  entity_type_info?: {
    id: string;
    comment: string;
  };
  mention?: MessageMention | null;
  message_type?: string;
  message_payload?: Record<string, unknown> | null;
  is_immutable?: boolean;
  structured_content?: Record<string, unknown> | null;
}

/** Minimal order shape needed by the messaging domain */
export interface MessagingOrder {
  id: string;
  order_number: string;
  business_id: string;
  client_id: string;
  assigned_agent_id: string | null;
  current_status?: string;
  fulfillment_method?: string | null;
  client?: {
    user_id?: string | null;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      preferred_language?: string | null;
    } | null;
  } | null;
  business?: {
    user_id?: string | null;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      preferred_language?: string | null;
    } | null;
  } | null;
  assigned_agent?: {
    user_id?: string | null;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      preferred_language?: string | null;
    } | null;
  } | null;
}

export interface MessageCreatedEvent {
  messageId: string;
  orderId: string;
  orderNumber: string;
  senderUserId: string;
  senderPersona: PersonaId;
  senderName: string;
  mentionedUserId?: string;
  recipients: ResolvedRecipient[];
  messageType?: string;
  fulfillmentMethod?: string | null;
}
