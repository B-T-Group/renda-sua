/** Parameter object for a WhatsApp template component (header/body/button). */
export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  [key: string]: unknown;
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: string;
  index?: string;
  parameters?: WhatsAppTemplateParameter[];
}

/** Meta's approved template category. Drives transport, pricing, and consent. */
export type WhatsAppTemplateCategory =
  | 'AUTHENTICATION'
  | 'UTILITY'
  | 'MARKETING';

export interface SendWhatsAppTemplateParams {
  /** Recipient phone in international format (digits, optional leading +). */
  to: string;
  templateName: string;
  /** Template translation code as approved in Meta; ours are `en` and `fr`. */
  languageCode?: string;
  components?: WhatsAppTemplateComponent[];
  /** Defaults to UTILITY; MARKETING may route through the Marketing Messages API. */
  category?: WhatsAppTemplateCategory;
}

export interface WhatsAppSendMessageResult {
  messagingProduct: string;
  contacts: Array<{ input: string; waId: string }>;
  messages: Array<{ id: string; messageStatus?: string }>;
}

export interface WhatsAppGraphMessagesResponse {
  messaging_product?: string;
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id?: string; message_status?: string }>;
  error?: { message?: string; type?: string; code?: number };
}
