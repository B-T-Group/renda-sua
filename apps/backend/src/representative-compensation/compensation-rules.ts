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

export function resolveHighestOnboardingRule(params: {
  approvedItemCount: number;
  completedSales: CompletedSale[];
  payoutCurrency: string;
  config: CompensationMarketConfig;
}): OnboardingRuleCode | null {
  const sales = params.completedSales.filter(
    (sale) => sale.currency === params.payoutCurrency && sale.subtotal > 0
  );
  if (sales.length === 0) return null;
  if (params.approvedItemCount >= ONBOARDING_25_ITEMS) {
    const hasLargeOrAbove = sales.some(
      (sale) => !isSmallSale(sale.subtotal, params.config.smallSaleMaxExclusive)
    );
    return hasLargeOrAbove
      ? ONBOARDING_25_LARGE_SALE
      : ONBOARDING_25_SMALL_SALE;
  }
  if (params.approvedItemCount >= ONBOARDING_10_ITEMS) {
    return ONBOARDING_10_FIRST_SALE;
  }
  return null;
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
  alreadyPaidOnboarding: number;
  hasAgentReferrer: boolean;
  hasBusinessReferrer: boolean;
  alreadyPaidBusinessReferral: boolean;
  triggeringOrderId?: string;
  /** Orders that already unlocked an onboarding milestone; they never also earn 1%. */
  onboardingTriggerOrderIds?: string[];
  config: CompensationMarketConfig;
}): CompensationAction[] {
  const actions: CompensationAction[] = [];
  const matchingSales = params.completedSales.filter(
    (sale) => sale.currency === params.payoutCurrency && sale.subtotal > 0
  );

  if (params.hasAgentReferrer) {
    const rule = resolveHighestOnboardingRule(params);
    if (rule) {
      const gross = onboardingGross(rule, params.config);
      const delta = roundCompensationAmount(
        Math.max(0, gross - params.alreadyPaidOnboarding),
        params.payoutCurrency
      );
      if (delta > 0) {
        const qualifying = matchingSales.reduce((best, sale) =>
          sale.subtotal > best.subtotal ? sale : best
        );
        actions.push({
          ruleCode: rule,
          amount: delta,
          grossMilestoneAmount: gross,
          orderId: params.triggeringOrderId ?? null,
          saleAmount: qualifying.subtotal,
        });
      }
    }
  }

  if (
    params.hasBusinessReferrer &&
    !params.hasAgentReferrer &&
    params.approvedItemCount >= ONBOARDING_10_ITEMS &&
    !params.alreadyPaidBusinessReferral
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
  }

  const onboardingThisRun = actions.some((action) =>
    ONBOARDING_RULES.includes(action.ruleCode as OnboardingRuleCode)
  );
  const onboardingOrderIds = new Set(params.onboardingTriggerOrderIds ?? []);
  if (
    params.hasAgentReferrer &&
    params.triggeringOrderId &&
    !onboardingThisRun &&
    !onboardingOrderIds.has(params.triggeringOrderId)
  ) {
    const sale = matchingSales.find(
      (row) => row.id === params.triggeringOrderId
    );
    if (sale) {
      const amount = salePercentAmount(
        sale.subtotal,
        params.config.salePercent,
        params.payoutCurrency
      );
      if (amount > 0) {
        actions.push({
          ruleCode: SALE_PERCENT,
          amount,
          grossMilestoneAmount: null,
          orderId: sale.id,
          saleAmount: sale.subtotal,
        });
      }
    }
  }

  return actions;
}
