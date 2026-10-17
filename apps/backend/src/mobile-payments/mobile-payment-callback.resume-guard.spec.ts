import { BadRequestException, HttpException } from '@nestjs/common';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

/**
 * #570/#571 leftovers. A processing row younger than 60s is not resumed and is
 * not acknowledged. A failed resume credit stays processing, a handler 4xx is
 * still a retryable error with updated_at old enough to resume, and a FAILED
 * give-change releases the hold with the success-path idempotency key.
 */
const NOW = Date.parse('2026-10-17T10:00:00.000Z');
const RETRY_MESSAGE = 'Payment handler failed for order ORD1; will retry';

const successCallback = {
  reference: 'fmp-order',
  externalId: 'ORD1-ref',
  status: 'SUCCESS' as const,
};

function updatedAt(ageMs: number): string {
  return new Date(NOW - ageMs).toISOString();
}

function orderTx(status: MobilePaymentTransaction['status'], ageMs: number): MobilePaymentTransaction {
  return {
    id: 'tx-order',
    reference: 'ORD1-ref',
    amount: 1500,
    currency: 'XAF',
    description: 'order ORD1',
    provider: 'freemopay',
    payment_method: 'mobile_money',
    status,
    transaction_id: 'fmp-order',
    customer_phone: '+237650000099',
    account_id: 'acct-client',
    transaction_type: 'PAYMENT',
    payment_entity: 'order',
    entity_id: 'ORD1',
    created_at: '2026-10-17T09:00:00.000Z',
    updated_at: updatedAt(ageMs),
  };
}

function buildOrder(tx: MobilePaymentTransaction, loseRestore = false) {
  const row: MobilePaymentTransaction = { ...tx };
  const databaseService = {
    getTransactionByTransactionId: jest.fn(async () => ({ ...row })),
    getTransactionByReference: jest.fn(async () => ({ ...row })),
    getTransactionById: jest.fn(async () => ({ ...row })),
    logCallback: jest.fn().mockResolvedValue(undefined),
    updateTransaction: jest.fn(),
    updateTransactionIfStatus: jest.fn(async (_id: string, expected: string, data: any) => {
      if (loseRestore && expected === 'success' && data.status === 'processing') {
        return false;
      }
      if (row.status !== expected) return false;
      Object.assign(row, data);
      return true;
    }),
  };
  const accountsService = {
    registerDepositIfNotExists: jest.fn().mockResolvedValue({ success: true }),
  };
  const handler = {
    supportsPaymentEntity: (entity: string) => entity === 'order',
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
  return { row, processor, databaseService, accountsService, handler, mobilePaymentsService };
}

async function catchError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error: any) {
    return error;
  }
  throw new Error('expected the callback to reject');
}

