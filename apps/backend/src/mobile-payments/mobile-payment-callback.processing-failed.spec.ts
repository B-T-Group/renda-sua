import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import type {
  FreemopayCallbackDto,
  MyPVitCallbackDto,
} from './mobile-payment-callback.dto';

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

/**
 * A processing row already claimed the payment (wallet credited, or a GIVE_CHANGE
 * payout sent). A late FAILED callback must not fail the row, reverse the ledger,
 * or release the hold.
 */
describe('MobilePaymentCallbackProcessor FAILED while processing', () => {
  const processingTx = {
    id: 'tx-processing',
    reference: 'ORD1-111-aaaa',
    amount: 600,
    currency: 'XAF',
    description: 'order ORD1',
    provider: 'freemopay',
    payment_method: 'mobile_money',
    status: 'processing',
    transaction_id: 'fmp-a',
    customer_phone: '+237650000099',
    account_id: 'acct-client',
    transaction_type: 'PAYMENT',
    payment_entity: 'order',
    entity_id: 'ORD1',
    created_at: '2026-10-16T10:00:00.000Z',
    updated_at: '2026-10-16T10:00:00.000Z',
  } as MobilePaymentTransaction;

  const freemopayFailed: FreemopayCallbackDto = {
    reference: 'fmp-a',
    status: 'FAILED',
    reason: 'declined',
  };

  const mypvitFailed: MyPVitCallbackDto = {
    transactionId: 'mypvit-a',
    merchantReferenceId: 'ORD1-111-aaaa',
    status: 'FAILED',
    amount: 600,
    customerID: '650000099',
    fees: 0,
    chargeOwner: 'MERCHANT',
    transactionOperation: 'PAYMENT',
    operator: 'AIRTEL',
    code: 200,
  };

  function build(tx: MobilePaymentTransaction) {
    const databaseService = {
      getTransactionByTransactionId: jest.fn().mockResolvedValue(tx),
      getTransactionByReference: jest.fn().mockResolvedValue(tx),
      getTransactionById: jest.fn().mockResolvedValue(tx),
      findMyPVitTransactionByShortReference: jest.fn().mockResolvedValue(null),
      logCallback: jest.fn().mockResolvedValue(undefined),
      updateTransaction: jest.fn(),
      updateTransactionIfStatus: jest.fn().mockResolvedValue(true),
    };
    const accountsService = {
      registerDepositIfNotExists: jest.fn().mockResolvedValue({ success: true }),
      registerReleaseIfNotExists: jest.fn().mockResolvedValue({ success: true }),
      registerWithdrawalIfNotExists: jest.fn().mockResolvedValue({ success: true }),
      hasTransactionForReference: jest.fn().mockResolvedValue(true),
    };
    const handler = {
      supportsPaymentEntity: () => true,
      onPaymentSuccess: jest.fn(),
      onPaymentFailure: jest.fn(),
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
    return { processor, databaseService, accountsService, handler, mobilePaymentsService };
  }

  function expectLeftAlone(built: ReturnType<typeof build>) {
    expect(built.databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
    expect(built.databaseService.updateTransaction).not.toHaveBeenCalled();
    expect(built.accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(built.accountsService.registerReleaseIfNotExists).not.toHaveBeenCalled();
    expect(built.accountsService.registerWithdrawalIfNotExists).not.toHaveBeenCalled();
    expect(built.accountsService.hasTransactionForReference).not.toHaveBeenCalled();
    expect(built.handler.onPaymentFailure).not.toHaveBeenCalled();
    expect(built.handler.onPaymentSuccess).not.toHaveBeenCalled();
    expect(built.mobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
    expect(reportMoneyAnomaly).not.toHaveBeenCalled();
  }

  it('Freemopay order: skips without failing or crediting', async () => {
    const built = build(processingTx);

    await expect(built.processor.processFreemopayCallback(freemopayFailed)).resolves.toEqual({
      received: true,
      reference: 'fmp-a',
      skipped: true,
    });
    expectLeftAlone(built);
  });

  it('MyPVit order: skips without failing or crediting', async () => {
    const built = build({ ...processingTx, provider: 'mypvit' });

    await expect(built.processor.processMypvitCallback(mypvitFailed)).resolves.toMatchObject({
      skipped: true,
      transactionId: 'mypvit-a',
    });
    expectLeftAlone(built);
  });

  it('account top-up: skips without a second deposit', async () => {
    const built = build({
      ...processingTx,
      payment_entity: 'account',
      entity_id: 'acct-client',
      reference: 'RCHG-1',
    });

    await expect(built.processor.processFreemopayCallback(freemopayFailed)).resolves.toMatchObject({
      skipped: true,
    });
    expectLeftAlone(built);
  });

  it('GIVE_CHANGE: skips without releasing the hold or reversing the debit', async () => {
    const built = build({
      ...processingTx,
      transaction_type: 'GIVE_CHANGE',
      payment_entity: 'account',
    });

    await expect(built.processor.processFreemopayCallback(freemopayFailed)).resolves.toMatchObject({
      skipped: true,
    });
    expectLeftAlone(built);
  });
});
