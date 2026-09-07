/**
 * Saved recipient types for diaspora orders.
 * Backend GET /recipients returns a raw array; POST/PATCH return the recipient
 * object. `agentApi.recipients` normalizes those into the envelopes below.
 */

export interface SavedRecipient {
  id: string;
  /** Full name of the recipient. */
  name: string;
  /** E.164 phone number. */
  phone: string;
  /** ISO country code (e.g. "GA", "CM"). Scoped to fulfillment country. */
  country: string;
  /** True to send WhatsApp updates to the recipient. */
  notify_whatsapp: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateRecipientPayload {
  name: string;
  phone: string;
  country: string;
  notify_whatsapp: boolean;
}

export interface UpdateRecipientPayload {
  name?: string;
  phone?: string;
  notify_whatsapp?: boolean;
}

export interface GetRecipientsParams {
  country?: string;
}

export interface RecipientsListResponse {
  success: boolean;
  recipients: SavedRecipient[];
  error?: string;
}

export interface RecipientResponse {
  success: boolean;
  recipient?: SavedRecipient;
  error?: string;
  message?: string;
}

export interface DeleteRecipientResponse {
  success: boolean;
  message?: string;
  error?: string;
}
