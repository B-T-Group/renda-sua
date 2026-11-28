import { Logger } from '@nestjs/common';
import { ExportOrdersCommissionService } from './export-orders-commission.service';
import type { ExportOrderRow } from './export-orders.types';

function order(patch: Partial<ExportOrderRow> = {}): ExportOrderRow {
  return {
    id: 'order-1',
    agent_user_id: 'agent-1',
    client_user_id: 'client-1',
    grand_total: 1000,
    balance_amount: 200,
    balance_option: 'FULL',
    credit_rate_full: 0.05,
    credit_rate_30: 0.025,
    credit_rate_60: 0.1,
    ...patch,
  } as ExportOrderRow;
}

describe('ExportOrdersCommissionService', () => {
  const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
  const docNumbers = { next: jest.fn() };
  const transitions = { getOrder: jest.fn() };
  let service: ExportOrdersCommissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    service = new ExportOrdersCommissionService(
      hasura as any,
      docNumbers as any,
      transitions as any
    );
    transitions.getOrder.mockResolvedValue(order());
    hasura.executeQuery.mockResolvedValue({
      export_order_revenue: [{ rendasua_revenue: 200 }],
    });
    hasura.executeMutation.mockResolvedValue({
      insert_export_credit_notes_one: { id: 'note-1' },
    });
    docNumbers.next.mockResolvedValue('CR-1');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function commissionInsert(paymentId: string) {
    const call = hasura.executeMutation.mock.calls.find(
      (entry) =>
        String(entry[0]).includes('InsertCommission') &&
        entry[1]?.object?.payment_id === paymentId
    );
    return call?.[1]?.object;
  }

  it('skips commission when there is no agent, no revenue, or a non-positive amount', async () => {
    transitions.getOrder.mockResolvedValue(order({ agent_user_id: null }));
    await service.accrueOnPayment('order-1', 'pay-1', 250);
    expect(hasura.executeQuery).not.toHaveBeenCalled();

    transitions.getOrder.mockResolvedValue(order());
    hasura.executeQuery.mockResolvedValue({ export_order_revenue: [] });
    await service.accrueOnPayment('order-1', 'pay-1', 250);
    hasura.executeQuery.mockResolvedValue({
      export_order_revenue: [{ rendasua_revenue: 'nope' }],
    });
    await service.accrueOnPayment('order-1', 'pay-1', 250);
    hasura.executeQuery.mockResolvedValue({
      export_order_revenue: [{ rendasua_revenue: -10 }],
    });
    await service.accrueOnPayment('order-1', 'pay-1', 100);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('accrues 5% of the revenue share and treats a zero total as one', async () => {
    await service.accrueOnPayment('order-1', 'pay-1', 250);
    expect(commissionInsert('pay-1')).toEqual({
      export_order_id: 'order-1',
      agent_user_id: 'agent-1',
      payment_id: 'pay-1',
      base_amount: 50,
      rate: 0.05,
      amount: 2.5,
      status: 'accrued',
    });

    transitions.getOrder.mockResolvedValue(order({ grand_total: 0 }));
    hasura.executeQuery.mockResolvedValue({
      export_order_revenue: [{ rendasua_revenue: 10 }],
    });
    await service.accrueOnPayment('order-1', 'pay-2', 4);
    expect(commissionInsert('pay-2')).toEqual(
      expect.objectContaining({
        base_amount: 40,
        amount: 2,
        payment_id: 'pay-2',
      })
    );

    transitions.getOrder.mockResolvedValue(order({ grand_total: 300 }));
    hasura.executeQuery.mockResolvedValue({
      export_order_revenue: [{ rendasua_revenue: '100' }],
    });
    await service.accrueOnPayment('order-1', 'pay-3', 100);
    expect(commissionInsert('pay-3')).toEqual(
      expect.objectContaining({ base_amount: 33.33, amount: 1.67 })
    );
  });

  it('does not accrue a sub-cent share', async () => {
    hasura.executeQuery.mockResolvedValue({
      export_order_revenue: [{ rendasua_revenue: 1 }],
    });
    await service.accrueOnPayment('order-1', 'pay-1', 1);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('awards the full and 30-day credits and never a 60-day credit', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-27T15:00:00.000Z'));
    await service.awardPaymentCredit(order({ credit_rate_full: 0 }));
    expect(docNumbers.next).toHaveBeenCalledWith('CR');
    const note = hasura.executeMutation.mock.calls.find((entry) =>
      String(entry[0]).includes('InsertCreditNote')
    )[1].object;
    expect(note.amount).toBe(10);
    expect(note.reason).toBe('Credit 5% for FULL');
    expect(note.expires_at).toBe('2027-11-27T15:00:00.000Z');
    const ledger = hasura.executeMutation.mock.calls.find((entry) =>
      String(entry[0]).includes('InsertCreditLedger')
    )[1].object;
    expect(ledger).toEqual(
      expect.objectContaining({
        amount: 10,
        entry_type: 'accrued',
        credit_note_id: 'note-1',
        expires_at: '2027-11-27T15:00:00.000Z',
      })
    );

    hasura.executeMutation.mockClear();
    docNumbers.next.mockClear();
    await service.awardPaymentCredit(
      order({
        balance_option: 'FINANCED_30',
        balance_amount: 80.01 as any,
        credit_rate_30: 0,
      })
    );
    expect(
      hasura.executeMutation.mock.calls.find((entry) =>
        String(entry[0]).includes('InsertCreditNote')
      )[1].object.amount
    ).toBe(2);

    hasura.executeMutation.mockClear();
    docNumbers.next.mockClear();
    await service.awardPaymentCredit(
      order({ balance_option: 'FINANCED_60', balance_amount: 500 })
    );
    await service.awardPaymentCredit(
      order({ balance_option: null, balance_amount: 500 })
    );
    await service.awardPaymentCredit(order({ balance_amount: 'nope' as any }));
    await service.awardPaymentCredit(order({ balance_amount: 0 }));
    expect(docNumbers.next).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('does not insert a second credit note for the same order', async () => {
    hasura.executeQuery.mockResolvedValue({
      export_credit_notes: [{ id: 'note-existing' }],
    });
    await service.awardPaymentCredit(order());
    expect(docNumbers.next).not.toHaveBeenCalled();
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('sets financing due from the option length and a zero principal when the balance is missing', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-27T15:00:00.000Z'));
    await service.ensureFinancing(order({ balance_amount: null }), 30, 'fin-1');
    expect(hasura.executeMutation.mock.calls[0][1].object).toEqual(
      expect.objectContaining({
        export_order_id: 'order-1',
        option_days: 30,
        approved: true,
        approved_by: 'fin-1',
        due_date: '2026-12-27',
        principal: 0,
        status: 'active',
      })
    );
    await service.ensureFinancing(order({ balance_amount: 600 }), 60, 'fin-1');
    expect(hasura.executeMutation.mock.calls[1][1].object.due_date).toBe(
      '2027-01-26'
    );
    expect(hasura.executeMutation.mock.calls[1][1].object.principal).toBe(600);
  });

  it('reminds only on day 7, 0, and -7, and still continues after one failure', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-27T15:00:00.000Z'));
    hasura.executeQuery.mockResolvedValue({
      export_financing: [
        {
          id: 'late',
          due_date: '2026-11-20',
          export_order: { bc_number: 'BC-LATE' },
        },
        {
          id: 'soon',
          due_date: '2026-11-26',
          export_order: { bc_number: 'BC-SOON' },
        },
        {
          id: 'today',
          due_date: '2026-11-27',
          export_order: { bc_number: 'BC-TODAY' },
        },
        {
          id: 'week',
          due_date: '2026-12-04',
          export_order: { bc_number: 'BC-WEEK' },
        },
      ],
    });
    hasura.executeMutation.mockRejectedValueOnce(new Error('db down'));
    await service.sendFinancingReminders();
    expect(hasura.executeQuery.mock.calls[0][1]).toEqual({
      from: '2026-11-20',
      to: '2026-12-04',
    });
    const overdue = hasura.executeMutation.mock.calls.filter((entry) =>
      String(entry[0]).includes('overdue')
    );
    expect(overdue).toHaveLength(1);
    expect(overdue[0][1].id).toBe('late');
    const logged = (Logger.prototype.log as jest.Mock).mock.calls
      .map((entry) => String(entry[0]))
      .join(' ');
    expect(logged).toContain('BC-TODAY');
    expect(logged).toContain('BC-WEEK');
    expect(logged).not.toContain('BC-SOON');
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });
});
