import type {
  CreateBusinessLocationPayload,
  UpdateBusinessLocationPayload,
} from '../types/business/locations';

interface AddressFields {
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
}

function addressPayload(form: AddressFields): NonNullable<CreateBusinessLocationPayload['address']> {
  return {
    address_line_1: form.address_line_1.trim(),
    address_line_2: form.address_line_2?.trim(),
    city: form.city.trim(),
    state: form.state,
    postal_code: form.postal_code?.trim(),
    latitude: form.latitude,
    longitude: form.longitude,
  };
}

/**
 * Stripe Connect payouts run only when auto_withdraw_commissions is true.
 * Creating a Stripe location must leave the column at its default (true).
 * Mobile-money locations opt in explicitly.
 */
export function createLocationPayload(input: {
  name: string;
  isStripeRail: boolean;
  phone: string;
  mobilePaymentPhoneId: string | null;
  addressForm: AddressFields;
}): CreateBusinessLocationPayload {
  const phone = input.phone.trim() || undefined;
  const payout = input.isStripeRail
    ? { phone }
    : {
        mobile_payment_phone_id: input.mobilePaymentPhoneId,
        auto_withdraw_commissions: true as const,
      };
  return {
    name: input.name.trim(),
    location_type: 'store',
    ...payout,
    address: addressPayload(input.addressForm),
  };
}

/** Name, logo, and email saves must not turn Stripe auto-payout off. */
export function basicsLocationPatch(input: {
  name: string;
  email: string;
  logoUrl: string;
  isStripeRail: boolean;
  phone: string;
}): UpdateBusinessLocationPayload {
  return {
    name: input.name.trim(),
    email: input.email.trim() || undefined,
    logo_url: input.logoUrl.trim() ? input.logoUrl.trim() : null,
    ...(input.isStripeRail ? { phone: input.phone.trim() || undefined } : {}),
  };
}
