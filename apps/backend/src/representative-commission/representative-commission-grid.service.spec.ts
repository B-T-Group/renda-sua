import { RepresentativeCommissionGridService } from './representative-commission-grid.service';

const NOTICE_MS = 30 * 24 * 60 * 60 * 1000;

describe('RepresentativeCommissionGridService', () => {
  const hasura = { executeQuery: jest.fn() };
  const service = new RepresentativeCommissionGridService(hasura as never);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-13T12:00:00.000Z'));
    hasura.executeQuery.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null when no grid is open, and coerces stored amounts', async () => {
    hasura.executeQuery.mockResolvedValueOnce({ representative_commission_grids: [] });
    await expect(service.loadFor('XAF', new Date())).resolves.toBeNull();

    hasura.executeQuery.mockResolvedValueOnce({
      representative_commission_grids: [storedGrid()],
    });
    const grid = await service.loadFor('XAF', new Date('2026-11-02T00:00:00.000Z'));
    expect(grid).toEqual(
      expect.objectContaining({
        id: 'grid-1',
        currency: 'XAF',
        basePercent: 10,
        capPercent: 13.5,
        holdPercent: 0,
        inactiveDays: 90,
        tiers: [
          { minMonthlySales: 0, maxMonthlySales: null, bonusPercent: 2 },
          { minMonthlySales: 10, maxMonthlySales: 0, bonusPercent: 1 },
        ],
      })
    );
  });

  it('rejects a grid that starts before 30 days and closes the open one at the boundary', async () => {
    const tooSoon = new Date(Date.now() + NOTICE_MS - 1);
    await expect(service.replaceOpenGrid('XAF', tooSoon, { base_percent: 9 })).rejects.toThrow(
      /30 days/
    );
    expect(hasura.executeQuery).not.toHaveBeenCalled();

    const start = new Date(Date.now() + NOTICE_MS);
    hasura.executeQuery.mockResolvedValueOnce({
      representative_commission_grids: [{ ...storedGrid(), id: 'open-grid' }],
    });
    await service.replaceOpenGrid('XAF', start, { base_percent: 9 });
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('CloseCommissionGrid'),
      { id: 'open-grid', effectiveTo: start.toISOString() }
    );
    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('InsertCommissionGrid'),
      {
        object: {
          currency: 'XAF',
          effective_from: start.toISOString(),
          base_percent: 9,
        },
      }
    );
  });

  it('inserts the next grid when nothing is open at the start date', async () => {
    const start = new Date(Date.now() + NOTICE_MS);
    hasura.executeQuery.mockResolvedValueOnce({ representative_commission_grids: [] });
    await service.replaceOpenGrid('CAD', start, { base_percent: 8 });
    const queries = hasura.executeQuery.mock.calls.map((call) => String(call[0]));
    expect(queries.some((query) => query.includes('CloseCommissionGrid'))).toBe(false);
    expect(queries.some((query) => query.includes('InsertCommissionGrid'))).toBe(true);
  });
});

function storedGrid() {
  return {
    id: 'grid-1',
    currency: 'XAF',
    base_percent: '10',
    cap_percent: '13.5',
    hold_percent: null,
    hold_days: '90',
    registration_target: '40',
    objective_threshold_percent: '70',
    activation_amount: '4000',
    activation_min_sales: '2500',
    activation_window_days: '30',
    fast_start_amount: '0',
    fast_start_min_registrations: '0',
    fast_start_window_days: '0',
    fast_start_weekly_sales: '0',
    quarterly_amount: '0',
    quarterly_min_weeks: '0',
    quarterly_week_span: '0',
    quarterly_min_registrations_per_week: '0',
    quarterly_min_weekly_sales: '0',
    courier_amount: '5000',
    courier_min_deliveries: '1',
    courier_window_days: '60',
    courier_max_per_month: '2',
    ambassador_amount: '0',
    ambassador_min_registrations: '1',
    ambassador_window_days: '60',
    inactive_days: '90',
    tiers: [
      { min_monthly_sales: '0', max_monthly_sales: null, bonus_percent: '2' },
      { min_monthly_sales: '10', max_monthly_sales: 0, bonus_percent: '1' },
    ],
  };
}
