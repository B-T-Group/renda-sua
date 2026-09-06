export type BusinessAccountTypeId = 'STANDARD' | 'PREMIUM' | 'ELITE';

export interface BusinessAccountTypePlan {
  id: BusinessAccountTypeId;
  commissionPercent: number;
  stars: number;
  labelKey: string;
  defaultLabel: string;
  taglineKey: string;
  defaultTagline: string;
  /** Solid accent for borders, CTAs, and highlights */
  color: string;
  /** Soft wash for card headers / backgrounds */
  softColor: string;
  /**
   * When set, UI shows “Everything in {label}, plus:” before this tier’s own benefits.
   */
  includesFromId?: BusinessAccountTypeId;
  benefitKeys: string[];
  defaultBenefits: string[];
}

export const BUSINESS_ACCOUNT_TYPE_PLANS: BusinessAccountTypePlan[] = [
  {
    id: 'STANDARD',
    commissionPercent: 12,
    stars: 1,
    labelKey: 'business.accountType.plans.standard.label',
    defaultLabel: 'Standard',
    taglineKey: 'business.accountType.plans.standard.tagline',
    defaultTagline: 'Best for getting started',
    color: '#475569',
    softColor: '#f1f5f9',
    benefitKeys: [
      'business.accountType.plans.standard.benefit1',
      'business.accountType.plans.standard.benefit2',
      'business.accountType.plans.standard.benefit3',
      'business.accountType.plans.standard.benefit4',
      'business.accountType.plans.standard.benefit5',
    ],
    defaultBenefits: [
      'Customer support',
      'Product & listing management',
      'Secure payments',
      'Seller dashboard',
      'Basic analytics',
    ],
  },
  {
    id: 'PREMIUM',
    commissionPercent: 15,
    stars: 2,
    labelKey: 'business.accountType.plans.premium.label',
    defaultLabel: 'Premium',
    taglineKey: 'business.accountType.plans.premium.tagline',
    defaultTagline: 'Grow your reach',
    color: '#1d4ed8',
    softColor: '#eff6ff',
    includesFromId: 'STANDARD',
    benefitKeys: [
      'business.accountType.plans.premium.benefit1',
      'business.accountType.plans.premium.benefit2',
      'business.accountType.plans.premium.benefit3',
      'business.accountType.plans.premium.benefit4',
    ],
    defaultBenefits: [
      'Better listing visibility',
      'Platform promotion',
      'Advanced analytics',
      'Priority support',
    ],
  },
  {
    id: 'ELITE',
    commissionPercent: 20,
    stars: 3,
    labelKey: 'business.accountType.plans.elite.label',
    defaultLabel: 'Elite',
    taglineKey: 'business.accountType.plans.elite.tagline',
    defaultTagline: 'Maximum visibility',
    color: '#b45309',
    softColor: '#fffbeb',
    includesFromId: 'PREMIUM',
    benefitKeys: [
      'business.accountType.plans.elite.benefit1',
      'business.accountType.plans.elite.benefit2',
      'business.accountType.plans.elite.benefit3',
      'business.accountType.plans.elite.benefit4',
    ],
    defaultBenefits: [
      'Homepage placement',
      'Dedicated marketing campaigns',
      'Personalized account management',
      'Dedicated account manager',
    ],
  },
];

export function getPlanById(id?: string | null): BusinessAccountTypePlan {
  return (
    BUSINESS_ACCOUNT_TYPE_PLANS.find((p) => p.id === id) ??
    BUSINESS_ACCOUNT_TYPE_PLANS[0]
  );
}

/** Merge backend country-specific rates onto local plan metadata (labels/benefits). */
export function mergePlansWithCommissionRates(
  rates?: Array<{ id: string; commissionPercent: number }> | null
): BusinessAccountTypePlan[] {
  if (!rates?.length) return BUSINESS_ACCOUNT_TYPE_PLANS;
  const rateMap = new Map(
    rates.map((r) => [r.id as BusinessAccountTypeId, r.commissionPercent])
  );
  return BUSINESS_ACCOUNT_TYPE_PLANS.map((plan) => ({
    ...plan,
    commissionPercent: rateMap.get(plan.id) ?? plan.commissionPercent,
  }));
}
