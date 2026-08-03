export type PersonaId = 'client' | 'agent' | 'business';
export type MainInterest = 'sell_items' | 'rent_items';

export type WizardStepId =
  | 'contact'
  | 'personas'
  | 'country'
  | 'storeLocation'
  | 'review';

export interface SignupContactValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface SignupBusinessValues {
  name: string;
  mainInterest: MainInterest;
  referralAgentCode: string;
}

export interface SignupStoreLocationValues {
  street: string;
  city: string;
  region: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
}

export interface SignupFormValues {
  contact: SignupContactValues;
  personas: PersonaId[];
  business: SignupBusinessValues;
  country: string;
  storeLocation: SignupStoreLocationValues;
}

export interface CountryOnboardingUi {
  code: string;
  name: string;
  currencyCode: string;
  signupEnabled: boolean;
  postalCodeRequired: boolean;
  verificationFlow: string;
  supportedPaymentMethods: string[];
}

export interface StepContext {
  personas: PersonaId[];
  country: string;
  countryConfig?: CountryOnboardingUi | null;
  flags?: Record<string, boolean>;
}

export const DEFAULT_SIGNUP_VALUES: SignupFormValues = {
  contact: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  },
  personas: ['client'],
  business: {
    name: '',
    mainInterest: 'sell_items',
    referralAgentCode: '',
  },
  country: '',
  storeLocation: {
    street: '',
    city: '',
    region: '',
    postalCode: '',
  },
};

export type SignupIntent =
  | 'client'
  | 'agent'
  | 'business_sell'
  | 'business_rent';

export function personasFromIntent(intent: SignupIntent | null): PersonaId[] {
  if (intent === 'agent') return ['agent'];
  if (intent === 'business_sell' || intent === 'business_rent') return ['business'];
  return ['client'];
}

export function mainInterestFromIntent(
  intent: SignupIntent | null
): MainInterest {
  if (intent === 'business_rent') return 'rent_items';
  return 'sell_items';
}

export function parseSignupIntent(raw: string | null): SignupIntent | null {
  if (
    raw === 'client' ||
    raw === 'agent' ||
    raw === 'business_sell' ||
    raw === 'business_rent'
  ) {
    return raw;
  }
  return null;
}

export function legacyUserTypeFromPersonas(personas: PersonaId[]): PersonaId {
  const order: PersonaId[] = ['agent', 'business', 'client'];
  for (const p of order) {
    if (personas.includes(p)) return p;
  }
  return personas[0] ?? 'client';
}
