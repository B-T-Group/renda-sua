import {
  FINALIZE_HANDLER_FAILED,
  MobilePaymentCallbackProcessor,
} from './mobile-payment-callback.processor';
import type { FedaPayCallbackDto } from './mobile-payment-callback.dto';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';

/**
 * FedaPay enters the shared processing-resume path through its own callback.
 * A fresh in-flight row must not move money. FINALIZE_HANDLER_FAILED must
 * resume immediately, and an expired order collect must fail the row and the
 * order (like a decline) without crediting.
 */
const NOW = Date.parse('2026-10-18T10:00:00.000Z');

function updatedAt(ageMs: number): string {
  return new Date(NOW - ageMs).toISOString();
}

function orderTx(
  status: MobilePaymentTransaction['status'],
  ageMs = 70_000
): MobilePaymentTransaction {
  return {
    id: 'tx-order',
    reference: 'ORD1-ref',
    amount: 1500,
    currency: 'XOF',
    description: 'order ORD1',
    provider: 'fedapay',
    payment_method: 'mobile_money',
    status,
    transaction_id: '456',
    customer_phone: '+22890123456',
    account_id: 'acct-client',
    transaction_type: 'PAYMENT',
    payment_entity: 'order',
    entity_id: 'ORD1',
    created_at: '2026-10-18T09:00:00.000Z',
    updated_at: updatedAt(ageMs),
  };
}

function callback(
  status: 'approved' | 'declined' | 'expired',
  name: FedaPayCallbackDto['name']
): FedaPayCallbackDto {
  return {
    entity: {
      id: 456,
      status,
      amount: 1500,
      reference: 'fp-456',
      custom_metadata: { externalId: 'ORD1-ref' },
    },
    name,
  };
}

function build(tx: MobilePaymentTransaction, casWins = true) {
  const row: MobilePaymentTransaction = { ...tx };
  const databaseService = {
    getTransactionByTransactionId: jest.fn(async (key: string) =>
      key === '456' ? { ...row } : null
    ),
    getTransactionByReference: jest.fn(async () => null),
    getTransactionById: jest.fn(async () => ({ ...row })),
    logCallback: jest.fn().mockResolvedValue(undefined),
    updateTransaction: jest.fn(),
    updateTransactionIfStatus: jest.fn(
      async (_id: string, expected: string, data: Record<string, unknown>) => {
        if (!casWins || row.status !== expected) return false;
        Object.assign(row, data, { updated_at: new Date(NOW).toISOString() });
        return true;
      }
    ),
  };
  const accountsService = {
    registerDepositIfNotExists: jest.fn().mockResolvedValue({ success: true }),
    registerReleaseIfNotExists: jest.fn(),
    registerWithdrawalIfNotExists: jest.fn(),
  };
  const handler = {
    supportsPaymentEntity: (entity: string) => entity === 'order',
    onPaymentSuccess: jest.fn().mockResolvedValue(undefined),
    onPaymentFailure: jest.fn().mockResolvedValue(undefined),
    finalizeCashReconciliationAfterPayment: jest.fn(),
  };
  const mobilePaymentsService = {
    assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined),
  };
  const processor = new MobilePaymentCallbackProcessor(
    databaseService as never,
    accountsService as never,
    { getHandlers: () => [handler] } as never,
    mobilePaymentsService as never
  );
  return { row, processor, databaseService, accountsService, handler, mobilePaymentsService };
}

describe('FedaPay processing resume', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not credit a fresh processing row', async () => {
    const t = build(orderTx('processing', 5_000));

    const result = await t.processor.processFedaPayCallback(
      callback('approved', 'transaction.approved')
    );

    expect(result).toEqual({ received: true, transactionId: 456 });
    expect(t.databaseService.logCallback).toHaveBeenCalledWith(
      'tx-order',
      expect.objectContaining({ name: 'transaction.approved' })
    );
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(t.databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
    expect(t.mobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
    expect(t.row.status).toBe('processing');
  });

  it('resumes immediately when the handler already failed', async () => {
    const t = build({
      ...orderTx('processing', 5_000),
      error_code: FINALIZE_HANDLER_FAILED,
    });

    await t.processor.processFedaPayCallback(
      callback('approved', 'transaction.approved')
    );

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
      { status: 'success', transaction_id: '456', error_code: null }
    );
    expect(t.handler.onPaymentSuccess).toHaveBeenCalledTimes(1);
    expect(t.mobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
    expect(t.row.status).toBe('success');
    expect(t.row.error_code).toBeNull();
  });
});

describe('FedaPay terminal failure side effects', () => {
  it('fails an expired order collect like a decline, without crediting', async () => {
    const t = build(orderTx('pending'));

    await t.processor.processFedaPayCallback(
      callback('expired', 'transaction.updated')
    );

    expect(t.mobilePaymentsService.assertProviderConfirmsCallback).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-order' }),
      'FAILED'
    );
    expect(t.databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      'tx-order',
      'pending',
      {
        status: 'failed',
        transaction_id: '456',
        error_message: 'expired',
      }
    );
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    // #597 N2: expiry fails order/deposit/claim rows exactly like a decline.
    expect(t.handler.onPaymentFailure).toHaveBeenCalledTimes(1);
    expect(t.handler.onPaymentFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-order', payment_entity: 'order' }),
      'expired'
    );
    expect(t.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(t.row.status).toBe('failed');
  });

  it('notifies the order when FedaPay declines, and does not credit', async () => {
    const t = build(orderTx('pending'));

    await t.processor.processFedaPayCallback(
      callback('declined', 'transaction.declined')
    );

    expect(t.databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
      'tx-order',
      'pending',
      {
        status: 'failed',
        transaction_id: '456',
        error_message: 'declined',
      }
    );
    expect(t.handler.onPaymentFailure).toHaveBeenCalledTimes(1);
    expect(t.handler.onPaymentFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-order', payment_entity: 'order' }),
      'declined'
    );
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(t.row.status).toBe('failed');
  });

  it('does not fail the order when the declined compare-and-set loses', async () => {
    const t = build(orderTx('pending'), false);

    await t.processor.processFedaPayCallback(
      callback('declined', 'transaction.declined')
    );

    expect(t.handler.onPaymentFailure).not.toHaveBeenCalled();
    expect(t.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(t.accountsService.registerReleaseIfNotExists).not.toHaveBeenCalled();
    expect(t.row.status).toBe('pending');
  });
});
