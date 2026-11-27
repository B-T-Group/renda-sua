import { ExportOrdersDashboardService } from './export-orders-dashboard.service';

describe('ExportOrdersDashboardService', () => {
  it('sums deposits, balances, and open financing without mixing them', async () => {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        export_orders: [
          {
            status: 'DEPOSIT_REQUIRED',
            country_code: 'CM',
            deposit_amount: '10.50',
            balance_amount: 80,
          },
          {
            status: 'DEPOSIT_REQUIRED',
            country_code: 'CM',
            deposit_amount: -2,
            balance_amount: 5,
          },
          {
            status: 'BALANCE_REQUIRED',
            country_code: 'CI',
            deposit_amount: 40,
            balance_amount: '1.25',
          },
          {
            status: 'FINANCED_30',
            country_code: 'CM',
            balance_amount: 30,
          },
          {
            status: 'FINANCED_60',
            country_code: 'GA',
            balance_amount: null,
          },
          {
            status: 'PAID_IN_FULL',
            country_code: 'CM',
            deposit_amount: 100,
            balance_amount: 100,
          },
        ],
      }),
    };
    const summary = await new ExportOrdersDashboardService(
      hasura as any
    ).summary();
    expect(summary.accountsReceivable).toEqual({
      deposits: 8.5,
      balances: 1.25,
    });
    expect(summary.openFinancing).toBe(30);
    expect(summary.byStatus).toEqual({
      DEPOSIT_REQUIRED: 2,
      BALANCE_REQUIRED: 1,
      FINANCED_30: 1,
      FINANCED_60: 1,
      PAID_IN_FULL: 1,
    });
    expect(summary.byCountry.CM).toBe(4);
    expect(summary.totalOrders).toBe(6);
  });

  it('returns zeros when the order list is missing', async () => {
    const hasura = { executeQuery: jest.fn().mockResolvedValue({}) };
    const summary = await new ExportOrdersDashboardService(
      hasura as any
    ).summary();
    expect(summary).toEqual({
      byStatus: {},
      byCountry: {},
      accountsReceivable: { deposits: 0, balances: 0 },
      openFinancing: 0,
      totalOrders: 0,
    });
  });
});
