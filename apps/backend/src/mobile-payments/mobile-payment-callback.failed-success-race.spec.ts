import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

/**
 * M1 fix: When a FAILED callback races a SUCCESS callback, the payment and order
 * must end up in a consistent final state. The SUCCESS path claims the row (pending
 * -> processing) before crediting the wallet, so only the first writer wins. The
 * FAILED path also uses CAS (pending -> failed), so they are mutually exclusive.
 */
describe('MobilePaymentCallbackProcessor FAILED vs SUCCESS race (M1 money bug)', () => {
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

  /** In-memory row with real CAS semantics. */
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
      onPaymentFailure: jest.fn().mockResolvedValue(undefined),
      finalizeCashReconciliationAfterPayment: jest.fn(),
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
    /** What a racing FAILED callback does: CAS pending -> failed. */
    const failCallback = async () =>
      databaseService.updateTransactionIfStatus('tx-a', 'pending', {
        status: 'failed',
        error_message: 'Payment declined',
      });
    return {
      row,
      processor,
      databaseService,
      accountsService,
      handler,
      failCallback,
    };
  }

  const successCallback = { reference: 'fmp-a', externalId: 'ORD1-111-aaaa', status: 'SUCCESS' } as any;
  const failedCallback = { reference: 'fmp-a', externalId: 'ORD1-111-aaaa', status: 'FAILED', reason: 'declined' } as any;

  it('SUCCESS wins: row ends success, wallet credited, order finalized', async () => {
    const t = build();
    
    await t.processor.processFreemopayCallback(successCallback);
    
    expect(t.row.status).toBe('success');
    expect(t.accountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-client',
        amount: 600,
        idempotencyKey: 'momo-deposit:tx-a',
      })
    );
    expect(t.handler.onPaymentSuccess).toHaveBeenCalledTimes(1);
    expect(t.handler.onPaymentFailure).not.toHaveBeenCalled();

    // Racing FAILED callback loses CAS
    await t.processor.processFreemopayCallback(failedCallback);
    
    // Row stays success, no failure handler
    expect(t.row.status).toBe('success');
    expect(t.handler.onPaymentFailure).not.toHaveBeenCalled();
  });

  it('FAILED wins: row ends failed, no wallet credit, order failed', async () => {
    const t = build();
    
    await t.processor.processFreemopayCallback(failedCallback);
    
    expect(t.row.status).toBe('failed');
    expect(t.row.error_message).toBe('declined');
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(t.handler.onPaymentFailure).toHaveBeenCalledTimes(1);
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();

    // Racing SUCCESS callback loses CAS
    await t.processor.processFreemopayCallback(successCallback);
    
    // Row stays failed, no wallet credit
    expect(t.row.status).toBe('failed');
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
  });

  it('FAILED during wallet credit: CAS ensures no credit happens', async () => {
    const t = build();
    
    // FAILED callback wins the CAS before SUCCESS can claim
    let processingClaimed = false;
    t.databaseService.updateTransactionIfStatus.mockImplementation(async (_id, expected, data) => {
      if (expected === 'pending' && data.status === 'processing') {
        // Try to fail it before we can claim processing
        if (!processingClaimed) {
          processingClaimed = true;
          t.row.status = 'failed';
          t.row.error_message = 'Payment declined';
          return false; // CAS fails
        }
      }
      if (t.row.status !== expected) return false;
      Object.assign(t.row, data);
      return true;
    });

    // Process both callbacks - FAILED should win
    await t.failCallback();
    await t.processor.processFreemopayCallback(successCallback);
    
    // The SUCCESS callback's CAS fails (pending -> processing), so no credit
    expect(t.row.status).toBe('failed');
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
  });

  it('SUCCESS during FAILED processing: CAS ensures consistent final state', async () => {
    const t = build();
    let successClaimed = false;
    
    // SUCCESS callback wins the CAS during FAILED processing
    t.handler.onPaymentFailure.mockImplementationOnce(async () => {
      // Reset to pending to simulate race
      t.row.status = 'pending';
      await t.processor.processFreemopayCallback(successCallback);
      successClaimed = true;
    });

    await t.processor.processFreemopayCallback(failedCallback);
    
    // If SUCCESS won, row is success with credit; if FAILED won, row is failed without credit
    expect(successClaimed).toBe(true);
    expect(t.row.status).toBe('success');
    expect(t.accountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'momo-deposit:tx-a' })
    );
  });

  it('non-order payment: FAILED vs SUCCESS race is also consistent', async () => {
    const nonOrderTx = {
      ...pendingTx,
      payment_entity: 'account' as const,
    };
    const t = build();
    t.row.payment_entity = 'account';
    t.databaseService.getTransactionByTransactionId.mockResolvedValue(nonOrderTx);
    t.databaseService.getTransactionByReference.mockResolvedValue(nonOrderTx);
    
    // FAILED wins
    await t.processor.processFreemopayCallback(failedCallback);
    
    expect(t.row.status).toBe('failed');
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();

    // SUCCESS loses
    await t.processor.processFreemopayCallback(successCallback);
    
    expect(t.row.status).toBe('failed');
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
  });
});
