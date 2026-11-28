import { HttpException } from '@nestjs/common';
import { RentalCommissionService } from './rental-commission.service';
import { CommissionQuote } from './rental-commission.types';

function service(overrides: { enabled?: boolean; rate?: any } = {}) {
  const hasura = { executeMutation: jest.fn().mockResolvedValue({}), executeQuery: jest.fn() };
  const rules = {
    isEnabled: jest.fn().mockResolvedValue(overrides.enabled ?? true),
    resolve: jest.fn().mockResolvedValue(
      overrides.rate ?? { rateBps: 1500, source: 'default', ruleId: 'rule-1', campaignCode: null }
    ),
    persistPendingPromo: jest.fn(async (_c: any, rate: any) => rate.ruleId),
  };
  const svc = new RentalCommissionService(hasura as any, {} as any, {} as any, rules as any);
  return { svc, hasura, rules };
}

const input = { businessId: 'biz', categoryId: 'cat', country: 'CM', currency: 'XAF', total: 10000 };

describe('RentalCommissionService quote and freeze', () => {
  it('quotes 15% on the total with the flag on', async () => {
    const { svc } = service();
    const quote = await svc.quote(input);
    expect(quote).toMatchObject({ commissionAmount: 1500, merchantPayoutAmount: 8500, baseAmount: 10000 });
  });

  it('returns no quote when the flag is off for the market', async () => {
    const { svc, rules } = service({ enabled: false });
    expect(await svc.quote(input)).toBeNull();
    expect(rules.resolve).not.toHaveBeenCalled();
  });

  it('propagates a missing default rate instead of guessing', async () => {
    const { svc, rules } = service();
    rules.resolve.mockRejectedValue(new HttpException('Commission rate is not configured', 503));
    await expect(svc.quote(input)).rejects.toMatchObject({ status: 503 });
  });

  it('freezes the full snapshot on the booking', async () => {
    const { svc, hasura } = service();
    const quote = (await svc.quote(input)) as CommissionQuote;
    await svc.freeze('b1', quote, new Date('2026-12-01T10:00:00Z'));
    const { set } = hasura.executeMutation.mock.calls[0][1];
    expect(set).toMatchObject({
      commission_status: 'quoted',
      commission_rate_bps: 1500,
      commission_basis: 'rental_subtotal',
      commission_base_amount: 10000,
      commission_amount: 1500,
      merchant_payout_amount: 8500,
      commission_rounding: 'half_up_minor_unit',
      commission_rule_id: 'rule-1',
      commission_source: 'default',
      commission_calc_version: 1,
    });
  });

  it('freezes nothing when there is no quote', async () => {
    const { svc, hasura } = service();
    await svc.freeze('b1', null);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });
});

describe('RentalCommissionService acknowledgement', () => {
  it('passes when the merchant saw the current rate, or an older client sends none', async () => {
    const { svc } = service();
    const quote = (await svc.quote(input)) as CommissionQuote;
    expect(() => svc.assertAcknowledged(quote, 1500)).not.toThrow();
    expect(() => svc.assertAcknowledged(quote, undefined)).not.toThrow();
    expect(() => svc.assertAcknowledged(null, 900)).not.toThrow();
  });

  it('answers 409 COMMISSION_RATE_CHANGED with the current numbers when the rate moved', async () => {
    const { svc } = service();
    const quote = (await svc.quote(input)) as CommissionQuote;
    try {
      svc.assertAcknowledged(quote, 1000);
      fail('expected a 409');
    } catch (error) {
      const http = error as HttpException;
      expect(http.getStatus()).toBe(409);
      expect(http.getResponse()).toMatchObject({ code: 'COMMISSION_RATE_CHANGED', currentRateBps: 1500, commissionAmount: 1500 });
    }
  });
});

describe('RentalCommissionService merchant view', () => {
  it('hides commission for legacy bookings and shows numbers for quoted ones', () => {
    const { svc } = service();
    expect(svc.merchantEarnings({ id: 'b', currency: 'XAF', commission_status: 'not_applicable' })).toBeNull();
    expect(
      svc.merchantEarnings({
        id: 'b',
        currency: 'XAF',
        commission_status: 'quoted',
        commission_rate_bps: 1500,
        commission_base_amount: '10000.00',
        commission_amount: '1500.00',
        merchant_payout_amount: '8500.00',
      })
    ).toMatchObject({ status: 'quoted', rate_bps: 1500, commission_amount: 1500, merchant_payout_amount: 8500 });
  });

  it('sums totals per currency in minor units', () => {
    const { svc } = service();
    const totals = svc.totalsByCurrency([
      { currency: 'CAD', commission_status: 'earned', commission_base_amount: '0.10', commission_amount: '0.02', merchant_payout_amount: '0.08' },
      { currency: 'CAD', commission_status: 'earned', commission_base_amount: '0.20', commission_amount: '0.03', merchant_payout_amount: '0.17' },
      { currency: 'XAF', commission_status: 'earned', commission_base_amount: '1000', commission_amount: '150', merchant_payout_amount: '850' },
    ]);
    expect(totals).toEqual([
      { currency: 'CAD', count: 2, base_amount: 0.3, commission_amount: 0.05, merchant_payout_amount: 0.25 },
      { currency: 'XAF', count: 1, base_amount: 1000, commission_amount: 150, merchant_payout_amount: 850 },
    ]);
  });

  it('hides a missing booking and a null status', () => {
    const { svc } = service();
    expect(svc.merchantEarnings(null)).toBeNull();
    expect(svc.merchantEarnings(undefined)).toBeNull();
    expect(svc.merchantEarnings({ id: 'b', currency: 'XAF', commission_status: null })).toBeNull();
  });
});

