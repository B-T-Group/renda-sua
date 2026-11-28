import { RentalCommissionRulesService } from './rental-commission-rules.service';
import {
  EARLY_ADOPTER_CAMPAIGN,
  EARLY_ADOPTER_ENROL_UNTIL_KEY,
  EARLY_ADOPTER_MONTHS_KEY,
  EARLY_ADOPTER_RATE_KEY,
  RENTALS_COMMISSION_FLAG,
  CommissionRuleRow,
} from './rental-commission.types';

const AT = new Date('2026-12-01T00:00:00.000Z');
const CTX = { businessId: 'biz-1', categoryId: 'cat-1', country: 'CM' };

interface ConfigRow {
  config_key: string;
  country_code?: string | null;
  boolean_value?: boolean | null;
  number_value?: number | string | null;
  date_value?: string | null;
}

function rule(partial: Partial<CommissionRuleRow> & Pick<CommissionRuleRow, 'id' | 'scope' | 'rate_bps'>): CommissionRuleRow {
  return {
    business_id: null,
    rental_category_id: null,
    country_code: null,
    campaign_code: null,
    effective_from: '2026-01-01T00:00:00.000Z',
    effective_to: null,
    status: 'active',
    ...partial,
  };
}

const defaultRule = rule({ id: 'd', scope: 'default', rate_bps: 1500 });

function harness(options: { configs?: ConfigRow[]; rules?: CommissionRuleRow[] } = {}) {
  const executeQuery = jest.fn(async (query: string) => {
    if (String(query).includes('application_configurations')) {
      return { application_configurations: options.configs ?? [] };
    }
    return { rental_commission_rules: options.rules ?? [] };
  });
  const executeMutation = jest.fn(async () => ({
    insert_rental_commission_rules_one: { id: 'saved-rule' },
    update_rental_commission_rules: { returning: [{ id: 'ended-rule' }] },
  }));
  const svc = new RentalCommissionRulesService({ executeQuery, executeMutation } as never);
  return { svc, executeQuery, executeMutation };
}

function flag(country: string | null, value: boolean | null): ConfigRow {
  return { config_key: RENTALS_COMMISSION_FLAG, country_code: country, boolean_value: value };
}

function adopter(partial: {
  rate?: number | string;
  months?: number | string;
  until?: string | null;
  country?: string | null;
} = {}): ConfigRow[] {
  const country = partial.country ?? null;
  return [
    { config_key: EARLY_ADOPTER_RATE_KEY, country_code: country, number_value: partial.rate ?? 1000 },
    { config_key: EARLY_ADOPTER_MONTHS_KEY, country_code: country, number_value: partial.months ?? 6 },
    {
      config_key: EARLY_ADOPTER_ENROL_UNTIL_KEY,
      country_code: country,
      date_value: partial.until === undefined ? '2027-01-01T00:00:00.000Z' : partial.until,
    },
  ];
}

describe('RentalCommissionRulesService.isEnabled', () => {
  const rows = [flag('CM', false), flag(null, true)];

  it('lets a country false beat a global true, and uses global only when that country has no row', async () => {
    const { svc, executeQuery } = harness({ configs: rows });
    expect(await svc.isEnabled('cm')).toBe(false);
    expect(await svc.isEnabled('GA')).toBe(true);
    expect(await svc.isEnabled(null)).toBe(true);
    expect(executeQuery.mock.calls[0][1]).toEqual({ keys: [RENTALS_COMMISSION_FLAG], country: 'CM' });
    expect(executeQuery.mock.calls[2][1]).toEqual({ keys: [RENTALS_COMMISSION_FLAG], country: '' });
  });

  it('stays off when the country row is null or the table is empty, and does not swallow a read failure', async () => {
    const { svc, executeQuery } = harness({ configs: [flag('CM', null), flag(null, true)] });
    expect(await svc.isEnabled('CM')).toBe(false);
    const empty = harness();
    expect(await empty.svc.isEnabled('CM')).toBe(false);
    executeQuery.mockRejectedValue(new Error('config down'));
    await expect(svc.isEnabled('CM')).rejects.toThrow('config down');
  });
});

