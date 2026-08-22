export const ONBOARDING_10_FIRST_SALE = 'onboarding_10_first_sale';
export const ONBOARDING_25_SMALL_SALE = 'onboarding_25_small_sale';
export const ONBOARDING_25_LARGE_SALE = 'onboarding_25_large_sale';
export const SALE_PERCENT = 'sale_percent';
export const BUSINESS_REFERRAL_10_ITEMS = 'business_referral_10_items';

export const ONBOARDING_RULES = [ONBOARDING_10_FIRST_SALE] as const;

export type OnboardingRuleCode = (typeof ONBOARDING_RULES)[number];

export type CompensationRuleCode =
  | OnboardingRuleCode
  | typeof ONBOARDING_25_SMALL_SALE
  | typeof ONBOARDING_25_LARGE_SALE
  | typeof SALE_PERCENT
  | typeof BUSINESS_REFERRAL_10_ITEMS;

export const ONBOARDING_10_ITEMS = 10;
export const ONBOARDING_WINDOW_DAYS = 30;

export interface CompensationMarketConfig {
  currency: string;
  onboarding10FirstSale: number;
  salePercent: number;
  businessReferral10Items: number;
}

export interface CompletedSale {
  id: string;
  subtotal: number;
  currency: string;
  completedAt?: string;
}

export interface CompensationAction {
  ruleCode: CompensationRuleCode;
  amount: number;
  grossMilestoneAmount: number | null;
  orderId: string | null;
  saleAmount: number | null;
}

export function roundCompensationAmount(
  amount: number,
  currency: string
): number {
  if (currency === 'CAD' || currency === 'USD') {
    return Math.round(amount * 100) / 100;
  }
  return Math.round(amount);
}

export function saleWithinOnboardingWindow(
  onboardedAt: string | undefined,
  completedAt: string | undefined
): boolean {
  if (!onboardedAt || !completedAt) return false;
  const start = Date.parse(onboardedAt);
  const completed = Date.parse(completedAt);
  if (Number.isNaN(start) || Number.isNaN(completed)) return false;
  const max = start + ONBOARDING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return completed >= start && completed <= max;
}

export function salePercentAmount(
  subtotal: number,
  percent: number,
  currency: string
): number {
  if (subtotal <= 0 || percent <= 0) return 0;
  return roundCompensationAmount((subtotal * percent) / 100, currency);
}

export function evaluateCompensation(params: {
  approvedItemCount: number;
  completedSales: CompletedSale[];
  payoutCurrency: string;
  paidOnboardingRules: OnboardingRuleCode[];
  hasAgentReferrer: boolean;
  hasBusinessReferrer: boolean;
  alreadyPaidBusinessReferral: boolean;
  businessOnboardedAt?: string;
  triggeringOrderId?: string;
  paidSalePercentOrderIds?: string[];
  config: CompensationMarketConfig;
}): CompensationAction[] {
  const b2b = businessReferralAction(params);
  if (b2b) return [b2b];
  if (!params.hasAgentReferrer || !params.triggeringOrderId) return [];
  const sale = params.completedSales.find(
    (row) =>
      row.id === params.triggeringOrderId &&
      row.currency === params.payoutCurrency &&
      row.subtotal > 0
  );
  if (!sale) return [];
  return [
    ...optionalAction(onboardingBonusAction(params, sale)),
    ...optionalAction(salePercentAction(params, sale)),
  ];
}

function optionalAction(
  action: CompensationAction | null
): CompensationAction[] {
  return action ? [action] : [];
}

function businessReferralAction(
  params: Parameters<typeof evaluateCompensation>[0]
): CompensationAction | null {
  if (
    !params.hasBusinessReferrer ||
    params.hasAgentReferrer ||
    params.approvedItemCount < ONBOARDING_10_ITEMS ||
    params.alreadyPaidBusinessReferral ||
    params.triggeringOrderId
  ) {
    return null;
  }
  const amount = roundCompensationAmount(
    params.config.businessReferral10Items,
    params.payoutCurrency
  );
  if (amount <= 0) return null;
  return {
    ruleCode: BUSINESS_REFERRAL_10_ITEMS,
    amount,
    grossMilestoneAmount: null,
    orderId: null,
    saleAmount: null,
  };
}

function onboardingBonusAction(
  params: Parameters<typeof evaluateCompensation>[0],
  sale: CompletedSale
): CompensationAction | null {
  if (params.paidOnboardingRules.includes(ONBOARDING_10_FIRST_SALE)) {
    return null;
  }
  if (params.approvedItemCount < ONBOARDING_10_ITEMS) return null;
  if (!saleWithinOnboardingWindow(params.businessOnboardedAt, sale.completedAt)) {
    return null;
  }
  const amount = roundCompensationAmount(
    params.config.onboarding10FirstSale,
    params.payoutCurrency
  );
  if (amount <= 0) return null;
  return {
    ruleCode: ONBOARDING_10_FIRST_SALE,
    amount,
    grossMilestoneAmount: amount,
    orderId: sale.id,
    saleAmount: sale.subtotal,
  };
}

function salePercentAction(
  params: Parameters<typeof evaluateCompensation>[0],
  sale: CompletedSale
): CompensationAction | null {
  if ((params.paidSalePercentOrderIds ?? []).includes(sale.id)) return null;
  const amount = salePercentAmount(
    sale.subtotal,
    params.config.salePercent,
    params.payoutCurrency
  );
  if (amount <= 0) return null;
  return {
    ruleCode: SALE_PERCENT,
    amount,
    grossMilestoneAmount: null,
    orderId: sale.id,
    saleAmount: sale.subtotal,
  };
}
