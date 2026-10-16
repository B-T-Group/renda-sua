import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

/**
 * #545 QA F2: a client retry superseding the attempt while its SUCCESS callback is
 * being processed. The success write must be conditional on 'pending' and a row the
 * retry already superseded must go to the late-success handler, never be overwritten.
 */
describe('MobilePaymentCallbackProcessor order success vs retry race (#545 F2)', () => {
  const pendingTx: MobilePaymentTransaction = {
    id: 'tx-a',
    reference: 'ORD1-111-aaaa',
    amount: 600,
    currency: 'XAF',
    description: 'order ORD1',
    provider: 'freemopay',
    payment_method: 'mobile_money',
    status: 'pending',
    transaction_id: 'fmp-a',
    customer_phone: '+237650000099',
    account_id: 'acct-client',
    transaction_type: 'PAYMENT',
    payment_entity: 'order',
    entity_id: 'ORD1',
    created_at: '2026-10-12T10:00:00.000Z',
    updated_at: '2026-10-12T10:00:00.000Z',
  };

  /** In-memory row with real CAS semantics, so the interleaving is reproduced. */
  function build() {
    const row: any = { ...pendingTx };
    const databaseService = {
      getTransactionByTransactionId: jest.fn(async () => ({ ...pendingTx })),
      getTransactionByReference: jest.fn(async () => ({ ...pendingTx })),
      getTransactionById: jest.fn(async () => ({ ...row })),
      logCallback: jest.fn().mockResolvedValue(undefined),
      updateTransaction: jest.fn(async (_id: string, data: any) => Object.assign(row, data)),
      updateTransactionIfStatus: jest.fn(async (_id: string, expected: string, data: any) => {
        if (row.status !== expected) return false;
        Object.assign(row, data);
        return true;
      }),
    };
    const accountsService = {
      registerDepositIfNotExists: jest.fn().mockResolvedValue({ success: true }),
    };
    const handler = {
      supportsPaymentEntity: (e: string) => e === 'order',
      onPaymentSuccess: jest.fn().mockResolvedValue(undefined),
      onPaymentFailure: jest.fn(),
      finalizeCashReconciliationAfterPayment: jest.fn(),
      onLateSuccessAfterSupersede: jest.fn().mockResolvedValue('applied'),
    };
    const mobilePaymentsService = {
      assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new MobilePaymentCallbackProcessor(
      databaseService as any,
      accountsService as any,
      { getHandlers: () => [handler] } as any,
      mobilePaymentsService as any
    );
    /** What a racing retry does: CAS pending -> cancelled/SUPERSEDED_BY_RETRY. */
    const retrySupersede = () =>
      databaseService.updateTransactionIfStatus('tx-a', 'pending', {
        status: 'cancelled',
        error_code: 'SUPERSEDED_BY_RETRY',
        superseded_reason: 'resend_after_min_age',
      });
    return {
      row,
      processor,
      databaseService,
      accountsService,
      handler,
      retrySupersede,
      mobilePaymentsService,
    };
  }

  const callback = { reference: 'fmp-a', externalId: 'ORD1-111-aaaa', status: 'SUCCESS' } as any;

  beforeEach(() => (reportMoneyAnomaly as jest.Mock).mockClear());

  it('retry supersedes while the wallet is being credited -> late-success handler, row not overwritten', async () => {
    const t = build();
    // Track call order
    let firstCasDone = false;
    let secondCasAttempted = false;
    
    t.databaseService.updateTransactionIfStatus.mockImplementation(async (_id, expected, data) => {
      // First CAS: pending -> processing (succeeds)
      if (expected === 'pending' && data.status === 'processing' && !firstCasDone) {
        t.row.status = 'processing';
        firstCasDone = true;
        return true;
      }
      // Second CAS: processing -> success (fails because row is now cancelled)
      if (expected === 'processing' && data.status === 'success') {
        secondCasAttempted = true;
        // Row is now cancelled, so CAS fails
        return false;
      }
      // Other CAS operations
      if (t.row.status !== expected) return false;
      Object.assign(t.row, data);
      return true;
    });
    
    // During wallet credit, the retry supersedes
    t.accountsService.registerDepositIfNotExists.mockImplementationOnce(async () => {
      if (firstCasDone) {
        t.row.status = 'cancelled';
        t.row.error_code = 'SUPERSEDED_BY_RETRY';
      }
      return { success: true };
    });

    await t.processor.processFreemopayCallback(callback);

    expect(secondCasAttempted).toBe(true);
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(t.handler.onLateSuccessAfterSupersede).toHaveBeenCalledTimes(1);
    expect(t.row).toMatchObject({ status: 'success', error_code: 'LATE_SUCCESS_APPLIED' });
  });

  it('callback claims first -> the racing retry CAS fails (no supersede, no new prompt)', async () => {
    const t = build();
    let retryWon: boolean | undefined;
    t.handler.onPaymentSuccess.mockImplementationOnce(async () => {
      retryWon = await t.retrySupersede();
    });

    await t.processor.processFreemopayCallback(callback);

    expect(retryWon).toBe(false);
    expect(t.row).toMatchObject({ status: 'success' });
    expect(t.row.error_code).toBeUndefined();
    expect(t.handler.onLateSuccessAfterSupersede).not.toHaveBeenCalled();
  });

  it('finalize throws -> row stays in processing for recovery (no rollback after credit)', async () => {
    const t = build();
    // Mark the row as processing when the claim succeeds, and as success when marked
    let processingSet = false;
    t.databaseService.updateTransactionIfStatus.mockImplementation(async (_id, expected, data) => {
      if (expected === 'pending' && data.status === 'processing') {
        t.row.status = 'processing';
        processingSet = true;
        return true;
      }
      if (expected === 'processing' && data.status === 'success') {
        t.row.status = 'success';
        return true;
      }
      if (t.row.status !== expected) return false;
      Object.assign(t.row, data);
      return true;
    });
    t.handler.onPaymentSuccess.mockRejectedValueOnce(new Error('hold failed'));
    await expect(t.processor.processFreemopayCallback(callback)).rejects.toThrow('Payment handler failed for order ORD1; will retry');
    expect(processingSet).toBe(true);
    expect(t.row.status).toBe('processing');
  });

  it('handler failure stays processing so the next SUCCESS finalizes the order', async () => {
    const t = build();
    t.databaseService.getTransactionByTransactionId.mockImplementation(async () => ({ ...t.row }));
    t.databaseService.getTransactionByReference.mockImplementation(async () => ({ ...t.row }));
    t.handler.onPaymentSuccess
      .mockRejectedValueOnce(new Error('hold failed'))
      .mockResolvedValueOnce(undefined);

    await expect(t.processor.processFreemopayCallback(callback)).rejects.toThrow('Payment handler failed for order ORD1; will retry');
    expect(t.row.status).toBe('processing');

    await t.processor.processFreemopayCallback(callback);

    expect(t.handler.onPaymentSuccess).toHaveBeenCalledTimes(2);
    expect(t.row.status).toBe('success');
  });

  it('row moved to failed meanwhile -> money stays in wallet and an anomaly is reported', async () => {
    const t = build();
    // The CAS to claim processing fails because the row was already moved to failed
    t.databaseService.updateTransactionIfStatus.mockImplementation(async (_id, expected, data) => {
      if (expected === 'pending' && data.status === 'processing') {
        // Row was already moved to failed
        return false;
      }
      if (t.row.status !== expected) return false;
      Object.assign(t.row, data);
      return true;
    });
    t.accountsService.registerDepositIfNotExists.mockImplementationOnce(async () => {
      t.row.status = 'failed';
      return { success: true };
    });
    await t.processor.processFreemopayCallback(callback);
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.anything(),
      'payment_finalize_failed',
      expect.stringContaining('non-pending row'),
      expect.anything()
    );
  });

  it('retry supersedes during FAILED live-check -> row stays cancelled, order not failed', async () => {
    const t = build();
    const failed = { ...callback, status: 'FAILED' as const, reason: 'expired' };
    t.mobilePaymentsService.assertProviderConfirmsCallback.mockImplementation(
      async () => {
        await t.retrySupersede();
      }
    );

    await t.processor.processFreemopayCallback(failed);

    expect(t.row).toMatchObject({
      status: 'cancelled',
      error_code: 'SUPERSEDED_BY_RETRY',
    });
    expect(t.handler.onPaymentFailure).not.toHaveBeenCalled();
    expect(t.databaseService.updateTransaction).not.toHaveBeenCalledWith(
      'tx-a',
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('FAILED callback still closes a live pending attempt', async () => {
    const t = build();
    const failed = { ...callback, status: 'FAILED' as const, reason: 'declined' };

    await t.processor.processFreemopayCallback(failed);

    expect(t.row).toMatchObject({ status: 'failed', error_message: 'declined' });
    expect(t.handler.onPaymentFailure).toHaveBeenCalledTimes(1);
  });

  it('poll marks PROVIDER_TERMINAL_ON_RETRY during the credit -> late success, no anomaly', async () => {
    const t = build();
    // Track call order
    let firstCasDone = false;
    let secondCasAttempted = false;
    
    t.databaseService.updateTransactionIfStatus.mockImplementation(async (_id, expected, data) => {
      // First CAS: pending -> processing (succeeds)
      if (expected === 'pending' && data.status === 'processing' && !firstCasDone) {
        t.row.status = 'processing';
        firstCasDone = true;
        return true;
      }
      // Second CAS: processing -> success (fails because row is now failed)
      if (expected === 'processing' && data.status === 'success') {
        secondCasAttempted = true;
        // Row is now failed, so CAS fails
        return false;
      }
      // Other CAS operations
      if (t.row.status !== expected) return false;
      Object.assign(t.row, data);
      return true;
    });
    
    // During wallet credit, the poll marks it failed
    t.accountsService.registerDepositIfNotExists.mockImplementationOnce(async () => {
      if (firstCasDone) {
        t.row.status = 'failed';
        t.row.error_code = 'PROVIDER_TERMINAL_ON_RETRY';
      }
      return { success: true };
    });

    await t.processor.processFreemopayCallback(callback);

    expect(secondCasAttempted).toBe(true);
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(t.handler.onLateSuccessAfterSupersede).toHaveBeenCalledTimes(1);
    expect(t.row).toMatchObject({ status: 'success', error_code: 'LATE_SUCCESS_APPLIED' });
    expect(reportMoneyAnomaly).not.toHaveBeenCalled();
  });
});
