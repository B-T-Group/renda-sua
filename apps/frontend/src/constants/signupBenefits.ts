import type { SignupGoalId } from '../components/onboarding/SignupGoalIllustration';

export type SignupBenefitPersona = 'client' | 'agent' | 'business' | 'businessRent';

export function benefitPersonaFromGoalId(goalId: SignupGoalId): SignupBenefitPersona {
  if (goalId === 'browse_buy') return 'client';
  if (goalId === 'delivery_agent') return 'agent';
  if (goalId === 'rent_and_earn') return 'businessRent';
  return 'business';
}

export function benefitPersonaFromUserType(
  userType: 'client' | 'agent' | 'business',
  mainInterest?: 'sell_items' | 'rent_items'
): SignupBenefitPersona {
  if (userType === 'client') return 'client';
  if (userType === 'agent') return 'agent';
  return mainInterest === 'rent_items' ? 'businessRent' : 'business';
}

export const SIGNUP_BENEFIT_BULLET_KEYS = ['b1', 'b2', 'b3'] as const;
