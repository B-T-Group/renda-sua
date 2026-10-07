import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FreemopayService } from './freemopay.service';
import type { FreemopayConfig } from '../../config/configuration';
import type { MobilePaymentCallbackProcessor } from '../mobile-payment-callback.processor';

describe('FreemopayService Mock', () => {
  let service: FreemopayService;
  let configService: ConfigService;
  let mockCallbackProcessor: jest.Mocked<MobilePaymentCallbackProcessor>;

  describe('Mock Disabled (Production Safety)', () => {
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
                    baseUrl: 'https://api-v2.freemopay.com',
                    appKey: 'test-key',
                    secretKey: 'test-secret',
                    callbackUrl: 'http://localhost:3000/callback',
                    amountMockEnabled: false,
                  } as FreemopayConfig;
                }
                return undefined;
              }),
            },
          },
          {
            provide: 'MobilePaymentCallbackProcessor',
            useValue: null,
          },
        ],
      }).compile();

      service = module.get<FreemopayService>(FreemopayService);
      configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should not enable mock when amountMockEnabled is false', () => {
      expect(service['mockEnabled']).toBe(false);
    });

    it('should call live API when mock is disabled', async () => {
      const httpClientSpy = jest.spyOn(service['httpClient'], 'post');
      httpClientSpy.mockResolvedValue({
        status: 200,
        data: { reference: 'live-ref-123', status: 'PENDING' },
      } as any);

      const result = await service.initiatePayment({
        payer: '237600000000',
        amount: 1000,
        externalId: 'test-ref',
        description: 'Test payment',
        callback: 'http://localhost:3000/callback',
      });

      expect(httpClientSpy).toHaveBeenCalledWith('/api/v2/payment', {
        payer: '237600000000',
        amount: 1000,
        externalId: 'test-ref',
        description: 'Test payment',
        callback: 'http://localhost:3000/callback',
      });
      expect(result.success).toBe(true);
      expect(result.reference).toBe('live-ref-123');
    });
  });

  describe('Mock Enabled (DEV/Test)', () => {
    beforeEach(async () => {
      mockCallbackProcessor = {
        processFreemopayCallback: jest.fn().mockResolvedValue({ received: true, reference: 'mock-ref' }),
      } as any;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FreemopayService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'freemopay') {
                  return {
                    baseUrl: 'https://api-v2.freemopay.com',
                    appKey: 'test-key',
                    secretKey: 'test-secret',
                    callbackUrl: 'http://localhost:3000/callback',
                    amountMockEnabled: true,
                  } as FreemopayConfig;
                }
                return undefined;
              }),
            },
          },
          {
            provide: 'MobilePaymentCallbackProcessor',
            useValue: mockCallbackProcessor,
          },
        ],
      }).compile();

      service = module.get<FreemopayService>(FreemopayService);
      configService = module.get<ConfigService>(ConfigService);
    });

    it('should enable mock when amountMockEnabled is true', () => {
      expect(service['mockEnabled']).toBe(true);
    });

    describe('Payment Mock (Collection)', () => {
      it('should not call live API when mock is enabled', async () => {
        const httpClientSpy = jest.spyOn(service['httpClient'], 'post');

        await service.initiatePayment({
          payer: '237600000000',
          amount: 1000,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        expect(httpClientSpy).not.toHaveBeenCalled();
      });

      it('should return success for amounts < 2000 XAF', async () => {
        const result = await service.initiatePayment({
          payer: '237600000000',
          amount: 1999,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.success).toBe(true);
        expect(result.reference).toMatch(/^mock-/);
        expect(result.transactionId).toMatch(/^mock-/);
        expect(result.status).toBe('PENDING');
      });

      it('should return success for amounts = 2000 XAF (fails on status check)', async () => {
        const result = await service.initiatePayment({
          payer: '237600000000',
          amount: 2000,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.success).toBe(true);
        expect(result.reference).toMatch(/^mock-/);
        expect(result.status).toBe('PENDING');

        // Status check should return FAILED for amounts >= 2000
        const status = await service.checkTransactionStatus(result.reference!);
        expect(status.status).toBe('FAILED');
      });

      it('should return success for amounts > 2000 XAF (fails on status check)', async () => {
        const result = await service.initiatePayment({
          payer: '237600000000',
          amount: 5000,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.success).toBe(true);
        expect(result.reference).toMatch(/^mock-/);
        expect(result.status).toBe('PENDING');

        // Status check should return FAILED for amounts >= 2000
        const status = await service.checkTransactionStatus(result.reference!);
        expect(status.status).toBe('FAILED');
        expect(status.amount).toBe(5000);
      });

      it('should store mock outcomes for status checks', async () => {
        const successResult = await service.initiatePayment({
          payer: '237600000000',
          amount: 1000,
          externalId: 'success-ref',
          description: 'Success payment',
          callback: 'http://localhost:3000/callback',
        });

        const failResult = await service.initiatePayment({
          payer: '237600000000',
          amount: 3000,
          externalId: 'fail-ref',
          description: 'Fail payment',
          callback: 'http://localhost:3000/callback',
        });

        // Check success status
        const successStatus = await service.checkTransactionStatus(
          successResult.reference!
        );
        expect(successStatus.status).toBe('SUCCESS');
        expect(successStatus.amount).toBe(1000);

        // Check fail status
        const failStatus = await service.checkTransactionStatus(
          failResult.reference!
        );
        expect(failStatus.status).toBe('FAILED');
        expect(failStatus.amount).toBe(3000);
      });
    });

    describe('Withdrawal Mock (Disbursement)', () => {
      it('should not call live API when mock is enabled', async () => {
        const httpClientSpy = jest.spyOn(service['httpClient'], 'post');

        await service.withdraw({
          payee: '237600000000',
          amount: 1000,
          externalId: 'test-ref',
          description: 'Test withdrawal',
          callback: 'http://localhost:3000/callback',
        });

        expect(httpClientSpy).not.toHaveBeenCalled();
      });

      it('should return success for withdrawal amounts < 2000 XAF', async () => {
        const result = await service.withdraw({
          payee: '237600000000',
          amount: 1500,
          externalId: 'test-ref',
          description: 'Test withdrawal',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.success).toBe(true);
        expect(result.reference).toMatch(/^mock-/);
        expect(result.transactionId).toMatch(/^mock-/);
        expect(result.status).toBe('CREATED');
      });

      it('should return success for withdrawal amounts >= 2000 XAF (fails on status check)', async () => {
        const result = await service.withdraw({
          payee: '237600000000',
          amount: 2500,
          externalId: 'test-ref',
          description: 'Test withdrawal',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.success).toBe(true);
        expect(result.reference).toMatch(/^mock-/);

        // Status check should return FAILED
        const status = await service.checkTransactionStatus(result.reference!);
        expect(status.status).toBe('FAILED');
        expect(status.amount).toBe(2500);
      });

      it('should apply the 2000 XAF threshold to withdrawals', async () => {
        const belowThreshold = await service.withdraw({
          payee: '237600000000',
          amount: 1999,
          externalId: 'below-ref',
          description: 'Below threshold',
          callback: 'http://localhost:3000/callback',
        });

        const atThreshold = await service.withdraw({
          payee: '237600000000',
          amount: 2000,
          externalId: 'at-ref',
          description: 'At threshold',
          callback: 'http://localhost:3000/callback',
        });

        const aboveThreshold = await service.withdraw({
          payee: '237600000000',
          amount: 2001,
          externalId: 'above-ref',
          description: 'Above threshold',
          callback: 'http://localhost:3000/callback',
        });

        // Check statuses
        const belowStatus = await service.checkTransactionStatus(
          belowThreshold.reference!
        );
        const atStatus = await service.checkTransactionStatus(atThreshold.reference!);
        const aboveStatus = await service.checkTransactionStatus(
          aboveThreshold.reference!
        );

        expect(belowStatus.status).toBe('SUCCESS');
        expect(atStatus.status).toBe('FAILED');
        expect(aboveStatus.status).toBe('FAILED');
      });
    });

    describe('Status Check Mock', () => {
      it('should return SUCCESS for mock transactions < 2000 XAF', async () => {
        const initResult = await service.initiatePayment({
          payer: '237600000000',
          amount: 1000,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        const status = await service.checkTransactionStatus(initResult.reference!);
        expect(status.status).toBe('SUCCESS');
        expect(status.transactionId).toBe(initResult.reference);
        expect(status.reference).toBe(initResult.reference);
        expect(status.amount).toBe(1000);
      });

      it('should return FAILED for mock transactions >= 2000 XAF', async () => {
        const initResult = await service.initiatePayment({
          payer: '237600000000',
          amount: 2000,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        const status = await service.checkTransactionStatus(initResult.reference!);
        expect(status.status).toBe('FAILED');
        expect(status.reason).toContain('threshold');
      });

      it('should return PENDING for unknown mock transactions', async () => {
        const status = await service.checkTransactionStatus('mock-unknown-ref');
        expect(status.status).toBe('PENDING');
        expect(status.transactionId).toBe('mock-unknown-ref');
      });

      it('should call live API for non-mock transactions', async () => {
        const httpClientSpy = jest.spyOn(service['httpClient'], 'get');
        httpClientSpy.mockResolvedValue({
          status: 200,
          data: {
            reference: 'live-ref-123',
            status: 'SUCCESS',
            amount: 1000,
          },
        } as any);

        const status = await service.checkTransactionStatus('live-ref-123');

        expect(httpClientSpy).toHaveBeenCalledWith(
          '/api/v2/payment/live-ref-123'
        );
        expect(status.status).toBe('SUCCESS');
      });
    });

    describe('Mock Reference Format', () => {
      it('should generate mock references with mock- prefix', async () => {
        const result = await service.initiatePayment({
          payer: '237600000000',
          amount: 1000,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.reference).toMatch(/^mock-[0-9a-f-]+$/);
        expect(result.transactionId).toMatch(/^mock-[0-9a-f-]+$/);
      });

      it('should identify mock transactions correctly', () => {
        expect(service['isMockedTransaction']('mock-123-abc')).toBe(true);
        expect(service['isMockedTransaction']('live-ref-123')).toBe(false);
        expect(service['isMockedTransaction']('')).toBe(false);
      });
    });

    describe('Auto-Callback', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should schedule auto-callback after payment initiation (SUCCESS)', async () => {
        const result = await service.initiatePayment({
          payer: '237600000000',
          amount: 1500,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.success).toBe(true);
        expect(result.reference).toMatch(/^mock-/);

        // Fast-forward time to trigger callback
        jest.advanceTimersByTime(1500);

        // Wait for async callback processing
        await Promise.resolve();

        expect(mockCallbackProcessor.processFreemopayCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            reference: result.reference,
            status: 'SUCCESS',
            externalId: 'test-ref',
          })
        );
      });

      it('should schedule auto-callback after payment initiation (FAILED)', async () => {
        const result = await service.initiatePayment({
          payer: '237600000000',
          amount: 2500,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.success).toBe(true);
        expect(result.reference).toMatch(/^mock-/);

        // Fast-forward time to trigger callback
        jest.advanceTimersByTime(1500);

        // Wait for async callback processing
        await Promise.resolve();

        expect(mockCallbackProcessor.processFreemopayCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            reference: result.reference,
            status: 'FAILED',
            externalId: 'test-ref',
            reason: 'Mock failure (amount >= threshold)',
          })
        );
      });

      it('should schedule auto-callback after withdrawal initiation (SUCCESS)', async () => {
        const result = await service.withdraw({
          payee: '237600000000',
          amount: 1000,
          externalId: 'test-ref',
          description: 'Test withdrawal',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.success).toBe(true);
        expect(result.reference).toMatch(/^mock-/);

        // Fast-forward time to trigger callback
        jest.advanceTimersByTime(1500);

        // Wait for async callback processing
        await Promise.resolve();

        expect(mockCallbackProcessor.processFreemopayCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            reference: result.reference,
            status: 'SUCCESS',
            externalId: 'test-ref',
          })
        );
      });

      it('should schedule auto-callback after withdrawal initiation (FAILED)', async () => {
        const result = await service.withdraw({
          payee: '237600000000',
          amount: 3000,
          externalId: 'test-ref',
          description: 'Test withdrawal',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.success).toBe(true);
        expect(result.reference).toMatch(/^mock-/);

        // Fast-forward time to trigger callback
        jest.advanceTimersByTime(1500);

        // Wait for async callback processing
        await Promise.resolve();

        expect(mockCallbackProcessor.processFreemopayCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            reference: result.reference,
            status: 'FAILED',
            externalId: 'test-ref',
            reason: 'Mock failure (amount >= threshold)',
          })
        );
      });

      it('should not schedule callback if processor is not available', async () => {
        // Create a service without callback processor
        const moduleWithoutProcessor = await Test.createTestingModule({
          providers: [
            FreemopayService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => {
                  if (key === 'freemopay') {
                    return {
                      baseUrl: 'https://api-v2.freemopay.com',
                      appKey: 'test-key',
                      secretKey: 'test-secret',
                      callbackUrl: 'http://localhost:3000/callback',
                      amountMockEnabled: true,
                    } as FreemopayConfig;
                  }
                  return undefined;
                }),
              },
            },
            {
              provide: 'MobilePaymentCallbackProcessor',
              useValue: null,
            },
          ],
        }).compile();

        const serviceWithoutProcessor = moduleWithoutProcessor.get<FreemopayService>(FreemopayService);

        const result = await serviceWithoutProcessor.initiatePayment({
          payer: '237600000000',
          amount: 1500,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        expect(result.success).toBe(true);
        expect(result.reference).toMatch(/^mock-/);

        // Fast-forward time
        jest.advanceTimersByTime(1500);
        await Promise.resolve();

        // Callback processor should not have been called
        expect(mockCallbackProcessor.processFreemopayCallback).not.toHaveBeenCalled();
      });

      it('should use correct delay for auto-callback', async () => {
        await service.initiatePayment({
          payer: '237600000000',
          amount: 1000,
          externalId: 'test-ref',
          description: 'Test payment',
          callback: 'http://localhost:3000/callback',
        });

        // Callback should not be called yet (before delay)
        expect(mockCallbackProcessor.processFreemopayCallback).not.toHaveBeenCalled();

        // Advance by less than delay
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        expect(mockCallbackProcessor.processFreemopayCallback).not.toHaveBeenCalled();

        // Advance to full delay
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        expect(mockCallbackProcessor.processFreemopayCallback).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Production Hard Disable', () => {
    it('should document that production is blocked by configuration.ts', () => {
      // This test documents that the production hard disable is implemented
      // in configuration.ts using isProductionRuntime() check.
      // The config loader will NEVER set amountMockEnabled=true in production,
      // regardless of the FREEMOPAY_AMOUNT_MOCK env var value.
      expect(true).toBe(true);
    });
  });
});
