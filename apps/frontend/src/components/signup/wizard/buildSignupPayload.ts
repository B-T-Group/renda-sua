import type { SignupFormValues } from './types';
import { legacyUserTypeFromPersonas } from './types';

export interface SignupStartPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  personas: Array<'client' | 'agent' | 'business'>;
  user_type_id: 'client' | 'agent' | 'business';
  profile: {
    name?: string;
    main_interest?: 'sell_items' | 'rent_items';
    vehicle_type_id?: string;
  };
  country: string;
  store_location?: {
    street: string;
    city: string;
    region: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
  };
  referral_agent_code?: string;
}

/** Maps RHF values to API DTO; strips inactive sections. */
export function buildSignupPayload(
  values: SignupFormValues
): SignupStartPayload {
  const personas = [...new Set(values.personas)];
  const hasBusiness = personas.includes('business');
  const hasAgentOrBusiness =
    hasBusiness || personas.includes('agent');
  const trimmedReferral = values.business.referralAgentCode.trim();

  const payload: SignupStartPayload = {
    first_name: values.contact.firstName.trim(),
    last_name: values.contact.lastName.trim(),
    email: values.contact.email.trim(),
    phone_number: values.contact.phone.trim(),
    personas,
    user_type_id: legacyUserTypeFromPersonas(personas),
    profile: {
      name: hasBusiness ? values.business.name.trim() : undefined,
      main_interest: hasBusiness ? values.business.mainInterest : undefined,
      vehicle_type_id: personas.includes('agent') ? 'other' : undefined,
    },
    country: values.country.trim().toUpperCase(),
  };

  if (hasBusiness) {
    payload.store_location = {
      street: values.storeLocation.street.trim(),
      city: values.storeLocation.city.trim(),
      region: values.storeLocation.region.trim(),
      postal_code: values.storeLocation.postalCode.trim() || undefined,
      latitude: values.storeLocation.latitude,
      longitude: values.storeLocation.longitude,
    };
  }

  if (hasAgentOrBusiness && trimmedReferral) {
    payload.referral_agent_code = trimmedReferral.toUpperCase();
  }

  return payload;
}
