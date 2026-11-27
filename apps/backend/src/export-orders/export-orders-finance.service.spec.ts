import { ExportOrdersFinanceService } from './export-orders-finance.service';
import type { ExportOrderRow } from './export-orders.types';

function order(patch: Partial<ExportOrderRow> = {}): ExportOrderRow {
  return {
    id: 'order-1',
    status: 'DEPOSIT_REQUIRED',
    currency: 'CAD',
    grand_total: 1000,
    payments: [
      { id: 'voided', amount: 100, voided_at: '2026-11-01T00:00:00.000Z' },
      { id: 'kept', amount: 600, voided_at: null },
    ],
    ...patch,
  } as ExportOrderRow;
}

describe('ExportOrdersFinanceService', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const hasuraUser = { getUser: jest.fn() };
  const transitions = { getOrder: jest.fn(), transition: jest.fn() };
  const pdf = { issueReceipt: jest.fn() };
  const commissions = {
    accrueOnPayment: jest.fn(),
    markFinancingPaid: jest.fn(),
  };
  let service: ExportOrdersFinanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-27T15:00:00.000Z'));
    service = new ExportOrdersFinanceService(
      hasura as any,
      hasuraUser as any,
      transitions as any,
      pdf as any,
      commissions as any
    );
    hasuraUser.getUser.mockResolvedValue({ id: 'fin-1' });
    transitions.getOrder.mockResolvedValue(order());
    transitions.transition.mockResolvedValue(
      order({ status: 'DEPOSIT_RECEIVED' })
    );
    pdf.issueReceipt.mockResolvedValue({ id: 'receipt-1' });
    commissions.accrueOnPayment.mockResolvedValue(undefined);
    commissions.markFinancingPaid.mockResolvedValue(undefined);
    hasura.executeMutation.mockImplementation(async (query: string) => {
      if (String(query).includes('InsertExportPayment')) {
        return {
          insert_export_payments_one: {
            id: 'pay-1',
            amount: 50,
            allocation: 'deposit',
          },
        };
      }
      return { insert_export_bank_accounts_one: { id: 'bank-1' } };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refuses a deposit unless the order is waiting for one', async () => {
    transitions.getOrder.mockResolvedValue(
      order({ status: 'BALANCE_REQUIRED' })
    );
    await expect(
      service.recordClientPayment('order-1', { amount: 50 })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Deposit payment only when DEPOSIT_REQUIRED',
    });
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(transitions.transition).not.toHaveBeenCalled();
  });

  it('ignores voided payments and does not leave a negative balance', async () => {
    await service.recordClientPayment('order-1', {
      amount: 50,
      allocation: 'deposit',
      method: 'wire',
      valueDate: '2026-01-15',
    });
    expect(pdf.issueReceipt.mock.calls[0][2].remaining).toBe(350);

    transitions.getOrder.mockResolvedValue(
      order({
        payments: [{ id: 'kept', amount: 900, voided_at: null } as any],
      })
    );
    await service.recordClientPayment('order-1', {
      amount: 200,
      allocation: 'deposit',
    });
    expect(pdf.issueReceipt.mock.calls[1][2].remaining).toBe(0);
    expect(pdf.issueReceipt.mock.calls[1][2]).toEqual(
      expect.objectContaining({
        currency: 'CAD',
        method: 'wire',
        valueDate: '2026-11-27',
      })
    );
  });

  it('keeps a real currency and does not mark the deposit received if commission fails', async () => {
    transitions.getOrder.mockResolvedValue(order({ currency: '' as any }));
    commissions.accrueOnPayment.mockRejectedValue(new Error('commission down'));
    await expect(
      service.recordClientPayment('order-1', {
        amount: 50,
        allocation: 'deposit',
      })
    ).rejects.toThrow('commission down');
    expect(hasura.executeMutation.mock.calls[0][1].object.currency).toBe('CAD');
    expect(transitions.transition).not.toHaveBeenCalled();
  });

  it('does not mark a balance paid unless the order is waiting for the balance', async () => {
    await service.recordClientPayment('order-1', {
      amount: 50,
      allocation: 'balance',
    });
    expect(transitions.transition).not.toHaveBeenCalled();
    expect(commissions.markFinancingPaid).not.toHaveBeenCalled();

    transitions.getOrder.mockResolvedValue(
      order({ status: 'BALANCE_REQUIRED' })
    );
    await service.recordClientPayment('order-1', {
      amount: 50,
      allocation: 'balance',
    });
    expect(transitions.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'PAID_IN_FULL',
        actorRole: 'finance',
        extraSet: { balance_option: 'FULL' },
      })
    );
  });

  it('marks financing paid without changing status on a repayment', async () => {
    transitions.getOrder.mockResolvedValue(order({ status: 'FINANCED_30' }));
    await service.recordClientPayment('order-1', {
      amount: 50,
      allocation: 'financing_repayment',
    });
    expect(commissions.markFinancingPaid).toHaveBeenCalledWith('order-1');
    expect(transitions.transition).not.toHaveBeenCalled();
  });

  it('moves a supplier deposit into production and leaves a balance payment in place', async () => {
    transitions.getOrder.mockRejectedValueOnce(new Error('missing'));
    await expect(
      service.recordSupplierPayment('order-1', { kind: 'deposit', amount: 10 })
    ).rejects.toThrow('missing');
    expect(hasura.executeMutation).not.toHaveBeenCalled();

    transitions.getOrder.mockResolvedValue(
      order({ status: 'DEPOSIT_RECEIVED' })
    );
    await service.recordSupplierPayment('order-1', {
      kind: 'deposit',
      amount: 10,
    });
    expect(transitions.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'IN_PRODUCTION',
        actorRole: 'finance',
        eventName: 'supplier_payment.deposit_sent',
      })
    );

    transitions.transition.mockClear();
    await service.recordSupplierPayment('order-1', {
      kind: 'balance',
      amount: 20,
    });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertSupplierPayment'),
      expect.objectContaining({
        object: expect.objectContaining({ kind: 'balance', amount: 20 }),
      })
    );
    expect(transitions.transition).not.toHaveBeenCalled();
  });

  it('defaults a new bank account to CAD after deactivating the previous one', async () => {
    await service.upsertBankAccount({
      institution: 'Bank',
      accountNumber: '123',
      beneficiary: 'Rendasua',
    } as any);
    const queries = hasura.executeMutation.mock.calls.map((call) =>
      String(call[0])
    );
    expect(queries[0]).toContain('valid_to');
    expect(queries[1]).toContain('Insert');
    expect(hasura.executeMutation.mock.calls[1][1].object).toEqual(
      expect.objectContaining({
        currency: 'CAD',
        transit: null,
        swift: null,
        is_active: true,
        valid_to: null,
      })
    );
  });
});
