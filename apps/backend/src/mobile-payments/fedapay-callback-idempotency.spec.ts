import { Test, TestingModule } from '@nestjs/testing';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { MobilePaymentsService } from './mobile-payments.service';
import { AccountsService } from '../accounts/accounts.service';
import { PaymentCallbackRegistryService } from './payment-callback/payment-callback-registry.service';
import { FedaPayCallbackDto } from './mobile-payment-callback.dto';

describe('MobilePaymentCallbackProcessor - FedaPay Idempotency', () => {
  let processor: MobilePaymentCallbackProcessor;

  const mockDatabaseService = {
    getTransactionByTransactionId: jest.fn(),
    getTransactionByReference: jest.fn(),
    getTransactionById: jest.fn(),
    logCallback: jest.fn(),
    updateTransactionIfStatus: jest.fn(),
  };

  const mockMobilePaymentsService = {
    assertProviderConfirmsCallback: jest.fn(),
  };

  const mockAccountsService = {
    registerDepositIfNotExists: jest.fn(),
  };

  const mockRegistryService = {
    findHandlerFor: jest.fn().mockReturnValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobilePaymentCallbackProcessor,
        { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
        { provide: MobilePaymentsService, useValue: mockMobilePaymentsService },
        { provide: AccountsService, useValue: mockAccountsService },
        { provide: PaymentCallbackRegistryService, useValue: mockRegistryService },
      ],
    }).compile();

    processor = module.get<MobilePaymentCallbackProcessor>(MobilePaymentCallbackProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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
    transaction_type: 'PAYMENT',
    payment_entity: 'rental_booking',
    reference: 'REF123',
  };

  const successCallback: FedaPayCallbackDto = {
    entity: { id: 456, status: 'approved', amount: 1000, reference: 'fedapay-tx-456' },
  };

  describe('Duplicate Webhook Prevention & No Double-Credit', () => {
    it('should process first success callback and credit once', async () => {
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValueOnce(mockTransaction);
      mockDatabaseService.updateTransactionIfStatus
        .mockResolvedValueOnce(true)  // pending -> processing
        .mockResolvedValueOnce(true);  // processing -> success
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ success: true });

      const result = await processor.processFedaPayCallback(successCallback);

      expect(result.received).toBe(true);
      expect(mockDatabaseService.logCallback).toHaveBeenCalled();
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).toHaveBeenCalled();
      expect(mockAccountsService.registerDepositIfNotExists).toHaveBeenCalledTimes(1);
    });
  });

  describe('Handler Failure Returns 5xx', () => {
    it('should throw when credit fails (5xx for webhook retry)', async () => {
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValueOnce(mockTransaction);
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValueOnce(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ success: false, error: 'DB error' });

      await expect(processor.processFedaPayCallback(successCallback)).rejects.toThrow();
    });

    it('should throw when handler throws exception (5xx)', async () => {
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValueOnce(mockTransaction);
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValueOnce(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockRejectedValue(new Error('Connection failed'));

      await expect(processor.processFedaPayCallback(successCallback)).rejects.toThrow();
    });
  });

  describe('Provider Status Re-verification', () => {
    it('should re-verify status with provider before crediting', async () => {
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValueOnce(mockTransaction);
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ success: true });

      await processor.processFedaPayCallback(successCallback);

      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).toHaveBeenCalledWith(
        mockTransaction,
        'SUCCESS'
      );
    });

    it('should reject callback if provider status does not match', async () => {
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValueOnce(mockTransaction);
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockRejectedValue(
        new Error('Provider reports declined')
      );

      await expect(processor.processFedaPayCallback(successCallback)).rejects.toThrow();
      expect(mockAccountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    });
  });
});
