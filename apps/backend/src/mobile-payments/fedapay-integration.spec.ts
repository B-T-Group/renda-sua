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

      // First call: event recorded and processed
      mockHasuraSystemService.query.mockResolvedValueOnce({ webhook_events: [] });
      mockHasuraSystemService.mutate.mockResolvedValueOnce({ insert_webhook_events_one: { id: 1 } });
      mockCallbackProcessor.processFedaPayCallback.mockResolvedValueOnce({ received: true });

      const req1 = { headers: { 'x-fedapay-signature': header }, body: rawBody } as any;
      const result1 = await controller.fedapayCallback(req1);
      expect(result1).toEqual({ received: true });

      // Second call: same event replayed (webhook_events found, so processor not called again)
      mockHasuraSystemService.query.mockResolvedValueOnce({ webhook_events: [{ id: 1, event_id: parsedEvent.id }] });
      mockCallbackProcessor.processFedaPayCallback.mockResolvedValueOnce({ received: true });

      const req2 = { headers: { 'x-fedapay-signature': header }, body: rawBody } as any;
      const result2 = await controller.fedapayCallback(req2);
      expect(result2).toEqual({ received: true });
      expect(mockCallbackProcessor.processFedaPayCallback).toHaveBeenCalledTimes(1);
    });

    it('should reprocess replayed event after handler failure', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const header = Webhook.generateTestHeaderString({ payload, secret, timestamp });
      const parsedEvent = JSON.parse(payload);
      const rawBody = Buffer.from(payload);

      // First call: event recorded but processing throws
      mockHasuraSystemService.query.mockResolvedValueOnce({ webhook_events: [] });
      mockHasuraSystemService.mutate.mockResolvedValueOnce({ insert_webhook_events_one: { id: 1 } });
      mockCallbackProcessor.processFedaPayCallback.mockRejectedValueOnce(new Error('DB timeout'));

      const req1 = { headers: { 'x-fedapay-signature': header }, body: rawBody } as any;
      await expect(controller.fedapayCallback(req1)).rejects.toThrow(/Failed to process FedaPay callback|DB timeout/);

      // Second call: same event, but no recorded webhook_events (because insert failed in error path)
      mockHasuraSystemService.query.mockResolvedValueOnce({ webhook_events: [] });
      mockHasuraSystemService.mutate.mockResolvedValueOnce({ insert_webhook_events_one: { id: 2 } });
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

    // Note: Account currency XOF checks for FedaPay are tested in
    // mobile-payments.controller.ts:initiatePayment integration tests (B5)
    // Lines 280-299 for payments and 1113-1130 for withdrawals

    // Note: XOF currency and integer amount validation for FedaPay is tested
    // in mobile-payments.service.spec.ts:initiatePayment tests (B5)
  });

});