describe('RentalCommissionRulesService.resolve', () => {
  it('fails closed when there is no base rule, even if an early-adopter config exists', async () => {
    const { svc } = harness({ configs: adopter(), rules: [] });
    await expect(svc.resolve(CTX, AT)).rejects.toMatchObject({ status: 503 });
  });

  it('does not turn a rules-query failure into the config rate', async () => {
    const { svc, executeQuery } = harness({ configs: adopter() });
    executeQuery.mockRejectedValue(new Error('rules down'));
    await expect(svc.resolve(CTX, AT)).rejects.toThrow('rules down');
  });

  it('applies a lower early-adopter rate from string config, and not at the enrol instant', async () => {
    const { svc } = harness({ configs: adopter({ rate: '1000', months: '6' }), rules: [defaultRule] });
    await expect(svc.resolve(CTX, AT)).resolves.toMatchObject({
      rateBps: 1000,
      source: 'promo',
      ruleId: 'pending:biz-1',
      campaignCode: EARLY_ADOPTER_CAMPAIGN,
      promoEndsAt: '2027-06-01T00:00:00.000Z',
    });
    await expect(svc.resolve(CTX, new Date('2027-01-01T00:00:00.000Z'))).resolves.toMatchObject({
      ruleId: 'd',
      rateBps: 1500,
    });
  });

  it('still enrols one millisecond before the deadline and ignores a higher config rate', async () => {
    const until = '2026-12-01T00:00:00.000Z';
    const inside = harness({ configs: adopter({ until }), rules: [defaultRule] });
    const before = new Date(AT.getTime() - 1);
    await expect(inside.svc.resolve(CTX, before)).resolves.toMatchObject({ rateBps: 1000, source: 'promo' });
    const higher = harness({ configs: adopter({ rate: 2000 }), rules: [defaultRule] });
    await expect(higher.svc.resolve(CTX, AT)).resolves.toMatchObject({ ruleId: 'd', rateBps: 1500 });
  });

  it('does not invent a second promo when this merchant already has the campaign', async () => {
    const saved = rule({
      id: 'saved-promo',
      scope: 'promo',
      business_id: 'biz-1',
      campaign_code: EARLY_ADOPTER_CAMPAIGN,
      rate_bps: 1200,
    });
    const { svc, executeQuery } = harness({ configs: adopter({ rate: 500 }), rules: [defaultRule, saved] });
    await expect(svc.resolve(CTX, AT)).resolves.toMatchObject({ ruleId: 'saved-promo', rateBps: 1200 });
    expect(executeQuery).toHaveBeenCalledTimes(1);
  });

  it('keeps a merchant rule ahead of the early-adopter promo', async () => {
    const merchant = rule({ id: 'm', scope: 'merchant', business_id: 'biz-1', rate_bps: 1800 });
    const { svc } = harness({ configs: adopter(), rules: [defaultRule, merchant] });
    await expect(svc.resolve(CTX, AT)).resolves.toMatchObject({ ruleId: 'm', rateBps: 1800 });
  });

  it('matches a lowercase context country to the country rule', async () => {
    const country = rule({ id: 'c', scope: 'country', country_code: 'CM', rate_bps: 1400 });
    const { svc } = harness({ rules: [defaultRule, country] });
    await expect(svc.resolve({ ...CTX, country: 'cm' }, AT)).resolves.toMatchObject({ ruleId: 'c', rateBps: 1400 });
  });

  it('drops an early-adopter config that is not a positive whole rate with an end date', async () => {
    const fractional = harness({ configs: adopter({ rate: 1000.5 }), rules: [defaultRule] });
    const zeroMonths = harness({ configs: adopter({ months: 0 }), rules: [defaultRule] });
    const noUntil = harness({ configs: adopter({ until: null }), rules: [defaultRule] });
    await expect(fractional.svc.resolve(CTX, AT)).resolves.toMatchObject({ ruleId: 'd' });
    await expect(zeroMonths.svc.resolve(CTX, AT)).resolves.toMatchObject({ ruleId: 'd' });
    await expect(noUntil.svc.resolve(CTX, AT)).resolves.toMatchObject({ ruleId: 'd' });
  });

  it('prefers the country early-adopter numbers over the global row', async () => {
    const { svc } = harness({
      configs: [...adopter({ rate: 1000 }), ...adopter({ rate: 800, months: 3, country: 'CM' })],
      rules: [defaultRule],
    });
    await expect(svc.resolve(CTX, AT)).resolves.toMatchObject({
      rateBps: 800,
      promoEndsAt: '2027-03-01T00:00:00.000Z',
    });
  });
});

