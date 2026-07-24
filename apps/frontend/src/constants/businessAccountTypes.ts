/**
 * Business Account Type plan definitions.
 * Single UI source of truth for plan IDs, commission %, benefits, and display metadata.
 * Commission values mirror the backend helper — keep in sync with business-account-type.ts.
 */

export type BusinessAccountTypeId = 'STANDARD' | 'PREMIUM' | 'ELITE';

export interface BusinessAccountTypePlan {
  id: BusinessAccountTypeId;
  commissionPercent: number;
  stars: number;
  /** i18n key for the plan label */
  labelKey: string;
  defaultLabel: string;
  /** Color accent for UI */
  color: string;
  /** Icon glyph or emoji shorthand for star representation */
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
    color: '#64748b',
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
    color: '#7c3aed',
    benefitKeys: [
      'business.accountType.plans.standard.benefit1',
      'business.accountType.plans.standard.benefit2',
      'business.accountType.plans.standard.benefit3',
      'business.accountType.plans.standard.benefit4',
      'business.accountType.plans.standard.benefit5',
      'business.accountType.plans.premium.benefit1',
      'business.accountType.plans.premium.benefit2',
      'business.accountType.plans.premium.benefit3',
      'business.accountType.plans.premium.benefit4',
    ],
    defaultBenefits: [
      'Customer support',
      'Product & listing management',
      'Secure payments',
      'Seller dashboard',
      'Basic analytics',
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
    color: '#d97706',
    benefitKeys: [
      'business.accountType.plans.standard.benefit1',
      'business.accountType.plans.standard.benefit2',
      'business.accountType.plans.standard.benefit3',
      'business.accountType.plans.standard.benefit4',
      'business.accountType.plans.standard.benefit5',
      'business.accountType.plans.premium.benefit1',
      'business.accountType.plans.premium.benefit2',
      'business.accountType.plans.premium.benefit3',
      'business.accountType.plans.premium.benefit4',
      'business.accountType.plans.elite.benefit1',
      'business.accountType.plans.elite.benefit2',
      'business.accountType.plans.elite.benefit3',
      'business.accountType.plans.elite.benefit4',
    ],
    defaultBenefits: [
      'Customer support',
      'Product & listing management',
      'Secure payments',
      'Seller dashboard',
      'Basic analytics',
      'Better listing visibility',
      'Platform promotion',
      'Advanced analytics',
      'Priority support',
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
