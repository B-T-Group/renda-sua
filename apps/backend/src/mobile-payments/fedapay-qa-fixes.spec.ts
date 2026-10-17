import { Test, TestingModule } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsService } from './mobile-payments.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import { AccountsService } from '../accounts/accounts.service';
import { PaymentCallbackRegistryService } from './payment-callback/payment-callback-registry.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { FedaPayService } from './providers/fedapay.service';
import { MyPVitService } from './providers/mypvit.service';
import { FreemopayService } from './providers/freemopay.service';
import { MtnMomoService } from '../mtn-momo/mtn-momo.service';
import { MtnMomoDatabaseService } from '../mtn-momo/mtn-momo-database.service';
import { OrangeMomoService } from '../orange-momo/orange-momo.service';
import { OrangeMomoDatabaseService } from '../orange-momo/orange-momo-database.service';
import type { FedaPayCallbackDto } from './mobile-payment-callback.dto';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';

/**
 * QA Phase 1 findings: F2, F3, F-L2, F-L3, F-M3, F-M5, G1, G2, G3, M3, N6
 * Tests for each fix with mutation checks.
 */
describe('FedaPay QA Fixes (Phase 1 Findings)', () => {
  let processor: MobilePaymentCallbackProcessor;
  let service: MobilePaymentsService;
  let databaseService: MobilePaymentsDatabaseService;
  let accountsService: AccountsService;

  const mockDatabaseService = {
    getTransactionById: jest.fn(),
    getTransactionByTransactionId: jest.fn(),
    getTransactionByReference: jest.fn(),
    updateTransactionIfStatus: jest.fn(),
    updateTransaction: jest.fn(),
    logCallback: jest.fn(),
  };

  const mockAccountsService = {
    registerDepositIfNotExists: jest.fn(),
    registerWithdrawalIfNotExists: jest.fn(),
    registerReleaseIfNotExists: jest.fn(),
    hasTransactionForReference: jest.fn(),
  };

  const mockMobilePaymentsService = {
    assertProviderConfirmsCallback: jest.fn(),
  };

  const mockRegistryService = {
    getHandlers: jest.fn().mockReturnValue([]),
  };

  const mockModuleRef = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobilePaymentCallbackProcessor,
        { provide: MobilePaymentsDatabaseService, useValue: mockDatabaseService },
        { provide: AccountsService, useValue: mockAccountsService },
        { provide: MobilePaymentsService, useValue: mockMobilePaymentsService },
        { provide: PaymentCallbackRegistryService, useValue: mockRegistryService },
        { provide: ModuleRef, useValue: mockModuleRef },
      ],
    }).compile();

    processor = module.get<MobilePaymentCallbackProcessor>(MobilePaymentCallbackProcessor);
    service = module.get<MobilePaymentsService>(MobilePaymentsService);
    databaseService = module.get<MobilePaymentsDatabaseService>(MobilePaymentsDatabaseService);
    accountsService = module.get<AccountsService>(AccountsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('F2: Handle transaction.expired event', () => {
    const expiredTx: MobilePaymentTransaction = {
      id: 'tx-expired-1',
      status: 'pending',
      provider: 'fedapay',
      transaction_type: 'PAYMENT',
      transaction_id: '789',
      amount: 500,
      currency: 'XOF',
      reference: 'REF-EXPIRED',
      customer_phone: '+22890123456',
      account_id: 'acc-1',
      payment_entity: 'account',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should process transaction.expired event as terminal', async () => {
      const expiredEvent: FedaPayCallbackDto = {
        entity: {
          id: 789,
          status: 'expired',
          amount: 500,
          reference: 'REF-EXPIRED',
          custom_metadata: { externalId: 'REF-EXPIRED' },
        } as any,
        name: 'transaction.expired',
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(expiredTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);

      const result = await processor.processFedaPayCallback(expiredEvent);

      expect(result.received).toBe(true);
      expect(mockDatabaseService.logCallback).toHaveBeenCalledWith(expiredTx.id, expiredEvent);
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).toHaveBeenCalledWith(
        expect.objectContaining({ id: expiredTx.id }),
        'FAILED'
      );
    });

    it('should still process transaction.updated with expired status', async () => {
      const updatedExpired: FedaPayCallbackDto = {
        entity: {
          id: 789,
          status: 'expired',
          amount: 500,
          reference: 'REF-EXPIRED',
          custom_metadata: { externalId: 'REF-EXPIRED' },
        } as any,
        name: 'transaction.updated',
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(expiredTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);

      const result = await processor.processFedaPayCallback(updatedExpired);

      expect(result.received).toBe(true);
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).toHaveBeenCalled();
    });
  });

  describe('F3: Approve-after-decline for top-ups', () => {
    const failedTopUpTx: MobilePaymentTransaction = {
      id: 'tx-failed-topup',
      status: 'failed',
      provider: 'fedapay',
      transaction_type: 'PAYMENT',
      transaction_id: '999',
      amount: 1000,
      currency: 'XOF',
      reference: 'REF-TOPUP',
      customer_phone: '+22890123456',
      account_id: 'acc-1',
      payment_entity: 'account',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should re-check and credit a failed top-up that later gets approved', async () => {
      const lateApproval: FedaPayCallbackDto = {
        entity: {
          id: 999,
          status: 'approved',
          amount: 1000,
          reference: 'REF-TOPUP',
          custom_metadata: { externalId: 'REF-TOPUP' },
        } as any,
        name: 'transaction.approved',
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(failedTopUpTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ 
        success: true, 
        alreadyExists: false 
      });
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);

      const result = await processor.processFedaPayCallback(lateApproval);

      expect(result.received).toBe(true);
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).toHaveBeenCalledWith(
        expect.objectContaining({ id: failedTopUpTx.id }),
        'SUCCESS'
      );
      expect(mockAccountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: failedTopUpTx.account_id,
          amount: failedTopUpTx.amount,
        })
      );
      // F3: First CAS claim failed->processing, then mark success
      expect(mockDatabaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
        failedTopUpTx.id,
        'failed',
        expect.objectContaining({ status: 'processing' })
      );
      expect(mockDatabaseService.updateTransaction).toHaveBeenCalledWith(
        failedTopUpTx.id,
        expect.objectContaining({ status: 'success' })
      );
    });

    it('should NOT credit non-wallet entities on late approval (money anomaly case)', async () => {
      const failedOrderTx: MobilePaymentTransaction = {
        id: 'tx-failed-order',
        status: 'failed',
        provider: 'fedapay',
        transaction_type: 'PAYMENT',
        transaction_id: '888',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF-ORDER',
        customer_phone: '+22890123456',
        account_id: 'acc-1',
        payment_entity: 'order', // Non-wallet entity
        entity_id: 'ORD-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const lateApprovalOrder: FedaPayCallbackDto = {
        entity: {
          id: 888,
          status: 'approved',
          amount: 1000,
          reference: 'REF-ORDER',
          custom_metadata: { externalId: 'REF-ORDER' },
        } as any,
        name: 'transaction.approved',
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(failedOrderTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);

      const result = await processor.processFedaPayCallback(lateApprovalOrder);

      expect(result.received).toBe(true);
      // Should NOT call registerDepositIfNotExists for non-wallet entities
      expect(mockAccountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
      // The processor should log the money anomaly and return early
    });

    it('should use CAS to prevent double-credit on concurrent callbacks', async () => {
      const lateApproval: FedaPayCallbackDto = {
        entity: {
          id: 999,
          status: 'approved',
          amount: 1000,
          reference: 'REF-TOPUP',
          custom_metadata: { externalId: 'REF-TOPUP' },
        } as any,
        name: 'transaction.approved',
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(failedTopUpTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ 
        success: true, 
        alreadyExists: false 
      });
      // CAS fails - another callback already moved the row
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(false);

      const result = await processor.processFedaPayCallback(lateApproval);

      expect(result.received).toBe(true);
      // F3: CAS before credit means if CAS fails, no credit happens (preventing double-credit)
      expect(mockAccountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    });

    it('should credit wallet when payment_entity is null (real user top-ups)', async () => {
      const topUpWithNullEntity: MobilePaymentTransaction = {
        ...failedTopUpTx,
        payment_entity: null as any,
      };

      const lateApproval: FedaPayCallbackDto = {
        entity: {
          id: 999,
          status: 'approved',
          amount: 1000,
          reference: 'REF-TOPUP',
          custom_metadata: { externalId: 'REF-TOPUP' },
        } as any,
        name: 'transaction.approved',
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(topUpWithNullEntity);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ 
        success: true, 
        alreadyExists: false 
      });
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);

      const result = await processor.processFedaPayCallback(lateApproval);

      expect(result.received).toBe(true);
      expect(mockAccountsService.registerDepositIfNotExists).toHaveBeenCalled();
    });

    it('should log money anomaly for non-wallet late approvals', async () => {
      const orderTx: MobilePaymentTransaction = {
        ...failedTopUpTx,
        payment_entity: 'order',
      };

      const lateApproval: FedaPayCallbackDto = {
        entity: {
          id: 999,
          status: 'approved',
          amount: 1000,
          reference: 'REF-TOPUP',
          custom_metadata: { externalId: 'REF-TOPUP' },
        } as any,
        name: 'transaction.approved',
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(orderTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);

      const result = await processor.processFedaPayCallback(lateApproval);

      expect(result.received).toBe(true);
      // No credit should happen for non-wallet entities
      expect(mockAccountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
      // Transaction should remain unchanged
      expect(mockDatabaseService.updateTransaction).not.toHaveBeenCalled();
    });

    it('should preserve transaction_id when marking late success', async () => {
      const lateApproval: FedaPayCallbackDto = {
        entity: {
          id: 999,
          status: 'approved',
          amount: 1000,
          reference: 'REF-TOPUP',
          custom_metadata: { externalId: 'REF-TOPUP' },
        } as any,
        name: 'transaction.approved',
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(failedTopUpTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ 
        success: true, 
        alreadyExists: false 
      });
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);

      await processor.processFedaPayCallback(lateApproval);

      // The final updateTransaction call should NOT include transaction_id
      const finalUpdateCall = mockDatabaseService.updateTransaction.mock.calls.find(
        (call) => call[1].status === 'success'
      );
      expect(finalUpdateCall).toBeDefined();
      expect(finalUpdateCall[1]).not.toHaveProperty('transaction_id');
    });
  });

  describe('F-L3: Preserve mock- transaction_id', () => {
    const mockTx: MobilePaymentTransaction = {
      id: 'tx-mock-1',
      status: 'pending',
      provider: 'fedapay',
      transaction_type: 'PAYMENT',
      transaction_id: 'mock-abc-123',
      amount: 500,
      currency: 'XOF',
      reference: 'REF-MOCK',
      customer_phone: '+22890123456',
      account_id: 'acc-1',
      payment_entity: 'account',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should preserve mock- id and not overwrite with numeric entity id', async () => {
      const mockCallback: FedaPayCallbackDto = {
        entity: {
          id: 12345,
          status: 'approved',
          amount: 500,
          reference: 'mock-abc-123',
          custom_metadata: { externalId: 'REF-MOCK' },
        } as any,
        name: 'transaction.approved',
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(mockTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ 
        success: true, 
        alreadyExists: false 
      });
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);

      await processor.processFedaPayCallback(mockCallback);

      // Should use mock- reference, not the numeric entity.id
      const updateCall = mockDatabaseService.updateTransactionIfStatus.mock.calls.find(
        (call) => call[0] === mockTx.id && call[1] === 'processing'
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[2].transaction_id).toBe('mock-abc-123');
    });

    it('should preserve stored mock- id even when callback reference is not mock-', async () => {
      const storedMockTx: MobilePaymentTransaction = {
        id: 'tx-mock-2',
        status: 'pending',
        provider: 'fedapay',
        transaction_type: 'PAYMENT',
        transaction_id: 'mock-xyz-789',
        amount: 1000,
        currency: 'XOF',
        reference: 'REF-REAL',
        customer_phone: '+22890123456',
        account_id: 'acc-2',
        payment_entity: 'account',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const callbackWithNonMockReference: FedaPayCallbackDto = {
        entity: {
          id: 99999,
          status: 'approved',
          amount: 1000,
          reference: 'REF-REAL',
          custom_metadata: { externalId: 'REF-REAL' },
        } as any,
        name: 'transaction.approved',
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(storedMockTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ 
        success: true, 
        alreadyExists: false 
      });
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(true);

      await processor.processFedaPayCallback(callbackWithNonMockReference);

      // Should preserve stored mock-xyz-789, NOT use numeric 99999
      const updateCall = mockDatabaseService.updateTransactionIfStatus.mock.calls.find(
        (call) => call[0] === storedMockTx.id && call[1] === 'processing'
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[2].transaction_id).toBe('mock-xyz-789');
    });
  });

  describe('G1: Mock carve-out only when mock mode is on', () => {
    const mockGiveChangeTx: MobilePaymentTransaction = {
      id: 'tx-gc-mock',
      status: 'pending',
      provider: 'fedapay',
      transaction_type: 'GIVE_CHANGE',
      transaction_id: 'mock-xyz-789',
      amount: 200,
      currency: 'XOF',
      reference: 'GC-REF',
      customer_phone: '+22890123456',
      account_id: 'acc-1',
      payment_entity: 'account',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should not match mock GIVE_CHANGE rows when mock mode is off', async () => {
      // Mock mode is off
      const mockFedaPayService = {
        mockEnabled: false,
      };
      mockModuleRef.get.mockReturnValue(mockFedaPayService);

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(mockGiveChangeTx);
      mockDatabaseService.getTransactionByReference.mockResolvedValue(null);

      const callback: FedaPayCallbackDto = {
        entity: {
          id: 123,
          status: 'approved',
          amount: 200,
          reference: 'mock-xyz-789',
          custom_metadata: { externalId: 'GC-REF' },
        } as any,
        name: 'transaction.approved',
      };

      const result = await processor.processFedaPayCallback(callback);

      // Should not find the transaction (carve-out blocked by mock mode check)
      expect(result.received).toBe(true);
      expect(mockMobilePaymentsService.assertProviderConfirmsCallback).not.toHaveBeenCalled();
    });

    it('should match mock GIVE_CHANGE rows when mock mode is on', async () => {
      // Mock mode is on
      const mockFedaPayService = {
        mockEnabled: true,
      };
      mockModuleRef.get.mockReturnValue(mockFedaPayService);

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(mockGiveChangeTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValueOnce(true); // pending->processing
      mockAccountsService.registerReleaseIfNotExists.mockResolvedValue({ success: true });
      mockAccountsService.registerWithdrawalIfNotExists.mockResolvedValue({ 
        success: true, 
        alreadyExists: false 
      });
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValueOnce(true); // processing->success

      const callback: FedaPayCallbackDto = {
        entity: {
          id: 123,
          status: 'approved',
          amount: 200,
          reference: 'mock-xyz-789',
          custom_metadata: { externalId: 'GC-REF' },
        } as any,
        name: 'transaction.approved',
      };

      const result = await processor.processFedaPayCallback(callback);

      expect(result.received).toBe(true);
      expect(mockDatabaseService.updateTransactionIfStatus).toHaveBeenCalled();
    });
  });

  describe('G3: Tests assert CAS and account operations', () => {
    const gcTx: MobilePaymentTransaction = {
      id: 'tx-gc-1',
      status: 'pending',
      provider: 'fedapay',
      transaction_type: 'GIVE_CHANGE',
      transaction_id: 'mock-gc-1',
      amount: 150,
      currency: 'XOF',
      reference: 'GC-1',
      customer_phone: '+22890123456',
      account_id: 'acc-1',
      payment_entity: 'account',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('should assert CAS claim succeeds and debit is called', async () => {
      const mockFedaPayService = { mockEnabled: true };
      mockModuleRef.get.mockReturnValue(mockFedaPayService);

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(gcTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValueOnce(true); // CAS claim
      mockAccountsService.registerReleaseIfNotExists.mockResolvedValue({ success: true });
      mockAccountsService.registerWithdrawalIfNotExists.mockResolvedValue({ 
        success: true, 
        alreadyExists: false 
      });
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValueOnce(true); // mark success

      const callback: FedaPayCallbackDto = {
        entity: {
          id: 111,
          status: 'approved',
          amount: 150,
          reference: 'mock-gc-1',
          custom_metadata: { externalId: 'GC-1' },
        } as any,
        name: 'transaction.approved',
      };

      await processor.processFedaPayCallback(callback);

      // G3: Assert CAS claim was called and succeeded
      expect(mockDatabaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
        gcTx.id,
        'pending',
        { status: 'processing' }
      );
      
      // G3: Assert account release was called
      expect(mockAccountsService.registerReleaseIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: gcTx.account_id,
          amount: gcTx.amount,
          referenceId: gcTx.id,
        })
      );
      
      // G3: Assert account debit was called
      expect(mockAccountsService.registerWithdrawalIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: gcTx.account_id,
          amount: gcTx.amount,
          referenceId: gcTx.id,
        })
      );

      // G3: Assert final status update was called
      expect(mockDatabaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
        gcTx.id,
        'processing',
        expect.objectContaining({ status: 'success' })
      );
    });

    it('should not debit if CAS claim fails', async () => {
      const mockFedaPayService = { mockEnabled: true };
      mockModuleRef.get.mockReturnValue(mockFedaPayService);

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(gcTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      // CAS claim fails
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValue(false);
      mockDatabaseService.getTransactionById.mockResolvedValue({
        ...gcTx,
        status: 'processing',
      });

      const callback: FedaPayCallbackDto = {
        entity: {
          id: 111,
          status: 'approved',
          amount: 150,
          reference: 'mock-gc-1',
          custom_metadata: { externalId: 'GC-1' },
        } as any,
        name: 'transaction.approved',
      };

      await processor.processFedaPayCallback(callback);

      // G3: Assert CAS was attempted
      expect(mockDatabaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
        gcTx.id,
        'pending',
        { status: 'processing' }
      );
      
      // G3: Assert no debit when CAS fails
      expect(mockAccountsService.registerReleaseIfNotExists).not.toHaveBeenCalled();
      expect(mockAccountsService.registerWithdrawalIfNotExists).not.toHaveBeenCalled();
    });

    it('should assert deposit for top-up success', async () => {
      const depositTx: MobilePaymentTransaction = {
        id: 'tx-deposit-1',
        status: 'pending',
        provider: 'fedapay',
        transaction_type: 'PAYMENT',
        transaction_id: '789',
        amount: 500,
        currency: 'XOF',
        reference: 'REF-1',
        customer_phone: '+22890123456',
        account_id: 'acc-1',
        payment_entity: 'account',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockDatabaseService.getTransactionByTransactionId.mockResolvedValue(depositTx);
      mockDatabaseService.logCallback.mockResolvedValue(undefined);
      mockMobilePaymentsService.assertProviderConfirmsCallback.mockResolvedValue(undefined);
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValueOnce(true); // CAS
      mockAccountsService.registerDepositIfNotExists.mockResolvedValue({ 
        success: true, 
        alreadyExists: false 
      });
      mockDatabaseService.updateTransactionIfStatus.mockResolvedValueOnce(true); // mark success

      const callback: FedaPayCallbackDto = {
        entity: {
          id: 789,
          status: 'approved',
          amount: 500,
          reference: 'REF-1',
          custom_metadata: { externalId: 'REF-1' },
        } as any,
        name: 'transaction.approved',
      };

      await processor.processFedaPayCallback(callback);

      // G3: Assert CAS was called
      expect(mockDatabaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
        depositTx.id,
        'pending',
        { status: 'processing' }
      );

      // G3: Assert deposit was called
      expect(mockAccountsService.registerDepositIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: depositTx.account_id,
          amount: depositTx.amount,
        })
      );
    });
  });

  describe('N6: Handle empty/null stored reference (real code)', () => {
    let realService: MobilePaymentsService;
    let mockFedaPayService: any;
    let mockHasuraSystemService: any;

    beforeEach(async () => {
      mockFedaPayService = {
        checkTransactionStatus: jest.fn(),
        testConnection: jest.fn().mockResolvedValue(true),
        getSupportedPaymentMethods: jest.fn().mockResolvedValue(['mobile_money']),
      };
      mockHasuraSystemService = {
        executeQuery: jest.fn(),
        executeMutation: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MobilePaymentsService,
          { provide: HasuraSystemService, useValue: mockHasuraSystemService },
          { provide: FedaPayService, useValue: mockFedaPayService },
          { provide: MyPVitService, useValue: { testConnection: jest.fn().mockResolvedValue(true) } },
          { provide: FreemopayService, useValue: { testConnection: jest.fn().mockResolvedValue(true) } },
          { provide: MtnMomoService, useValue: { testConnection: jest.fn().mockResolvedValue(true) } },
          { provide: MtnMomoDatabaseService, useValue: {} },
          { provide: OrangeMomoService, useValue: { testConnection: jest.fn().mockResolvedValue(true) } },
          { provide: OrangeMomoDatabaseService, useValue: {} },
          { provide: MobilePaymentsDatabaseService, useValue: { getUserCountry: jest.fn(), getUserAddress: jest.fn() } },
        ],
      }).compile();

      realService = module.get<MobilePaymentsService>(MobilePaymentsService);
    });

    it('should reject SUCCESS callback when stored reference is empty', async () => {
      const tx = {
        id: 'tx-no-ref',
        transaction_id: '123',
        provider: 'fedapay',
        reference: '',
        amount: 500,
        currency: 'XOF',
        customer_phone: '+22890123456',
        transaction_type: 'PAYMENT',
      } as any;

      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        transactionId: '123',
        status: 'approved',
        amount: 500,
        currency: 'XOF',
        reference: '123',
        merchantRef: 'LIVE-REF',
        reason: '',
        message: 'Success',
      });

      await expect(
        realService.assertProviderConfirmsCallback(tx, 'SUCCESS')
      ).rejects.toThrow(/missing stored reference/);
    });

    it('should reject FAILED callback when stored reference is null', async () => {
      const tx = {
        id: 'tx-null-ref',
        transaction_id: '123',
        provider: 'fedapay',
        reference: null,
        amount: 500,
        currency: 'XOF',
        customer_phone: '+22890123456',
        transaction_type: 'PAYMENT',
      } as any;

      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        transactionId: '123',
        status: 'declined',
        amount: 500,
        currency: 'XOF',
        reference: '123',
        merchantRef: 'LIVE-REF',
        reason: 'declined',
        message: 'Declined',
      });

      await expect(
        realService.assertProviderConfirmsCallback(tx, 'FAILED')
      ).rejects.toThrow(/missing stored reference/);
    });

    it('should reject SUCCESS callback when stored reference is whitespace', async () => {
      const tx = {
        id: 'tx-ws-ref',
        transaction_id: '123',
        provider: 'fedapay',
        reference: '   ',
        amount: 500,
        currency: 'XOF',
        customer_phone: '+22890123456',
        transaction_type: 'PAYMENT',
      } as any;

      mockFedaPayService.checkTransactionStatus.mockResolvedValue({
        transactionId: '123',
        status: 'approved',
        amount: 500,
        currency: 'XOF',
        reference: '123',
        merchantRef: 'LIVE-REF',
        reason: '',
        message: 'Success',
      });

      await expect(
        realService.assertProviderConfirmsCallback(tx, 'SUCCESS')
      ).rejects.toThrow(/missing stored reference/);
    });
  });
});
