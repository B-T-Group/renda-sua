import { HttpException, HttpStatus } from '@nestjs/common';
import { validatePhoneNumber } from '../mobile-payments/phone-validation.util';

/** Recipient block collected at checkout when buying for someone else. */
export interface OrderRecipientInput {
  name?: string;
  phone?: string;
  email?: string;
  notify_whatsapp?: boolean;
}

/** Recipient contact persisted on the order, or the payer when self-ordering. */
export interface ResolvedOrderRecipient {
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_notify_whatsapp: boolean;
  is_third_party_recipient: boolean;
}

export interface PayerIdentity {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  country?: string | null;
}

/** Payer snapshot persisted on the order so it survives later profile edits. */
export interface ResolvedOrderPayer {
  payer_name: string | null;
  payer_phone: string | null;
  payer_email: string | null;
  payer_country: string | null;
}

export const DIASPORA_ERROR_CODES = {
  recipientContactRequired: 'RECIPIENT_CONTACT_REQUIRED',
  recipientPhoneInvalid: 'RECIPIENT_PHONE_INVALID_FOR_COUNTRY',
  requiresPayNow: 'DIASPORA_REQUIRES_PAY_NOW',
} as const;

export function normalizeCountryCode(
  value?: string | null
): string | null {
  const code = value?.trim().toUpperCase();
  return code && code.length === 2 ? code : null;
}

function trimOrNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Normalizes a recipient phone to E.164 using the fulfillment country as the
 * default region, so a locally typed `077…` still reaches the right handset.
 */
export function normalizeRecipientPhone(
  phone: string,
  fulfillmentCountry?: string | null
): string | null {
  const region = normalizeCountryCode(fulfillmentCountry) ?? 'GA';
  const result = validatePhoneNumber(phone.trim(), region);
  if (!result.isValid || !result.countryCode || !result.nationalNumber) {
    return null;
  }
  return `+${result.countryCode}${result.nationalNumber}`;
}

/**
 * Builds the recipient columns. When the shopper is buying for themselves the
 * recipient columns stay null and `is_third_party_recipient` is false, which is
 * exactly how every pre-existing order reads.
 */
export function resolveOrderRecipient(params: {
  recipient?: OrderRecipientInput | null;
  sendingToSomeoneElse?: boolean;
  fulfillmentCountry?: string | null;
}): ResolvedOrderRecipient {
  const { recipient } = params;
  const wantsThirdParty =
    params.sendingToSomeoneElse === true ||
    Boolean(trimOrNull(recipient?.name) || trimOrNull(recipient?.phone));

  if (!wantsThirdParty) {
    return {
      recipient_name: null,
      recipient_phone: null,
      recipient_email: null,
      recipient_notify_whatsapp: false,
      is_third_party_recipient: false,
    };
  }

  const name = trimOrNull(recipient?.name);
  const rawPhone = trimOrNull(recipient?.phone);
  if (!name || !rawPhone) {
    throw new HttpException(
      {
        success: false,
        error: DIASPORA_ERROR_CODES.recipientContactRequired,
        message:
          'A recipient name and phone number are required when sending to someone else.',
      },
      HttpStatus.BAD_REQUEST
    );
  }

  const phone = normalizeRecipientPhone(rawPhone, params.fulfillmentCountry);
  if (!phone) {
    throw new HttpException(
      {
        success: false,
        error: DIASPORA_ERROR_CODES.recipientPhoneInvalid,
        message: `The recipient phone number is not a valid number for ${
          normalizeCountryCode(params.fulfillmentCountry) ?? 'the delivery country'
        }.`,
      },
      HttpStatus.BAD_REQUEST
    );
  }

  return {
    recipient_name: name,
    recipient_phone: phone,
    recipient_email: trimOrNull(recipient?.email),
    recipient_notify_whatsapp: recipient?.notify_whatsapp === true,
    is_third_party_recipient: true,
  };
}

/**
 * Billing country used for rail + pay-now gates.
 *
 * A traveller may *upgrade* into diaspora (profile local, card abroad). A
 * client-supplied country must never *downgrade* a diaspora profile to a
 * local rail — that would skip Stripe and re-enable pay-at-delivery.
 */
export function trustedPayerCountry(params: {
  profileCountry?: string | null;
  requestedCountry?: string | null;
  profileIsDiaspora: boolean;
  requestedIsDiaspora: boolean;
}): string | null {
  const profile = normalizeCountryCode(params.profileCountry);
  const requested = normalizeCountryCode(params.requestedCountry);
  if (params.profileIsDiaspora && !params.requestedIsDiaspora) {
    return profile;
  }
  return requested ?? profile;
}

/**
 * Snapshots who paid. Pass an already-trusted billing country as
 * `requestedPayerCountry` (see `trustedPayerCountry`).
 */
export function resolveOrderPayer(params: {
  user: PayerIdentity;
  requestedPayerCountry?: string | null;
}): ResolvedOrderPayer {
  const name =
    `${params.user.first_name ?? ''} ${params.user.last_name ?? ''}`.trim();
  return {
    payer_name: name || null,
    payer_phone: trimOrNull(params.user.phone_number),
    payer_email: trimOrNull(params.user.email),
    payer_country:
      normalizeCountryCode(params.requestedPayerCountry) ??
      normalizeCountryCode(params.user.country),
  };
}

/**
 * A payer abroad has no way to hand cash to an agent or pay at the counter, so
 * deferred timings are rejected before any order row is written.
 */
export function assertDiasporaPaymentTiming(params: {
  isDiaspora: boolean;
  paymentTiming: string;
}): void {
  if (!params.isDiaspora) return;
  if (params.paymentTiming === 'pay_now') return;
  throw new HttpException(
    {
      success: false,
      error: DIASPORA_ERROR_CODES.requiresPayNow,
      message:
        'Orders paid from abroad must be paid online at checkout. Pay at delivery and pay at pickup are not available.',
    },
    HttpStatus.BAD_REQUEST
  );
}