describe('MobilePaymentCallbackProcessor resume guard (#570 #571)', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    (reportMoneyAnomaly as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('a processing order younger than 60s does not credit, finalize, or acknowledge', async () => {
    // 59_999ms rounds to "60s" in the log; the guard compares milliseconds.
    const t = buildOrder(orderTx('processing', 59_999));

    const error = await catchError(() => t.processor.processFreemopayCallback(successCallback));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(HttpException);
    expect((error as Error).message).toBe(
      'Payment finalize still in progress for tx-order; will retry'
    );
    expect(t.databaseService.logCallback).toHaveBeenCalledWith('tx-order', successCallback);
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(t.databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
    expect(t.mobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
    expect(t.row.status).toBe('processing');
  });

  it('a processing order updated in the future does not credit, finalize, or acknowledge', async () => {
    const t = buildOrder(orderTx('processing', -5_000));

    const error = await catchError(() => t.processor.processFreemopayCallback(successCallback));

    expect((error as Error).message).toBe(
      'Payment finalize still in progress for tx-order; will retry'
    );
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(t.databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
    expect(t.row.status).toBe('processing');
  });

  it('a processing order aged exactly 60s resumes credit and the order handler', async () => {
    const t = buildOrder(orderTx('processing', 60_000));

    await t.processor.processFreemopayCallback(successCallback);

    expect(t.accountsService.registerDepositIfNotExists).toHaveBeenCalledTimes(1);
    expect(t.accountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-client',
        amount: 1500,
        referenceId: 'tx-order',
        idempotencyKey: 'momo-deposit:tx-order',
        skipCashAdvanceRepayment: true,
      })
    );
    expect(t.databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      'tx-order',
      'processing',
      { status: 'success', transaction_id: 'fmp-order' }
    );
    expect(t.handler.onPaymentSuccess).toHaveBeenCalledTimes(1);
    expect(t.mobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
    expect(t.row.status).toBe('success');
  });

  it('a failed resume credit stays processing and does not run the order handler', async () => {
    const t = buildOrder(orderTx('processing', 70_000));
    t.accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: false,
      error: 'ledger down',
    });

    const error = await catchError(() => t.processor.processFreemopayCallback(successCallback));

    expect((error as Error).message).toBe(
      'Wallet credit failed while resuming tx-order; leaving processing for recovery'
    );
    expect(t.databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(t.row.status).toBe('processing');
  });

  it('a 4xx from the order handler on resume is a retryable error and restores processing', async () => {
    const t = buildOrder(orderTx('processing', 70_000));
    t.handler.onPaymentSuccess.mockRejectedValue(
      new BadRequestException('Order already complete')
    );

    const error = await catchError(() => t.processor.processFreemopayCallback(successCallback));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(HttpException);
    expect((error as Error).message).toBe(RETRY_MESSAGE);
    expect(typeof (error as { getStatus?: unknown }).getStatus).toBe('undefined');
    expect(t.databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      'tx-order',
      'success',
      expect.objectContaining({ status: 'processing' })
    );
    expect(NOW - Date.parse(t.row.updated_at)).toBeGreaterThanOrEqual(60_000);
    expect(t.accountsService.registerDepositIfNotExists).toHaveBeenCalledTimes(1);
    expect(t.row.status).toBe('processing');
  });

  it('a lost success-to-processing restore still rejects without leaking the 4xx', async () => {
    const t = buildOrder(orderTx('pending', 70_000), true);
    t.handler.onPaymentSuccess.mockRejectedValue(
      new BadRequestException('Order already complete')
    );

    const error = await catchError(() => t.processor.processFreemopayCallback(successCallback));

    expect(error).not.toBeInstanceOf(HttpException);
    expect((error as Error).message).toBe(RETRY_MESSAGE);
    expect(t.row.status).toBe('success');
    expect(t.databaseService.updateTransactionIfStatus).not.toHaveBeenCalledWith(
      'tx-order',
      'processing',
      { status: 'pending' }
    );

    const replay = await t.processor.processFreemopayCallback(successCallback);

    expect(replay).toMatchObject({ received: true, skipped: true });
    expect(t.handler.onPaymentSuccess).toHaveBeenCalledTimes(2);
    expect(t.accountsService.registerDepositIfNotExists).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ idempotencyKey: 'momo-deposit:tx-order' })
    );
    expect(t.accountsService.registerDepositIfNotExists).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ idempotencyKey: 'momo-deposit:tx-order' })
    );
    expect(t.row.status).toBe('success');
    expect(reportMoneyAnomaly).toHaveBeenCalledWith(
      expect.anything(),
      'payment_finalize_failed',
      expect.stringContaining('(replay)'),
      expect.objectContaining({ replay: true, transactionId: 'tx-order' })
    );
  });
});

describe('MobilePaymentCallbackProcessor GIVE_CHANGE failed release key', () => {
  it('FAILED releases the hold with the success-path idempotency key and does not withdraw', async () => {
    const tx: MobilePaymentTransaction = {
      id: 'tx-give',
      reference: 'GC-FAIL-1',
      amount: 5000,
      currency: 'XAF',
      description: 'give change',
      provider: 'mypvit',
      payment_method: 'mobile_money',
      status: 'pending',
      transaction_id: 'provider-give-1',
      account_id: 'acct-business',
      transaction_type: 'GIVE_CHANGE',
      payment_entity: 'order',
      entity_id: 'ORD1',
      created_at: '2026-10-17T09:00:00.000Z',
      updated_at: '2026-10-17T09:00:00.000Z',
    };
    const accountsService = {
      registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true }),
      registerWithdrawalIfNotExists: jest.fn(),
      registerDepositIfNotExists: jest.fn(),
      hasTransactionForReference: jest.fn().mockResolvedValue(false),
    };
    const databaseService = {
      getTransactionByReference: jest.fn().mockResolvedValue(tx),
      logCallback: jest.fn().mockResolvedValue(undefined),
      updateTransactionIfStatus: jest.fn().mockResolvedValue(true),
      getTransactionById: jest.fn().mockResolvedValue(tx),
    };
    const processor = new MobilePaymentCallbackProcessor(
      databaseService as any,
      accountsService as any,
      { getHandlers: () => [] } as any,
      { assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined) } as any
    );

    await processor.processMypvitCallback({
      transactionId: 'provider-give-1',
      merchantReferenceId: 'GC-FAIL-1',
      status: 'FAILED',
      amount: 5000,
      customerID: '+237600000000',
      fees: 0,
      chargeOwner: 'MERCHANT',
      transactionOperation: 'PAYOUT',
      operator: 'MTN',
      code: 200,
    });

    expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalledWith({
      accountId: 'acct-business',
      amount: 5000,
      referenceId: 'tx-give',
      memo: 'GIVE_CHANGE release - GC-FAIL-1',
      idempotencyKey: 'momo-giveout-release:tx-give',
    });
    expect(accountsService.registerWithdrawalIfNotExists).not.toHaveBeenCalled();
    expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
  });
});
