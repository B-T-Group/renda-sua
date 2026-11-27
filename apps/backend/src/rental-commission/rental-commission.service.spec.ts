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
});
