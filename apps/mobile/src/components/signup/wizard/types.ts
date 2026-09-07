import type { CountryCode } from 'libphonenumber-js';
import type { SignupMainInterest, SignupStartPersona } from '../../../services/publicAuthApi';
import type { DeliveryAddressFormValue } from '../../forms/DeliveryAddressForm';
import type { AgentFocus } from '../../../types/agentFocus';

export type WizardStepId =
  | 'contact'
  | 'personas'
  | 'agentFocus'
  | 'country'
  | 'storeLocation'
  | 'review';

export interface SignupContactState {
  firstName: string;
  lastName: string;
  email: string;
  phoneCountry: CountryCode;
  phoneNationalDigits: string;
}

export interface SignupBusinessState {
  name: string;
  mainInterest: SignupMainInterest;
  referralAgentCode: string;
}

export interface SignupWizardValues {
  contact: SignupContactState;
  personas: SignupStartPersona[];
  agentFocus: AgentFocus | '';
  business: SignupBusinessState;
  country: string;
  storeLocation: DeliveryAddressFormValue;
}

export interface StepContext {
  personas: SignupStartPersona[];
}

export interface WizardStepMeta {
  id: WizardStepId;
  labelKey: string;
  labelDefault: string;
  subtitleKey: string;
  subtitleDefault: string;
  isEnabled: (ctx: StepContext) => boolean;
}

export function emptyStoreLocation(country: string): DeliveryAddressFormValue {
  return {
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country,
  };
}

export function createDefaultSignupValues(
  defaultCountry: string
): SignupWizardValues {
  const iso = defaultCountry.toUpperCase();
  return {
    contact: {
      firstName: '',
      lastName: '',
      email: '',
      phoneCountry: iso as CountryCode,
      phoneNationalDigits: '',
    },
    personas: [],
    agentFocus: '',
    business: {
      name: '',
      mainInterest: 'sell_items',
      referralAgentCode: '',
    },
    country: iso,
    storeLocation: emptyStoreLocation(iso),
  };
}

/** Matches web: agent > business > client. */
export function legacyUserTypeFromPersonas(
  personas: SignupStartPersona[]
): SignupStartPersona {
  const order: SignupStartPersona[] = ['agent', 'business', 'client'];
  for (const p of order) {
    if (personas.includes(p)) return p;
  }
  return personas[0] ?? 'client';
}

export function isStoreLocationComplete(
  v: DeliveryAddressFormValue,
  postalCodeRequired: boolean
): boolean {
  const base = Boolean(
    v.address_line_1.trim() && v.country && v.state && v.city.trim()
  );
  if (!base) return false;
  if (postalCodeRequired && !v.postal_code.trim()) return false;
  return true;
}
