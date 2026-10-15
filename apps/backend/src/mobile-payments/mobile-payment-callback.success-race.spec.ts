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
    // The retry wins its CAS between our pending read and our claim.
    t.accountsService.registerDepositIfNotExists.mockImplementationOnce(async () => {
      await t.retrySupersede();
      return { success: true };
    });

    await t.processor.processFreemopayCallback(callback);

    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(t.handler.onLateSuccessAfterSupersede).toHaveBeenCalledTimes(1);
    expect(t.row).toMatchObject({ status: 'success', error_code: 'LATE_SUCCESS_APPLIED' });
    // Never the old unconditional overwrite.
    expect(t.databaseService.updateTransaction).not.toHaveBeenCalledWith(
      'tx-a',
      expect.objectContaining({ status: 'success' })
    );
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

  it('finalize throws -> claim released to pending so the provider retry reruns the path', async () => {
    const t = build();
    t.handler.onPaymentSuccess.mockRejectedValueOnce(new Error('hold failed'));
    await expect(t.processor.processFreemopayCallback(callback)).rejects.toThrow('hold failed');
    expect(t.row.status).toBe('pending');
  });

  it('row moved to failed meanwhile -> money stays in wallet and an anomaly is reported', async () => {
    const t = build();
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
    t.accountsService.registerDepositIfNotExists.mockImplementationOnce(async () => {
      t.row.status = 'failed';
      t.row.error_code = 'PROVIDER_TERMINAL_ON_RETRY';
      return { success: true };
    });

    await t.processor.processFreemopayCallback(callback);

    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(t.handler.onLateSuccessAfterSupersede).toHaveBeenCalledTimes(1);
    expect(t.row).toMatchObject({ status: 'success', error_code: 'LATE_SUCCESS_APPLIED' });
    expect(reportMoneyAnomaly).not.toHaveBeenCalled();
  });
});
