import type { CommissionRuleContext, CommissionRuleRow, ResolvedCommissionRate } from './rental-commission.types';

function inWindow(rule: CommissionRuleRow, at: Date): boolean {
  if (rule.status !== 'active') return false;
  if (Date.parse(rule.effective_from) > at.getTime()) return false;
  return rule.effective_to == null || Date.parse(rule.effective_to) > at.getTime();
}

function newest(rows: CommissionRuleRow[]): CommissionRuleRow | undefined {
  return [...rows].sort((a, b) => Date.parse(b.effective_from) - Date.parse(a.effective_from))[0];
}

function asRate(rule: CommissionRuleRow): ResolvedCommissionRate {
  return {
    rateBps: rule.rate_bps,
    source: rule.scope,
    ruleId: rule.id,
    campaignCode: rule.campaign_code,
    promoEndsAt: rule.scope === 'promo' ? rule.effective_to : null,
  };
}

function sameCountry(rule: CommissionRuleRow, country: string | null): boolean {
  return !!country && (rule.country_code ?? '').toUpperCase() === country.toUpperCase();
}

function baseRule(rows: CommissionRuleRow[], ctx: CommissionRuleContext): CommissionRuleRow | undefined {
  const category = rows.filter((r) => r.scope === 'category' && r.rental_category_id === ctx.categoryId);
  return (
    newest(category.filter((r) => sameCountry(r, ctx.country))) ??
    newest(category.filter((r) => !r.country_code)) ??
    newest(rows.filter((r) => r.scope === 'country' && sameCountry(r, ctx.country))) ??
    newest(rows.filter((r) => r.scope === 'default'))
  );
}

/**
 * Merchant rule is final. Otherwise the category, country or default rate applies, and a
 * promo applies only when it is lower. No default rule means no rate: the caller must fail closed.
 */
export function pickCommissionRate(
  allRows: CommissionRuleRow[],
  ctx: CommissionRuleContext,
  at: Date = new Date()
): ResolvedCommissionRate | null {
  const rows = allRows.filter((r) => inWindow(r, at));
  const merchant = newest(rows.filter((r) => r.scope === 'merchant' && r.business_id === ctx.businessId));
  if (merchant) return asRate(merchant);
  const base = baseRule(rows, ctx);
  if (!base) return null;
  const promo = newest(rows.filter((r) => r.scope === 'promo' && r.business_id === ctx.businessId));
  return promo && promo.rate_bps < base.rate_bps ? asRate(promo) : asRate(base);
}
