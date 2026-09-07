import type { SignupStartPayload } from '../../../services/publicAuthApi';
import {
  legacyUserTypeFromPersonas,
  type SignupWizardValues,
} from './types';

export interface BuildSignupPayloadInput {
  values: SignupWizardValues;
  phoneE164: string | null;
}

/** Maps wizard values to Nest signup/start DTO (country + store_location). */
export function buildSignupPayload({
  values,
  phoneE164,
}: BuildSignupPayloadInput): SignupStartPayload {
  const personas = [...new Set(values.personas)];
  const hasBusiness = personas.includes('business');
  const hasAgentOrBusiness =
    hasBusiness || personas.includes('agent');
  const trimmedReferral = values.business.referralAgentCode.trim();
  const trimmedEmail = values.contact.email.trim().toLowerCase();

  const payload: SignupStartPayload = {
    first_name: values.contact.firstName.trim(),
    last_name: values.contact.lastName.trim(),
    email: trimmedEmail || null,
    phone_number: phoneE164,
    personas,
    user_type_id: legacyUserTypeFromPersonas(personas),
    profile: {
      name: hasBusiness ? values.business.name.trim() : undefined,
      main_interest: hasBusiness ? values.business.mainInterest : undefined,
      vehicle_type_id: personas.includes('agent') ? 'other' : undefined,
      agent_focus: personas.includes('agent')
        ? values.agentFocus || 'both'
        : undefined,
    },
    country: values.country.trim().toUpperCase(),
  };

  if (hasBusiness) {
    const loc = values.storeLocation;
    payload.store_location = {
      street: loc.address_line_1.trim(),
      city: loc.city.trim(),
      region: loc.state,
      postal_code: loc.postal_code.trim() || undefined,
      ...(loc.latitude != null ? { latitude: loc.latitude } : {}),
      ...(loc.longitude != null ? { longitude: loc.longitude } : {}),
    };
  }

  if (hasAgentOrBusiness && trimmedReferral) {
    payload.referral_agent_code = trimmedReferral.toUpperCase();
  }

  return payload;
}
