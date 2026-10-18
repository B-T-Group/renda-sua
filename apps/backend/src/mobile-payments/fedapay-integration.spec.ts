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
    resolveProviderFromRequest: jest.fn(),
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

    it('does not drop transaction.approved when transaction.updated shares entity id and timestamp', async () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const updatedPayload = JSON.stringify({
        name: 'transaction.updated',
        entity: { id: 'tx_123', status: 'approved', amount: 1000 },
      });
      const approvedPayload = JSON.stringify({
        name: 'transaction.approved',
        entity: { id: 'tx_123', status: 'approved', amount: 1000 },
      });
      const updatedHeader = Webhook.generateTestHeaderString({
        payload: updatedPayload,
        secret,
        timestamp,
      });
      const approvedHeader = Webhook.generateTestHeaderString({
        payload: approvedPayload,
        secret,
        timestamp,
      });
      mockCallbackProcessor.processFedaPayCallback.mockResolvedValue({ received: true });

      await controller.fedapayCallback({
        headers: { 'x-fedapay-signature': updatedHeader },
        body: Buffer.from(updatedPayload),
      } as any);
      const approved = await controller.fedapayCallback({
        headers: { 'x-fedapay-signature': approvedHeader },
        body: Buffer.from(approvedPayload),
      } as any);

      expect(approved).toEqual({ received: true });
      expect(mockCallbackProcessor.processFedaPayCallback).toHaveBeenCalledTimes(2);
      expect(mockCallbackProcessor.processFedaPayCallback).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: 'transaction.approved' }),
        expect.anything()
      );
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

    it('accepts a Hasura numeric string amount against a FedaPay number', async () => {
      const tx = {
        id: 'tx-decimal',
        transaction_id: 'fedapay_tx_dec',
        amount: '1000.00',
        currency: 'XOF',
        reference: 'REF333',
        provider: 'fedapay',
        status: 'pending',
      };
      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        status: 'approved',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF333',
      });

      await expect(
        realService.assertProviderConfirmsCallback(tx as any, 'SUCCESS')
      ).resolves.toBeUndefined();
    });

    it('still rejects a real amount mismatch when the stored amount is a numeric string', async () => {
      const tx = {
        id: 'tx-decimal-bad',
        transaction_id: 'fedapay_tx_dec_bad',
        amount: '1000.00',
        currency: 'XOF',
        reference: 'REF333',
        provider: 'fedapay',
        status: 'pending',
      };
      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        status: 'approved',
        amount: 999,
        currency: 'XOF',
        reference: 'REF333',
      });

      await expect(
        realService.assertProviderConfirmsCallback(tx as any, 'SUCCESS')
      ).rejects.toThrow(/amount mismatch/i);
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

    describe('N5: expired is confirmed by the live re-check (service statusMap)', () => {
      const expTx = { id: 'tx-exp', transaction_id: 'fedapay_tx_exp', amount: 1000, currency: 'XOF', reference: 'REF-EXP', provider: 'fedapay', status: 'pending' };

      it('accepts an expired webhook when FedaPay reports expired with the matching reference', async () => {
        mockFedaPayService.checkTransactionStatus.mockResolvedValue({ status: 'expired', amount: 1000, currency: 'XOF', merchantRef: 'REF-EXP' });
        await expect(realService.assertProviderConfirmsCallback(expTx as any, 'FAILED')).resolves.toBeUndefined();
      });

      it('rejects an expired webhook while FedaPay still reports pending', async () => {
        mockFedaPayService.checkTransactionStatus.mockResolvedValue({ status: 'pending', amount: 1000, currency: 'XOF', merchantRef: 'REF-EXP' });
        await expect(realService.assertProviderConfirmsCallback(expTx as any, 'FAILED')).rejects.toThrow(/provider still pending/);
      });

      it('rejects an expired webhook whose live reference mismatches', async () => {
        mockFedaPayService.checkTransactionStatus.mockResolvedValue({ status: 'expired', amount: 1000, currency: 'XOF', merchantRef: 'OTHER' });
        await expect(realService.assertProviderConfirmsCallback(expTx as any, 'FAILED')).rejects.toThrow(/reference mismatch/);
      });
    });

    describe('N6: reference check on FAILED (declined) callbacks', () => {
      const declinedTx = {
        id: 'tx-n6',
        transaction_id: 'fedapay_tx_n6',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF-N6',
        provider: 'fedapay',
        status: 'pending',
      };

      it('rejects a declined callback whose live reference mismatches (row stays pending)', async () => {
        mockFedaPayService.checkTransactionStatus.mockResolvedValue({
          status: 'declined',
          amount: 1000,
          currency: 'XOF',
          reference: 'OTHER-REF',
        });
        await expect(
          realService.assertProviderConfirmsCallback(declinedTx as any, 'FAILED')
        ).rejects.toThrow(/FAILED callback.*reference mismatch.*expected REF-N6.*got OTHER-REF/i);
      });

      it('rejects a declined callback with no live reference (fail closed)', async () => {
        mockFedaPayService.checkTransactionStatus.mockResolvedValue({
          status: 'declined',
          amount: 1000,
          currency: 'XOF',
          reference: '',
        });
        await expect(
          realService.assertProviderConfirmsCallback(declinedTx as any, 'FAILED')
        ).rejects.toThrow(/reference mismatch.*<missing>/i);
      });

      it('accepts a legitimate declined callback whose reference matches', async () => {
        mockFedaPayService.checkTransactionStatus.mockResolvedValue({
          status: 'declined',
          amount: 1000,
          currency: 'XOF',
          merchantRef: 'REF-N6',
          reference: 'fedapay_tx_n6',
        });
        await expect(
          realService.assertProviderConfirmsCallback(declinedTx as any, 'FAILED')
        ).resolves.toBeUndefined();
      });
    });

    describe('ambiguous FedaPay outcome is surfaced on MobilePaymentResponse', () => {
      const request = {
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22890000001',
        description: 'Test',
        paymentMethod: 'mobile_money',
      } as any;

      it('returns status pending + reason provider_ambiguous when FedaPay reports ambiguous', async () => {
        mockFedaPayService.initiatePayment = jest.fn().mockResolvedValue({
          success: true,
          ambiguous: true,
          transactionId: '777',
          status: 'pending',
          message: 'Payment created; awaiting confirmation',
        });
        jest.spyOn(realService as any, 'selectProvider').mockResolvedValue('fedapay');
        // Unit under test is the response mapping; stub the request conversion.
        jest.spyOn(realService as any, 'convertToProviderRequest').mockReturnValue({ amount: 1000, payer: '+22890000001', channel: 'togocel' });

        const result = await realService.initiatePayment(request, 'REF-AMB');

        expect(mockFedaPayService.initiatePayment).toHaveBeenCalled();
        expect(result).toMatchObject({
          success: true,
          transactionId: '777',
          provider: 'fedapay',
          status: 'pending',
          reason: 'provider_ambiguous',
        });
      });

      it('does not add status/reason for a normal (non-ambiguous) FedaPay success', async () => {
        mockFedaPayService.initiatePayment = jest.fn().mockResolvedValue({
          success: true,
          transactionId: '778',
          status: 'pending',
        });
        jest.spyOn(realService as any, 'selectProvider').mockResolvedValue('fedapay');
        // Unit under test is the response mapping; stub the request conversion.
        jest.spyOn(realService as any, 'convertToProviderRequest').mockReturnValue({ amount: 1000, payer: '+22890000001', channel: 'togocel' });

        const result = await realService.initiatePayment(request, 'REF-OK');

        expect(result.success).toBe(true);
        expect(result).not.toHaveProperty('reason');
      });
    });

    it('controller passes ambiguous status/reason through to API response', async () => {
      const ctx: any = { headers: {} };
      const svc = { 
        resolveProviderFromRequest: jest.fn().mockResolvedValue('fedapay'),
        initiatePayment: jest.fn().mockResolvedValue({
          success: true,
          transactionId: '999',
          status: 'pending',
          reason: 'provider_ambiguous',
          provider: 'fedapay',
          message: 'Payment created; awaiting confirmation',
        }),
      };
      const db = { 
        createTransaction: jest.fn().mockResolvedValue({ id: 'tx-amb', reference: 'REF-AMB' }),
        updateTransaction: jest.fn().mockResolvedValue(undefined),
      };
      const hasuraUser = { getUser: jest.fn().mockResolvedValue({ id: 'user-1' }) };
      const access = { canView: jest.fn().mockResolvedValue(true) };
      const accounts = { getAccountBalance: jest.fn().mockResolvedValue({ availableBalance: 10000, currency: 'XOF' }) };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [MobilePaymentsController],
        providers: [
          { provide: MobilePaymentsService, useValue: svc },
          { provide: MobilePaymentsDatabaseService, useValue: db },
          { provide: AccountsService, useValue: accounts },
          { provide: GiveChangePayoutService, useValue: {} },
          { provide: HasuraUserService, useValue: hasuraUser },
          { provide: MobilePaymentCallbackProcessor, useValue: {} },
          { provide: WithdrawalPinService, useValue: {} },
          { provide: PendingWithdrawalResolveService, useValue: {} },
          { provide: MobileTransactionAccessService, useValue: access },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      const ctrl = module.get(MobilePaymentsController);

      const response = await ctrl.initiatePayment(ctx, {
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22890000001',
        accountId: 'acc-xof',
        transactionType: 'PAYMENT',
      } as any);

      expect(response.success).toBe(true);
      expect(response.data).toMatchObject({
        status: 'pending',
        reason: 'provider_ambiguous',
      });
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

  describe('B5: account currency (controller, ACCOUNT_CURRENCY_MISMATCH)', () => {
    let currencyController: MobilePaymentsController;
    const ctx: any = { headers: {} };

    const svc = {
      resolveProviderFromRequest: jest.fn(),
      isWithdrawalDestinationCmOrGa: jest.fn(),
      initiatePayment: jest.fn(),
    };
    const accounts = {
      getAccountBalance: jest.fn(),
      getBusinessWithdrawalPinStateByAccountId: jest.fn(),
    };
    const db = { createTransaction: jest.fn(), updateTransaction: jest.fn() };
    const giveChange = { executeGiveChangePayout: jest.fn() };
    const hasuraUser = { getUser: jest.fn() };
    const access = { canView: jest.fn() };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [MobilePaymentsController],
        providers: [
          { provide: MobilePaymentsService, useValue: svc },
          { provide: MobilePaymentsDatabaseService, useValue: db },
          { provide: AccountsService, useValue: accounts },
          { provide: GiveChangePayoutService, useValue: giveChange },
          { provide: HasuraUserService, useValue: hasuraUser },
          { provide: MobilePaymentCallbackProcessor, useValue: {} },
          { provide: WithdrawalPinService, useValue: {} },
          { provide: PendingWithdrawalResolveService, useValue: {} },
          { provide: MobileTransactionAccessService, useValue: access },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      currencyController = module.get(MobilePaymentsController);

      hasuraUser.getUser.mockResolvedValue({ id: 'user-1' });
      access.canView.mockResolvedValue(true);
      svc.resolveProviderFromRequest.mockResolvedValue('fedapay');
      svc.isWithdrawalDestinationCmOrGa.mockResolvedValue(true);
      accounts.getAccountBalance.mockResolvedValue({
        availableBalance: 50000,
        currency: 'XAF',
      });
      accounts.getBusinessWithdrawalPinStateByAccountId.mockResolvedValue(null);
    });

    const expectCurrencyMismatch = async (promise: Promise<unknown>, accountId: string) => {
      let caught: any;
      try {
        await promise;
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(HttpException);
      expect(caught.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      const response = caught.getResponse();
      expect(response).toEqual(
        expect.objectContaining({
          error: 'ACCOUNT_CURRENCY_MISMATCH',
          data: { accountCurrency: 'XAF', requiredCurrency: 'XOF' },
        })
      );
      // N4: assert error message includes FedaPay and XOF
      expect(response.message).toMatch(/FedaPay.*XOF/i);
      // N4: assert resolveProviderFromRequest received the real request (accountId)
      expect(svc.resolveProviderFromRequest).toHaveBeenCalledWith(
        expect.objectContaining({ accountId })
      );
    };

    it('rejects a fedapay top-up into a non-XOF account with 400 ACCOUNT_CURRENCY_MISMATCH', async () => {
      await expectCurrencyMismatch(
        currencyController.initiatePayment(ctx, {
          amount: 1000,
          currency: 'XOF',
          customerPhone: '+22896000001',
          accountId: 'acc-xaf',
          transactionType: 'PAYMENT',
        } as any),
        'acc-xaf'
      );
      expect(db.createTransaction).not.toHaveBeenCalled();
      expect(svc.initiatePayment).not.toHaveBeenCalled();
    });

    it('rejects a +228 (fedapay) withdrawal from a non-XOF account with 400 ACCOUNT_CURRENCY_MISMATCH', async () => {
      await expectCurrencyMismatch(
        currencyController.initiatePayment(ctx, {
          amount: 1000,
          currency: 'XOF',
          customerPhone: '+22896000001',
          accountId: 'acc-xaf',
          transactionType: 'GIVE_CHANGE',
        } as any),
        'acc-xaf'
      );
      expect(db.createTransaction).not.toHaveBeenCalled();
      expect(svc.initiatePayment).not.toHaveBeenCalled();
      expect(giveChange.executeGiveChangePayout).not.toHaveBeenCalled();
    });

    it('lets an XOF account past the currency check (control)', async () => {
      accounts.getAccountBalance.mockResolvedValue({
        availableBalance: 50000,
        currency: 'XOF',
      });
      // N4: Make XOF control prove the request passed the currency check
      // by asserting downstream service calls happened
      db.createTransaction.mockResolvedValue({ id: 'tx-1', reference: 'ref-1' });
      svc.initiatePayment.mockResolvedValue({ success: true });
      
      await currencyController.initiatePayment(ctx, {
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22896000001',
        accountId: 'acc-xof',
        transactionType: 'PAYMENT',
      } as any);
      
      // Assert the currency check was passed (account was fetched)
      expect(accounts.getAccountBalance).toHaveBeenCalledWith('acc-xof');
      // Assert resolveProviderFromRequest was called (routing happened)
      expect(svc.resolveProviderFromRequest).toHaveBeenCalled();
    });
  });
});
