import { ExportOrdersAdminService } from './export-orders-admin.service';
import type { ExportOrderRow } from './export-orders.types';

function order(patch: Partial<ExportOrderRow> = {}): ExportOrderRow {
  return {
    id: 'order-1',
    status: 'IN_REVIEW',
    lines: [{ id: 'l1', quantity: 3 } as any],
    invoices: [],
    ...patch,
  } as ExportOrderRow;
}

describe('ExportOrdersAdminService', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const hasuraUser = { getUser: jest.fn() };
  const transitions = { getOrder: jest.fn(), transition: jest.fn() };
  const pdf = { issueProforma: jest.fn() };
  const exportOrders = { startReview: jest.fn(), listForActor: jest.fn() };
  let service: ExportOrdersAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    service = new ExportOrdersAdminService(
      hasura as any,
      hasuraUser as any,
      transitions as any,
      pdf as any,
      exportOrders as any
    );
    hasuraUser.getUser.mockResolvedValue({ id: 'admin-1' });
    transitions.getOrder.mockResolvedValue(order());
    transitions.transition.mockImplementation(
      async (params: { to: string; extraSet?: object }) => ({
        status: params.to,
        ...(params.extraSet ?? {}),
      })
    );
    hasura.executeMutation.mockResolvedValue({});
    hasura.executeQuery.mockResolvedValue({ export_bank_accounts: [] });
    pdf.issueProforma.mockResolvedValue({ id: 'doc-1' });
    exportOrders.startReview.mockResolvedValue(order({ status: 'IN_REVIEW' }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requires notes to reject or request changes, and approves without them', async () => {
    await expect(
      service.review('order-1', { decision: 'CHANGES_REQUESTED', notes: '   ' })
    ).rejects.toMatchObject({ status: 400, message: 'Notes required' });
    await expect(
      service.review('order-1', { decision: 'REJECT' })
    ).rejects.toMatchObject({ status: 400, message: 'Notes required' });
    expect(transitions.transition).not.toHaveBeenCalled();

    await service.review('order-1', { decision: 'APPROVE' });
    expect(exportOrders.startReview).not.toHaveBeenCalled();
    expect(transitions.transition).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'MFR_QUOTE', actorRole: 'admin' })
    );
  });

  it('starts review from SUBMITTED before approving, and refuses other statuses', async () => {
    transitions.getOrder.mockResolvedValue(order({ status: 'SUBMITTED' }));
    await service.review('order-1', { decision: 'APPROVE', notes: '  ok  ' });
    expect(exportOrders.startReview).toHaveBeenCalledWith('order-1', 'admin-1');
    expect(hasura.executeMutation.mock.calls[0][1].object.notes).toBe('ok');

    transitions.getOrder.mockResolvedValue(order({ status: 'READY' }));
    await expect(
      service.review('order-1', { decision: 'APPROVE' })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Order must be SUBMITTED or IN_REVIEW',
    });
  });

  it('refuses a proforma for the wrong status or an unknown line', async () => {
    transitions.getOrder.mockResolvedValue(order({ status: 'IN_REVIEW' }));
    await expect(
      service.issueProforma('order-1', { lines: [] })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Proforma requires MFR_QUOTE or PROFORMA_ISSUED',
    });

    transitions.getOrder.mockResolvedValue(order({ status: 'MFR_QUOTE' }));
    await expect(
      service.issueProforma('order-1', {
        lines: [{ lineId: 'missing', unitPrice: 10 }],
      })
    ).rejects.toMatchObject({ status: 400, message: 'Unknown line missing' });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rounds each line before the deposit and keeps the leftover cent', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-27T15:00:00.000Z'));
    transitions.getOrder.mockResolvedValue(
      order({
        status: 'MFR_QUOTE',
        lines: [
          { id: 'l1', quantity: 1 } as any,
          { id: 'l2', quantity: 1 } as any,
        ],
      })
    );
    await service.issueProforma('order-1', {
      lines: [
        { lineId: 'l1', unitPrice: 0.014 },
        { lineId: 'l2', unitPrice: 0.014 },
      ],
    });
    const totals = transitions.transition.mock.calls[0][0].extraSet;
    expect(totals.client_subtotal).toBe(0.02);
    expect(totals.grand_total).toBe(0.02);
    expect(totals.deposit_amount).toBe(0.01);
    expect(totals.balance_amount).toBe(0.01);

    transitions.transition.mockClear();
    hasura.executeMutation.mockClear();
    transitions.getOrder.mockResolvedValue(order({ status: 'MFR_QUOTE' }));
    await service.issueProforma('order-1', {
      lines: [{ lineId: 'l1', unitPrice: 10.005, manufacturerUnitCost: 4.004 }],
      fees: [
        { feeType: 'other', label: 'A', amount: 0.004 },
        { feeType: 'other', label: 'B', amount: 0.004 },
      ],
    });
    const priced = transitions.transition.mock.calls[0][0].extraSet;
    expect(priced).toEqual(
      expect.objectContaining({
        client_subtotal: 30.02,
        fees_total: 0.008,
        grand_total: 30.028,
        deposit_rate: 0.4,
        deposit_amount: 12.01,
        balance_amount: 18.02,
        manufacturer_cost_total: 12.01,
        credit_rate_full: 0.05,
        credit_rate_30: 0.025,
        credit_rate_60: 0,
        proforma_expires_at: '2026-12-04T15:00:00.000Z',
      })
    );
    const revenue = hasura.executeMutation.mock.calls.find((call) =>
      String(call[0]).includes('UpsertRevenue')
    )[1].object;
    expect(revenue.rendasua_revenue).toBe(18.01);
    expect(revenue.fees_passthrough).toBe(0.008);
  });

  it('numbers the first proforma as 1 and the next issue from the proforma count', async () => {
    transitions.getOrder.mockResolvedValue(
      order({
        status: 'MFR_QUOTE',
        lines: [{ id: 'l1', quantity: 1 } as any],
        invoices: [{ id: 'old', kind: 'PROFORMA' } as any],
      })
    );
    await service.issueProforma('order-1', {
      lines: [{ lineId: 'l1', unitPrice: 10 }],
    });
    expect(
      hasura.executeMutation.mock.calls.find((call) =>
        String(call[0]).includes('InsertExportInvoice')
      )[1].object.version_number
    ).toBe(1);

    transitions.getOrder.mockResolvedValue(
      order({
        status: 'PROFORMA_ISSUED',
        lines: [{ id: 'l1', quantity: 1 } as any],
        invoices: [
          { id: 'p1', kind: 'PROFORMA' } as any,
          { id: 'p2', kind: 'PROFORMA' } as any,
          { id: 'inv', kind: 'INVOICE' } as any,
        ],
      })
    );
    await service.issueProforma('order-1', {
      lines: [{ lineId: 'l1', unitPrice: 10 }],
    });
    const versions = hasura.executeMutation.mock.calls
      .filter((call) => String(call[0]).includes('InsertExportInvoice'))
      .map((call) => call[1].object.version_number);
    expect(versions).toEqual([1, 3]);
  });
});
