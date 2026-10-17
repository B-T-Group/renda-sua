import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { FreemopayService } from './providers/freemopay.service';
import { FedaPayService } from './providers/fedapay.service';
import { MyPVitService } from './providers/mypvit.service';
import { MobilePaymentsController } from './mobile-payments.controller';
import { MobilePaymentsService } from './mobile-payments.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { AccountRechargeService } from '../admin/account-recharge/account-recharge.service';
import { WhatsAppReplyService } from '../notifications/orchestration/whatsapp-reply.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock axios.create to return a proper instance
const mockAxiosInstance = {
  post: jest.fn(),
  get: jest.fn(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  },
};
(axios.create as jest.Mock) = jest.fn(() => mockAxiosInstance);

describe('Production Sanitization & Masking Tests', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('FreemoPay Service Sanitization', () => {
    let service: FreemopayService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FreemopayService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'freemopay') {
                  return {
                    baseUrl: 'https://api.test.com',
                    appKey: 'test-key',
                    secretKey: 'sk_live_secret123',
                    callbackUrl: 'http://test.com/callback',
                    amountMockEnabled: false,
                    mockPendingPhones: [],
                  };
                }
                return null;
              }),
            },
          },
          { provide: ModuleRef, useValue: {} },
        ],
      }).compile();

      service = module.get<FreemopayService>(FreemopayService);
    });

    it('should sanitize Bearer token in initiatePayment error', async () => {
      const axiosError = {
        message: 'Request failed with status 401: Bearer sk_live_secret123',
        response: { status: 401, data: { error: 'Unauthorized' } },
        config: {
          headers: { Authorization: 'Bearer sk_live_secret123' },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(axiosError);

      await expect(
        service.initiatePayment({
          amount: 1000,
          currency: 'XAF',
          description: 'Test',
          customerPhone: '+237677123456',
        })
      ).rejects.toThrow();

      // Verify no log contains the secret
      const allLogCalls = logSpy.mock.calls.flat();
      const hasSecret = allLogCalls.some((arg) =>
        String(arg).includes('sk_live_secret123')
      );
      expect(hasSecret).toBe(false);

      // Verify no log contains Authorization header
      const hasAuthHeader = allLogCalls.some((arg) =>
        String(arg).includes('Authorization')
      );
      expect(hasAuthHeader).toBe(false);
    });

    it('should sanitize secret in withdraw error', async () => {
      const axiosError = {
        message: 'Withdrawal failed: Bearer sk_live_secret123',
        response: { status: 500 },
        config: {
          headers: { Authorization: 'Bearer sk_live_secret123' },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(axiosError);

      await expect(
        service.withdraw({
          amount: 500,
          currency: 'XAF',
          description: 'Withdrawal',
          recipientPhone: '+237677123456',
        })
      ).rejects.toThrow();

      const allLogCalls = logSpy.mock.calls.flat();
      const hasSecret = allLogCalls.some((arg) =>
        String(arg).includes('sk_live_secret123')
      );
      expect(hasSecret).toBe(false);
    });
  });

  describe('Controller Callback Sanitization', () => {
    let controller: MobilePaymentsController;
    let mobilePaymentsService: any;

    beforeEach(async () => {
      const mockDatabaseService = {
        getTransactionByReference: jest.fn(),
        logCallback: jest.fn(),
      };

      mobilePaymentsService = {
        processMyPVitCallback: jest.fn().mockRejectedValue({
          message: 'Callback processing failed: Bearer sk_live_X',
          config: { headers: { Authorization: 'Bearer sk_live_X' } },
        }),
        processFreemopayCallback: jest.fn().mockRejectedValue({
          message: 'FreemoPay callback error: Bearer sk_live_Y',
          config: { headers: { Authorization: 'Bearer sk_live_Y' } },
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [MobilePaymentsController],
        providers: [
          { provide: MobilePaymentsService, useValue: mobilePaymentsService },
          { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
        ],
      }).compile();

      controller = module.get<MobilePaymentsController>(MobilePaymentsController);
    });

    it('should sanitize MyPVit callback errors (controller:672)', async () => {
      const callback = {
        trans_id: '12345',
        status: 'SUCCESS',
        amount: 1000,
      };

      await expect(
        controller.handleMyPVitCallback('mypvit', callback as any)
      ).rejects.toThrow();

      const allLogCalls = logSpy.mock.calls.flat();
      const hasSecret = allLogCalls.some((arg) => String(arg).includes('sk_live_X'));
      expect(hasSecret).toBe(false);
    });

    it('should sanitize FreemoPay callback errors (controller:721)', async () => {
      const callback = {
        transaction_id: '67890',
        status: 'SUCCESS',
        amount: 1000,
      };

      await expect(
        controller.handleFreemopayCallback(callback as any)
      ).rejects.toThrow();

      const allLogCalls = logSpy.mock.calls.flat();
      const hasSecret = allLogCalls.some((arg) => String(arg).includes('sk_live_Y'));
      expect(hasSecret).toBe(false);
    });
  });

  describe('FreemoPay Masking', () => {
    let service: FreemopayService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FreemopayService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'freemopay') {
                  return {
                    baseUrl: 'https://api.test.com',
                    appKey: 'test-key',
                    secretKey: 'secret',
                    callbackUrl: 'http://test.com/callback',
                    amountMockEnabled: false,
                    mockPendingPhones: [],
                  };
                }
                return null;
              }),
            },
          },
          { provide: ModuleRef, useValue: {} },
        ],
      }).compile();

      service = module.get<FreemopayService>(FreemopayService);
    });

    it('should mask phone numbers in FreemoPay logs', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'SUCCESS', transaction_id: 'tx-123' },
      });

      await service.initiatePayment({
        amount: 1000,
        currency: 'XAF',
        description: 'Test',
        customerPhone: '+237677123456',
      });

      const allLogCalls = [
        ...logSpy.mock.calls.flat(),
        ...jest.spyOn(Logger.prototype, 'log').mock.calls.flat(),
      ];
      const hasFullPhone = allLogCalls.some((arg) =>
        String(arg).includes('237677123456')
      );
      expect(hasFullPhone).toBe(false);
    });
  });

  describe('FedaPay Mock Masking', () => {
    let service: FedaPayService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FedaPayService,
          {
            provide: 'FEDAPAY_CONFIG',
            useValue: {
              apiKey: 'test-key',
              environment: 'sandbox',
              mockEnabled: true,
            },
          },
        ],
      }).compile();

      service = module.get<FedaPayService>(FedaPayService);
    });

    it('should mask phone numbers in FedaPay mock logs', async () => {
      await service.mockInitiatePayment({
        amount: 1000,
        currency: 'XOF',
        description: 'Test',
        customer: { phone_number: { number: '+22890123456' } },
      });

      const allLogCalls = [
        ...logSpy.mock.calls.flat(),
        ...jest.spyOn(Logger.prototype, 'log').mock.calls.flat(),
      ];
      const hasFullPhone = allLogCalls.some((arg) =>
        String(arg).includes('22890123456')
      );
      expect(hasFullPhone).toBe(false);
    });
  });

  describe('MyPVit KYC Masking', () => {
    let service: MyPVitService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MyPVitService,
          {
            provide: 'MYPVIT_CONFIG',
            useValue: {
              apiUrl: 'https://api.test.com',
              moovApiKey: 'moov-key',
              airtelApiKey: 'airtel-key',
            },
          },
        ],
      }).compile();

      service = module.get<MyPVitService>(MyPVitService);
    });

    it('should mask phone numbers in MyPVit KYC logs (mypvit:605)', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'SUCCESS', kyc_verified: true },
      });

      await service.performKYC({
        customerPhone: '+241062345678',
        amount: 1000,
        operatorCode: 'AIRTEL',
      });

      const allLogCalls = [
        ...logSpy.mock.calls.flat(),
        ...jest.spyOn(Logger.prototype, 'log').mock.calls.flat(),
      ];
      const hasFullPhone = allLogCalls.some((arg) =>
        String(arg).includes('241062345678')
      );
      expect(hasFullPhone).toBe(false);
    });
  });

  describe('AccountRechargeService Masking', () => {
    let service: AccountRechargeService;

    beforeEach(async () => {
      const mockMobilePaymentsService = {
        initiatePayment: jest.fn().mockResolvedValue({
          success: true,
          transactionId: 'tx-123',
        }),
        getProvider: jest.fn().mockReturnValue('mypvit'),
        scheduleMockCallback: jest.fn(),
      };

      const mockDatabaseService = {
        createTransaction: jest.fn().mockResolvedValue({ id: 'tx-1' }),
        updateTransaction: jest.fn(),
      };

      const mockHasuraService = {
        query: jest.fn().mockResolvedValue({
          users: [{ id: 'user-1', accounts: [{ id: 'acc-1' }] }],
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AccountRechargeService,
          { provide: MobilePaymentsService, useValue: mockMobilePaymentsService },
          { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
          { provide: 'HasuraSystemService', useValue: mockHasuraService },
        ],
      }).compile();

      service = module.get<AccountRechargeService>(AccountRechargeService);
    });

    it('should mask phone numbers in recharge logs (account-recharge:78)', async () => {
      await service.initiateRecharge({
        countryCode: '+241',
        phoneNumber: '062345678',
        amount: 5000,
      });

      const allLogCalls = [
        ...logSpy.mock.calls.flat(),
        ...jest.spyOn(Logger.prototype, 'log').mock.calls.flat(),
      ];
      const hasFullPhone = allLogCalls.some((arg) =>
        String(arg).includes('241062345678')
      );
      expect(hasFullPhone).toBe(false);
    });
  });

  describe('WhatsApp STOP Masking', () => {
    let service: WhatsAppReplyService;

    beforeEach(async () => {
      const mockWhatsAppService = {
        sendMessage: jest.fn(),
      };

      const mockHasuraService = {
        query: jest.fn(),
        executeMutation: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WhatsAppReplyService,
          { provide: 'WhatsAppService', useValue: mockWhatsAppService },
          { provide: 'HasuraSystemService', useValue: mockHasuraService },
        ],
      }).compile();

      service = module.get<WhatsAppReplyService>(WhatsAppReplyService);
    });

    it('should mask phone numbers in WhatsApp STOP logs (whatsapp-reply:524)', async () => {
      await service.handleStopCommand('+237677123456');

      const allLogCalls = [
        ...logSpy.mock.calls.flat(),
        ...jest.spyOn(Logger.prototype, 'log').mock.calls.flat(),
      ];
      const hasFullPhone = allLogCalls.some((arg) =>
        String(arg).includes('237677123456')
      );
      expect(hasFullPhone).toBe(false);
    });
  });
});
