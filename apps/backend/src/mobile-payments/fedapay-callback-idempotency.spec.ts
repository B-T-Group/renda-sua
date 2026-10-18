import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { MobilePaymentsService } from './mobile-payments.service';
import { AccountsService } from '../accounts/accounts.service';
import { PaymentCallbackRegistryService } from './payment-callback/payment-callback-registry.service';
import { FedaPayService } from './providers/fedapay.service';
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

  const mockFedaPayService = {
    mockEnabled: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobilePaymentCallbackProcessor,
        { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
        { provide: MobilePaymentsService, useValue: mockMobilePaymentsService },
        { provide: AccountsService, useValue: mockAccountsService },
        { provide: PaymentCallbackRegistryService, useValue: mockRegistryService },
        { provide: FedaPayService, useValue: mockFedaPayService },
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
    name: 'transaction.approved',
  };
  
  const declinedCallback: FedaPayCallbackDto = {
    entity: { id: 456, status: 'declined', amount: 1000, reference: 'fedapay-tx-456' },
    name: 'transaction.declined',
  };
  
  const nonTerminalCallback: FedaPayCallbackDto = {
    entity: { id: 456, status: 'pending', amount: 1000, reference: 'fedapay-tx-456' },
    name: 'transaction.pending',
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

  describe('Provider isolation', () => {
    it('ignores a FedaPay callback whose id matches a non-FedaPay transaction', async () => {
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue({
        ...mockTransaction,
        provider: 'mypvit',
      });
      mockDatabaseService.getTransactionByReference.mockResolvedValue(null);

      const result = await processor.processFedaPayCallback(successCallback);

      expect(result.received).toBe(true);
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
      expect(mockAccountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
      mockDatabaseService.getTransactionByTransactionId.mockReset();
      mockDatabaseService.getTransactionByReference.mockReset();
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

  describe('N2: row without provider transaction_id', () => {
    const rowWithoutProviderId = { ...mockTransaction, transaction_id: null };
    const approvedByExternalId: FedaPayCallbackDto = {
      entity: {
        id: 456,
        status: 'approved',
        amount: 1000,
        reference: 'trx_abc',
        custom_metadata: { externalId: 'REF123' },
      } as any,
      name: 'transaction.approved',
    };

    beforeEach(() => {
      mockDatabaseService.getTransactionByTransactionId.mockReset();
      mockDatabaseService.getTransactionByReference.mockReset();
      mockDatabaseService.updateTransactionIfStatus.mockReset();
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockReset();
      mockAccountsService.registerDepositIfNotExists.mockReset();
    });

    it('re-checks the webhook entity id (instead of throwing) and credits once', async () => {
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(null);
      mockDatabaseService.getTransactionByReference.mockImplementation(
        async (key: string) => (key === 'REF123' ? rowWithoutProviderId : null)
      );
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ success: true });

      await processor.processFedaPayCallback(approvedByExternalId);

      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tx-123', transaction_id: '456', reference: 'REF123' }),
        'SUCCESS'
      );
      expect(mockAccountsService.registerDepositIfNotExists).toHaveBeenCalledTimes(1);
    });

    it('does not substitute the entity id when the row has no reference (stays fail closed)', async () => {
      const noRef = { ...rowWithoutProviderId, reference: '' };
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(null);
      mockDatabaseService.getTransactionByReference.mockImplementation(
        async (key: string) => (key === 'REF123' ? noRef : null)
      );
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockRejectedValue(
        new Error('missing provider transaction_id')
      );

      await expect(processor.processFedaPayCallback(approvedByExternalId)).rejects.toThrow(
        /missing provider transaction_id/
      );
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).toHaveBeenCalledWith(
        noRef,
        'SUCCESS'
      );
      expect(mockAccountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    });

    it('keeps the stored transaction_id when present', async () => {
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
  });

  describe('Non-Terminal Event Handling (B3)', () => {
    it('should return 200 for non-terminal events without state change', async () => {
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValueOnce(mockTransaction);

      const result = await processor.processFedaPayCallback(nonTerminalCallback);

      expect(result.received).toBe(true);
      expect(mockDatabaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
      expect(mockAccountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
    });

    it('should not fail pending transaction on unknown event name', async () => {
      const unknownCallback: FedaPayCallbackDto = {
        entity: { id: 456, status: 'processing', amount: 1000, reference: 'fedapay-tx-456' },
        name: 'transaction.processing',
      };
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValueOnce(mockTransaction);

      const result = await processor.processFedaPayCallback(unknownCallback);

      expect(result.received).toBe(true);
      expect(mockDatabaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
    });
  });

  describe('GIVE_CHANGE rows excluded from collection webhook lookup', () => {
    const gcRow = { ...mockTransaction, id: 'gc-1', transaction_type: 'GIVE_CHANGE', transaction_id: '456', reference: 'REFGC' };
    const collectionApproved: FedaPayCallbackDto = {
      entity: { id: 456, status: 'approved', amount: 1000, reference: 'trx_x', custom_metadata: { externalId: 'REF123' } } as any,
      name: 'transaction.approved',
    };

    beforeEach(() => {
      // clearAllMocks does not drop queued mockResolvedValueOnce values from earlier tests
      mockDatabaseService.getTransactionByTransactionId.mockReset();
      mockDatabaseService.getTransactionByReference.mockReset();
      mockDatabaseService.getTransactionById.mockReset();
      mockDatabaseService.updateTransactionIfStatus.mockReset();
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockReset();
      mockAccountsService.registerDepositIfNotExists.mockReset();
    });

    it('does not match a real GIVE_CHANGE row holding a colliding payout id', async () => {
      mockDatabaseService.getTransactionByTransactionId.mockImplementation(async (k: string) => (k === '456' ? gcRow : null));
      mockDatabaseService.getTransactionByReference.mockResolvedValue(null);

      const res = await processor.processFedaPayCallback(successCallback);

      expect(res.received).toBe(true);
      expect(mockDatabaseService.logCallback).not.toHaveBeenCalled();
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
    });

    it('falls through to the collection row (by externalId) when a GIVE_CHANGE row shares the id', async () => {
      mockDatabaseService.getTransactionByTransactionId.mockImplementation(async (k: string) => (k === '456' ? gcRow : null));
      mockDatabaseService.getTransactionByReference.mockImplementation(async (k: string) => (k === 'REF123' ? mockTransaction : null));
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ success: true });

      await processor.processFedaPayCallback(collectionApproved);

      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'tx-123' }),
        'SUCCESS'
      );
      expect(mockDatabaseService.logCallback).not.toHaveBeenCalledWith('gc-1', expect.anything());
    });

    it('still resolves a DEV mock payout auto-callback on its GIVE_CHANGE row', async () => {
      const mockGc = { ...gcRow, transaction_id: 'mock-abc123-xyz' };
      mockDatabaseService.getTransactionByTransactionId.mockImplementation(async (k: string) => (k === 'mock-abc123-xyz' ? mockGc : null));
      mockDatabaseService.getTransactionByReference.mockImplementation(async (k: string) => (k === 'REFGC' ? mockGc : null));
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(false);

      // exact shape FedaPayService.scheduleAutoCallback emits for a mock payout
      await processor
        .processFedaPayCallback({
          entity: { id: parseInt('abc123', 36), status: 'approved', amount: 0, reference: 'mock-abc123-xyz', custom_metadata: { externalId: 'REFGC' } } as any,
          name: 'transaction.approved',
        })
        .catch(() => undefined); // finalize collaborators are not under test here

      expect(mockDatabaseService.logCallback).toHaveBeenCalledWith('gc-1', expect.anything());
    });

    it('does not match GIVE_CHANGE row when mock mode is off', async () => {
      // Temporarily disable mock mode
      mockFedaPayService.mockEnabled = false;

      const mockGc = { ...gcRow, transaction_id: 'mock-abc123-xyz' };
      mockDatabaseService.getTransactionByTransactionId.mockImplementation(async (k: string) => (k === 'mock-abc123-xyz' ? mockGc : null));
      mockDatabaseService.getTransactionByReference.mockImplementation(async (k: string) => (k === 'REFGC' ? null : mockGc));

      await processor
        .processFedaPayCallback({
          entity: { id: parseInt('abc123', 36), status: 'approved', amount: 0, reference: 'mock-abc123-xyz', custom_metadata: { externalId: 'REFGC' } } as any,
          name: 'transaction.approved',
        })
        .catch(() => undefined);

      // Should not match the GIVE_CHANGE row
      expect(mockDatabaseService.logCallback).not.toHaveBeenCalledWith('gc-1', expect.anything());

      // Restore mock mode for other tests
      mockFedaPayService.mockEnabled = true;
    });
  });

  describe('N5: expired status handling', () => {
    it('handles transaction.updated with expired status as terminal failed', async () => {
      const expiredCallback: FedaPayCallbackDto = {
        entity: { id: 456, status: 'expired', amount: 1000, reference: 'fedapay-tx-456', custom_metadata: { externalId: 'REF456' } } as any,
        name: 'transaction.updated',
      };
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValueOnce(mockTransaction);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);

      await processor.processFedaPayCallback(expiredCallback);

      // The failPendingAttempt method is called, which updates the transaction
      // Note: assertProviderConfirmsCallback is NOT called for expired status - only for SUCCESS
      expect(mockDatabaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
        'fedapay-tx-123',
        'pending',
        expect.objectContaining({ status: 'failed' })
      );
    });

    it('ignores transaction.updated with non-terminal status (stays no-op)', async () => {
      const pendingUpdateCallback: FedaPayCallbackDto = {
        entity: { id: 456, status: 'pending', amount: 1000, reference: 'fedapay-tx-456' },
        name: 'transaction.updated',
      };
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValueOnce(mockTransaction);

      const result = await processor.processFedaPayCallback(pendingUpdateCallback);

      expect(result.received).toBe(true);
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
      expect(mockDatabaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
    });

    it('ignores transaction.updated with approved status (terminal events use dedicated transaction.approved)', async () => {
      const approvedUpdateCallback: FedaPayCallbackDto = {
        entity: { id: 456, status: 'approved', amount: 1000, reference: 'fedapay-tx-456' },
        name: 'transaction.updated',
      };
      mockDatabaseService.getTransactionByTransactionId.mockResolvedValueOnce(mockTransaction);

      const result = await processor.processFedaPayCallback(approvedUpdateCallback);

      expect(result.received).toBe(true);
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
      expect(mockDatabaseService.updateTransactionIfStatus).not.toHaveBeenCalled();
    });
  });

});
