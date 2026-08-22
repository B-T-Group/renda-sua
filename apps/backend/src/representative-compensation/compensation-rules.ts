export const ONBOARDING_10_FIRST_SALE = 'onboarding_10_first_sale';
export const ONBOARDING_25_SMALL_SALE = 'onboarding_25_small_sale';
export const ONBOARDING_25_LARGE_SALE = 'onboarding_25_large_sale';
export const SALE_PERCENT = 'sale_percent';
export const BUSINESS_REFERRAL_10_ITEMS = 'business_referral_10_items';

export const ONBOARDING_RULES = [
  ONBOARDING_10_FIRST_SALE,
  ONBOARDING_25_SMALL_SALE,
  ONBOARDING_25_LARGE_SALE,
] as const;

export type OnboardingRuleCode = (typeof ONBOARDING_RULES)[number];

/** Highest unpaid match wins when one order qualifies for more than one type. */
export const ONBOARDING_RULE_RANK: OnboardingRuleCode[] = [
  ONBOARDING_25_LARGE_SALE,
  ONBOARDING_25_SMALL_SALE,
  ONBOARDING_10_FIRST_SALE,
];

export type CompensationRuleCode =
  | OnboardingRuleCode
  | typeof SALE_PERCENT
  | typeof BUSINESS_REFERRAL_10_ITEMS;

export const ONBOARDING_10_ITEMS = 10;
export const ONBOARDING_25_ITEMS = 25;

export interface CompensationMarketConfig {
  currency: string;
  onboarding10FirstSale: number;
  onboarding25SmallSale: number;
  onboarding25LargeSale: number;
  smallSaleMaxExclusive: number;
  largeSaleMaxInclusive: number;
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

export function isSmallSale(
  amount: number,
  smallSaleMaxExclusive: number
): boolean {
  return amount < smallSaleMaxExclusive;
}

export function onboardingGross(
  rule: OnboardingRuleCode,
  config: CompensationMarketConfig
): number {
  if (rule === ONBOARDING_10_FIRST_SALE) return config.onboarding10FirstSale;
  if (rule === ONBOARDING_25_SMALL_SALE) return config.onboarding25SmallSale;
  return config.onboarding25LargeSale;
}

export function matchingOnboardingRulesForOrder(params: {
  approvedItemCount: number;
  orderSubtotal: number;
  config: CompensationMarketConfig;
}): OnboardingRuleCode[] {
  const rules: OnboardingRuleCode[] = [];
  if (params.approvedItemCount >= ONBOARDING_10_ITEMS) {
    rules.push(ONBOARDING_10_FIRST_SALE);
  }
  if (params.approvedItemCount >= ONBOARDING_25_ITEMS) {
    if (isSmallSale(params.orderSubtotal, params.config.smallSaleMaxExclusive)) {
      rules.push(ONBOARDING_25_SMALL_SALE);
    } else {
      rules.push(ONBOARDING_25_LARGE_SALE);
    }
  }
  return rules;
}

export function pickHighestUnpaidOnboardingRule(params: {
  approvedItemCount: number;
  orderSubtotal: number;
  paidOnboardingRules: OnboardingRuleCode[];
  config: CompensationMarketConfig;
}): OnboardingRuleCode | null {
  const paid = new Set(params.paidOnboardingRules);
  const matching = matchingOnboardingRulesForOrder(params);
  return (
    ONBOARDING_RULE_RANK.find(
      (rule) => matching.includes(rule) && !paid.has(rule)
    ) ?? null
  );
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
  triggeringOrderId?: string;
  /** Orders that already paid any commission; they never earn another. */
  paidOrderIds?: string[];
  config: CompensationMarketConfig;
}): CompensationAction[] {
  const actions: CompensationAction[] = [];

  if (
    params.hasBusinessReferrer &&
    !params.hasAgentReferrer &&
    params.approvedItemCount >= ONBOARDING_10_ITEMS &&
    !params.alreadyPaidBusinessReferral &&
    !params.triggeringOrderId
  ) {
    const amount = roundCompensationAmount(
      params.config.businessReferral10Items,
      params.payoutCurrency
    );
    if (amount > 0) {
      actions.push({
        ruleCode: BUSINESS_REFERRAL_10_ITEMS,
        amount,
        grossMilestoneAmount: null,
        orderId: null,
        saleAmount: null,
      });
    }
    return actions;
  }

  if (!params.hasAgentReferrer || !params.triggeringOrderId) {
    return actions;
  }
  if ((params.paidOrderIds ?? []).includes(params.triggeringOrderId)) {
    return actions;
  }

  const sale = params.completedSales.find(
    (row) =>
      row.id === params.triggeringOrderId &&
      row.currency === params.payoutCurrency &&
      row.subtotal > 0
  );
  if (!sale) return actions;

  const unpaidRule = pickHighestUnpaidOnboardingRule({
    approvedItemCount: params.approvedItemCount,
    orderSubtotal: sale.subtotal,
    paidOnboardingRules: params.paidOnboardingRules,
    config: params.config,
  });
  if (unpaidRule) {
    const gross = onboardingGross(unpaidRule, params.config);
    const amount = roundCompensationAmount(gross, params.payoutCurrency);
    if (amount > 0) {
      actions.push({
        ruleCode: unpaidRule,
        amount,
        grossMilestoneAmount: gross,
        orderId: params.triggeringOrderId,
        saleAmount: sale.subtotal,
      });
    }
    return actions;
  }

  const percentAmount = salePercentAmount(
    sale.subtotal,
    params.config.salePercent,
    params.payoutCurrency
  );
  if (percentAmount > 0) {
    actions.push({
      ruleCode: SALE_PERCENT,
      amount: percentAmount,
      grossMilestoneAmount: null,
      orderId: sale.id,
      saleAmount: sale.subtotal,
    });
  }
  return actions;
}
