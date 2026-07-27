import { BadRequestException } from '@nestjs/common';
import { AccountRechargeService } from './account-recharge.service';

describe('AccountRechargeService', () => {
  function buildService(options?: {
    paymentResponse?: {
      success: boolean;
      transactionId?: string;
      message?: string;
      errorCode?: string;
      provider?: string;
    };
  }) {
    const createTransaction = jest.fn(async () => ({ id: 'mp-tx-1' }));
    const updateTransaction = jest.fn(async () => undefined);
    const getTransactionById = jest.fn(async () => ({ id: 'mp-tx-1' }));
    const initiatePayment = jest.fn(async () =>
      options?.paymentResponse ?? {
        success: true,
        transactionId: 'provider-1',
        provider: 'freemopay',
        message: 'ok',
      }
    );
    const getProvider = jest.fn(() => 'freemopay');
    const getRendasuaHQUser = jest.fn(async () => ({ id: 'hq-user' }));
    const getAccount = jest.fn(async () => ({ id: 'hq-acct' }));
    const getDepositsByMemoPrefix = jest.fn(async () => []);

    const service = new AccountRechargeService(
      { getRendasuaHQUser, getAccount } as never,
      { initiatePayment, getProvider } as never,
      { createTransaction, updateTransaction, getTransactionById } as never,
      { getDepositsByMemoPrefix } as never
    );

    return {
      service,
      createTransaction,
      updateTransaction,
      initiatePayment,
      getProvider,
      getDepositsByMemoPrefix,
    };
  }

  it('rejects unsupported country codes before creating a payment', async () => {
    const { service, createTransaction, initiatePayment } = buildService();

    await expect(
      service.initiateRecharge({
        countryCode: '1',
        phoneNumber: '4165550100',
        amount: 5000,
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createTransaction).not.toHaveBeenCalled();
    expect(initiatePayment).not.toHaveBeenCalled();
  });

  it('rejects amounts below the 150 XAF minimum', async () => {
    const { service, createTransaction } = buildService();

    await expect(
      service.initiateRecharge({
        countryCode: '237',
        phoneNumber: '670000000',
        amount: 149,
      })
    ).rejects.toThrow(/Minimum recharge amount is 150 XAF/);

    expect(createTransaction).not.toHaveBeenCalled();
  });

  it('records the provider transaction id on successful initiation', async () => {
    const { service, createTransaction, updateTransaction, initiatePayment } =
      buildService();

    const result = await service.initiateRecharge({
      countryCode: '237',
      phoneNumber: '670-000-000',
      amount: 5000,
    });

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: 'XAF',
        customer_phone: '+237670000000',
        account_id: 'hq-acct',
        payment_entity: 'account',
        entity_id: 'hq-acct',
      })
    );
    expect(initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        customerPhone: '+237670000000',
        provider: 'freemopay',
      }),
      expect.stringMatching(/^RCHG/)
    );
    expect(updateTransaction).toHaveBeenCalledWith('mp-tx-1', {
      transaction_id: 'provider-1',
    });
    expect(result.transactionId).toBe('mp-tx-1');
    expect(result.providerTransactionId).toBe('provider-1');
  });

  it('marks the local transaction failed when the provider declines', async () => {
    const { service, updateTransaction } = buildService({
      paymentResponse: {
        success: false,
        message: 'Insufficient funds',
        errorCode: 'INSUFFICIENT_FUNDS',
        provider: 'freemopay',
      },
    });

    const result = await service.initiateRecharge({
      countryCode: '241',
      phoneNumber: '06000000',
      amount: 1000,
    });

    expect(updateTransaction).toHaveBeenCalledWith('mp-tx-1', {
      status: 'failed',
      error_message: 'Insufficient funds',
      error_code: 'INSUFFICIENT_FUNDS',
    });
    expect(result.transactionId).toBe('mp-tx-1');
    expect(result.providerTransactionId).toBeUndefined();
  });

  it('lists only HQ deposits matching the mobile payment memo prefix', async () => {
    const { service, getDepositsByMemoPrefix } = buildService();
    getDepositsByMemoPrefix.mockResolvedValue([
      {
        id: 'dep-1',
        amount: 5000,
        memo: 'Mobile payment deposit',
        created_at: '2026-07-24T00:00:00Z',
        reference_id: 'ref-1',
      },
    ]);

    const rows = await service.listRecentRecharges(10, 0);

    expect(getDepositsByMemoPrefix).toHaveBeenCalledWith(
      'hq-acct',
      'Mobile payment deposit',
      10,
      0
    );
    expect(rows).toHaveLength(1);
  });
});
