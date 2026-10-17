import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { AccountsService } from '../accounts/accounts.service';
import { GiveChangePayoutService } from './give-change-payout.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { WithdrawalPinService } from '../admin/withdrawal-pin.service';
import { PendingWithdrawalResolveService } from './pending-withdrawal-resolve.service';
import { MobileTransactionAccessService } from './mobile-transaction-access.service';
import { MtnMomoService } from './providers/mtn-momo.service';
import { OrangeMomoService } from './providers/orange-momo.service';
import { FreemopayService } from './providers/freemopay.service';

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

  const mockHasuraSystemService = {
    query: jest.fn(),
    mutate: jest.fn(),
  };

  const mockMtnMomoService = {};
  const mockOrangeMomoService = {};
  const mockFreemopayService = {};
  const mockFedaPayService = {};

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
    jest.resetAllMocks();
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

  describe('B8a: Controller Webhook Signature Verification (Real SDK)', () => {
    const { Webhook } = require('fedapay');
    const secret = 'test_webhook_secret'; // Must match mockConfigService
    const payload = JSON.stringify({
      id: 'evt_test_123',
      name: 'transaction.approved',
      entity: {
        id: 'tx_123',
        status: 'approved',
        amount: 1000,
        custom_metadata: { externalId: 'REF123' },
      },
    });

    beforeEach(() => {
      // Re-establish webhook secret mock after reset
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'fedapay.webhookSecret') return secret;
        return null;
      });
    });

    it('should accept valid webhook with real HMAC signature', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const header = Webhook.generateTestHeaderString({ payload, secret, timestamp });

      const result = controller['verifyAndParseFedaPayWebhook'](payload, header);

      expect(result).toBeDefined();
      expect(result.id).toBe('evt_test_123');
    });

    it('should reject tampered webhook body', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const header = Webhook.generateTestHeaderString({ payload, secret, timestamp });
      const tamperedPayload = payload.replace('"approved"', '"declined"');

      expect(() => {
        controller['verifyAndParseFedaPayWebhook'](tamperedPayload, header);
      }).toThrow(HttpException);
    });

    it('should reject stale webhook (>300s past)', () => {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s ago
      const header = Webhook.generateTestHeaderString({ payload, secret, timestamp: staleTimestamp });

      expect(() => {
        controller['verifyAndParseFedaPayWebhook'](payload, header);
      }).toThrow(HttpException);
    });

    it('should reject future webhook (>300s future)', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 400; // 400s future
      const header = Webhook.generateTestHeaderString({ payload, secret, timestamp: futureTimestamp });

      expect(() => {
        controller['verifyAndParseFedaPayWebhook'](payload, header);
      }).toThrow(HttpException);
    });

    it('should reject webhook with missing header', () => {
      expect(() => {
        controller['verifyAndParseFedaPayWebhook'](payload, '');
      }).toThrow();
    });

    it('should handle replayed event (200 with no reprocessing)', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const header = Webhook.generateTestHeaderString({ payload, secret, timestamp });
      const parsedEvent = JSON.parse(payload);
      const rawBody = Buffer.from(payload);

      // First call: event processed and recorded in-memory
      mockCallbackProcessor.processFedaPayCallback.mockResolvedValue({ received: true });

      const req1 = { headers: { 'x-fedapay-signature': header }, body: rawBody } as any;
      const result1 = await controller.fedapayCallback(req1);
      expect(result1).toEqual({ received: true });
      expect(mockCallbackProcessor.processFedaPayCallback).toHaveBeenCalledTimes(1);

      // Second call: same event replayed, controller throws HTTP 200 (duplicate)
      const req2 = { headers: { 'x-fedapay-signature': header }, body: rawBody } as any;
      try {
        await controller.fedapayCallback(req2);
        throw new Error('Expected HTTP 200 exception for duplicate');
      } catch (error: any) {
        expect(error.status).toBe(200);
        expect(error.response.message).toBe('Duplicate event');
      }
      // Processor not called again
      expect(mockCallbackProcessor.processFedaPayCallback).toHaveBeenCalledTimes(1);
    });

    it('should reprocess replayed event after handler failure', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const header = Webhook.generateTestHeaderString({ payload, secret, timestamp });
      const parsedEvent = JSON.parse(payload);
      const rawBody = Buffer.from(payload);

      // First call: processing throws, event NOT recorded in-memory
      mockCallbackProcessor.processFedaPayCallback.mockRejectedValueOnce(new Error('DB timeout'));

      const req1 = { headers: { 'x-fedapay-signature': header }, body: rawBody } as any;
      await expect(controller.fedapayCallback(req1)).rejects.toThrow(/Failed to process FedaPay callback/);

      // Second call: same event retried, processing succeeds this time
      mockCallbackProcessor.processFedaPayCallback.mockResolvedValueOnce({ received: true });

      const req2 = { headers: { 'x-fedapay-signature': header }, body: rawBody } as any;
      const result2 = await controller.fedapayCallback(req2);
      expect(result2).toEqual({ received: true });
      expect(mockCallbackProcessor.processFedaPayCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('B8b: Real assertProviderConfirmsCallback Tests', () => {
    let realService: MobilePaymentsService;
    let mockFedaPayService: any;
    const mockMyPVitService = {};
    const mockMtnMomoDatabaseService = {};
    const mockOrangeMomoDatabaseService = {};

    beforeEach(() => {
      mockFedaPayService = {
        checkTransactionStatus: jest.fn(),
      };
      realService = new MobilePaymentsService(
        mockMyPVitService as any,
        mockMtnMomoService as any,
        mockMtnMomoDatabaseService as any,
        mockOrangeMomoService as any,
        mockOrangeMomoDatabaseService as any,
        mockFreemopayService as any,
        mockFedaPayService,
        mockHasuraSystemService as any,
      );
    });

    it('should reject when live amount mismatches stored amount', async () => {
      const tx = {
        id: 'tx-1',
        transaction_id: 'fedapay_tx_1',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF123',
        provider: 'fedapay',
        status: 'PENDING',
      };
      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        status: 'approved',
        amount: 999, // Mismatch
        currency: 'XOF',
        reference: 'REF123',
      });
      process.env.ENABLE_FEDAPAY_TOGO_INTEGRATION = 'false';

      await expect(
        realService['assertProviderConfirmsCallback'](tx as any, 'SUCCESS')
      ).rejects.toThrow(/amount mismatch.*expected 1000.*got 999/i);
    });

    it('should reject when live currency is not XOF', async () => {
      const tx = {
        id: 'tx-2',
        transaction_id: 'fedapay_tx_2',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF456',
        provider: 'fedapay',
        status: 'PENDING',
      };
      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        status: 'approved',
        amount: 1000,
        currency: 'XAF', // Wrong currency
        reference: 'REF456',
      });
      process.env.ENABLE_FEDAPAY_TOGO_INTEGRATION = 'false';

      await expect(
        realService['assertProviderConfirmsCallback'](tx as any, 'SUCCESS')
      ).rejects.toThrow(/live currency XAF is not XOF/i);
    });

    it('should reject when live reference mismatches stored reference', async () => {
      const tx = {
        id: 'tx-3',
        transaction_id: 'fedapay_tx_3',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF789',
        provider: 'fedapay',
        status: 'PENDING',
      };
      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        status: 'approved',
        amount: 1000,
        currency: 'XOF',
        reference: 'WRONG_REF', // Reference mismatch
      });
      process.env.ENABLE_FEDAPAY_TOGO_INTEGRATION = 'false';

      await expect(
        realService['assertProviderConfirmsCallback'](tx as any, 'SUCCESS')
      ).rejects.toThrow(/reference mismatch.*expected REF789.*got WRONG_REF/i);
    });

    it('should reject when live currency is missing (fail closed)', async () => {
      const tx = {
        id: 'tx-4',
        transaction_id: 'fedapay_tx_4',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF111',
        provider: 'fedapay',
        status: 'PENDING',
      };
      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        status: 'approved',
        amount: 1000,
        currency: '', // Missing currency
        reference: 'REF111',
      });
      process.env.ENABLE_FEDAPAY_TOGO_INTEGRATION = 'false';

      await expect(
        realService['assertProviderConfirmsCallback'](tx as any, 'SUCCESS')
      ).rejects.toThrow(/missing live currency.*fail closed/i);
    });

    it('should reject when live reference is missing (fail closed)', async () => {
      const tx = {
        id: 'tx-5',
        transaction_id: 'fedapay_tx_5',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF222',
        provider: 'fedapay',
        status: 'PENDING',
      };
      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        status: 'approved',
        amount: 1000,
        currency: 'XOF',
        reference: '', // Missing reference
      });
      process.env.ENABLE_FEDAPAY_TOGO_INTEGRATION = 'false';

      await expect(
        realService['assertProviderConfirmsCallback'](tx as any, 'SUCCESS')
      ).rejects.toThrow(/missing live reference.*fail closed/i);
    });

    it('should accept when all fields match', async () => {
      const tx = {
        id: 'tx-6',
        transaction_id: 'fedapay_tx_6',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF333',
        provider: 'fedapay',
        status: 'PENDING',
      };
      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        status: 'approved',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF333',
      });
      process.env.ENABLE_FEDAPAY_TOGO_INTEGRATION = 'false';

      await expect(
        realService['assertProviderConfirmsCallback'](tx as any, 'SUCCESS')
      ).resolves.not.toThrow();
    });
  });

  describe('B8e: Card/Bank Rejection and Currency Guards', () => {
    it('should reject card payment method for FedaPay', () => {
      const request = {
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22878123456',
        paymentMethod: 'card',
      };

      expect(() => {
        (controller as any).assertMobileMoneyCurrency(request, 'fedapay');
      }).toThrow(/only supports mobile_money/i);
    });

    it('should reject bank transfer payment method for FedaPay', () => {
      const request = {
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22878123456',
        paymentMethod: 'bank_transfer',
      };

      expect(() => {
        (controller as any).assertMobileMoneyCurrency(request, 'fedapay');
      }).toThrow(/only supports mobile_money/i);
    });

    it('should reject FedaPay top-up from non-XOF account (controller:280-299)', async () => {
      const mockAccountsService = {
        getAccountBalance: jest.fn().mockResolvedValue({
          currency: 'XAF',
          balance: 5000,
        }),
      };
      const mockTestMobilePaymentsService = {
        resolveProviderFromRequest: jest.fn().mockResolvedValue('fedapay'),
        checkTransactionStatus: jest.fn(),
        assertProviderConfirmsCallback: jest.fn(),
        isWithdrawalDestinationCmOrGa: jest.fn(),
      };
      const mockGiveChangePayoutService = {};
      const mockHasuraUserService = {
        getUser: jest.fn().mockResolvedValue({ id: 'user-123' }),
      };
      const mockWithdrawalPinService = {};
      const mockPendingWithdrawalResolveService = {};
      const mockMobileTransactionAccessService = {
        canView: jest.fn().mockResolvedValue(true),
      };
      const mockMobilePaymentsDatabaseService = {};

      const testModule = await Test.createTestingModule({
        controllers: [MobilePaymentsController],
        providers: [
          { provide: MobilePaymentsService, useValue: mockTestMobilePaymentsService },
          { provide: MobilePaymentsDatabaseService, useValue: mockMobilePaymentsDatabaseService },
          { provide: AccountsService, useValue: mockAccountsService },
          { provide: GiveChangePayoutService, useValue: mockGiveChangePayoutService },
          { provide: HasuraUserService, useValue: mockHasuraUserService },
          { provide: MobilePaymentCallbackProcessor, useValue: mockCallbackProcessor },
          { provide: WithdrawalPinService, useValue: mockWithdrawalPinService },
          { provide: PendingWithdrawalResolveService, useValue: mockPendingWithdrawalResolveService },
          { provide: MobileTransactionAccessService, useValue: mockMobileTransactionAccessService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testController = testModule.get<MobilePaymentsController>(MobilePaymentsController);

      const request = {
        amount: 1000,
        currency: 'XOF',
        accountId: 'acc-xaf',
        customerPhone: '+22878123456',
        provider: 'fedapay' as const,
        description: 'Test payment',
      };
      const ctx = { userId: 'user-123', user: { id: 'user-123' } } as any;

      // Controller signature is initiatePayment(ctx, paymentRequest).
      const error: any = await testController
        .initiatePayment(ctx, request as any)
        .then(
          () => {
            throw new Error('Expected ACCOUNT_CURRENCY_MISMATCH error');
          },
          (e) => e
        );
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.getResponse()).toMatchObject({
        error: 'ACCOUNT_CURRENCY_MISMATCH',
        data: { accountCurrency: 'XAF', requiredCurrency: 'XOF' },
      });
      expect(error.getResponse().message).toMatch(/FedaPay.*requires account currency to be XOF/i);
      expect(
        mockTestMobilePaymentsService.resolveProviderFromRequest
      ).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'acc-xaf' }));
    });

    it('should reject FedaPay withdrawal from non-XOF account (controller:1113-1130)', async () => {
      const mockAccountsService = {
        getAccountBalance: jest.fn().mockResolvedValue({
          currency: 'XAF',
          balance: 5000,
          availableBalance: 5000,
        }),
        getBusinessWithdrawalPinStateByAccountId: jest.fn().mockResolvedValue({
          enabled: true,
          hash: 'test-hash',
          businessId: 'bus-123',
        }),
      };
      const mockTestMobilePaymentsService = {
        resolveProviderFromRequest: jest.fn().mockResolvedValue('fedapay'),
        checkTransactionStatus: jest.fn(),
        assertProviderConfirmsCallback: jest.fn(),
        isWithdrawalDestinationCmOrGa: jest.fn().mockResolvedValue(true),
      };
      const mockGiveChangePayoutService = {
        executeGiveChangePayout: jest.fn(),
      };
      const mockHasuraUserService = {
        getUser: jest.fn().mockResolvedValue({ id: 'user-123' }),
      };
      const mockWithdrawalPinService = {
        verifyPin: jest.fn().mockReturnValue(true),
      };
      const mockPendingWithdrawalResolveService = {};
      const mockMobileTransactionAccessService = {
        canView: jest.fn().mockResolvedValue(true),
      };
      const mockMobilePaymentsDatabaseService = {
        getUserTransactionInDateRange: jest.fn().mockResolvedValue([]),
      };

      const testModule = await Test.createTestingModule({
        controllers: [MobilePaymentsController],
        providers: [
          { provide: MobilePaymentsService, useValue: mockTestMobilePaymentsService },
          { provide: MobilePaymentsDatabaseService, useValue: mockMobilePaymentsDatabaseService },
          { provide: AccountsService, useValue: mockAccountsService },
          { provide: GiveChangePayoutService, useValue: mockGiveChangePayoutService },
          { provide: HasuraUserService, useValue: mockHasuraUserService },
          { provide: MobilePaymentCallbackProcessor, useValue: mockCallbackProcessor },
          { provide: WithdrawalPinService, useValue: mockWithdrawalPinService },
          { provide: PendingWithdrawalResolveService, useValue: mockPendingWithdrawalResolveService },
          { provide: MobileTransactionAccessService, useValue: mockMobileTransactionAccessService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const testController = testModule.get<MobilePaymentsController>(MobilePaymentsController);

      const request = {
        amount: 1000,
        currency: 'XOF',
        accountId: 'acc-xaf',
        customerPhone: '+22878123456',
        provider: 'fedapay' as const,
        description: 'Test withdrawal',
        transactionType: 'GIVE_CHANGE' as const,
        withdrawalPin: '1234',
      };
      const ctx = { userId: 'user-123', user: { id: 'user-123' } } as any;

      // Controller signature is initiatePayment(ctx, paymentRequest).
      const error: any = await testController
        .initiatePayment(ctx, request as any)
        .then(
          () => {
            throw new Error('Expected ACCOUNT_CURRENCY_MISMATCH error');
          },
          (e) => e
        );
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.getResponse()).toMatchObject({
        error: 'ACCOUNT_CURRENCY_MISMATCH',
        data: { accountCurrency: 'XAF', requiredCurrency: 'XOF' },
      });
      expect(error.getResponse().message).toMatch(/FedaPay.*withdrawals require account currency to be XOF/i);
      expect(
        mockTestMobilePaymentsService.resolveProviderFromRequest
      ).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'acc-xaf' }));
    });

    it('should reject initiatePayment with non-XOF currency for fedapay (service:505-510)', async () => {
      const realService = new MobilePaymentsService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockFedaPayService,
        mockHasuraSystemService as any,
      );

      const mockSelectProvider = jest.spyOn(realService as any, 'selectProvider')
        .mockResolvedValue('fedapay');

      const result = await realService.initiatePayment({
        amount: 1000,
        currency: 'XAF',
        accountId: 'acc-test',
        description: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/only supports XOF currency/i);

      mockSelectProvider.mockRestore();
    });

    it('should reject initiatePayment with decimal amount for fedapay (service:512-519)', async () => {
      const realService = new MobilePaymentsService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockFedaPayService,
        mockHasuraSystemService as any,
      );

      const mockSelectProvider = jest.spyOn(realService as any, 'selectProvider')
        .mockResolvedValue('fedapay');

      const result = await realService.initiatePayment({
        amount: 100.5,
        currency: 'XOF',
        accountId: 'acc-test',
        description: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/amounts must be integers/i);

      mockSelectProvider.mockRestore();
    });
  });

});