describe('RentalCommissionService commission amount', () => {
  const quoted = {
    id: 'b',
    currency: 'XAF',
    total_amount: 10000 as number | string,
    commission_status: 'quoted',
    commission_rate_bps: 1500 as number | null,
  };

  it('withholds nothing unless the booking is still quoted with a rate', () => {
    const { svc } = service();
    expect(svc.commissionFor({ ...quoted, commission_status: 'earned' }, 10000)).toBe(0);
    expect(svc.commissionFor({ ...quoted, commission_status: 'waived' }, 10000)).toBe(0);
    expect(svc.commissionFor({ ...quoted, commission_status: 'not_applicable' }, 10000)).toBe(0);
    expect(svc.commissionFor({ ...quoted, commission_rate_bps: null }, 10000)).toBe(0);
    expect(svc.commissionFor({ ...quoted, total_amount: '3330' }, 10000)).toBe(500);
    expect(svc.commissionFor(quoted, 0)).toBe(0);
    expect(svc.commissionFor(quoted, -5)).toBe(-5);
  });

  it('subtracts the commission in minor units, including a payout that would go negative', () => {
    const { svc } = service();
    expect(svc.netOfCommission(10.1, 1.51, 'CAD')).toBe(8.59);
    expect(svc.netOfCommission(10000, 1500, 'XAF')).toBe(8500);
    expect(svc.netOfCommission(1, 1.5, 'CAD')).toBe(-0.5);
  });

  it('reads the quote country from a code or a known name', () => {
    const { svc } = service();
    const req = (country: string | null) => ({
      rental_location_listing: {
        business_location: { address: { country } },
        rental_item: { business_id: 'biz', rental_category_id: null },
      },
    });
    expect(svc.quoteInputFromRequest(req(' cm '), 10, 'XAF')).toMatchObject({ country: 'CM', businessId: 'biz', categoryId: null });
    expect(svc.quoteInputFromRequest(req('Cameroun'), 10, 'XAF').country).toBe('CM');
    expect(svc.quoteInputFromRequest(req('Congo'), 10, 'XAF').country).toBe('CG');
    expect(svc.quoteInputFromRequest(req('DRC'), 10, 'XAF').country).toBe('CD');
    expect(svc.quoteInputFromRequest(req(''), 10, 'XAF').country).toBeNull();
    expect(svc.quoteInputFromRequest(req('Narnia'), 10, 'XAF').country).toBeNull();
    expect(svc.quoteInputFromRequest({}, 10, 'XAF')).toMatchObject({ businessId: undefined, categoryId: null, country: null });
  });
});

