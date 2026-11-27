import { pickCommissionRate } from './rental-commission-rule-picker';
import { CommissionRuleRow } from './rental-commission.types';

const NOW = new Date('2026-12-01T00:00:00Z');
const ctx = { businessId: 'biz-1', categoryId: 'cat-1', country: 'CM' };

function rule(partial: Partial<CommissionRuleRow> & Pick<CommissionRuleRow, 'id' | 'scope' | 'rate_bps'>): CommissionRuleRow {
  return {
    business_id: null,
    rental_category_id: null,
    country_code: null,
    campaign_code: null,
    effective_from: '2026-01-01T00:00:00Z',
    effective_to: null,
    status: 'active',
    ...partial,
  };
}

const defaultRule = rule({ id: 'd', scope: 'default', rate_bps: 1500 });

describe('pickCommissionRate', () => {
  it('uses the default rule when nothing more specific exists', () => {
    expect(pickCommissionRate([defaultRule], ctx, NOW)).toMatchObject({ rateBps: 1500, source: 'default', ruleId: 'd' });
  });

  it('returns null without a default so the caller fails closed', () => {
    expect(pickCommissionRate([], ctx, NOW)).toBeNull();
  });

  it('prefers category in the country, then category, then country, then default', () => {
    const rows = [
      defaultRule,
      rule({ id: 'c', scope: 'country', country_code: 'CM', rate_bps: 1400 }),
      rule({ id: 'k', scope: 'category', rental_category_id: 'cat-1', rate_bps: 1300 }),
      rule({ id: 'kc', scope: 'category', rental_category_id: 'cat-1', country_code: 'CM', rate_bps: 1200 }),
    ];
    expect(pickCommissionRate(rows, ctx, NOW)?.ruleId).toBe('kc');
    expect(pickCommissionRate(rows.slice(0, 3), ctx, NOW)?.ruleId).toBe('k');
    expect(pickCommissionRate(rows.slice(0, 2), ctx, NOW)?.ruleId).toBe('c');
    expect(pickCommissionRate(rows, { ...ctx, categoryId: 'other', country: 'GA' }, NOW)?.ruleId).toBe('d');
  });

  it('applies a promo only when it is lower than the base rate', () => {
    const promo = rule({ id: 'p', scope: 'promo', business_id: 'biz-1', campaign_code: 'x', rate_bps: 1000 });
    expect(pickCommissionRate([defaultRule, promo], ctx, NOW)).toMatchObject({ rateBps: 1000, source: 'promo' });
    const higher = rule({ id: 'p2', scope: 'promo', business_id: 'biz-1', campaign_code: 'x', rate_bps: 2000 });
    expect(pickCommissionRate([defaultRule, higher], ctx, NOW)?.ruleId).toBe('d');
  });

  it('lets a merchant rule win even when it is higher than a promo', () => {
    const rows = [
      defaultRule,
      rule({ id: 'p', scope: 'promo', business_id: 'biz-1', campaign_code: 'x', rate_bps: 1000 }),
      rule({ id: 'm', scope: 'merchant', business_id: 'biz-1', rate_bps: 1800 }),
    ];
    expect(pickCommissionRate(rows, ctx, NOW)).toMatchObject({ ruleId: 'm', rateBps: 1800 });
  });

  it('ignores other merchants, ended rules, and rules outside their window', () => {
    const rows = [
      defaultRule,
      rule({ id: 'o', scope: 'merchant', business_id: 'biz-2', rate_bps: 500 }),
      rule({ id: 'e', scope: 'merchant', business_id: 'biz-1', rate_bps: 500, status: 'ended' }),
      rule({ id: 'f', scope: 'promo', business_id: 'biz-1', campaign_code: 'x', rate_bps: 500, effective_from: '2027-01-01T00:00:00Z' }),
      rule({ id: 'x', scope: 'promo', business_id: 'biz-1', campaign_code: 'y', rate_bps: 500, effective_to: '2026-11-30T23:59:59Z' }),
    ];
    expect(pickCommissionRate(rows, ctx, NOW)?.ruleId).toBe('d');
  });

  it('treats the end of a window as exclusive', () => {
    const promo = rule({ id: 'p', scope: 'promo', business_id: 'biz-1', campaign_code: 'x', rate_bps: 1000, effective_to: NOW.toISOString() });
    expect(pickCommissionRate([defaultRule, promo], ctx, NOW)?.ruleId).toBe('d');
  });
});
