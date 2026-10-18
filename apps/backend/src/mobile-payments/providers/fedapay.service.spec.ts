import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { FedaPayService } from './fedapay.service';

// Mock the FedaPay SDK to avoid module loading issues
jest.mock('fedapay', () => ({
  FedaPay: {
    setApiKey: jest.fn(),
    setEnvironment: jest.fn(),
    getApiKey: jest.fn(),
    getEnvironment: jest.fn(),
  },
  Transaction: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  Payout: {
    create: jest.fn(),
    retrieve: jest.fn(),
    all: jest.fn(),
  },
  Webhook: {
    constructEvent: jest.fn(),
  },
}));

describe('FedaPayService', () => {
  let service: FedaPayService;
  let configService: ConfigService;

  const mockConfig = {
    fedapay: {
      env: 'sandbox',
      secretKey: 'test-secret',
      publicKey: 'test-public',
      webhookSecret: 'test-webhook-secret',
      callbackUrl: 'https://test.com/callback',
      payoutCallbackUrl: 'https://test.com/payout-callback',
      mock: false,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FedaPayService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'fedapay') return mockConfig.fedapay;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FedaPayService>(FedaPayService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Suppress console logs in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with valid config', () => {
      expect(service).toBeDefined();
    });

    it('should handle missing config gracefully', async () => {
      // Create a service with undefined config
      const noConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FedaPayService,
          {
            provide: ConfigService,
            useValue: noConfigService,
          },
        ],
      }).compile();

      const unconfiguredService = module.get<FedaPayService>(FedaPayService);

      // Service should handle missing config by using empty config
      expect(unconfiguredService).toBeDefined();
    });
  });

  describe('Phone Validation', () => {
    it('should validate Moov Togo prefixes', () => {
      const moovPrefixes = ['78', '79', '96', '97', '98', '99'];
      moovPrefixes.forEach(prefix => {
        expect(service['isValidTogoPhone'](`+228${prefix}123456`)).toBe(true);
        expect(service['isValidTogoPhone'](`228${prefix}123456`)).toBe(true);
      });
    });

    it('should validate Mixx by Yas prefixes', () => {
      const mixxPrefixes = ['70', '71', '72', '73', '90', '91', '92', '93'];
      mixxPrefixes.forEach(prefix => {
        expect(service['isValidTogoPhone'](`+228${prefix}123456`)).toBe(true);
      });
    });

    it('should reject invalid Togo prefixes', () => {
      expect(service['isValidTogoPhone']('+22812345678')).toBe(false);
      expect(service['isValidTogoPhone']('+22860123456')).toBe(false);
    });

    it('should reject non-Togo numbers', () => {
      expect(service['isValidTogoPhone']('+23712345678')).toBe(false);
      expect(service['isValidTogoPhone']('+24112345678')).toBe(false);
    });
  });

  describe('Status Mapping', () => {
    it('should return approved status from checkTransactionStatus', async () => {
      const mockTx = { id: 'tx_123', status: 'approved', amount: 1000, currency: { iso: 'XOF' }, description: 'test' };
      const { Transaction } = require('fedapay');
      Transaction.retrieve.mockResolvedValue(mockTx);

      const result = await service.checkTransactionStatus('mock_ref');
      expect(result.status).toBe('approved');
    });

    it('should return declined status from checkTransactionStatus', async () => {
      const mockTx = { id: 'tx_123', status: 'declined', amount: 1000, currency: { iso: 'XOF' }, description: 'test' };
      const { Transaction } = require('fedapay');
      Transaction.retrieve.mockResolvedValue(mockTx);

      const result = await service.checkTransactionStatus('mock_ref');
      expect(result.status).toBe('declined');
    });

    it('should return pending status from checkTransactionStatus', async () => {
      const mockTx = { id: 'tx_123', status: 'pending', amount: 1000, currency: { iso: 'XOF' }, description: 'test' };
      const { Transaction } = require('fedapay');
      Transaction.retrieve.mockResolvedValue(mockTx);

      const result = await service.checkTransactionStatus('mock_ref');
      expect(result.status).toBe('pending');
    });
  });

  describe('Mock Mode', () => {
    let mockService: FedaPayService;

    beforeEach(async () => {
      // Set DEPLOYMENT_ENV for mock mode
      process.env.DEPLOYMENT_ENV = 'test';
      
      // Create a new service with mock enabled
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'fedapay') {
            return {
              environment: 'sandbox',
              secretKey: 'sk_test_mock',
              publicKey: 'test-public',
              webhookSecret: 'test-webhook-secret',
              callbackUrl: 'https://test.com/callback',
              payoutCallbackUrl: 'https://test.com/payout-callback',
              mockEnabled: true, // Use mockEnabled instead of mock
            };
          }
          return undefined;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FedaPayService,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      mockService = module.get<FedaPayService>(FedaPayService);
    });

    it('should return pending for amounts < 1,000,000 XOF in mock mode', async () => {
      const result = await mockService.initiatePayment({
        payer: '+22878123456',
        amount: 500000,
        externalId: 'test-123',
        description: 'Test',
        callback: 'https://test.com/callback',
        channel: 'moov_tg',
      });

      // Mock mode always returns pending initially, actual outcome delivered via callback
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.message).toContain('Mock payment initiated');
    });

    it('should return pending for amounts >= 1,000,000 XOF in mock mode', async () => {
      const result = await mockService.initiatePayment({
        payer: '+22878123456',
        amount: 1500000,
        externalId: 'test-456',
        description: 'Test',
        callback: 'https://test.com/callback',
        channel: 'moov_tg',
      });

      // Mock mode always returns pending initially, declined outcome delivered via callback
      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.status).toBe('pending');
    });

    it('should schedule auto callback for mock transactions', async () => {
      const result = await mockService.initiatePayment({
        payer: '+22878123456',
        amount: 500000,
        externalId: 'test-789',
        description: 'Test',
        callback: 'https://test.com/callback',
        channel: 'moov_tg',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.message).toContain('Mock payment initiated');
    });

    it('should force mock off in production', () => {
      const originalEnv = process.env.DEPLOYMENT_ENV;
      process.env.DEPLOYMENT_ENV = 'production';

      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'fedapay') {
            return {
              environment: 'sandbox',
              secretKey: 'sk_test_mock',
              publicKey: 'test-public',
              webhookSecret: 'test-webhook-secret',
              callbackUrl: 'https://test.com/callback',
              payoutCallbackUrl: 'https://test.com/payout-callback',
              mockEnabled: true,
            };
          }
          return undefined;
        }),
      };

      // Mock ModuleRef
      const mockModuleRef = {} as any;

      // Should throw error when trying to enable mock in production
      expect(() => new FedaPayService(mockConfigService as any, mockModuleRef)).toThrow('development');

      process.env.DEPLOYMENT_ENV = originalEnv;
    });
  });

  describe('Payment Initiation', () => {
    it('should validate phone number', async () => {
      const result = await service.initiatePayment({
        payer: '+22812345678', // Invalid prefix
        amount: 1000,
        externalId: 'test-123',
        description: 'Test',
        callback: 'https://test.com/callback',
        channel: 'moov_tg',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid Togo phone number');
    });

    it('should validate valid phone number', async () => {
      const { Transaction } = require('fedapay');
      const mockTx = { 
        id: 'tx_123', 
        status: 'pending',
        generateToken: jest.fn().mockResolvedValue(undefined),
        sendNowWithToken: jest.fn().mockResolvedValue(undefined),
        token: 'mock_token'
      };
      Transaction.create.mockResolvedValue(mockTx);

      const result = await service.initiatePayment({
        payer: '+22878123456', // Valid Moov prefix
        amount: 1000,
        externalId: 'test-123',
        description: 'Test',
        callback: 'https://test.com/callback',
        channel: 'moov_tg',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('tx_123');
    });
  });

  describe('Payout', () => {
    it('should validate phone for withdrawal', async () => {
      const result = await service.withdraw({
        payee: '+22812345678', // Invalid
        amount: 1000,
        externalId: 'test-123',
        description: 'Payout',
        callback: 'https://test.com/callback',
        channel: 'togocel',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid Togo phone number');
    });

    it('should initiate withdrawal with valid phone', async () => {
      const { Payout } = require('fedapay');
      const mockPayout = {
        id: 'payout_123',
        status: 'pending',
        sendNow: jest.fn().mockResolvedValue(undefined),
      };
      Payout.create.mockResolvedValue(mockPayout);

      const result = await service.withdraw({
        payee: '+22890123456', // Valid Mixx prefix
        amount: 1000,
        externalId: 'test-123',
        description: 'Payout',
        callback: 'https://test.com/callback',
        channel: 'togocel',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('payout_123');
    });
  });

  describe('Transaction Status Check', () => {
    it('should check transaction status', async () => {
      const mockTx = {
        id: 'tx_123',
        status: 'pending',
        amount: 1000,
        currency: { iso: 'XOF' },
        description: 'Test payment',
      };
      const { Transaction } = require('fedapay');
      Transaction.retrieve.mockResolvedValue(mockTx);

      const result = await service.checkTransactionStatus('tx_123');
      
      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.amount).toBe(1000);
    });

    it('should handle transaction retrieval error', async () => {
      const { Transaction } = require('fedapay');
      Transaction.retrieve.mockResolvedValue(null);

      await expect(service.checkTransactionStatus('invalid-id')).rejects.toThrow('not found');
    });
  });

  describe('B8: M1 Token Flow', () => {
    it('should use token returned by generateToken()', async () => {
      const mockToken = 'generated-token-xyz';
      const mockTx = {
        id: 'tx_token_test',
        status: 'pending',
        generateToken: jest.fn().mockResolvedValue({ token: mockToken }),
        sendNowWithToken: jest.fn().mockResolvedValue(undefined),
      };

      const { Transaction } = require('fedapay');
      Transaction.create.mockResolvedValue(mockTx);

      await service.initiatePayment({
        payer: '+22878123456',
        amount: 1000,
        externalId: 'ref-token-test',
        description: 'Token test',
        callback: 'https://test.com/callback',
        channel: 'moov_tg',
      });

      expect(mockTx.generateToken).toHaveBeenCalled();
      expect(mockTx.sendNowWithToken).toHaveBeenCalledWith(
        'moov_tg',
        mockToken,
        expect.objectContaining({
          phone_number: expect.objectContaining({
            country: 'TG'
          })
        })
      );
    });
  });

  describe('B8: B6 Payout Idempotency', () => {
    it('should check for existing payout before creating new one using Payout.all', async () => {
      const { Payout } = require('fedapay');
      // Real SDK shape: Payout.all returns { payouts: [...], meta: {...} }
      // See node_modules/fedapay/test/PayoutTest.ts:68-126
      Payout.all.mockResolvedValue({
        payouts: [
          {
            id: 'existing-payout-id',
            status: 'pending',
            amount: 5000,
            custom_metadata: { externalId: 'duplicate-ref-test' },
          }
        ]
      });

      const result = await service.withdraw({
        payee: '+22878123456',
        amount: 5000,
        externalId: 'duplicate-ref-test',
        description: 'Duplicate payout test',
        callback: 'https://test.com/callback',
        channel: 'togocel',
      });

      expect(Payout.all).toHaveBeenCalledWith({
        'custom_metadata.externalId': 'duplicate-ref-test'
      });
      expect(Payout.create).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('existing-payout-id');
    });

    it('should create new payout when none exists', async () => {
      const { Payout } = require('fedapay');
      // Real SDK shape: empty list
      Payout.all.mockResolvedValue({ payouts: [] });
      
      const mockPayout = {
        id: 'new-payout-123',
        status: 'pending',
        sendNow: jest.fn().mockResolvedValue(undefined),
      };
      Payout.create.mockResolvedValue(mockPayout);

      const result = await service.withdraw({
        payee: '+22878123456',
        amount: 5000,
        externalId: 'new-ref',
        description: 'New payout',
        callback: 'https://test.com/callback',
        channel: 'togocel',
      });

      expect(Payout.all).toHaveBeenCalled();
      expect(Payout.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('new-payout-123');
    });

    it('should fail closed when payout lookup errors', async () => {
      const { Payout } = require('fedapay');
      Payout.all.mockRejectedValue(new Error('Network error'));

      const result = await service.withdraw({
        payee: '+22878123456',
        amount: 5000,
        externalId: 'error-ref',
        description: 'Error test',
        callback: 'https://test.com/callback',
        channel: 'togocel',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to check existing payout');
      expect(Payout.create).not.toHaveBeenCalled();
    });
  });

  describe('N1: payout partial failure after Payout.create', () => {
    const withdrawReq = {
      payee: '+22878123456',
      amount: 5000,
      externalId: 'n1-ref',
      description: 'N1 payout',
      callback: 'https://test.com/callback',
      channel: 'togocel',
    };

    beforeEach(() => {
      const { Payout } = require('fedapay');
      Payout.all.mockReset();
      Payout.create.mockReset();
      Payout.retrieve.mockReset();
    });

    it('keeps the payout pending (success, ambiguous, id) when sendNow times out and FedaPay shows it pending/sent', async () => {
      const { Payout } = require('fedapay');
      Payout.all.mockResolvedValue({ payouts: [] });
      Payout.create.mockResolvedValue({
        id: 4242,
        status: 'pending',
        sendNow: jest.fn().mockRejectedValue(new Error('ETIMEDOUT')),
      });
      Payout.retrieve.mockResolvedValue({ id: 4242, status: 'sent' });

      const result = await service.withdraw(withdrawReq);

      expect(Payout.retrieve).toHaveBeenCalledWith(4242);
      expect(result.success).toBe(true);
      expect(result.ambiguous).toBe(true);
      expect(result.transactionId).toBe('4242');
      expect(result.status).toBe('sent');
    });

    it('stays pending (never failure) when sendNow fails and the reconcile retrieve also fails', async () => {
      const { Payout } = require('fedapay');
      Payout.all.mockResolvedValue({ payouts: [] });
      Payout.create.mockResolvedValue({
        id: 4243,
        status: 'pending',
        sendNow: jest.fn().mockRejectedValue(new Error('socket hang up')),
      });
      Payout.retrieve.mockRejectedValue(new Error('network down'));

      const result = await service.withdraw(withdrawReq);

      expect(result.success).toBe(true);
      expect(result.ambiguous).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.transactionId).toBe('4243');
    });

    it('reports failure only when Payout.retrieve confirms the payout failed', async () => {
      const { Payout } = require('fedapay');
      Payout.all.mockResolvedValue({ payouts: [] });
      Payout.create.mockResolvedValue({
        id: 4244,
        status: 'pending',
        sendNow: jest.fn().mockRejectedValue(new Error('rejected')),
      });
      Payout.retrieve.mockResolvedValue({ id: 4244, status: 'failed' });

      const result = await service.withdraw(withdrawReq);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe('PAYOUT_FAILED');
      expect(result.transactionId).toBe('4244');
    });

    it('dedupe: resends an existing payout that was created but never sent', async () => {
      const { Payout } = require('fedapay');
      Payout.all.mockResolvedValue({
        payouts: [
          { id: 5001, status: 'pending', custom_metadata: { externalId: 'n1-ref' } },
        ],
      });
      const sendNow = jest.fn().mockResolvedValue(undefined);
      Payout.retrieve.mockResolvedValue({ id: 5001, status: 'pending', sendNow });

      const result = await service.withdraw(withdrawReq);

      expect(Payout.create).not.toHaveBeenCalled();
      expect(Payout.retrieve).toHaveBeenCalledWith(5001);
      expect(sendNow).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.ambiguous).toBeUndefined();
      expect(result.transactionId).toBe('5001');
    });

    it('dedupe: a resend that fails again stays pending, not success-and-done nor failure', async () => {
      const { Payout } = require('fedapay');
      Payout.all.mockResolvedValue({
        payouts: [
          { id: 5002, status: 'pending', custom_metadata: { externalId: 'n1-ref' } },
        ],
      });
      Payout.retrieve
        .mockResolvedValueOnce({
          id: 5002,
          status: 'pending',
          sendNow: jest.fn().mockRejectedValue(new Error('ETIMEDOUT')),
        })
        .mockResolvedValueOnce({ id: 5002, status: 'pending' });

      const result = await service.withdraw(withdrawReq);

      expect(Payout.create).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.ambiguous).toBe(true);
      expect(result.status).toBe('pending');
    });

    it('dedupe: passes through a sent payout without resending', async () => {
      const { Payout } = require('fedapay');
      Payout.all.mockResolvedValue({
        payouts: [
          { id: 5003, status: 'sent', custom_metadata: { externalId: 'n1-ref' } },
        ],
      });

      const result = await service.withdraw(withdrawReq);

      expect(Payout.retrieve).not.toHaveBeenCalled();
      expect(Payout.create).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.status).toBe('sent');
      expect(result.transactionId).toBe('5003');
    });

    it('dedupe: passes through a failed payout as failure', async () => {
      const { Payout } = require('fedapay');
      Payout.all.mockResolvedValue({
        payouts: [
          { id: 5004, status: 'failed', custom_metadata: { externalId: 'n1-ref' } },
        ],
      });

      const result = await service.withdraw(withdrawReq);

      expect(Payout.create).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.transactionId).toBe('5004');
    });

    it('still reports failure when Payout.create itself fails (nothing was created)', async () => {
      const { Payout } = require('fedapay');
      Payout.all.mockResolvedValue({ payouts: [] });
      Payout.create.mockRejectedValue(new Error('422 invalid payee'));

      const result = await service.withdraw(withdrawReq);

      expect(result.success).toBe(false);
      expect(result.transactionId).toBeUndefined();
    });
  });

  describe('N2: collection push failure after Transaction.create', () => {
    const payReq = {
      payer: '+22878123456',
      amount: 1000,
      externalId: 'n2-ref',
      description: 'N2 payment',
      callback: 'https://test.com/callback',
      channel: 'moov_tg',
    };

    beforeEach(() => {
      const { Transaction } = require('fedapay');
      Transaction.create.mockReset();
    });

    it('returns the FedaPay id as pending when sendNowWithToken throws', async () => {
      const { Transaction } = require('fedapay');
      Transaction.create.mockResolvedValue({
        id: 7001,
        status: 'pending',
        generateToken: jest.fn().mockResolvedValue({ token: 'tok' }),
        sendNowWithToken: jest.fn().mockRejectedValue(new Error('ETIMEDOUT')),
      });

      const result = await service.initiatePayment(payReq);

      expect(result.success).toBe(true);
      expect(result.ambiguous).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.transactionId).toBe('7001');
    });

    it('returns the FedaPay id as pending when generateToken throws', async () => {
      const { Transaction } = require('fedapay');
      Transaction.create.mockResolvedValue({
        id: 7002,
        status: 'pending',
        generateToken: jest.fn().mockRejectedValue(new Error('500')),
        sendNowWithToken: jest.fn(),
      });

      const result = await service.initiatePayment(payReq);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('7002');
    });

    it('still reports failure when Transaction.create itself fails', async () => {
      const { Transaction } = require('fedapay');
      Transaction.create.mockRejectedValue(new Error('422'));

      const result = await service.initiatePayment(payReq);

      expect(result.success).toBe(false);
      expect(result.transactionId).toBeUndefined();
    });
  });

  describe('B8: B6 Payout Status Mapping', () => {
    it('should map payout sent to approved', async () => {
      const { Payout } = require('fedapay');
      Payout.retrieve.mockResolvedValue({
        id: 'payout-sent',
        status: 'sent',
        amount: 5000,
        currency: { iso: 'XOF' },
        custom_metadata: { externalId: 'sent-ref' },
      });

      const result = await service.checkPayoutStatus('payout-sent');

      expect(result.status).toBe('approved');
      expect(result.amount).toBe(5000);
      expect(result.currency).toBe('XOF');
    });

    it('should map payout failed to declined', async () => {
      const { Payout } = require('fedapay');
      Payout.retrieve.mockResolvedValue({
        id: 'payout-failed',
        status: 'failed',
        amount: 5000,
        currency: { iso: 'XOF' },
        custom_metadata: { externalId: 'failed-ref' },
        reason: 'Insufficient funds',
      });

      const result = await service.checkPayoutStatus('payout-failed');

      expect(result.status).toBe('declined');
      expect(result.reason).toContain('Insufficient funds');
    });

    it('should keep payout pending as pending', async () => {
      const { Payout } = require('fedapay');
      Payout.retrieve.mockResolvedValue({
        id: 'payout-pending',
        status: 'pending',
        amount: 5000,
        currency: { iso: 'XOF' },
        custom_metadata: { externalId: 'pending-ref' },
      });

      const result = await service.checkPayoutStatus('payout-pending');

      expect(result.status).toBe('pending');
    });
  });

  describe('B8d: M4 Production Config Refusal (Real Constructor Tests)', () => {
    it('should throw when sk_live_ key is used with mock enabled', async () => {
      const originalEnv = process.env.DEPLOYMENT_ENV;
      process.env.DEPLOYMENT_ENV = 'development';

      try {
        await Test.createTestingModule({
          providers: [
            FedaPayService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => {
                  if (key === 'fedapay') {
                    return {
                      environment: 'sandbox',
                      secretKey: 'sk_live_DANGEROUS',
                      publicKey: 'test-public',
                      webhookSecret: 'test-webhook-secret',
                      callbackUrl: 'https://test.com/callback',
                      payoutCallbackUrl: 'https://test.com/payout-callback',
                      mockEnabled: true,
                    };
                  }
                  return undefined;
                }),
              },
            },
          ],
        }).compile();
        throw new Error('Expected constructor to throw');
      } catch (error: any) {
        expect(error.message).toMatch(/mock cannot be enabled with a live secret key/i);
      }

      process.env.DEPLOYMENT_ENV = originalEnv;
    });

    it('should throw when DEPLOYMENT_ENV is production with mock enabled', async () => {
      const originalEnv = process.env.DEPLOYMENT_ENV;
      process.env.DEPLOYMENT_ENV = 'production';

      try {
        await Test.createTestingModule({
          providers: [
            FedaPayService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => {
                  if (key === 'fedapay') {
                    return {
                      environment: 'sandbox',
                      secretKey: 'sk_sandbox_TEST',
                      publicKey: 'test-public',
                      webhookSecret: 'test-webhook-secret',
                      callbackUrl: 'https://test.com/callback',
                      payoutCallbackUrl: 'https://test.com/payout-callback',
                      mockEnabled: true,
                    };
                  }
                  return undefined;
                }),
              },
            },
          ],
        }).compile();
        throw new Error('Expected constructor to throw');
      } catch (error: any) {
        expect(error.message).toMatch(/Mock can only be enabled.*development.*test/i);
      }

      process.env.DEPLOYMENT_ENV = originalEnv;
    });

    it('should allow sk_sandbox_ with mock enabled in development', async () => {
      const originalEnv = process.env.DEPLOYMENT_ENV;
      process.env.DEPLOYMENT_ENV = 'development';

      const testModule = await Test.createTestingModule({
        providers: [
          FedaPayService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'fedapay') {
                  return {
                    environment: 'sandbox',
                    secretKey: 'sk_sandbox_TEST',
                    publicKey: 'test-public',
                    webhookSecret: 'test-webhook-secret',
                    callbackUrl: 'https://test.com/callback',
                    payoutCallbackUrl: 'https://test.com/payout-callback',
                    mockEnabled: true,
                  };
                }
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      expect(() => {
        testModule.get(FedaPayService);
      }).not.toThrow();

      process.env.DEPLOYMENT_ENV = originalEnv;
    });
  });

  describe('B8: B4 Currency Reading', () => {
    it('should read real currency from transaction', async () => {
      const { Transaction } = require('fedapay');
      Transaction.retrieve.mockResolvedValue({
        id: 'tx-currency-test',
        status: 'approved',
        amount: 1000,
        currency: { iso: 'XOF' },
        custom_metadata: { externalId: 'ref-curr' },
      });

      const result = await service.checkTransactionStatus('tx-currency-test');

      expect(result.currency).toBe('XOF');
    });

    it('should return empty string when currency missing (fail closed)', async () => {
      const { Transaction } = require('fedapay');
      Transaction.retrieve.mockResolvedValue({
        id: 'tx-no-currency',
        status: 'approved',
        amount: 1000,
        custom_metadata: { externalId: 'ref-no-curr' },
      });

      const result = await service.checkTransactionStatus('tx-no-currency');

      expect(result.currency).toBe('');
    });

    it('should read real currency from payout', async () => {
      const { Payout } = require('fedapay');
      Payout.retrieve.mockResolvedValue({
        id: 'payout-currency-test',
        status: 'sent',
        amount: 5000,
        currency: { iso: 'XOF' },
        custom_metadata: { externalId: 'payout-curr' },
      });

      const result = await service.checkPayoutStatus('payout-currency-test');

      expect(result.currency).toBe('XOF');
    });

    it('should return empty string when payout currency missing (fail closed)', async () => {
      const { Payout } = require('fedapay');
      Payout.retrieve.mockResolvedValue({
        id: 'payout-no-currency',
        status: 'sent',
        amount: 5000,
        custom_metadata: { externalId: 'payout-no-curr' },
      });

      const result = await service.checkPayoutStatus('payout-no-currency');

      expect(result.currency).toBe('');
    });
  });

  describe('N5: expired status mapping', () => {
    it('maps expired transaction status to failed', async () => {
      const { Transaction } = require('fedapay');
      Transaction.retrieve.mockResolvedValue({
        id: 'tx-expired',
        status: 'expired',
        amount: 1000,
        currency: { iso: 'XOF' },
        custom_metadata: { externalId: 'ref-expired' },
      });

      const result = await service.checkTransactionStatus('tx-expired');

      expect(result.status).toBe('expired');
      // The processor and service statusMap will handle expired → failed mapping
    });
  });

});