describe('RentalCommissionService settle', () => {
  function settleService() {
    const hasura = {
      getRendasuaHQUser: jest.fn().mockResolvedValue({ id: 'hq' }),
      getAccount: jest.fn().mockResolvedValue({ id: 'hq-acc' }),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    const accounts = {
      registerTransaction: jest.fn().mockResolvedValue({ success: true, transactionId: 'tx-1' }),
    };
    const svc = new RentalCommissionService(hasura as any, {} as any, accounts as any, {} as any);
    return { svc, hasura, accounts };
  }

  const booking = {
    id: 'b1',
    currency: 'XAF',
    commission_rate_bps: 1500,
    business: { user_id: 'biz-user' },
  };

  it('does not pay HQ or write a payout when the commission is zero or negative', async () => {
    const { svc, hasura, accounts } = settleService();
    await svc.settle(booking, 0, 10000, 'contract');
    await svc.settle(booking, -1, 10000, 'contract');
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
    expect(hasura.getRendasuaHQUser).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('writes no payout when HQ is missing', async () => {
    const { svc, hasura, accounts } = settleService();
    hasura.getRendasuaHQUser.mockResolvedValue(null);
    await expect(svc.settle(booking, 1500, 8500, 'contract')).rejects.toMatchObject({ status: 502 });
    expect(accounts.registerTransaction).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('stores the rate as a percent and still marks earned when the merchant user is missing', async () => {
    const { svc, hasura } = settleService();
    await svc.settle({ ...booking, business: {} }, 1500, 8500, 'contract');
    const objects = hasura.executeMutation.mock.calls.map((call) => call[1].object).filter(Boolean);
    expect(objects).toEqual([
      expect.objectContaining({
        recipient_type: 'rendasua',
        commission_type: 'rental_commission',
        amount: 1500,
        commission_percentage: 15,
        commission_rate_bps: 1500,
      }),
    ]);
    const status = hasura.executeMutation.mock.calls.map((call) => call[1].set).find(Boolean);
    expect(status).toMatchObject({ commission_status: 'earned', commission_earned_amount: 1500 });
  });
});

describe('RentalCommissionService preview and report', () => {
  const request = {
    quoted_total: 10000,
    rental_pricing_snapshot: { total: 8000, currency: 'XAF' },
    rental_location_listing: {
      business_location: { address: { country: 'cm' } },
      rental_item: { business_id: 'biz-1', rental_category_id: 'cat-1', currency: 'XAF' },
    },
  };

  function previewService(user: unknown, row: unknown, enabled = true) {
    const executeQuery = jest.fn(async () => ({ rental_requests_by_pk: row, rental_bookings: [] }));
    const rules = {
      isEnabled: jest.fn().mockResolvedValue(enabled),
      resolve: jest.fn().mockResolvedValue({ rateBps: 1500, source: 'default', ruleId: 'rule-1', campaignCode: null }),
      persistPendingPromo: jest.fn(async (_ctx: unknown, rate: { ruleId: string }) => rate.ruleId),
      activeRules: jest.fn().mockResolvedValue([]),
    };
    const svc = new RentalCommissionService(
      { executeQuery, executeMutation: jest.fn() } as any,
      { getUser: async () => user } as any,
      {} as any,
      rules as any
    );
    return { svc, executeQuery, rules };
  }

  const business = { active_persona: 'business', business: { id: 'biz-1' } };

  it('refuses a client who also has a business row, and another business, before quoting', async () => {
    const client = previewService({ active_persona: 'client', business: { id: 'biz-1' } }, request);
    await expect(client.svc.previewForBusiness('req-1')).rejects.toMatchObject({ status: 403 });
    expect(client.executeQuery).not.toHaveBeenCalled();
    const other = previewService(business, {
      ...request,
      rental_location_listing: {
        ...request.rental_location_listing,
        rental_item: { ...request.rental_location_listing.rental_item, business_id: 'biz-2' },
      },
    });
    await expect(other.svc.previewForBusiness('req-1')).rejects.toMatchObject({ status: 403 });
    expect(other.rules.resolve).not.toHaveBeenCalled();
  });

  it('uses a positive override, falls back when the override is not positive, and rejects a missing total', async () => {
    const { svc, rules } = previewService(business, request);
    await expect(svc.previewForBusiness('req-1', 12000)).resolves.toMatchObject({
      enabled: true,
      base_amount: 12000,
      commission_amount: 1800,
      merchant_payout_amount: 10200,
    });
    await expect(svc.previewForBusiness('req-1', 0)).resolves.toMatchObject({ base_amount: 10000, commission_amount: 1500 });
    await expect(svc.previewForBusiness('req-1', -4)).resolves.toMatchObject({ base_amount: 10000 });
    const snapshot = previewService(business, { ...request, quoted_total: null });
    await expect(snapshot.svc.previewForBusiness('req-1')).resolves.toMatchObject({ base_amount: 8000, commission_amount: 1200 });
    const missing = previewService(business, { rental_location_listing: request.rental_location_listing });
    await expect(missing.svc.previewForBusiness('req-1')).rejects.toMatchObject({ status: 409 });
    expect(rules.resolve).toHaveBeenCalled();
    expect(missing.rules.resolve).not.toHaveBeenCalled();
  });

  it('returns the full total to the merchant when the flag is off', async () => {
    const { svc, rules } = previewService(business, request, false);
    await expect(svc.previewForBusiness('req-1')).resolves.toEqual({
      enabled: false,
      currency: 'XAF',
      base_amount: 10000,
      rate_bps: 0,
      commission_amount: 0,
      merchant_payout_amount: 10000,
    });
    expect(rules.resolve).not.toHaveBeenCalled();
  });

  it('answers 404 when the request is gone and 403 for a summary outside the business persona', async () => {
    const missing = previewService(business, null);
    await expect(missing.svc.previewForBusiness('req-1')).rejects.toMatchObject({ status: 404 });
    const client = previewService({ active_persona: 'client', business: { id: 'biz-1' } }, request);
    await expect(client.svc.businessSummary()).rejects.toMatchObject({ status: 403 });
    expect(client.executeQuery).not.toHaveBeenCalled();
  });

  it('excludes not-applicable bookings unless the report asks for a status', async () => {
    const { svc, hasura } = service();
    hasura.executeQuery.mockResolvedValue({ rental_bookings: [] });
    await svc.report({});
    expect(hasura.executeQuery.mock.calls[0][1].where).toEqual({
      commission_status: { _neq: 'not_applicable' },
    });
    await svc.report({ status: 'earned', businessId: 'biz-1', from: '2026-11-01', to: '2026-12-01' });
    expect(hasura.executeQuery.mock.calls[1][1].where).toEqual({
      commission_status: { _eq: 'earned' },
      business_id: { _eq: 'biz-1' },
      created_at: { _gte: '2026-11-01', _lt: '2026-12-01' },
    });
  });
});
