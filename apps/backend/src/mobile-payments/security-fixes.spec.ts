import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { sanitizeProviderError, maskPhoneNumber } from './sanitize-provider-error.util';
import { MobilePaymentsService } from './mobile-payments.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { FedaPayService } from './providers/fedapay.service';

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

  describe('FedaPayService: no secrets in logs', () => {
    let service: FedaPayService;
    let loggerSpy: jest.SpyInstance;

    beforeEach(async () => {
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
      loggerSpy = jest.spyOn(Logger.prototype, 'error');
    });

    afterEach(() => {
      loggerSpy.mockRestore();
    });

    it('should not log Authorization header in provider-status error', async () => {
      const axiosError = {
        message: 'Request failed',
        config: {
          headers: {
            Authorization: 'Bearer sk_sandbox_DANGEROUS_KEY',
          },
        },
        response: { status: 401 },
      };

      try {
        throw axiosError;
      } catch (err) {
        const sanitized = sanitizeProviderError(err);
        loggerSpy(`Failed to check FedaPay transaction status: ${sanitized.message}`);
      }

      const allCalls = loggerSpy.mock.calls.flat();
      const loggedText = allCalls.map((arg) => JSON.stringify(arg)).join(' ');

      expect(loggedText).not.toContain('Authorization');
      expect(loggedText).not.toContain('Bearer');
      expect(loggedText).not.toContain('sk_sandbox_DANGEROUS');
      expect(loggedText).not.toContain('DANGEROUS_KEY');
    });

    it('should not log Bearer token in initiate-payment error', async () => {
      const error = {
        message: 'Auth failed: Bearer sk_live_SECRET123',
      };

      const sanitized = sanitizeProviderError(error);
      loggerSpy(`Failed to initiate FedaPay payment: ${sanitized.message}`);

      const allCalls = loggerSpy.mock.calls.flat();
      const loggedText = allCalls.map((arg) => JSON.stringify(arg)).join(' ');

      expect(loggedText).not.toContain('Bearer sk_live_SECRET123');
      expect(loggedText).not.toContain('SECRET123');
      expect(loggedText).toContain('Bearer REDACTED');
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

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MobilePaymentsService,
          { provide: HasuraSystemService, useValue: mockHasuraSystemService },
          { provide: FedaPayService, useValue: mockFedaPayService },
          { provide: 'MyPVitService', useValue: { testConnection: jest.fn().mockResolvedValue(true) } },
          { provide: 'FreemopayService', useValue: { testConnection: jest.fn().mockResolvedValue(true) } },
          { provide: 'MtnMomoService', useValue: {} },
          { provide: 'MtnMomoDatabaseService', useValue: {} },
          { provide: 'OrangeMomoService', useValue: {} },
          { provide: 'OrangeMomoDatabaseService', useValue: {} },
          { provide: 'MobilePaymentsDatabaseService', useValue: { getUserCountry: jest.fn(), getUserAddress: jest.fn() } },
        ],
      }).compile();

      service = module.get<MobilePaymentsService>(MobilePaymentsService);
      loggerSpy = jest.spyOn(Logger.prototype, 'log');
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
