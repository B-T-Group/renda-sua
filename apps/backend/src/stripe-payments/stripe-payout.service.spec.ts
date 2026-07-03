import { HttpException, HttpStatus } from '@nestjs/common';
import { StripePayoutService } from './stripe-payout.service';

describe('StripePayoutService', () => {
  const databaseService = {
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
  };
  const accountsService = {
    accountBelongsToUser: jest.fn(),
    getAccountBalance: jest.fn(),
    registerTransaction: jest.fn(),
  };
  const stripeService = {
    createTransfer: jest.fn(),
  };
  const connectService = {
    getByUserId: jest.fn(),
    isPayoutReady: jest.fn(),
  };

  const payoutParams = {
    amount: 25,
    currency: 'USD',
    accountId: 'wallet-other-user',
    userId: 'authenticated-user',
    description: 'Wallet withdrawal',
  };

  let service: StripePayoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripePayoutService(
      databaseService as never,
      accountsService as never,
      stripeService as never,
      connectService as never
    );
  });

  it('rejects payouts from accounts not owned by the user', async () => {
    accountsService.accountBelongsToUser.mockResolvedValue(false);

    try {
      await service.executePayout(payoutParams, { throwOnFailure: true });
      fail('Expected payout to be rejected');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(error.getResponse()).toEqual({
        success: false,
        error: 'ACCOUNT_NOT_OWNED',
      });
    }

    expect(accountsService.getAccountBalance).not.toHaveBeenCalled();
    expect(databaseService.createTransaction).not.toHaveBeenCalled();
    expect(connectService.getByUserId).not.toHaveBeenCalled();
    expect(stripeService.createTransfer).not.toHaveBeenCalled();
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });
});
