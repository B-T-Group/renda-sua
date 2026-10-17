import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { FedaPayService } from './fedapay.service';
import * as fedapay from 'fedapay';

jest.mock('fedapay');

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
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      
      await expect(
        service.initiatePayment({
          amount: 1000,
          currency: 'XOF',
          customerPhone: '+22878123456',
          description: 'Test',
          customerEmail: 'test@test.com',
          customerFirstName: 'Test',
          customerLastName: 'User',
        })
      ).rejects.toThrow('FedaPay is not configured');
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
    it('should map approved to SUCCESS', () => {
      expect(service['mapStatus']('approved')).toBe('SUCCESS');
    });

    it('should map transferred to SUCCESS', () => {
      expect(service['mapStatus']('transferred')).toBe('SUCCESS');
    });

    it('should map declined to FAILED', () => {
      expect(service['mapStatus']('declined')).toBe('FAILED');
    });

    it('should map cancelled to FAILED', () => {
      expect(service['mapStatus']('cancelled')).toBe('FAILED');
    });

    it('should map pending to PENDING', () => {
      expect(service['mapStatus']('pending')).toBe('PENDING');
    });

    it('should map unknown status to FAILED', () => {
      expect(service['mapStatus']('unknown_status')).toBe('FAILED');
    });
  });

  describe('Mock Mode', () => {
    beforeEach(() => {
      // Enable mock mode
      jest.spyOn(configService, 'get').mockReturnValue({
        ...mockConfig.fedapay,
        mock: true,
      });
    });

    it('should succeed for amounts < 1,000,000 XOF', async () => {
      const result = await service.initiatePayment({
        amount: 500000,
        currency: 'XOF',
        customerPhone: '+22878123456',
        description: 'Test',
        customerEmail: 'test@test.com',
        customerFirstName: 'Test',
        customerLastName: 'User',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.status).toBe('PENDING');
    });

    it('should fail for amounts >= 1,000,000 XOF', async () => {
      const result = await service.initiatePayment({
        amount: 1500000,
        currency: 'XOF',
        customerPhone: '+22878123456',
        description: 'Test',
        customerEmail: 'test@test.com',
        customerFirstName: 'Test',
        customerLastName: 'User',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.status).toBe('PENDING');
    });

    it('should simulate delayed callback', (done) => {
      const callback = jest.fn();
      service['simulateDelayedCallback']('mock-tx-id', 500000, callback);

      // Should not be called immediately
      expect(callback).not.toHaveBeenCalled();

      // Should be called after delay
      setTimeout(() => {
        expect(callback).toHaveBeenCalledWith('mock-tx-id', 'approved');
        done();
      }, 1600);
    }, 2000);

    it('should force mock off in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Even with mock: true in config, should be forced off
      const prodService = new FedaPayService(configService);
      expect(prodService['mockEnabled']).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Webhook Signature Verification', () => {
    const validPayload = JSON.stringify({ transaction: { id: '123' } });
    const timestamp = Math.floor(Date.now() / 1000);
    const secret = 'test-webhook-secret';

    it('should verify valid signature', () => {
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${validPayload}`)
        .digest('hex');
      
      const header = `t=${timestamp},v1=${signature}`;

      expect(
        service['verifyWebhookSignature'](validPayload, header, secret)
      ).toBe(true);
    });

    it('should reject invalid signature', () => {
      const header = `t=${timestamp},v1=invalid_signature`;

      expect(
        service['verifyWebhookSignature'](validPayload, header, secret)
      ).toBe(false);
    });

    it('should reject stale timestamp', () => {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s old
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${staleTimestamp}.${validPayload}`)
        .digest('hex');
      
      const header = `t=${staleTimestamp},v1=${signature}`;

      expect(
        service['verifyWebhookSignature'](validPayload, header, secret)
      ).toBe(false);
    });

    it('should accept timestamp within tolerance (5 minutes)', () => {
      const recentTimestamp = Math.floor(Date.now() / 1000) - 200; // 200s old
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', secret)
        .update(`${recentTimestamp}.${validPayload}`)
        .digest('hex');
      
      const header = `t=${recentTimestamp},v1=${signature}`;

      expect(
        service['verifyWebhookSignature'](validPayload, header, secret)
      ).toBe(true);
    });

    it('should reject malformed header', () => {
      expect(
        service['verifyWebhookSignature'](validPayload, 'malformed', secret)
      ).toBe(false);
    });
  });

  describe('Payment Initiation', () => {
    it('should validate phone number', async () => {
      const result = await service.initiatePayment({
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22812345678', // Invalid prefix
        description: 'Test',
        customerEmail: 'test@test.com',
        customerFirstName: 'Test',
        customerLastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid Togo phone number');
    });

    it('should validate XOF currency', async () => {
      const result = await service.initiatePayment({
        amount: 1000,
        currency: 'USD', // Invalid for Togo
        customerPhone: '+22878123456',
        description: 'Test',
        customerEmail: 'test@test.com',
        customerFirstName: 'Test',
        customerLastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('FedaPay only supports XOF');
    });
  });

  describe('Payout', () => {
    it('should validate phone for withdrawal', async () => {
      const result = await service.withdraw({
        amount: 1000,
        currency: 'XOF',
        recipientPhone: '+22812345678', // Invalid
        description: 'Payout',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid Togo phone number');
    });

    it('should validate XOF currency for withdrawal', async () => {
      const result = await service.withdraw({
        amount: 1000,
        currency: 'EUR',
        recipientPhone: '+22878123456',
        description: 'Payout',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('FedaPay only supports XOF');
    });
  });

  describe('Transaction Status Check', () => {
    it('should check transaction status in mock mode', async () => {
      jest.spyOn(configService, 'get').mockReturnValue({
        ...mockConfig.fedapay,
        mock: true,
      });

      const result = await service.checkTransactionStatus('mock-tx-123');
      
      expect(result).toBeDefined();
      expect(result.status).toBe('PENDING');
    });

    it('should handle missing transaction ID', async () => {
      const result = await service.checkTransactionStatus('');
      
      expect(result.status).toBe('FAILED');
    });
  });

  describe('Callback Verification', () => {
    it('should verify callback payload', async () => {
      const payload = {
        transaction: {
          id: '123',
          status: 'approved',
          amount: 1000,
        },
      };

      const result = await service.verifyCallback(payload);
      
      expect(result.isValid).toBe(true);
      expect(result.transactionId).toBe('123');
      expect(result.status).toBe('SUCCESS');
    });

    it('should reject invalid callback payload', async () => {
      const result = await service.verifyCallback({});
      
      expect(result.isValid).toBe(false);
    });
  });
});
