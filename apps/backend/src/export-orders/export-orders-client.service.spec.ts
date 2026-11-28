import { HttpException, HttpStatus } from '@nestjs/common';
import { ExportOrdersClientService } from './export-orders-client.service';
import type { ExportOrderRow } from './export-orders.types';

const proforma = {
  id: 'pf-1',
  kind: 'PROFORMA',
  subtotal: '10.50',
  fees_total: 1,
  tax_total: 0,
  grand_total: 11.5,
  deposit_rate: 0.4,
  deposit_amount: 4.6,
  balance_amount: 6.9,
  valid_until: '2026-11-27T15:00:00.000Z',
  client_approved_at: null as string | null,
};

function order(patch: Partial<ExportOrderRow> = {}): ExportOrderRow {
  return {
    id: 'order-1',
    status: 'PROFORMA_ISSUED',
    client_user_id: 'user-1',
    admin_notes: 'keep',
    has_open_dispute: false,
    balance_option: null,
    invoices: [proforma],
    ...patch,
  } as ExportOrderRow;
}

describe('ExportOrdersClientService', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const hasuraUser = { getUser: jest.fn() };
  const transitions = { getOrder: jest.fn(), transition: jest.fn() };
  const pdf = { issueInvoice: jest.fn() };
  const commissions = {
    ensureFinancing: jest.fn(),
    markPayableOnDelivery: jest.fn(),
    awardPaymentCredit: jest.fn(),
  };
  let service: ExportOrdersClientService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-27T15:00:00.000Z'));
    service = new ExportOrdersClientService(
      hasura as any,
      hasuraUser as any,
      transitions as any,
      pdf as any,
      commissions as any
    );
    hasuraUser.getUser.mockResolvedValue({ id: 'user-1' });
    transitions.getOrder.mockResolvedValue(order());
    transitions.transition.mockImplementation(async (params: any) => ({
      ...order(),
      status: params.to,
      has_open_dispute: Boolean(params.extraSet?.has_open_dispute),
      ...params.extraSet,
    }));
    hasura.executeQuery.mockResolvedValue({
      export_bank_accounts: [{ id: 'bank-1', currency: 'CAD' }],
    });
    hasura.executeMutation.mockResolvedValue({});
    pdf.issueInvoice.mockResolvedValue({ id: 'inv-doc' });
    commissions.ensureFinancing.mockResolvedValue(undefined);
    commissions.markPayableOnDelivery.mockResolvedValue(undefined);
    commissions.awardPaymentCredit.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refuses a proforma action from another client or the wrong status', async () => {
    hasuraUser.getUser.mockResolvedValue({ id: 'other' });
    await expect(
      service.handleProforma('order-1', { action: 'approve' })
    ).rejects.toMatchObject({ status: 403, message: 'Forbidden' });
    hasuraUser.getUser.mockResolvedValue({ id: 'user-1' });
    transitions.getOrder.mockResolvedValue(order({ status: 'INVOICED' }));
    await expect(
      service.handleProforma('order-1', { action: 'approve' })
    ).rejects.toMatchObject({ status: 400, message: 'No proforma to act on' });
    expect(transitions.transition).not.toHaveBeenCalled();
  });

  it('lets the client request a change after the proforma has expired', async () => {
    transitions.getOrder.mockResolvedValue(
      order({
        invoices: [
          { ...proforma, valid_until: '2026-11-26T00:00:00.000Z' },
        ] as ExportOrderRow['invoices'],
      })
    );
    await service.handleProforma('order-1', {
      action: 'request_adjustment',
      notes: 'too high',
    });
    expect(transitions.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'PROFORMA_ISSUED',
        actorRole: 'client',
        payload: { adjustment: true, notes: 'too high' },
      })
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects a missing or expired proforma and accepts one that expires this instant', async () => {
    transitions.getOrder.mockResolvedValue(
      order({
        invoices: [
          { ...proforma, client_approved_at: '2026-11-01' },
        ] as ExportOrderRow['invoices'],
      })
    );
    await expect(
      service.handleProforma('order-1', { action: 'approve' })
    ).rejects.toMatchObject({ status: 400, message: 'Proforma not found' });

    transitions.getOrder.mockResolvedValue(
      order({
        invoices: [
          { ...proforma, valid_until: '2026-11-27T14:59:59.999Z' },
        ] as ExportOrderRow['invoices'],
      })
    );
    await expect(
      service.handleProforma('order-1', { action: 'approve' })
    ).rejects.toMatchObject({ status: 400, message: 'Proforma expired' });
    expect(hasura.executeMutation).not.toHaveBeenCalled();

    transitions.getOrder.mockResolvedValue(order());
    await service.handleProforma('order-1', { action: 'approve' });
    expect(pdf.issueInvoice.mock.calls[0][4].subtotal).toBe(10.5);
    expect(transitions.transition.mock.calls.map((call) => call[0].to)).toEqual(
      ['INVOICED', 'DEPOSIT_REQUIRED']
    );
    expect(
      transitions.transition.mock.calls[1][0].extraSet.deposit_due_at
    ).toBe('2026-12-04T15:00:00.000Z');
  });

  it('finances 30 or 60 days only while the balance is required', async () => {
    transitions.getOrder.mockResolvedValue(
      order({ status: 'PROFORMA_ISSUED' })
    );
    await expect(
      service.selectBalanceOption('order-1', { option: 'FINANCED_30' })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Balance option not available',
    });
    expect(commissions.ensureFinancing).not.toHaveBeenCalled();

    const waiting = order({ status: 'BALANCE_REQUIRED' });
    transitions.getOrder.mockResolvedValue(waiting);
    await service.selectBalanceOption('order-1', { option: 'FINANCED_30' });
    await service.selectBalanceOption('order-1', { option: 'FINANCED_60' });
    expect(commissions.ensureFinancing).toHaveBeenNthCalledWith(
      1,
      waiting,
      30,
      'user-1'
    );
    expect(commissions.ensureFinancing).toHaveBeenNthCalledWith(
      2,
      waiting,
      60,
      'user-1'
    );
    expect(transitions.transition.mock.calls.map((call) => call[0].to)).toEqual(
      ['FINANCED_30', 'FINANCED_60']
    );
  });

  it('does not close a disputed delivery or a delivery the re-read does not show', async () => {
    transitions.getOrder.mockResolvedValue(
      order({ status: 'READY', client_user_id: 'user-1' })
    );
    await expect(service.confirmDelivery('order-1', {})).rejects.toMatchObject({
      status: 400,
      message: 'Not shipped yet',
    });
    expect(commissions.markPayableOnDelivery).not.toHaveBeenCalled();

    transitions.getOrder.mockResolvedValue(order({ status: 'SHIPPED' }));
    await service.confirmDelivery('order-1', {
      openDispute: true,
      reserves: '   ',
    });
    expect(transitions.transition).toHaveBeenCalledTimes(1);
    expect(transitions.transition.mock.calls[0][0].extraSet).toEqual(
      expect.objectContaining({
        has_open_dispute: true,
        admin_notes: 'keep',
      })
    );
    expect(commissions.markPayableOnDelivery).toHaveBeenCalledWith('order-1');
    expect(commissions.awardPaymentCredit).toHaveBeenCalled();

    transitions.transition.mockClear();
    commissions.markPayableOnDelivery.mockClear();
    await service.confirmDelivery('order-1', {});
    expect(transitions.transition).toHaveBeenCalledTimes(1);

    let reads = 0;
    transitions.getOrder.mockImplementation(async () => {
      reads += 1;
      return order({
        status: reads === 1 ? 'SHIPPED' : 'DELIVERED',
        has_open_dispute: false,
      });
    });
    transitions.transition.mockClear();
    await service.confirmDelivery('order-1', { openDispute: false });
    expect(transitions.transition.mock.calls.map((call) => call[0].to)).toEqual(
      ['DELIVERED', 'CLOSED']
    );
  });

  it('does not award credit when the delivery status claim loses', async () => {
    transitions.getOrder.mockResolvedValue(order({ status: 'SHIPPED' }));
    transitions.transition.mockRejectedValue(
      new HttpException('Export order status changed', HttpStatus.CONFLICT)
    );
    await expect(service.confirmDelivery('order-1', {})).rejects.toMatchObject({
      status: 409,
      message: 'Export order status changed',
    });
    expect(commissions.awardPaymentCredit).not.toHaveBeenCalled();
    expect(commissions.markPayableOnDelivery).not.toHaveBeenCalled();
  });
});