describe('RentalCommissionRulesService.persistPendingPromo', () => {
  const pending = { rateBps: 1000, source: 'promo' as const, ruleId: 'pending:biz-1', campaignCode: EARLY_ADOPTER_CAMPAIGN };

  it('saves a six-month promo and returns the new id', async () => {
    const { svc, executeMutation } = harness({ configs: adopter() });
    await expect(svc.persistPendingPromo(CTX, pending, AT)).resolves.toBe('saved-rule');
    const object = executeMutation.mock.calls[0][1].object;
    expect(object).toMatchObject({
      scope: 'promo',
      business_id: 'biz-1',
      campaign_code: EARLY_ADOPTER_CAMPAIGN,
      rate_bps: 1000,
      effective_from: AT.toISOString(),
      effective_to: '2027-06-01T00:00:00.000Z',
      reason: 'Early-adopter promo',
      created_by: null,
    });
  });

  it('returns the existing id without writing when the rate is not a pending promo', async () => {
    const { svc, executeQuery, executeMutation } = harness({ configs: adopter() });
    await expect(svc.persistPendingPromo(CTX, { ...pending, source: 'default', ruleId: 'd' }, AT)).resolves.toBe('d');
    await expect(svc.persistPendingPromo(CTX, { ...pending, ruleId: 'rule-uuid' }, AT)).resolves.toBe('rule-uuid');
    expect(executeQuery).not.toHaveBeenCalled();
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('returns null and does not throw when the config disappeared or the insert fails', async () => {
    const gone = harness();
    await expect(gone.svc.persistPendingPromo(CTX, pending, AT)).resolves.toBeNull();
    expect(gone.executeMutation).not.toHaveBeenCalled();
    const failed = harness({ configs: adopter() });
    failed.executeMutation.mockRejectedValue(new Error('unique'));
    await expect(failed.svc.persistPendingPromo(CTX, pending, AT)).resolves.toBeNull();
  });
});

describe('RentalCommissionRulesService.createRule and endRule', () => {
  const country = {
    scope: 'country' as const,
    business_id: null,
    rental_category_id: null,
    country_code: 'CM',
    campaign_code: null,
    rate_bps: 1400,
    effective_from: '2026-12-01T00:00:00.000Z',
    effective_to: null as string | null,
  };

  it('ends only the open rule with the same key before inserting an open-ended replacement', async () => {
    const { svc, executeMutation } = harness();
    await svc.createRule(country, 'actor-1');
    const end = executeMutation.mock.calls[0][1];
    expect(end.where).toEqual({
      scope: { _eq: 'country' },
      status: { _eq: 'active' },
      effective_to: { _is_null: true },
      business_id: { _is_null: true },
      rental_category_id: { _is_null: true },
      country_code: { _eq: 'CM' },
      campaign_code: { _is_null: true },
    });
    expect(executeMutation.mock.calls[1][1].object).toMatchObject({
      scope: 'country',
      country_code: 'CM',
      rate_bps: 1400,
      created_by: 'actor-1',
      reason: 'Admin rule',
    });
  });

  it('ends only that merchant when replacing an open merchant promo', async () => {
    const { svc, executeMutation } = harness();
    await svc.createRule(
      { ...country, scope: 'merchant', business_id: 'biz-1', country_code: null, campaign_code: EARLY_ADOPTER_CAMPAIGN },
      'actor-1'
    );
    expect(executeMutation.mock.calls[0][1].where).toEqual({
      scope: { _eq: 'merchant' },
      status: { _eq: 'active' },
      effective_to: { _is_null: true },
      business_id: { _eq: 'biz-1' },
      rental_category_id: { _is_null: true },
      country_code: { _is_null: true },
      campaign_code: { _eq: EARLY_ADOPTER_CAMPAIGN },
    });
  });

  it('does not end other open rules when the new rule already has an end', async () => {
    const { svc, executeMutation } = harness();
    const dated = { ...country, scope: 'merchant' as const, business_id: 'biz-1', country_code: null, effective_to: '2027-01-01T00:00:00.000Z' };
    await svc.createRule(dated, 'actor-1');
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(String(executeMutation.mock.calls[0][0])).toContain('InsertRentalCommissionRule');
    expect(executeMutation.mock.calls[0][1].object.business_id).toBe('biz-1');
  });

  it('rejects a bad rate or a window that does not move forward before any write', async () => {
    const { svc, executeMutation } = harness();
    await expect(svc.createRule({ ...country, rate_bps: 1500.5 }, 'actor-1')).rejects.toThrow(/Invalid commission rate/);
    await expect(svc.createRule({ ...country, rate_bps: -1 }, 'actor-1')).rejects.toThrow(/Invalid commission rate/);
    await expect(svc.createRule({ ...country, rate_bps: 10001 }, 'actor-1')).rejects.toThrow(/Invalid commission rate/);
    const same = { ...country, effective_to: country.effective_from };
    await expect(svc.createRule(same, 'actor-1')).rejects.toMatchObject({ status: 400 });
    const backwards = { ...country, effective_to: '2026-11-01T00:00:00.000Z' };
    await expect(svc.createRule(backwards, 'actor-1')).rejects.toMatchObject({ status: 400 });
    expect(executeMutation).not.toHaveBeenCalled();
  });

  it('returns 404 when the rule is already ended', async () => {
    const { svc, executeMutation } = harness();
    executeMutation.mockResolvedValue({ update_rental_commission_rules: { returning: [] } });
    await expect(svc.endRule('rule-1')).rejects.toMatchObject({ status: 404 });
    expect(executeMutation.mock.calls[0][1].id).toBe('rule-1');
  });
});
