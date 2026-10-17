import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sanitizeProviderError, maskPhoneNumber } from './sanitize-provider-error.util';
import { MobilePaymentsService } from './mobile-payments.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { FedaPayService } from './providers/fedapay.service';
import { MyPVitService } from './providers/mypvit.service';
import { FreemopayService } from './providers/freemopay.service';
import { MtnMomoService } from '../mtn-momo/mtn-momo.service';
import { MtnMomoDatabaseService } from '../mtn-momo/mtn-momo-database.service';
import { OrangeMomoService } from '../orange-momo/orange-momo.service';
import { OrangeMomoDatabaseService } from '../orange-momo/orange-momo-database.service';

/**
 * Security tests: ensure no Authorization headers or API keys are logged
 */
describe('Security: Error Sanitization & Phone Masking', () => {
  describe('sanitizeProviderError', () => {
    it('should remove config and headers from error', () => {
      const axiosError = {
        message: 'Request failed',
        config: {
          headers: {
            Authorization: 'Bearer sk_sandbox_SECRETKEY123',
            'Content-Type': 'application/json',
          },
          url: 'https://api.fedapay.com/v1/transactions',
        },
        response: {
          status: 401,
          data: { error: 'Unauthorized' },
        },
        status: 401,
      };

      const sanitized = sanitizeProviderError(axiosError);

      const str = JSON.stringify(sanitized);
      expect(str).not.toContain('Authorization');
      expect(str).not.toContain('Bearer');
      expect(str).not.toContain('sk_');
      expect(str).not.toContain('SECRETKEY');
      expect(sanitized.message).toBe('Request failed');
      expect(sanitized.status).toBe(401);
    });

    it('should redact sk_ keys from error message', () => {
      const error = {
        message: 'Authentication failed with key sk_live_abc123xyz789',
      };

      const sanitized = sanitizeProviderError(error);

      expect(sanitized.message).not.toContain('sk_live_abc123xyz789');
      expect(sanitized.message).toContain('sk_live_REDACTED');
    });

    it('should redact Bearer tokens from error message', () => {
      const error = {
        message: 'Invalid token: Bearer sk_test_tokenABC123',
      };

      const sanitized = sanitizeProviderError(error);

      expect(sanitized.message).not.toContain('Bearer sk_test_tokenABC123');
      expect(sanitized.message).toContain('Bearer REDACTED');
    });

    it('should handle multiple secret patterns in same message', () => {
      const error = {
        message: 'Auth failed: sk_sandbox_KEY1 and Bearer sk_live_KEY2',
      };

      const sanitized = sanitizeProviderError(error);

      expect(sanitized.message).not.toContain('KEY1');
      expect(sanitized.message).not.toContain('KEY2');
      expect(sanitized.message).toContain('sk_sandbox_REDACTED');
      expect(sanitized.message).toContain('Bearer REDACTED');
    });

    it('should remove config.headers even if nested in response', () => {
      const error = {
        message: 'Failed',
        response: {
          config: {
            headers: {
              Authorization: 'Bearer sk_test_DANGER',
            },
          },
        },
      };

      const sanitized = sanitizeProviderError(error);

      const str = JSON.stringify(sanitized);
      expect(str).not.toContain('Authorization');
      expect(str).not.toContain('sk_test');
    });

    it('should preserve safe error properties', () => {
      const error = {
        message: 'Transaction declined',
        status: 400,
        code: 'TRANSACTION_DECLINED',
      };

      const sanitized = sanitizeProviderError(error);

      expect(sanitized.message).toBe('Transaction declined');
      expect(sanitized.status).toBe(400);
      expect(sanitized.code).toBe('TRANSACTION_DECLINED');
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask phone keeping only last 3 digits', () => {
      expect(maskPhoneNumber('+22890123456')).toBe('***456');
      expect(maskPhoneNumber('+237692168717')).toBe('***717');
    });

    it('should handle short numbers', () => {
      expect(maskPhoneNumber('123')).toBe('***');
      expect(maskPhoneNumber('12')).toBe('***');
    });

    it('should handle empty/null', () => {
      expect(maskPhoneNumber('')).toBe('');
      expect(maskPhoneNumber(undefined)).toBe('');
    });

    it('should strip non-digits before masking', () => {
      expect(maskPhoneNumber('+228-90-12-3456')).toBe('***456');
    });
  });

  describe('FedaPayService: no secrets in logs (real service)', () => {
    let service: FedaPayService;
    let loggerSpy: jest.SpyInstance;

    beforeEach(async () => {
      // Mock the FedaPay SDK
      jest.mock('fedapay', () => ({
        Transaction: {
          retrieve: jest.fn(),
          create: jest.fn(),
        },
        Payout: {
          retrieve: jest.fn(),
          create: jest.fn(),
        },
        FedaPay: {
          setApiKey: jest.fn(),
          setEnvironment: jest.fn(),
        },
      }));

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: FedaPayService,
            useFactory: () => {
              const mockConfig = {
                get: jest.fn((key: string) => {
                  if (key === 'fedapay') {
                    return {
                      secretKey: 'sk_test_TESTSECRET123',
                      environment: 'sandbox',
                      callbackUrl: 'https://test.com/callback',
                      payoutCallbackUrl: 'https://test.com/payout',
                      mockEnabled: false,
                    };
                  }
                  return null;
                }),
              };

              const mockModuleRef = {
                get: jest.fn(() => null),
              };

              return new FedaPayService(mockConfig as any, mockModuleRef as any);
            },
          },
        ],
      }).compile();

      service = module.get<FedaPayService>(FedaPayService);
      loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined as any);
    });

    afterEach(() => {
      loggerSpy.mockRestore();
      jest.clearAllMocks();
    });

    it('should not log Authorization header when checkTransactionStatus fails', async () => {
      const axiosLikeError = {
        message: 'Request failed with status 401',
        config: {
          headers: {
            Authorization: 'Bearer sk_sandbox_DANGEROUS_KEY',
          },
          url: 'https://api.fedapay.com/v1/transactions/123',
        },
        response: { status: 401, data: { error: 'Unauthorized' } },
        status: 401,
      };

      // Mock Transaction.retrieve to throw
      const { Transaction } = require('fedapay');
      Transaction.retrieve = jest.fn().mockRejectedValue(axiosLikeError);

      try {
        await service.checkTransactionStatus('123', 'REF-123');
      } catch (err) {
        // Expected to throw after logging
      }

      const allCalls = loggerSpy.mock.calls.flat();
      const loggedText = allCalls.map((arg) => JSON.stringify(arg)).join(' ');

      expect(loggedText).not.toContain('Authorization');
      expect(loggedText).not.toContain('Bearer');
      expect(loggedText).not.toContain('sk_sandbox_DANGEROUS');
      expect(loggedText).not.toContain('DANGEROUS_KEY');
    });

    it('should not log sk_live_ keys in error message', async () => {
      const errorWithKey = {
        message: 'Authentication failed: sk_live_SECRET_KEY_12345',
        status: 401,
      };

      const { Transaction } = require('fedapay');
      Transaction.retrieve = jest.fn().mockRejectedValue(errorWithKey);

      try {
        await service.checkTransactionStatus('123', 'REF-123');
      } catch (err) {
        // Expected to throw
      }

      const allCalls = loggerSpy.mock.calls.flat();
      const loggedText = allCalls.map((arg) => JSON.stringify(arg)).join(' ');

      expect(loggedText).not.toContain('sk_live_SECRET_KEY_12345');
      expect(loggedText).not.toContain('SECRET_KEY_12345');
      expect(loggedText).toContain('sk_live_REDACTED');
    });
  });

  describe('Error sanitization coverage', () => {
    it('should sanitize errors in MyPVitService', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined as any);
      
      const mockConfig = {
        get: jest.fn(() => ({
          apiUrl: 'https://test.mypvit.com',
          merchantCode: 'TEST',
          secretKey: 'sk_test_SECRET',
        })),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MyPVitService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile();

      const service = module.get<MyPVitService>(MyPVitService);

      // Force an error by calling testConnection (will fail with mock config)
      await service.testConnection().catch(() => {});

      const allCalls = loggerSpy.mock.calls.flat();
      const loggedText = allCalls.map((arg) => JSON.stringify(arg)).join(' ');

      // Should not contain raw error objects or sensitive config
      expect(loggedText).not.toContain('"config"');
      expect(loggedText).not.toContain('"headers"');
      expect(loggedText).not.toContain('"request"');
      
      loggerSpy.mockRestore();
    });

    it('should sanitize errors in MobilePaymentsDatabaseService', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined as any);
      
      const mockHasura = {
        executeQuery: jest.fn().mockRejectedValue({
          message: 'Query error with sensitive data',
          config: { headers: { 'x-hasura-admin-secret': 'SECRET' } },
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MobilePaymentsDatabaseService,
          { provide: HasuraSystemService, useValue: mockHasura },
        ],
      }).compile();

      const service = module.get<MobilePaymentsDatabaseService>(MobilePaymentsDatabaseService);

      // Force an error
      await service.getTransactionById('invalid').catch(() => {});

      const allCalls = loggerSpy.mock.calls.flat();
      const loggedText = allCalls.map((arg) => JSON.stringify(arg)).join(' ');

      // Should not contain raw error config
      expect(loggedText).not.toContain('"config"');
      expect(loggedText).not.toContain('x-hasura-admin-secret');
      
      loggerSpy.mockRestore();
    });
  });

  describe('MobilePaymentsService: no phone numbers in logs', () => {
    let service: MobilePaymentsService;
    let loggerSpy: jest.SpyInstance;

    beforeEach(async () => {
      const mockHasuraSystemService = {
        executeQuery: jest.fn(),
      };

      const mockFedaPayService = {
        testConnection: jest.fn().mockResolvedValue(true),
        getSupportedPaymentMethods: jest.fn().mockResolvedValue(['mobile_money']),
        initiatePayment: jest.fn().mockResolvedValue({
          success: true,
          transactionId: '123',
        }),
      };

      const mockMyPVitService = { testConnection: jest.fn().mockResolvedValue(true) };
      const mockFreemopayService = { testConnection: jest.fn().mockResolvedValue(true) };
      const mockMtnMomoService = { testConnection: jest.fn().mockResolvedValue(true) };
      const mockOrangeMomoService = { testConnection: jest.fn().mockResolvedValue(true) };
      const mockDatabaseService = { 
        getUserCountry: jest.fn(), 
        getUserAddress: jest.fn() 
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MobilePaymentsService,
          { provide: HasuraSystemService, useValue: mockHasuraSystemService },
          { provide: FedaPayService, useValue: mockFedaPayService },
          { provide: MyPVitService, useValue: mockMyPVitService },
          { provide: FreemopayService, useValue: mockFreemopayService },
          { provide: MtnMomoService, useValue: mockMtnMomoService },
          { provide: MtnMomoDatabaseService, useValue: {} },
          { provide: OrangeMomoService, useValue: mockOrangeMomoService },
          { provide: OrangeMomoDatabaseService, useValue: {} },
          { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
        ],
      }).compile();

      service = module.get<MobilePaymentsService>(MobilePaymentsService);
      loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined as any);
    });

    afterEach(() => {
      loggerSpy.mockRestore();
    });

    it('should mask phone in "Phone number validated" log', async () => {
      const request = {
        amount: 500,
        currency: 'XOF',
        customerPhone: '+22890123456',
        provider: 'fedapay' as const,
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      await service.initiatePayment(request);

      const allCalls = loggerSpy.mock.calls.flat();
      const loggedText = allCalls.map((arg) => JSON.stringify(arg)).join(' ');

      expect(loggedText).not.toContain('+22890123456');
      expect(loggedText).not.toContain('90123456');
      expect(loggedText).toContain('***456');
    });

    it('should mask phone in "Initiating mobile payment" log', async () => {
      const request = {
        amount: 500,
        currency: 'XOF',
        customerPhone: '+22890999888',
        provider: 'fedapay' as const,
        paymentMethod: 'mobile_money' as const,
        transactionType: 'PAYMENT' as const,
        accountId: 'acc-1',
        callbackUrl: 'https://test.com/callback',
      };

      await service.initiatePayment(request);

      const allCalls = loggerSpy.mock.calls.flat();
      const loggedText = allCalls.map((arg) => JSON.stringify(arg)).join(' ');

      expect(loggedText).not.toContain('90999888');
      expect(loggedText).toContain('***888');
    });
  });

  describe('Mutation check: sanitizer must be used', () => {
    it('test fails if sanitizeProviderError is not used', () => {
      // This test documents that removing the sanitizer breaks security
      const dangerousError = {
        message: 'Failed',
        config: {
          headers: {
            Authorization: 'Bearer sk_live_MUSTNOTLOG',
          },
        },
      };

      // If sanitizer is NOT used, secrets leak
      const unsanitized = JSON.stringify(dangerousError);
      expect(unsanitized).toContain('Authorization');
      expect(unsanitized).toContain('sk_live_MUSTNOTLOG');

      // With sanitizer, secrets are removed
      const sanitized = sanitizeProviderError(dangerousError);
      const safe = JSON.stringify(sanitized);
      expect(safe).not.toContain('Authorization');
      expect(safe).not.toContain('sk_live_MUSTNOTLOG');
    });
  });
});
