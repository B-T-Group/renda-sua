/**
 * Controller validation tests (F-L2, F-M3, F-M6)
 * Tests for every controller 400 path, verifying:
 * 1. Correct error code and message
 * 2. No database row is created
 */
import {
  BadRequestException,
} from '@nestjs/common';
import {
  InitiatePaymentDto,
  MobilePaymentsController,
} from './mobile-payments.controller';

describe('MobilePaymentsController phone validation (400 paths)', () => {
  let controller: MobilePaymentsController;
  let mockDatabaseService: { insertTransaction: jest.Mock };
  let mockMobilePaymentsService: { initiatePayment: jest.Mock };
  let mockConfigService: { get: jest.Mock };
  let mockTransactionAccessService: { canView: jest.Mock };
  let mockUserService: { getUser: jest.Mock };

  beforeEach(() => {
    mockDatabaseService = {
      insertTransaction: jest.fn(),
    };
    mockMobilePaymentsService = {
      initiatePayment: jest.fn(),
      resolveProviderFromRequest: jest.fn().mockImplementation((req: any) => 
        Promise.resolve(req.provider)
      ),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue(false),
    };
    mockTransactionAccessService = {
      canView: jest.fn().mockResolvedValue(true),
    };
    mockUserService = {
      getUser: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };

    controller = new MobilePaymentsController(
      mockMobilePaymentsService as never, // mobilePaymentsService
      mockDatabaseService as never, // databaseService
      {} as never, // accountsService
      {} as never, // giveChangePayoutService
      mockUserService as never, // hasuraUserService
      {} as never, // callbackProcessor
      {} as never, // withdrawalPinService
      {} as never, // pendingWithdrawalResolveService
      mockTransactionAccessService as never, // transactionAccessService
      mockConfigService as never // configService
    );
  });

  async function expectBadRequest(
    run: () => Promise<unknown>,
    expectedError: string
  ): Promise<void> {
    try {
      await run();
      throw new Error('Expected HttpException with 400 status but none was thrown');
    } catch (error: any) {
      // Controller wraps errors in HttpException with 400 status
      expect(error.getStatus()).toBe(400);
      const response = error.getResponse() as any;
      expect(response.error).toBe(expectedError);
      // Verify no database row was created
      expect(mockDatabaseService.insertTransaction).not.toHaveBeenCalled();
    }
  }

  it('should return 400 for invalid phone number format', async () => {
    const request = {
      customerPhone: 'invalid-phone',
      amount: 1000,
      currency: 'XOF',
      provider: 'fedapay',
      transactionType: 'PAYMENT',
    } as InitiatePaymentDto;

    await expectBadRequest(
      () => controller.initiatePayment({ user: { id: 'user-1' } } as never, request),
      'INVALID_PHONE_NUMBER'
    );
  });

  it('should return 400 for phone-country mismatch (TG phone with CM item)', async () => {
    const request = {
      customerPhone: '+22890123456',
      amount: 1000,
      currency: 'XAF',
      provider: 'freemopay',
      transactionType: 'PAYMENT',
      itemCountry: 'CM',
    } as InitiatePaymentDto;

    await expectBadRequest(
      () => controller.initiatePayment({ user: { id: 'user-1' } } as never, request),
      'PHONE_COUNTRY_MISMATCH'
    );
  });

  it('should return 400 for non-TG phone with FedaPay', async () => {
    const request = {
      customerPhone: '+237650123456',
      amount: 1000,
      currency: 'XOF',
      provider: 'fedapay',
      transactionType: 'PAYMENT',
    } as InitiatePaymentDto;

    await expectBadRequest(
      () => controller.initiatePayment({ user: { id: 'user-1' } } as never, request),
      'INVALID_PHONE_NUMBER'
    );
  });

  it('should return 400 for non-CM phone with Freemopay', async () => {
    const request = {
      customerPhone: '+22890123456',
      amount: 1000,
      currency: 'XAF',
      provider: 'freemopay',
      transactionType: 'PAYMENT',
    } as InitiatePaymentDto;

    await expectBadRequest(
      () => controller.initiatePayment({ user: { id: 'user-1' } } as never, request),
      'INVALID_PHONE_NUMBER'
    );
  });

  it('should return 400 for non-GA phone with MyPVit', async () => {
    const request = {
      customerPhone: '+22890123456',
      amount: 1000,
      currency: 'XAF',
      provider: 'mypvit',
      transactionType: 'PAYMENT',
    } as InitiatePaymentDto;

    await expectBadRequest(
      () => controller.initiatePayment({ user: { id: 'user-1' } } as never, request),
      'INVALID_PHONE_NUMBER'
    );
  });

  it('should return 400 for non-GA phone with Airtel', async () => {
    const request = {
      customerPhone: '+237650123456',
      amount: 1000,
      currency: 'XOF',
      provider: 'airtel',
      transactionType: 'PAYMENT',
    } as InitiatePaymentDto;

    await expectBadRequest(
      () => controller.initiatePayment({ user: { id: 'user-1' } } as never, request),
      'INVALID_PHONE_NUMBER'
    );
  });

  it('should return 400 for non-GA phone with Moov', async () => {
    const request = {
      customerPhone: '+22890123456',
      amount: 1000,
      currency: 'XOF',
      provider: 'moov',
      transactionType: 'PAYMENT',
    } as InitiatePaymentDto;

    await expectBadRequest(
      () => controller.initiatePayment({ user: { id: 'user-1' } } as never, request),
      'INVALID_PHONE_NUMBER'
    );
  });
});
