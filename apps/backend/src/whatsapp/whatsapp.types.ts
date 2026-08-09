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

export interface SendWhatsAppTemplateParams {
  /** Recipient phone in international format (digits, optional leading +). */
  to: string;
  templateName: string;
  /** BCP-47 language code for the template, e.g. en_US. */
  languageCode?: string;
  components?: WhatsAppTemplateComponent[];
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
