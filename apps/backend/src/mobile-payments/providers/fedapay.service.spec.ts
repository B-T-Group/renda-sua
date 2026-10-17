import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { FedaPayService } from './fedapay.service';

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
      mock: true, // Use mock mode for tests
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
  });

  describe('Mock Mode', () => {
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

    it('should force mock off in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const prodService = new FedaPayService(configService);
      expect(prodService['mockEnabled']).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Payment Initiation', () => {
    it('should validate phone number in mock mode', async () => {
      const result = await service.initiatePayment({
        amount: 1000,
        currency: 'XOF',
        customerPhone: '+22812345678',
        description: 'Test',
        customerEmail: 'test@test.com',
        customerFirstName: 'Test',
        customerLastName: 'User',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid Togo phone number');
    });

    it('should validate XOF currency in mock mode', async () => {
      const result = await service.initiatePayment({
        amount: 1000,
        currency: 'USD',
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
      const staleTimestamp = Math.floor(Date.now() / 1000) - 400;
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
  });
});
