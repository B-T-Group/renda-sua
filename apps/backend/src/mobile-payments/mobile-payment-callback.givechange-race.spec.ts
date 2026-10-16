import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';

/**
 * Race test: 3 parallel SUCCESS callbacks on a GIVE_CHANGE payout must produce
 * exactly 1 hold release and 1 withdrawal (QA NEW-1, post #567/#570).
 *
 * The hold release and withdrawal are both keyed with idempotency keys:
 * - Release: momo-giveout-release:<tx id>
 * - Withdrawal: momo-giveout:<tx id>
 *
 * The resume path guards against fresh processing rows (updated_at < 60s ago),
 * so only stale processing rows are resumed.
 */
describe('MobilePaymentCallbackProcessor GIVE_CHANGE parallel SUCCESS race', () => {
  const pendingGiveChange: MobilePaymentTransaction = {
    id: 'tx-givechange',
    reference: 'GC-123',
    amount: 5000,
    currency: 'XAF',
    description: 'give change',
    provider: 'freemopay',
    payment_method: 'mobile_money',
    status: 'pending',
    transaction_id: 'fmp-gc',
    customer_phone: '+237650000099',
    account_id: 'acct-business',
    transaction_type: 'GIVE_CHANGE',
    payment_entity: 'order',
    entity_id: 'ORD1',
    created_at: '2026-10-16T10:00:00.000Z',
    updated_at: '2026-10-16T10:00:00.000Z',
  };

  function build() {
    const row: any = { ...pendingGiveChange };
    let releaseCallCount = 0;
    let withdrawalCallCount = 0;

    const databaseService = {
      getTransactionByTransactionId: jest.fn(async () => ({ ...pendingGiveChange })),
      getTransactionByReference: jest.fn(async () => ({ ...pendingGiveChange })),
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
      registerReleaseIfNotExists: jest.fn(async (req: any) => {
        releaseCallCount++;
        // Idempotency: second call with same key returns alreadyExists
        if (releaseCallCount > 1 && req.idempotencyKey) {
          return { success: true, alreadyExists: true };
        }
        return { success: true };
      }),
      registerWithdrawalIfNotExists: jest.fn(async (req: any) => {
        withdrawalCallCount++;
        // Idempotency: second call with same key returns alreadyExists
        if (withdrawalCallCount > 1 && req.idempotencyKey) {
          return { success: true, alreadyExists: true };
        }
        return { success: true };
      }),
    };

    const handler = {
      supportsPaymentEntity: (e: string) => e === 'order',
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
      mobilePaymentsService,
      getCounts: () => ({ releaseCallCount, withdrawalCallCount }),
    };
  }

  const callback = { reference: 'fmp-gc', externalId: 'GC-123', status: 'SUCCESS' } as any;

  it('3 parallel SUCCESS callbacks on GIVE_CHANGE -> exactly 1 release + 1 withdrawal', async () => {
    const t = build();

    // Simulate 3 parallel callbacks arriving at the same time
    // Only the first one should claim pending -> processing
    // The other two should see processing and skip (staleness check)
    let claimWinner = false;

    t.databaseService.updateTransactionIfStatus.mockImplementation(async (_id, expected, data) => {
      // First CAS: pending -> processing (only first callback wins)
      if (expected === 'pending' && data.status === 'processing' && !claimWinner) {
        t.row.status = 'processing';
        t.row.updated_at = new Date().toISOString();
        claimWinner = true;
        return true;
      }
      // Subsequent attempts lose the CAS
      if (expected === 'pending' && data.status === 'processing') {
        return false;
      }
      // processing -> success
      if (expected === 'processing' && data.status === 'success') {
        t.row.status = 'success';
        t.row.transaction_id = data.transaction_id;
        return true;
      }
      return false;
    });

    // Fire 3 parallel callbacks
    const results = await Promise.allSettled([
      t.processor.processFreemopayCallback(callback, {} as any),
      t.processor.processFreemopayCallback(callback, {} as any),
      t.processor.processFreemopayCallback(callback, {} as any),
    ]);

    // All should succeed (or skip)
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);

    // Verify exactly 1 release call
    const { releaseCallCount, withdrawalCallCount } = t.getCounts();
    expect(releaseCallCount).toBe(1);
    expect(withdrawalCallCount).toBe(1);

    // Verify the idempotency keys were passed
    expect(t.accountsService.registerReleaseIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'momo-giveout-release:tx-givechange',
      })
    );
    expect(t.accountsService.registerWithdrawalIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'momo-giveout:tx-givechange',
      })
    );
  });

  it('3 parallel SUCCESS on processing row (resume path) -> staleness guard prevents double release', async () => {
    const t = build();
    // Start in processing state with fresh updated_at (< 60s ago)
    t.row.status = 'processing';
    t.row.updated_at = new Date().toISOString();

    t.databaseService.updateTransactionIfStatus.mockResolvedValue(false);

    // Fire 3 parallel callbacks on a processing row
    const results = await Promise.allSettled([
      t.processor.processFreemopayCallback(callback, {} as any),
      t.processor.processFreemopayCallback(callback, {} as any),
      t.processor.processFreemopayCallback(callback, {} as any),
    ]);

    // All should succeed (staleness check returns early)
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);

    // No wallet operations because the row is too fresh
    const { releaseCallCount, withdrawalCallCount } = t.getCounts();
    expect(releaseCallCount).toBe(0);
    expect(withdrawalCallCount).toBe(0);
  });

  it('SUCCESS on stale processing row (crash recovery) -> resume completes', async () => {
    const t = build();
    // Start in processing state with stale updated_at (> 60s ago)
    const staleTime = new Date(Date.now() - 70_000).toISOString();
    t.row.status = 'processing';
    t.row.updated_at = staleTime;

    // Ensure lookups return the stale processing row
    t.databaseService.getTransactionByTransactionId.mockResolvedValue({ ...t.row });
    t.databaseService.getTransactionByReference.mockResolvedValue({ ...t.row });
    t.databaseService.getTransactionById.mockResolvedValue({ ...t.row });

    t.databaseService.updateTransactionIfStatus.mockImplementation(async (_id, expected, data) => {
      if (expected === 'processing' && data.status === 'success') {
        t.row.status = 'success';
        t.row.transaction_id = data.transaction_id;
        t.row.updated_at = new Date().toISOString();
        return true;
      }
      return false;
    });

    await t.processor.processFreemopayCallback(callback, {} as any);

    // Wallet operations should complete (stale row, resume path)
    const { releaseCallCount, withdrawalCallCount } = t.getCounts();
    expect(releaseCallCount).toBe(1);
    expect(withdrawalCallCount).toBe(1);
    expect(t.row.status).toBe('success');
  });
});
