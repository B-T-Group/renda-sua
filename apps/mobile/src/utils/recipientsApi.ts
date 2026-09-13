import type {
  RecipientResponse,
  RecipientsListResponse,
  SavedRecipient,
} from '../types/recipient';

export const RECIPIENT_COUNTRY_CODES = ['GA', 'CM'] as const;
export type RecipientCountryCode = (typeof RECIPIENT_COUNTRY_CODES)[number];

export function isRecipientCountryCode(
  value: string | undefined
): value is RecipientCountryCode {
  return value === 'GA' || value === 'CM';
}

function isSavedRecipient(value: unknown): value is SavedRecipient {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<SavedRecipient>;
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.phone === 'string' &&
    typeof row.country === 'string'
  );
}

function normalizeSavedRecipient(value: SavedRecipient): SavedRecipient {
  return {
    ...value,
    address_id:
      typeof value.address_id === 'string' && value.address_id.trim()
        ? value.address_id
        : null,
    notify_whatsapp: Boolean(value.notify_whatsapp),
  };
}

/**
 * Backend GET /recipients returns a raw array. Older clients expected
 * `{ success, recipients }`. Accept both so an empty list is not an error.
 */
export function normalizeRecipientsList(raw: unknown): RecipientsListResponse {
  if (Array.isArray(raw)) {
    return {
      success: true,
      recipients: raw.filter(isSavedRecipient).map(normalizeSavedRecipient),
    };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as RecipientsListResponse;
    if (Array.isArray(obj.recipients)) {
      return {
        success: obj.success !== false,
        recipients: obj.recipients
          .filter(isSavedRecipient)
          .map(normalizeSavedRecipient),
        error: obj.error,
      };
    }
    if (obj.success === false) {
      return { success: false, recipients: [], error: obj.error };
    }
  }
  return { success: false, recipients: [], error: 'Failed to fetch recipients' };
}

/**
 * Backend POST/PATCH /recipients returns the recipient object.
 * Accept `{ success, recipient }` as well.
 */
export function normalizeRecipientResponse(raw: unknown): RecipientResponse {
  if (isSavedRecipient(raw)) {
    return { success: true, recipient: normalizeSavedRecipient(raw) };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as RecipientResponse;
    if (obj.recipient && isSavedRecipient(obj.recipient)) {
      return {
        success: true,
        recipient: normalizeSavedRecipient(obj.recipient),
      };
    }
    if (obj.success === false) {
      return {
        success: false,
        error: obj.error || obj.message || 'Failed to save recipient',
      };
    }
  }
  return { success: false, error: 'Failed to save recipient' };
}
