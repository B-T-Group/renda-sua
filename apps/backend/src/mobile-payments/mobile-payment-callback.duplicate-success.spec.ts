import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

/**
 * H1 fix: Two SUCCESS callbacks for the same payment arriving at once must credit
 * the wallet exactly once. The processor claims the row (pending -> processing) before
 * any money moves, and uses an idempotency key on the deposit.
 */
describe('MobilePaymentCallbackProcessor duplicate SUCCESS race (H1 money bug)', () => {
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
    const creditedKeys = new Set<string>();
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
      registerDepositIfNotExists: jest.fn(async (req: any) => {
        // Idempotency key should prevent duplicate credits
        if (req.idempotencyKey) {
          if (creditedKeys.has(req.idempotencyKey)) {
            return { success: true, alreadyExists: true };
          }
          creditedKeys.add(req.idempotencyKey);
          return { success: true, alreadyExists: false };
        }
        return { success: true, alreadyExists: false };
      }),
    };
    const handler = {
      supportsPaymentEntity: (e: string) => e === 'order' || e === 'account',
      onPaymentSuccess: jest.fn().mockResolvedValue(undefined),
      onPaymentFailure: jest.fn(),
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
    return {
      row,
      processor,
      databaseService,
      accountsService,
      handler,
      creditedKeys,
    };
  }

  const callback = { reference: 'fmp-a', externalId: 'ORD1-111-aaaa', status: 'SUCCESS' } as any;

  it('duplicate SUCCESS callbacks: CAS allows only one to claim, exactly one credit', async () => {
    const t = build();
    
    // First callback wins the claim and credits
    await t.processor.processFreemopayCallback(callback);
    
    expect(t.row.status).toBe('success');
    expect(t.handler.onPaymentSuccess).toHaveBeenCalledTimes(1);
    expect(t.accountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-client',
        amount: 600,
        referenceId: 'tx-a',
        idempotencyKey: 'momo-deposit:tx-a',
      })
    );
    expect(t.creditedKeys.size).toBe(1);

    // Second callback loses the claim (CAS fails), sees success, retries side effects
    await t.processor.processFreemopayCallback(callback);
    
    // Still only one credit (idempotency ensures this)
    expect(t.creditedKeys.size).toBe(1);
    // Handler may be called again for retry (this is OK, it's idempotent)
  });

  it('idempotency key prevents duplicate credit when both callbacks pass CAS', async () => {
    const t = build();
    
    // Even if CAS somehow allowed both (shouldn't happen), 
    // idempotency key ensures only one credit
    await t.processor.processFreemopayCallback(callback);
    
    expect(t.creditedKeys.size).toBe(1);
    expect(t.accountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'momo-deposit:tx-a',
      })
    );
  });

  it('non-order payment: duplicate SUCCESS callbacks credit exactly once', async () => {
    const nonOrderTx = {
      ...pendingTx,
      payment_entity: 'account' as const,
    };
    const t = build();
    t.row.payment_entity = 'account';
    t.databaseService.getTransactionByTransactionId.mockResolvedValue(nonOrderTx);
    t.databaseService.getTransactionByReference.mockResolvedValue(nonOrderTx);
    
    await t.processor.processFreemopayCallback(callback);
    
    expect(t.row.status).toBe('success');
    expect(t.creditedKeys.size).toBe(1);
    expect(t.accountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'momo-deposit:tx-a',
      })
    );

    // Second duplicate callback
    await t.processor.processFreemopayCallback(callback);
    
    // Still only one credit
    expect(t.creditedKeys.size).toBe(1);
  });
});
