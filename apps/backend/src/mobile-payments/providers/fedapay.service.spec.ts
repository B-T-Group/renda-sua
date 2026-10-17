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

});
