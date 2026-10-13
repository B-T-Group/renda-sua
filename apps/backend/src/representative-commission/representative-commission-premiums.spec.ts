import { doualaMidnight } from './douala-period';
import {
  activationSubjectIds,
  fastStartAmountDue,
  type ActivationBusiness,
} from './representative-commission-premiums';

const period = { start: '2026-09-01', end: '2026-10-01' };
const grid = { activationMinSales: 2500, activationWindowDays: 30 };

describe('activation bonuses', () => {
  it('uses the earliest sale that crosses, not a later sale listed first', () => {
    const wide = { activationMinSales: 2500, activationWindowDays: 60 };
    const businesses = [
      shop('biz-1', '2026-08-20T00:00:00.000Z', [
        sale('2026-10-05T00:00:00.000Z', 2500, 'buyer'),
        sale('2026-09-10T00:00:00.000Z', 2500, 'buyer'),
        sale('2026-09-04T00:00:00.000Z', 9000, 'agent-user'),
      ]),
    ];
    expect(activationSubjectIds(businesses, period, wide, 'agent-user', new Set())).toEqual([
      'biz-1',
    ]);
    const tooEarly = shop('early', '2026-09-10T00:00:00.000Z', [
      sale('2026-09-09T00:00:00.000Z', 2500, 'buyer'),
    ]);
    expect(activationSubjectIds([tooEarly], period, grid, null, new Set())).toEqual([]);
  });

  it('counts a sale on the window and period edges, and excludes the next millisecond', () => {
    const accepted = '2026-09-01T00:00:00.000Z';
    const windowEnd = '2026-10-01T00:00:00.000Z';
    const periodEnd = doualaMidnight(period.end).toISOString();
    const inside = shop('inside', accepted, [sale(windowEnd, 2500, 'buyer')]);
    const outside = shop('outside', accepted, [
      sale('2026-10-01T00:00:00.001Z', 2500, 'buyer'),
    ]);
    const october = { start: '2026-10-01', end: '2026-11-01' };
    expect(activationSubjectIds([inside], october, grid, null, new Set())).toEqual(['inside']);
    expect(activationSubjectIds([outside], october, grid, null, new Set())).toEqual([]);
    const atEnd = shop('at-end', '2026-08-01T00:00:00.000Z', [sale(periodEnd, 2500, null)]);
    const justBefore = shop('before-end', '2026-08-01T00:00:00.000Z', [
      sale('2026-09-30T22:59:59.999Z', 2500, null),
    ]);
    expect(activationSubjectIds([atEnd], period, { ...grid, activationWindowDays: 90 }, null, new Set())).toEqual(
      []
    );
    expect(
      activationSubjectIds([justBefore], period, { ...grid, activationWindowDays: 90 }, null, new Set())
    ).toEqual(['before-end']);
  });

  it('skips a shop that was already paid, never agreed, or has no parseable sale', () => {
    const paid = shop('paid', '2026-09-01T00:00:00.000Z', [sale('2026-09-10T00:00:00.000Z', 2500, 'buyer')]);
    const unsigned = shop('unsigned', null, [sale('2026-09-10T00:00:00.000Z', 2500, 'buyer')]);
    const broken = shop('broken', '2026-09-01T00:00:00.000Z', [sale('not-a-date', 2500, 'buyer')]);
    const ids = activationSubjectIds(
      [paid, unsigned, broken],
      period,
      grid,
      null,
      new Set(['paid'])
    );
    expect(ids).toEqual([]);
  });
});

describe('fastStartAmountDue', () => {
  it('excludes day 90 when it lands on the next period boundary', () => {
    const day90 = doualaMidnight('2026-10-01');
    const signedAt = new Date(day90.getTime() - 89 * 24 * 60 * 60 * 1000).toISOString();
    expect(fastStartAmountDue(signedAt, period)).toBe(false);
    expect(fastStartAmountDue('not-a-date', period)).toBe(false);
  });
});

function shop(
  id: string,
  accepted: string | null,
  orders: ActivationBusiness['orders']
): ActivationBusiness {
  return { id, merchant_agreement_accepted_at: accepted, orders };
}

function sale(completedAt: string, subtotal: number, userId: string | null) {
  return { subtotal, completed_at: completedAt, client: { user_id: userId } };
}
