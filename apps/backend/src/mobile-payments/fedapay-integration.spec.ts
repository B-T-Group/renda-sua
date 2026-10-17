import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { AccountsService } from '../accounts/accounts.service';
import { GiveChangePayoutService } from './give-change-payout.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { WithdrawalPinService } from '../admin/withdrawal-pin.service';
import { PendingWithdrawalResolveService } from './pending-withdrawal-resolve.service';
import { MobileTransactionAccessService } from './mobile-transaction-access.service';

describe('FedaPay Integration Tests (B2, B4, B5)', () => {
  let controller: MobilePaymentsController;
  let mobilePaymentsService: MobilePaymentsService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'fedapay.webhookSecret') return 'test_webhook_secret';
      return null;
    }),
  };

  const mockMobilePaymentsService = {
    assertMobileMoneyCurrency: jest.fn(),
    checkTransactionStatus: jest.fn(),
    assertProviderConfirmsCallback: jest.fn(),
    isWithdrawalDestinationCmOrGa: jest.fn(),
  };

  const mockCallbackProcessor = {
    processFedaPayCallback: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MobilePaymentsController],
      providers: [
        { provide: MobilePaymentsService, useValue: mockMobilePaymentsService },
        { provide: MobilePaymentsDatabaseService, useValue: {} },
        { provide: AccountsService, useValue: {} },
        { provide: GiveChangePayoutService, useValue: {} },
        { provide: HasuraUserService, useValue: {} },
        { provide: MobilePaymentCallbackProcessor, useValue: mockCallbackProcessor },
        { provide: WithdrawalPinService, useValue: {} },
        { provide: PendingWithdrawalResolveService, useValue: {} },
        { provide: MobileTransactionAccessService, useValue: {} },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<MobilePaymentsController>(MobilePaymentsController);
    mobilePaymentsService = module.get<MobilePaymentsService>(MobilePaymentsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('B2: Signature Verification', () => {
    const mockRawBody = Buffer.from(JSON.stringify({
      entity: { id: 123, status: 'approved', amount: 1000 },
      name: 'transaction.approved',
    }));

    it('should reject webhook with missing signature header', async () => {
      const req: any = {
        headers: {},
        body: mockRawBody,
      };

      await expect(controller.fedapayCallback(req)).rejects.toThrow(HttpException);
      await expect(controller.fedapayCallback(req)).rejects.toThrow(/missing.*signature/i);
    });

    it('should reject webhook with missing webhook secret', async () => {
      mockConfigService.get.mockReturnValueOnce(null);
      const req: any = {
        headers: { 'x-fedapay-signature': 't=123,v1=abc' },
        body: mockRawBody,
      };

      await expect(controller.fedapayCallback(req)).rejects.toThrow(HttpException);
    });

    it('should reject webhook without raw body', async () => {
      const req: any = {
        headers: { 'x-fedapay-signature': 't=123,v1=abc' },
        body: null,
      };

      await expect(controller.fedapayCallback(req)).rejects.toThrow(HttpException);
    });
  });

  describe('B5: Currency Guard for FedaPay', () => {
    it('should validate XOF currency and integer amount for FedaPay', () => {
      const request = {
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22878123456',
      };

      expect(() => {
        (controller as any).assertMobileMoneyCurrency(request, 'fedapay');
      }).not.toThrow();
    });

    it('should reject non-XOF currency for FedaPay', () => {
      const request = {
        amount: 1000,
        currency: 'XAF',
        customerPhone: '+22878123456',
      };

      expect(() => {
        (controller as any).assertMobileMoneyCurrency(request, 'fedapay');
      }).toThrow(HttpException);
    });

    it('should reject decimal amount for FedaPay', () => {
      const request = {
        amount: 1000.50,
        currency: 'XOF',
        customerPhone: '+22878123456',
      };

      expect(() => {
        (controller as any).assertMobileMoneyCurrency(request, 'fedapay');
      }).toThrow(HttpException);
      expect(() => {
        (controller as any).assertMobileMoneyCurrency(request, 'fedapay');
      }).toThrow(/integer/i);
    });

    it('should allow XAF for non-FedaPay providers', () => {
      const request = {
        amount: 1000,
        currency: 'XAF',
        customerPhone: '+237670000000',
      };

      expect(() => {
        (controller as any).assertMobileMoneyCurrency(request, 'freemopay');
      }).not.toThrow();
    });
  });

  describe('B4: Provider Routing with Amount/Currency/Reference Check', () => {
    const mockTx = {
      id: 'tx-123',
      transaction_id: 'fedapay-tx-456',
      customer_phone: '+22878123456',
      provider: 'fedapay',
      amount: 1000,
      reference: 'REF123',
    };

    it('should reject callback when live amount mismatches for FedaPay', async () => {
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockRejectedValue(
        new Error('FedaPay amount mismatch: expected 999 XOF, got 1000 XOF')
      );

      await expect(
        mobilePaymentsService.assertProviderConfirmsCallback(mockTx as any, 'SUCCESS')
      ).rejects.toThrow(/amount mismatch/i);
    });

    it('should reject callback when currency is not XOF for FedaPay', async () => {
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockRejectedValue(
        new Error('FedaPay currency mismatch: expected XAF, got XOF')
      );

      await expect(
        mobilePaymentsService.assertProviderConfirmsCallback(mockTx as any, 'SUCCESS')
      ).rejects.toThrow(/currency mismatch/i);
    });
  });

  describe('B7: Withdrawal Destination with FedaPay Flag', () => {
    it('should reject TG withdrawal when FedaPay not active', async () => {
      mockMobilePaymentsService.isWithdrawalDestinationCmOrGa.mockResolvedValue(false);

      const request = {
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22878123456',
      };

      await expect(
        (controller as any).assertGiveChangeAmountAndPhone(request)
      ).rejects.toThrow(HttpException);
    });

    it('should allow TG withdrawal when FedaPay active', async () => {
      mockMobilePaymentsService.isWithdrawalDestinationCmOrGa.mockResolvedValue(true);

      const request = {
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22878123456',
      };

      await expect(
        (controller as any).assertGiveChangeAmountAndPhone(request)
      ).resolves.not.toThrow();
    });
  });
});
