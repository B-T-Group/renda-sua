import { HttpException, HttpStatus } from '@nestjs/common';
import { MobilePaymentsController } from './mobile-payments.controller';

describe('MobilePaymentsController GIVE_CHANGE withdraw gates', () => {
  const ctx = {} as never;
  let controller: MobilePaymentsController;
  let mobilePaymentsService: {
    isWithdrawalDestinationCmOrGa: jest.Mock;
    resolveProviderFromRequest: jest.Mock;
  };
  let accountsService: {
    getAccountBalance: jest.Mock;
    getBusinessWithdrawalPinStateByAccountId: jest.Mock;
  };
  let giveChangePayoutService: {
    executeGiveChangePayout: jest.Mock;
  };

  beforeEach(() => {
    mobilePaymentsService = {
      isWithdrawalDestinationCmOrGa: jest.fn().mockReturnValue(true),
      resolveProviderFromRequest: jest.fn().mockReturnValue('freemopay'),
    };
    accountsService = {
      getAccountBalance: jest.fn().mockResolvedValue({
        availableBalance: 5000,
        currency: 'XAF',
      }),
      getBusinessWithdrawalPinStateByAccountId: jest.fn().mockResolvedValue(null),
    };
    giveChangePayoutService = {
      executeGiveChangePayout: jest.fn().mockResolvedValue({
        success: true,
        data: { transactionId: 'tx-1' },
      }),
    };

    controller = new MobilePaymentsController(
      mobilePaymentsService as never,
      {} as never,
      accountsService as never,
      giveChangePayoutService as never,
      { getUser: jest.fn().mockResolvedValue({ id: 'user-1' }) } as never,
      {} as never,
      {} as never
    );
  });

  const withdrawRequest = {
    amount: 200,
    currency: 'XAF',
    description: 'Wallet withdrawal',
    customerPhone: '+237670000000',
    accountId: 'acct-1',
    transactionType: 'GIVE_CHANGE' as const,
    provider: 'freemopay' as const,
    paymentMethod: 'mobile_money' as const,
  };

  async function expectHttpError(
    run: () => Promise<unknown>
  ): Promise<HttpException> {
    try {
      await run();
    } catch (caught: any) {
      expect(caught).toBeInstanceOf(HttpException);
      return caught;
    }
    throw new Error('expected HttpException');
  }

  it('rejects withdrawals below the 150 minimum', async () => {
    const error = await expectHttpError(() =>
      controller.initiatePayment(ctx, { ...withdrawRequest, amount: 149 })
    );

    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ error: 'MIN_WITHDRAW_AMOUNT' })
    );
    expect(giveChangePayoutService.executeGiveChangePayout).not.toHaveBeenCalled();
  });

  it('rejects withdrawals to a non-CM/GA phone before payout', async () => {
    mobilePaymentsService.isWithdrawalDestinationCmOrGa.mockReturnValue(false);

    const error = await expectHttpError(() =>
      controller.initiatePayment(ctx, {
        ...withdrawRequest,
        customerPhone: '+15551234567',
      })
    );

    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({ error: 'WITHDRAW_PHONE_REGION_NOT_ALLOWED' })
    );
    expect(
      mobilePaymentsService.isWithdrawalDestinationCmOrGa
    ).toHaveBeenCalledWith('+15551234567');
    expect(giveChangePayoutService.executeGiveChangePayout).not.toHaveBeenCalled();
  });

  it('pays out after the destination phone and minimum amount pass', async () => {
    await expect(
      controller.initiatePayment(ctx, withdrawRequest)
    ).resolves.toEqual({
      success: true,
      data: expect.objectContaining({ transactionId: 'tx-1' }),
    });

    expect(giveChangePayoutService.executeGiveChangePayout).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-1',
        amount: 200,
        customerPhone: '+237670000000',
      }),
      expect.objectContaining({ initiatorUserId: 'user-1' })
    );
  });
});
