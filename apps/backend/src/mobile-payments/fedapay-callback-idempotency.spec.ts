import { Test, TestingModule } from '@nestjs/testing';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { MobilePaymentsService } from './mobile-payments.service';
import { AccountsService } from '../accounts/accounts.service';
import { PaymentCallbackRegistryService } from './payment-callback/payment-callback-registry.service';
import { FedaPayCallbackDto } from './mobile-payment-callback.dto';

describe('MobilePaymentCallbackProcessor - FedaPay Idempotency', () => {
  let processor: MobilePaymentCallbackProcessor;
  let databaseService: MobilePaymentsDatabaseService;
  let mobilePaymentsService: MobilePaymentsService;
  let accountsService: AccountsService;

  const mockDatabaseService = {
    findTransactionByProviderReference: jest.fn(),
    getTransactionByTransactionId: jest.fn(),
    getTransactionByReference: jest.fn(),
    logCallback: jest.fn(),
    updateTransactionIfStatus: jest.fn(),
    updateTransactionStatus: jest.fn(),
    findTransactionById: jest.fn(),
  };

  const mockMobilePaymentsService = {
    assertProviderConfirmsCallback: jest.fn(),
  };

  const mockAccountsService = {
    creditAccountFromCallback: jest.fn(),
  };

  const mockRegistryService = {
    findHandlerFor: jest.fn().mockReturnValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobilePaymentCallbackProcessor,
        {
          provide: MobilePaymentsDatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: MobilePaymentsService,
          useValue: mockMobilePaymentsService,
        },
        {
          provide: AccountsService,
          useValue: mockAccountsService,
        },
        {
          provide: PaymentCallbackRegistryService,
          useValue: mockRegistryService,
        },
      ],
    }).compile();

    processor = module.get<MobilePaymentCallbackProcessor>(
      MobilePaymentCallbackProcessor
    );
    databaseService = module.get<MobilePaymentsDatabaseService>(
      MobilePaymentsDatabaseService
    );
    mobilePaymentsService = module.get<MobilePaymentsService>(
      MobilePaymentsService
    );
    accountsService = module.get<AccountsService>(AccountsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Duplicate Webhook Prevention', () => {
    const mockTransaction = {
      id: 'tx-123',
      transaction_id: 'fedapay-tx-456',
      status: 'pending',
      amount: 1000,
      currency: 'XOF',
      customer_phone: '+22878123456',
      provider: 'fedapay',
      account_id: 'acc-123',
      callback_count: 0,
    };

    const successCallback: FedaPayCallbackDto = {
      entity: {
        id: 456,
        status: 'approved',
        amount: 1000,
        reference: 'fedapay-tx-456',
      },
    };

    it('should process first success callback', async () => {
      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        mockTransaction
      );
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(
        undefined
      );
      mockAccountsService.creditAccountFromCallback.mockResolvedValue({
        success: true,
      });

      const result = await processor.processFedaPayCallback(successCallback);

      expect(result.received).toBe(true);
      expect(mockDatabaseService.logCallback).toHaveBeenCalled();
      expect(
        mockMobilePaymentsService.assertProviderConfirmsCallback
      ).toHaveBeenCalled();
      expect(mockAccountsService.creditAccountFromCallback).toHaveBeenCalled();
    });

    it('should reject duplicate success callback (already success)', async () => {
      const completedTransaction = { ...mockTransaction, status: 'success' };
      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        completedTransaction
      );

      const result = await processor.processFedaPayCallback(successCallback);

      expect(result.received).toBe(true);
      expect(result.skipped).toBe(true);
      // Should not credit again
      expect(mockAccountsService.creditAccountFromCallback).not.toHaveBeenCalled();
    });

    it('should reject duplicate success callback (already failed)', async () => {
      const failedTransaction = { ...mockTransaction, status: 'failed' };
      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        failedTransaction
      );

      const result = await processor.processFedaPayCallback(successCallback);

      expect(result.received).toBe(true);
      expect(result.skipped).toBe(true);
      expect(mockAccountsService.creditAccountFromCallback).not.toHaveBeenCalled();
    });

    it('should handle duplicate pending callback', async () => {
      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        mockTransaction
      );
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(false); // CAS failed

      const result = await processor.processFedaPayCallback(successCallback);

      expect(result.received).toBe(true);
      // Should still log callback
      expect(mockDatabaseService.logCallback).toHaveBeenCalled();
    });

    it('should not double-credit on concurrent callbacks', async () => {
      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        mockTransaction
      );
      // First CAS succeeds, second fails
      mockDatabaseService.updateTransactionIfStatus
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(
        undefined
      );
      mockAccountsService.creditAccountFromCallback.mockResolvedValue({
        success: true,
      });

      // Simulate concurrent callbacks
      const [result1, result2] = await Promise.all([
        processor.processFedaPayCallback(successCallback),
        processor.processFedaPayCallback(successCallback),
      ]);

      // Only one should successfully credit
      expect(mockAccountsService.creditAccountFromCallback).toHaveBeenCalledTimes(
        1
      );
    });
  });

  describe('Handler Failure Returns 5xx', () => {
    const mockTransaction = {
      id: 'tx-123',
      transaction_id: 'fedapay-tx-456',
      status: 'pending',
      amount: 1000,
      currency: 'XOF',
      customer_phone: '+22878123456',
      provider: 'fedapay',
      account_id: 'acc-123',
      callback_count: 0,
    };

    const successCallback: FedaPayCallbackDto = {
      entity: {
        id: 456,
        status: 'approved',
        amount: 1000,
        reference: 'fedapay-tx-456',
      },
    };

    it('should return 5xx when credit fails', async () => {
      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        mockTransaction
      );
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(
        undefined
      );
      // Simulate handler failure
      mockAccountsService.creditAccountFromCallback.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      try {
        await processor.processFedaPayCallback(successCallback);
        fail('Should have thrown error');
      } catch (error: any) {
        // Should throw error that gets caught by controller and returns 5xx
        expect(error).toBeDefined();
      }
    });

    it('should return 5xx when handler throws exception', async () => {
      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        mockTransaction
      );
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(
        undefined
      );
      mockAccountsService.creditAccountFromCallback.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        processor.processFedaPayCallback(successCallback)
      ).rejects.toThrow();
    });

    it('should allow retry after handler failure', async () => {
      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        mockTransaction
      );
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(
        undefined
      );

      // First call fails
      mockAccountsService.creditAccountFromCallback.mockRejectedValueOnce(
        new Error('Temporary failure')
      );

      await expect(
        processor.processFedaPayCallback(successCallback)
      ).rejects.toThrow();

      // Second call succeeds
      mockAccountsService.creditAccountFromCallback.mockResolvedValueOnce({
        success: true,
      });

      const result = await processor.processFedaPayCallback(successCallback);
      expect(result.received).toBe(true);
    });
  });

  describe('Provider Status Re-verification', () => {
    const mockTransaction = {
      id: 'tx-123',
      transaction_id: 'fedapay-tx-456',
      status: 'pending',
      amount: 1000,
      currency: 'XOF',
      customer_phone: '+22878123456',
      provider: 'fedapay',
      account_id: 'acc-123',
      callback_count: 0,
    };

    it('should re-verify status with provider before crediting', async () => {
      const successCallback: FedaPayCallbackDto = {
        entity: {
          id: 456,
          status: 'approved',
          amount: 1000,
          reference: 'fedapay-tx-456',
        },
      };

      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        mockTransaction
      );
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(
        undefined
      );
      mockAccountsService.creditAccountFromCallback.mockResolvedValue({
        success: true,
      });

      await processor.processFedaPayCallback(successCallback);

      // Should call assertProviderConfirmsCallback before crediting
      expect(
        mockMobilePaymentsService.assertProviderConfirmsCallback
      ).toHaveBeenCalledWith(mockTransaction, 'SUCCESS');
      expect(
        mockMobilePaymentsService.assertProviderConfirmsCallback
      ).toHaveBeenCalledBefore(
        mockAccountsService.creditAccountFromCallback as jest.Mock
      );
    });

    it('should reject callback if provider status does not match', async () => {
      const successCallback: FedaPayCallbackDto = {
        entity: {
          id: 456,
          status: 'approved',
          amount: 1000,
          reference: 'fedapay-tx-456',
        },
      };

      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        mockTransaction
      );
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      // Provider verification fails
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockRejectedValue(
        new Error('Provider reports transaction as failed')
      );

      await expect(
        processor.processFedaPayCallback(successCallback)
      ).rejects.toThrow();

      // Should not credit
      expect(mockAccountsService.creditAccountFromCallback).not.toHaveBeenCalled();
    });

    it('should skip re-verification for mocked transactions', async () => {
      const mockTx = { ...mockTransaction, transaction_id: 'mock-fedapay-123' };
      const successCallback: FedaPayCallbackDto = {
        entity: {
          id: 456,
          status: 'approved',
          amount: 1000,
          reference: 'mock-fedapay-123',
        },
      };

      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        mockTx
      );
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockAccountsService.creditAccountFromCallback.mockResolvedValue({
        success: true,
      });

      await processor.processFedaPayCallback(successCallback);

      // Should NOT call assertProviderConfirmsCallback for mock
      expect(
        mockMobilePaymentsService.assertProviderConfirmsCallback
      ).not.toHaveBeenCalled();
      // But should still credit
      expect(mockAccountsService.creditAccountFromCallback).toHaveBeenCalled();
    });
  });

  describe('Callback Logging', () => {
    it('should log all callbacks including duplicates', async () => {
      const mockTransaction = {
        id: 'tx-123',
        transaction_id: 'fedapay-tx-456',
        status: 'success', // Already completed
        amount: 1000,
        currency: 'XOF',
        customer_phone: '+22878123456',
        provider: 'fedapay',
        account_id: 'acc-123',
        callback_count: 1,
      };

      const callback: FedaPayCallbackDto = {
        entity: {
          id: 456,
          status: 'approved',
          amount: 1000,
          reference: 'fedapay-tx-456',
        },
      };

      mockDatabaseService.findTransactionByProviderReference.mockResolvedValue(
        mockTransaction
      );

      await processor.processFedaPayCallback(callback);

      // Should still log even if skipped
      expect(mockDatabaseService.logCallback).toHaveBeenCalledWith(
        'tx-123',
        callback
      );
    });
  });
});
