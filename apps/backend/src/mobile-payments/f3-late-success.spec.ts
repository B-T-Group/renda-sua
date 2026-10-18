import { Test, TestingModule } from '@nestjs/testing';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import { MobilePaymentsDatabaseService, MobilePaymentTransaction } from './mobile-payments-database.service';
import { AccountsService } from '../accounts/accounts.service';
import { PaymentCallbackRegistryService } from './payment-callback/payment-callback-registry.service';
import { MobilePaymentsService } from './mobile-payments.service';
import { ModuleRef } from '@nestjs/core';
import type { FedaPayCallbackDto } from './mobile-payment-callback.dto';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';

jest.mock('../common/utils/money-alert.util', () => ({
  reportMoneyAnomaly: jest.fn(),
}));

describe('F3: Late Success Handling (Declined then Approved)', () => {
  let processor: MobilePaymentCallbackProcessor;
  let databaseService: jest.Mocked<MobilePaymentsDatabaseService>;
  let accountsService: jest.Mocked<AccountsService>;
  let mobilePaymentsService: jest.Mocked<MobilePaymentsService>;
  let registryService: jest.Mocked<PaymentCallbackRegistryService>;

  beforeEach(async () => {
    (reportMoneyAnomaly as jest.Mock).mockClear();
    databaseService = {
      logCallback: jest.fn().mockResolvedValue(undefined),
      updateTransactionIfStatus: jest.fn(),
      updateTransaction: jest.fn().mockResolvedValue(undefined),
      getTransactionByTransactionId: jest.fn(),
      getTransactionByReference: jest.fn(),
      getTransactionById: jest.fn(),
    } as any;

    accountsService = {
      creditWallet: jest.fn().mockResolvedValue({
        success: true,
        balance: { available_balance: '10000' },
      }),
      registerDepositIfNotExists: jest.fn().mockResolvedValue({
        success: true,
        alreadyProcessed: false,
      }),
    } as any;

    mobilePaymentsService = {
      assertProviderConfirmsCallback: jest.fn().mockResolvedValue(undefined),
    } as any;

    registryService = {
      getHandlers: jest.fn().mockReturnValue([]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobilePaymentCallbackProcessor,
        { provide: MobilePaymentsDatabaseService, useValue: databaseService },
        { provide: AccountsService, useValue: accountsService },
        { provide: MobilePaymentsService, useValue: mobilePaymentsService },
        { provide: PaymentCallbackRegistryService, useValue: registryService },
        { provide: ModuleRef, useValue: { get: jest.fn() } },
      ],
    }).compile();

    processor = module.get<MobilePaymentCallbackProcessor>(MobilePaymentCallbackProcessor);
  });

  describe('Wallet Top-Up Late Success', () => {
    it('should credit wallet once when declined then approved', async () => {
      // Setup: FAILED top-up transaction
      const failedTopUp: MobilePaymentTransaction = {
        id: 'tx-failed-topup',
        reference: 'REF-TOPUP-123',
        transaction_id: '525495',
        status: 'failed',
        transaction_type: 'PAYMENT',
        payment_entity: null, // wallet top-up
        amount: 5000,
        currency: 'XOF',
        account_id: 'acc-123',
        provider: 'fedapay',
        entity_id: null,
        customer_phone: '+22890123456',
        created_at: new Date().toISOString(),
      };

      // Mock lookup to return the failed transaction
      databaseService.getTransactionByTransactionId.mockResolvedValue(failedTopUp);

      // Mock CAS success (failed → processing)
      databaseService.updateTransactionIfStatus.mockResolvedValue(true);

      // Approved callback arrives
      const approvedCallback: FedaPayCallbackDto = {
        name: 'transaction.approved',
        entity: {
          id: 525495,
          status: 'approved',
          amount: 5000,
          currency: 'XOF',
          custom_metadata: {
            externalId: 'REF-TOPUP-123',
          },
        } as any,
      };

      await processor.processFedaPayCallback(approvedCallback);

      // Verify callback was logged
      expect(databaseService.logCallback).toHaveBeenCalledWith('tx-failed-topup', approvedCallback);

      // Verify CAS claim (failed → processing)
      expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
        'tx-failed-topup',
        'failed',
        { status: 'processing' }
      );

      // Verify wallet was credited with idempotency key
      expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith({
        accountId: 'acc-123',
        amount: 5000,
        memo: expect.stringContaining('REF-TOPUP-123'),
        referenceId: 'tx-failed-topup',
        idempotencyKey: 'momo-deposit:tx-failed-topup',
      });

      // Verify transaction marked as success
      expect(databaseService.updateTransaction).toHaveBeenCalledWith(
        'tx-failed-topup',
        expect.objectContaining({
          status: 'success',
          error_code: 'LATE_SUCCESS_APPLIED',
        })
      );

      // Verify money anomaly was reported
      expect(reportMoneyAnomaly).toHaveBeenCalled();
      const [, anomalyType, message] = (reportMoneyAnomaly as jest.Mock).mock.calls[0];
      expect(anomalyType).toBe('late_success_wallet_credited');
      expect(message).toContain('tx-failed-topup');
    });

    it('should not double-credit on replay (idempotency)', async () => {
      const failedTopUp: MobilePaymentTransaction = {
        id: 'tx-replay',
        reference: 'REF-REPLAY-456',
        transaction_id: '525496',
        status: 'failed',
        transaction_type: 'PAYMENT',
        payment_entity: null,
        amount: 3000,
        currency: 'XOF',
        account_id: 'acc-456',
        provider: 'fedapay',
        entity_id: null,
        customer_phone: '+22890123456',
        created_at: new Date().toISOString(),
      };

      databaseService.getTransactionByTransactionId.mockResolvedValue(failedTopUp);

      // First callback: CAS succeeds
      databaseService.updateTransactionIfStatus.mockResolvedValueOnce(true);

      const approvedCallback: FedaPayCallbackDto = {
        name: 'transaction.approved',
        entity: {
          id: 525496,
          status: 'approved',
          amount: 3000,
          currency: 'XOF',
          custom_metadata: { externalId: 'REF-REPLAY-456' },
        } as any,
      };

      await processor.processFedaPayCallback(approvedCallback);

      expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledTimes(1);

      // Replay: CAS fails (already processing or success)
      databaseService.updateTransactionIfStatus.mockResolvedValueOnce(false);

      await processor.processFedaPayCallback(approvedCallback);

      // Still only credited once (idempotency key prevents double-credit even if CAS passed)
      expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledTimes(1);
    });

    it('should validate amount matches', async () => {
      const failedTopUp: MobilePaymentTransaction = {
        id: 'tx-amount-mismatch',
        reference: 'REF-AMOUNT-789',
        transaction_id: '525497',
        status: 'failed',
        transaction_type: 'PAYMENT',
        payment_entity: null,
        amount: 5000,
        currency: 'XOF',
        account_id: 'acc-789',
        provider: 'fedapay',
        entity_id: null,
        customer_phone: '+22890123456',
        created_at: new Date().toISOString(),
      };

      databaseService.getTransactionByTransactionId.mockResolvedValue(failedTopUp);

      const approvedCallback: FedaPayCallbackDto = {
        name: 'transaction.approved',
        entity: {
          id: 525497,
          status: 'approved',
          amount: 6000, // MISMATCH
          currency: 'XOF',
          custom_metadata: { externalId: 'REF-AMOUNT-789' },
        } as any,
      };

      await processor.processFedaPayCallback(approvedCallback);

      // Should NOT credit wallet due to amount mismatch
      expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
      expect(databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();

      // Verify money anomaly was reported
      expect(reportMoneyAnomaly).toHaveBeenCalled();
      const [, anomalyType, message] = (reportMoneyAnomaly as jest.Mock).mock.calls[0];
      expect(anomalyType).toBe('late_success_amount_mismatch');
      expect(message).toContain('tx-amount-mismatch');
    });

    it('should validate currency is XOF', async () => {
      const failedTopUp: MobilePaymentTransaction = {
        id: 'tx-currency-invalid',
        reference: 'REF-CURRENCY-999',
        transaction_id: '525498',
        status: 'failed',
        transaction_type: 'PAYMENT',
        payment_entity: null,
        amount: 5000,
        currency: 'XOF',
        account_id: 'acc-999',
        provider: 'fedapay',
        entity_id: null,
        customer_phone: '+22890123456',
        created_at: new Date().toISOString(),
      };

      databaseService.getTransactionByTransactionId.mockResolvedValue(failedTopUp);

      const approvedCallback: FedaPayCallbackDto = {
        name: 'transaction.approved',
        entity: {
          id: 525498,
          status: 'approved',
          amount: 5000,
          currency: 'XAF', // INVALID for FedaPay
          custom_metadata: { externalId: 'REF-CURRENCY-999' },
        } as any,
      };

      await processor.processFedaPayCallback(approvedCallback);

      // Should NOT credit wallet due to invalid currency
      expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
      expect(databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();

      // Verify money anomaly was reported
      expect(reportMoneyAnomaly).toHaveBeenCalled();
      const [, anomalyType, message] = (reportMoneyAnomaly as jest.Mock).mock.calls[0];
      expect(anomalyType).toBe('late_success_currency_invalid');
      expect(message).toContain('tx-currency-invalid');
    });

    it('should validate reference matches', async () => {
      const failedTopUp: MobilePaymentTransaction = {
        id: 'tx-ref-mismatch',
        reference: 'REF-EXPECTED-111',
        transaction_id: '525499',
        status: 'failed',
        transaction_type: 'PAYMENT',
        payment_entity: null,
        amount: 5000,
        currency: 'XOF',
        account_id: 'acc-111',
        provider: 'fedapay',
        entity_id: null,
        customer_phone: '+22890123456',
        created_at: new Date().toISOString(),
      };

      databaseService.getTransactionByTransactionId.mockResolvedValue(failedTopUp);

      const approvedCallback: FedaPayCallbackDto = {
        name: 'transaction.approved',
        entity: {
          id: 525499,
          status: 'approved',
          amount: 5000,
          currency: 'XOF',
          custom_metadata: { externalId: 'REF-DIFFERENT-999' }, // MISMATCH
        } as any,
      };

      await processor.processFedaPayCallback(approvedCallback);

      // Should NOT credit wallet due to reference mismatch
      expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
      expect(databaseService.updateTransactionIfStatus).not.toHaveBeenCalled();

      // Verify money anomaly was reported
      expect(reportMoneyAnomaly).toHaveBeenCalled();
      const [, anomalyType, message] = (reportMoneyAnomaly as jest.Mock).mock.calls[0];
      expect(anomalyType).toBe('late_success_reference_mismatch');
      expect(message).toContain('tx-ref-mismatch');
    });
  });

  describe('Order Payment Late Success', () => {
    it('should handle failed order payment when declined then approved', async () => {
      const mockOrderHandler = {
        canHandle: jest.fn().mockReturnValue(true),
        onSuccess: jest.fn().mockResolvedValue(undefined),
      };

      registryService.getHandlers.mockReturnValue([mockOrderHandler as any]);

      const failedOrderPayment: MobilePaymentTransaction = {
        id: 'tx-order-failed',
        reference: 'ORD-REF-789',
        transaction_id: '525500',
        status: 'failed',
        transaction_type: 'PAYMENT',
        payment_entity: 'order',
        entity_id: 'order-123',
        amount: 8000,
        currency: 'XOF',
        account_id: 'acc-789',
        provider: 'fedapay',
        customer_phone: '+22890123456',
        created_at: new Date().toISOString(),
      };

      databaseService.getTransactionByTransactionId.mockResolvedValue(failedOrderPayment);
      databaseService.updateTransactionIfStatus.mockResolvedValue(true);

      const approvedCallback: FedaPayCallbackDto = {
        name: 'transaction.approved',
        entity: {
          id: 525500,
          status: 'approved',
          amount: 8000,
          currency: 'XOF',
          custom_metadata: { externalId: 'ORD-REF-789' },
        } as any,
      };

      await processor.processFedaPayCallback(approvedCallback);

      // Verify callback was logged
      expect(databaseService.logCallback).toHaveBeenCalledWith('tx-order-failed', approvedCallback);

      // Verify CAS claim (failed → processing)
      expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
        'tx-order-failed',
        'failed',
        { status: 'processing' }
      );

      // Verify order payment handler was called
      expect(mockOrderHandler.onSuccess).toHaveBeenCalledWith(failedOrderPayment);

      // Verify transaction marked as success
      expect(databaseService.updateTransaction).toHaveBeenCalledWith(
        'tx-order-failed',
        expect.objectContaining({
          status: 'success',
          error_code: 'LATE_SUCCESS_APPLIED',
        })
      );

      // Verify money anomaly was reported
      expect(reportMoneyAnomaly).toHaveBeenCalled();
      const [, anomalyType, message] = (reportMoneyAnomaly as jest.Mock).mock.calls[0];
      expect(anomalyType).toBe('late_success_order_applied');
      expect(message).toContain('tx-order-failed');
    });

    it('should raise anomaly if order payment cannot be applied safely', async () => {
      const mockOrderHandler = {
        canHandle: jest.fn().mockReturnValue(true),
        onSuccess: jest.fn().mockRejectedValue(new Error('Order already paid')),
      };

      registryService.getHandlers.mockReturnValue([mockOrderHandler as any]);

      const failedOrderPayment: MobilePaymentTransaction = {
        id: 'tx-order-unsafe',
        reference: 'ORD-REF-UNSAFE',
        transaction_id: '525501',
        status: 'failed',
        transaction_type: 'PAYMENT',
        payment_entity: 'order',
        entity_id: 'order-456',
        amount: 10000,
        currency: 'XOF',
        account_id: 'acc-unsafe',
        provider: 'fedapay',
        customer_phone: '+22890123456',
        created_at: new Date().toISOString(),
      };

      databaseService.getTransactionByTransactionId.mockResolvedValue(failedOrderPayment);
      databaseService.updateTransactionIfStatus.mockResolvedValue(true);

      const approvedCallback: FedaPayCallbackDto = {
        name: 'transaction.approved',
        entity: {
          id: 525501,
          status: 'approved',
          amount: 10000,
          currency: 'XOF',
          custom_metadata: { externalId: 'ORD-REF-UNSAFE' },
        } as any,
      };

      // Should not throw - anomaly is raised instead
      await processor.processFedaPayCallback(approvedCallback);

      // Verify handler was attempted
      expect(mockOrderHandler.onSuccess).toHaveBeenCalled();

      // Transaction should remain in processing (not marked success)
      const updateCalls = databaseService.updateTransaction.mock.calls;
      const hasSuccessUpdate = updateCalls.some(
        (call) => call[1]?.status === 'success'
      );
      expect(hasSuccessUpdate).toBe(false);

      // Verify money anomaly was reported for the failed application
      expect(reportMoneyAnomaly).toHaveBeenCalled();
      const [, anomalyType, message] = (reportMoneyAnomaly as jest.Mock).mock.calls[0];
      expect(anomalyType).toBe('late_success_order_apply_failed');
      expect(message).toContain('tx-order-unsafe');
    });

    it('should report late_success_non_wallet anomaly when payment_entity is not wallet', async () => {
      // This test specifically verifies the late_success_non_wallet anomaly type
      const mockHandler = {
        canHandle: jest.fn().mockReturnValue(false), // No handler can handle it
      };

      registryService.getHandlers.mockReturnValue([mockHandler as any]);

      const failedNonWalletPayment: MobilePaymentTransaction = {
        id: 'tx-non-wallet',
        reference: 'REF-NON-WALLET',
        transaction_id: '525503',
        status: 'failed',
        transaction_type: 'PAYMENT',
        payment_entity: 'rental_deposit', // Non-wallet entity
        entity_id: 'rental-123',
        amount: 15000,
        currency: 'XOF',
        account_id: 'acc-non-wallet',
        provider: 'fedapay',
        customer_phone: '+22890123456',
        created_at: new Date().toISOString(),
      };

      databaseService.getTransactionByTransactionId.mockResolvedValue(failedNonWalletPayment);
      databaseService.updateTransactionIfStatus.mockResolvedValue(true);

      const approvedCallback: FedaPayCallbackDto = {
        name: 'transaction.approved',
        entity: {
          id: 525503,
          status: 'approved',
          amount: 15000,
          currency: 'XOF',
          custom_metadata: { externalId: 'REF-NON-WALLET' },
        } as any,
      };

      await processor.processFedaPayCallback(approvedCallback);

      // Verify money anomaly was reported with late_success_non_wallet
      expect(reportMoneyAnomaly).toHaveBeenCalled();
      const [, anomalyType, message] = (reportMoneyAnomaly as jest.Mock).mock.calls[0];
      expect(anomalyType).toBe('late_success_non_wallet');
      expect(message).toContain('tx-non-wallet');
    });
  });

  describe('FedaPay transaction.expired Handling', () => {
    it('should mark transaction as failed when expired event arrives', async () => {
      const pendingTx: MobilePaymentTransaction = {
        id: 'tx-expired',
        reference: 'REF-EXPIRED',
        transaction_id: '525502',
        status: 'pending',
        transaction_type: 'PAYMENT',
        payment_entity: null,
        amount: 2000,
        currency: 'XOF',
        account_id: 'acc-expired',
        provider: 'fedapay',
        entity_id: null,
        customer_phone: '+22890123456',
        created_at: new Date().toISOString(),
      };

      databaseService.getTransactionByTransactionId.mockResolvedValue(pendingTx);
      databaseService.updateTransactionIfStatus.mockResolvedValue(true);

      const expiredCallback: FedaPayCallbackDto = {
        name: 'transaction.expired',
        entity: {
          id: 525502,
          status: 'expired',
          amount: 2000,
          currency: 'XOF',
          custom_metadata: { externalId: 'REF-EXPIRED' },
        } as any,
      };

      await processor.processFedaPayCallback(expiredCallback);

      // Verify callback was logged
      expect(databaseService.logCallback).toHaveBeenCalledWith('tx-expired', expiredCallback);

      // Verify transaction was updated to failed (expired → FAILED normalization)
      expect(databaseService.updateTransactionIfStatus).toHaveBeenCalledWith(
        'tx-expired',
        'pending',
        expect.objectContaining({
          status: 'failed',
        })
      );
    });

    it('should fail when transaction.expired handling is removed', () => {
      // This test documents that transaction.expired MUST be handled as a terminal event
      // If someone removes it from TERMINAL_EVENTS, this test will fail
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(
        path.join(__dirname, 'mobile-payment-callback.processor.ts'),
        'utf-8'
      );
      
      // transaction.expired must be in the terminal events list
      expect(source).toContain('transaction.expired');
    });
  });
});
