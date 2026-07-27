import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import type { MyPVitCallbackDto } from './mobile-payment-callback.dto';

describe('MobilePaymentCallbackProcessor provider confirmation', () => {
  const pendingTokenTx: MobilePaymentTransaction = {
    id: 'tx-uuid-1',
    reference: 'TOK12345678abcd',
    amount: 20000,
    currency: 'XAF',
    description: 'AI token pack pack_5000',
    provider: 'mypvit',
    payment_method: 'mobile_money',
    status: 'pending',
    transaction_id: 'provider-tx-1',
    customer_phone: '+24106123456',
    account_id: undefined,
    transaction_type: 'PAYMENT',
    payment_entity: 'token',
    entity_id: 'business-uuid-1',
    created_at: '2026-07-27T00:00:00.000Z',
    updated_at: '2026-07-27T00:00:00.000Z',
  };

  const successCallback: MyPVitCallbackDto = {
    transactionId: 'attacker-forged-id',
    merchantReferenceId: 'TOK12345678abcd',
    status: 'SUCCESS',
    amount: 20000,
    customerID: '06123456',
    fees: 0,
    chargeOwner: 'MERCHANT',
    transactionOperation: 'PAYMENT',
    operator: 'AIRTEL',
    code: 200,
  };

  function buildProcessor(overrides?: {
    liveStatus?: 'pending' | 'success' | 'failed' | 'cancelled' | 'ambiguous';
    assertImpl?: jest.Mock;
  }) {
    const databaseService = {
      getTransactionByReference: jest.fn().mockResolvedValue(pendingTokenTx),
      logCallback: jest.fn().mockResolvedValue(undefined),
      updateTransaction: jest.fn().mockResolvedValue(undefined),
    };
    const accountsService = {
      registerTransaction: jest.fn(),
    };
    const paymentCallbackRegistry = {
      getHandlers: jest.fn().mockReturnValue([
        {
          supportsPaymentEntity: (e: string) => e === 'token',
          onPaymentSuccess: jest.fn(),
          onPaymentFailure: jest.fn(),
          finalizeCashReconciliationAfterPayment: jest.fn(),
        },
      ]),
    };
    const assertProviderConfirmsCallback =
      overrides?.assertImpl ??
      jest.fn().mockImplementation(async () => {
        if (overrides?.liveStatus && overrides.liveStatus !== 'success') {
          throw new Error(
            `Rejecting SUCCESS callback for ${pendingTokenTx.id}: provider status is ${overrides.liveStatus}`
          );
        }
      });
    const mobilePaymentsService = {
      assertProviderConfirmsCallback,
      checkTransactionStatus: jest.fn(),
      resolveAdminIntegrationProvider: jest.fn().mockReturnValue('mypvit'),
    };

    const processor = new MobilePaymentCallbackProcessor(
      databaseService as any,
      accountsService as any,
      paymentCallbackRegistry as any,
      mobilePaymentsService as any
    );

    return {
      processor,
      databaseService,
      paymentCallbackRegistry,
      assertProviderConfirmsCallback,
    };
  }

  it('rejects forged SUCCESS callbacks when provider does not confirm success', async () => {
    const { processor, databaseService, paymentCallbackRegistry, assertProviderConfirmsCallback } =
      buildProcessor({ liveStatus: 'pending' });

    await expect(
      processor.processMypvitCallback(successCallback)
    ).rejects.toThrow(/provider status is pending/i);

    expect(assertProviderConfirmsCallback).toHaveBeenCalledWith(
      pendingTokenTx,
      'SUCCESS'
    );
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
    expect(
      paymentCallbackRegistry.getHandlers().[0].onPaymentSuccess
    ).not.toHaveBeenCalled();
  });

  it('finalizes token payment only after provider confirms success', async () => {
    const onPaymentSuccess = jest.fn().mockResolvedValue(undefined);
    const { processor, databaseService, paymentCallbackRegistry } = buildProcessor({
      liveStatus: 'success',
    });
    paymentCallbackRegistry.getHandlers.mockReturnValue([
      {
        supportsPaymentEntity: (e: string) => e === 'token',
        onPaymentSuccess,
        onPaymentFailure: jest.fn(),
        finalizeCashReconciliationAfterPayment: jest.fn(),
      },
    ]);

    const result = await processor.processMypvitCallback(successCallback);

    expect(result.transactionId).toBe('attacker-forged-id');
    expect(onPaymentSuccess).toHaveBeenCalledWith(pendingTokenTx);
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      pendingTokenTx.id,
      expect.objectContaining({ status: 'success' })
    );
  });
});
