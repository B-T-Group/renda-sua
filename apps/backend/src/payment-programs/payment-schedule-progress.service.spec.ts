import {
  PaymentScheduleProgressService,
  progressWindow,
  salesCompletionPercent,
  sumUniqueAmounts,
} from './payment-schedule-progress.service';

describe('salesCompletionPercent', () => {
  it('returns null without a sales target', () => {
    expect(salesCompletionPercent(1000, null)).toBeNull();
    expect(salesCompletionPercent(1000, 0)).toBeNull();
  });

  it('returns sales-only percent capped at 100', () => {
    expect(salesCompletionPercent(2500, 10000)).toBe(25);
    expect(salesCompletionPercent(15000, 10000)).toBe(100);
  });
});

describe('progressWindow', () => {
  it('starts at the later of starts_at and accepted_at', () => {
    const window = progressWindow(
      '2026-01-01T00:00:00.000Z',
      '2026-01-10T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      new Date('2026-01-20T00:00:00.000Z')
    );
    expect(window.from).toBe('2026-01-10T00:00:00.000Z');
    expect(window.to).toBe('2026-01-20T00:00:00.000Z');
  });

  it('uses starts_at when acceptance is earlier and caps an open end at now', () => {
    const window = progressWindow(
      '2026-01-10T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
      null,
      new Date('2026-01-20T00:00:00.000Z')
    );
    expect(window.from).toBe('2026-01-10T00:00:00.000Z');
    expect(window.to).toBe('2026-01-20T00:00:00.000Z');
  });
});

describe('sumUniqueAmounts', () => {
  it('deduplicates by id and respects exclude set', () => {
    const rows = [
      { id: 'a', subtotal: 100 },
      { id: 'b', subtotal: 50 },
      { id: 'a', subtotal: 100 },
    ];
    expect(
      sumUniqueAmounts(
        rows,
        (row) => row.id,
        (row) => row.subtotal,
        new Set(['b'])
      )
    ).toBe(100);
  });

  it('skips non-finite amounts', () => {
    expect(
      sumUniqueAmounts(
        [
          { id: 'a', subtotal: Number.NaN },
          { id: 'b', subtotal: 20 },
        ],
        (row) => row.id,
        (row) => row.subtotal
      )
    ).toBe(20);
  });
});

describe('PaymentScheduleProgressService.compute', () => {
  const targets = {
    targetAgentRecruitments: 4,
    targetClientSignups: 2,
    targetMerchantRecruitments: 1,
    targetItemSalesAmount: 2000,
    targetRentalAmount: 500,
  };

  function service(executeQuery: jest.Mock) {
    return new PaymentScheduleProgressService({ executeQuery } as never);
  }

  it('returns zero actuals and does not query before the agent accepts', async () => {
    const executeQuery = jest.fn();
    const result = await service(executeQuery).compute({
      agentId: 'agent-1',
      agentUserId: 'user-1',
      currency: 'XAF',
      startsAt: '2026-01-01T00:00:00.000Z',
      acceptedAt: null,
      endsAt: '2026-02-01T00:00:00.000Z',
      targets: { ...targets, targetItemSalesAmount: null },
    });
    expect(executeQuery).not.toHaveBeenCalled();
    expect(result.itemSales).toEqual({ actual: 0, target: null });
    expect(result.rentals).toEqual({ actual: 0, target: 500 });
    expect(result.completionPercent).toBeNull();
  });

  it('does not query when acceptance is after the schedule has ended', async () => {
    const executeQuery = jest.fn();
    const result = await service(executeQuery).compute({
      agentId: 'agent-1',
      agentUserId: 'user-1',
      currency: 'XAF',
      startsAt: '2020-01-01T00:00:00.000Z',
      acceptedAt: '2030-01-01T00:00:00.000Z',
      endsAt: '2020-06-01T00:00:00.000Z',
      targets,
    });
    expect(executeQuery).not.toHaveBeenCalled();
    expect(result.itemSales.actual).toBe(0);
    expect(result.completionPercent).toBe(0);
  });

  it('dedupes client and merchant orders and ignores rentals in the sales percent', async () => {
    const executeQuery = jest.fn(async () => ({
      agent_recruits: { aggregate: { count: 2 } },
      client_signups: { aggregate: { count: 3 } },
      client_orders: [
        { id: 'o1', subtotal: 1000 },
        { id: 'o2', subtotal: 'bad' },
      ],
      merchant_orders: [
        { id: 'o1', subtotal: 1000 },
        { id: 'o3', subtotal: '400' },
      ],
      client_rentals: [{ id: 'r1', total_amount: 200 }],
      merchant_rentals: [
        { id: 'r1', total_amount: 200 },
        { id: 'r2', total_amount: '50' },
      ],
    }));
    const result = await service(executeQuery).compute({
      agentId: 'agent-1',
      agentUserId: 'user-1',
      currency: 'XAF',
      startsAt: '2026-01-01T00:00:00.000Z',
      acceptedAt: '2026-01-10T00:00:00.000Z',
      endsAt: '2026-02-01T00:00:00.000Z',
      targets,
    });

    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('current_status: { _in: [complete, delivered] }'),
      {
        agentId: 'agent-1',
        agentUserId: 'user-1',
        currency: 'XAF',
        currencyText: 'XAF',
        from: '2026-01-10T00:00:00.000Z',
        to: '2026-02-01T00:00:00.000Z',
      }
    );
    expect(String(executeQuery.mock.calls[0][0])).toContain(
      'status: { _in: [confirmed, active, awaiting_return, completed] }'
    );
    expect(result.agentRecruitments).toEqual({ actual: 2, target: 4 });
    expect(result.clientSignups).toEqual({ actual: 3, target: 2 });
    expect(result.merchantRecruitments).toEqual({ actual: 0, target: 1 });
    expect(result.itemSales).toEqual({ actual: 1400, target: 2000 });
    expect(result.rentals).toEqual({ actual: 250, target: 500 });
    expect(result.completionPercent).toBe(70);
  });
});
