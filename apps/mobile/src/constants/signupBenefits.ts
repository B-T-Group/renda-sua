import type { SignupStartPersona } from '../services/publicAuthApi';

export type SignupBenefitPersona = 'client' | 'agent' | 'business';

export function benefitPersonaFromSignupPersona(
  persona: SignupStartPersona
): SignupBenefitPersona {
  return persona;
}

export const SIGNUP_BENEFIT_BULLET_KEYS = ['b1', 'b2', 'b3'] as const;
