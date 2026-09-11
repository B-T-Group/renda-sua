import { HttpException, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { MobilePaymentsDatabaseService } from '../mobile-payments/mobile-payments-database.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

describe('OrdersService - retryDepositPayment', () => {
  let service: OrdersService;
  let mobilePaymentsDatabaseService: jest.Mocked<MobilePaymentsDatabaseService>;
  let mobilePaymentsService: jest.Mocked<MobilePaymentsService>;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let hasuraUserService: jest.Mocked<HasuraUserService>;

  const mockUser = {
    id: 'user-123',
    email: 'client@example.com',
    user_type_id: 'client',
    active_persona: 'client',
    client: { id: 'client-123', user_id: 'user-123' },
  };

  const mockOrder = {
    id: 'order-123',
    order_number: 'ORD-123',
    current_status: 'pending_payment',
    total_amount: 10000,
    currency: 'XAF',
    payment_timing: 'pay_at_delivery',
    payment_source: 'mobile_payment',
    deposit_amount: 2000,
    deposit_status: 'pending',
    deposit_mobile_payment_transaction_id: null,
    client: {
      user_id: 'user-123',
      user: {
        phone_number: '+241062345678',
      },
    },
    business_location: {
      address: { country: 'GA' },
    },
  };

  beforeEach(() => {
    mobilePaymentsDatabaseService = {
      getTransactionById: jest.fn(),
      createTransaction: jest.fn(),
      updateTransaction: jest.fn(),
    } as any;

    mobilePaymentsService = {
      resolveProvider: jest.fn().mockReturnValue('mypvit'),
      initiatePayment: jest.fn(),
    } as any;

    hasuraSystemService = {
      getAccount: jest.fn(),
      executeMutation: jest.fn(),
    } as any;

    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(mockUser),
    } as any;

    service = {
      hasuraUserService,
      mobilePaymentsDatabaseService,
      mobilePaymentsService,
      hasuraSystemService,
      requireActivePersona: jest.fn(),
      getOrderDetails: jest.fn(),
      orderMomoContext: jest.fn().mockReturnValue({
        provider: 'mypvit',
        itemCountry: 'GA',
        payerUserId: 'user-123',
      }),
      waitAndExecuteScheduleService: {
        schedulePaymentTimeout: jest.fn(),
      },
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
      },
      finalizeDepositAfterCallback: jest.fn(),
      completePaidDepositFromSucceededTxn:
        OrdersService.prototype.completePaidDepositFromSucceededTxn,
      retryDepositPayment: OrdersService.prototype.retryDepositPayment,
    } as any;
  });

  describe('Guard checks', () => {
    it('should reject if order is not pending_payment', async () => {
      const order = { ...mockOrder, current_status: 'confirmed' };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      await expect(
        service.retryDepositPayment('order-123')
      ).rejects.toThrow(
        new HttpException(
          'Deposit payment retry is only available when order is pending payment',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should reject if payment_timing is pay_now', async () => {
      const order = { ...mockOrder, payment_timing: 'pay_now' };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      await expect(
        service.retryDepositPayment('order-123')
      ).rejects.toThrow(
        new HttpException(
          'Deposit payment retry is only available for pay-at-delivery or pay-at-pickup orders',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should return success if deposit is already paid', async () => {
      const order = { ...mockOrder, deposit_status: 'paid' };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      const result = await service.retryDepositPayment('order-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Deposit is already paid');
      expect(result.deposit_status).toBe('paid');
    });

    it('should allow retry when deposit_status is failed', async () => {
      const order = {
        ...mockOrder,
        deposit_status: 'failed',
        deposit_mobile_payment_transaction_id: 'txn-old-failed',
      };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);
      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue({
        id: 'txn-old-failed',
        status: 'failed',
      });
      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-123',
      });
      hasuraSystemService.getAccount.mockResolvedValue({ id: 'acct-1' });
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders: {
          affected_rows: 1,
          returning: [{ id: 'order-123', deposit_status: 'pending' }],
        },
      });
      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-1',
      });

      const result = await service.retryDepositPayment('order-123');

      expect(result.success).toBe(true);
      expect(result.deposit_status).toBe('pending');
    });

    it('should reject if order is cancelled', async () => {
      const order = { ...mockOrder, current_status: 'cancelled' };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      await expect(
        service.retryDepositPayment('order-123')
      ).rejects.toThrow(
        new HttpException(
          'Cannot retry deposit payment for cancelled order',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should reject if payment_source is not mobile_payment', async () => {
      const order = { ...mockOrder, payment_source: 'credit_card' };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      await expect(
        service.retryDepositPayment('order-123')
      ).rejects.toThrow(
        new HttpException(
          'Deposit payment retry is only available for mobile payment orders',
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe('CRITICAL: Prior pending/processing transaction guards', () => {
    it('should return 409 DEPOSIT_PAYMENT_PENDING if prior deposit transaction is still pending', async () => {
      const order = {
        ...mockOrder,
        deposit_mobile_payment_transaction_id: 'txn-old-123',
      };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue({
        id: 'txn-old-123',
        status: 'pending',
        reference: 'ORD-123-DEP-12345',
        amount: 2000,
        currency: 'XAF',
      } as any);

      await expect(
        service.retryDepositPayment('order-123')
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            success: false,
            code: 'DEPOSIT_PAYMENT_PENDING',
            existing_transaction_id: 'txn-old-123',
            deposit_status: 'pending',
          }),
          status: HttpStatus.CONFLICT,
        })
      );
    });

    it('should replay deposit finalize if prior deposit transaction succeeded but deposit_status still pending', async () => {
      const order = {
        ...mockOrder,
        deposit_mobile_payment_transaction_id: 'txn-old-123',
      };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);
      (service as any).finalizeDepositAfterCallback.mockResolvedValue(undefined);

      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue({
        id: 'txn-old-123',
        status: 'success',
        reference: 'ORD-123-DEP-12345',
        amount: 2000,
        currency: 'XAF',
      } as any);

      const result = await service.retryDepositPayment('order-123');

      expect((service as any).finalizeDepositAfterCallback).toHaveBeenCalledWith(
        'ORD-123',
        'txn-old-123'
      );
      expect(result).toEqual({
        success: true,
        message: 'Deposit payment completed',
        current_status: 'pending',
        deposit_status: 'paid',
      });
    });

    it('should replay deposit finalize if prior deposit transaction authorized but deposit_status still pending', async () => {
      const order = {
        ...mockOrder,
        deposit_mobile_payment_transaction_id: 'txn-old-123',
      };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);
      (service as any).finalizeDepositAfterCallback.mockResolvedValue(undefined);

      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue({
        id: 'txn-old-123',
        status: 'authorized' as any,
        reference: 'ORD-123-DEP-12345',
        amount: 2000,
        currency: 'XAF',
      } as any);

      const result = await service.retryDepositPayment('order-123');

      expect((service as any).finalizeDepositAfterCallback).toHaveBeenCalledWith(
        'ORD-123',
        'txn-old-123'
      );
      expect(result.deposit_status).toBe('paid');
    });


    it('should allow retry if prior deposit transaction is failed (CAS with expectedPriorTxnId)', async () => {
      const order = {
        ...mockOrder,
        deposit_mobile_payment_transaction_id: 'txn-old-123',
      };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue({
        id: 'txn-old-123',
        status: 'failed',
        reference: 'ORD-123-DEP-12345',
        amount: 2000,
        currency: 'XAF',
      } as any);

      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        currency: 'XAF',
      } as any);

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders: { affected_rows: 1, returning: [{ id: 'order-123' }] },
      });

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-new',
        message: 'Payment initiated',
      });

      mobilePaymentsDatabaseService.updateTransaction.mockResolvedValue({} as any);

      const result = await service.retryDepositPayment('order-123');

      expect(result.success).toBe(true);
      expect(result.deposit_amount).toBe(2000);
      expect(mobilePaymentsService.initiatePayment).toHaveBeenCalled();

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('ClaimDepositRetry'),
        expect.objectContaining({
          expectedPriorTxnId: 'txn-old-123',
          claimValue: 'txn-new-456',
        })
      );
    });

    it('should allow retry if prior deposit transaction is cancelled', async () => {
      const order = {
        ...mockOrder,
        deposit_mobile_payment_transaction_id: 'txn-old-123',
      };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue({
        id: 'txn-old-123',
        status: 'cancelled',
        reference: 'ORD-123-DEP-12345',
        amount: 2000,
        currency: 'XAF',
      } as any);

      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        currency: 'XAF',
      } as any);

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders: { affected_rows: 1, returning: [{ id: 'order-123' }] },
      });

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-new',
        message: 'Payment initiated',
      });

      mobilePaymentsDatabaseService.updateTransaction.mockResolvedValue({} as any);

      const result = await service.retryDepositPayment('order-123');

      expect(result.success).toBe(true);
      expect(mobilePaymentsService.initiatePayment).toHaveBeenCalled();
    });
  });

  describe('Successful retry', () => {
    it('should create DB txn first then CAS FK with TOCTOU guard when no prior txn (uses _is_null)', async () => {
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(mockOrder as any);

      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        currency: 'XAF',
      } as any);

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
        amount: 2000,
        currency: 'XAF',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders: { affected_rows: 1, returning: [{ id: 'order-123' }] },
      });

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-new',
        message: 'Payment initiated',
      });

      mobilePaymentsDatabaseService.updateTransaction.mockResolvedValue({} as any);

      const result = await service.retryDepositPayment('order-123');

      expect(result.success).toBe(true);
      expect(result.deposit_amount).toBe(2000);
      expect(result.amount_due).toBe(8000);
      expect(result.payment_transaction.transaction_id).toBe('provider-tx-new');

      expect(mobilePaymentsDatabaseService.createTransaction).toHaveBeenCalledBefore(
        hasuraSystemService.executeMutation as any
      );

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('ClaimDepositRetryNull'),
        expect.objectContaining({
          orderId: 'order-123',
          claimValue: 'txn-new-456',
        })
      );
    });

    it('should return 409 CONCURRENT_RETRY_DETECTED when CAS FK update affected_rows=0', async () => {
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(mockOrder as any);

      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        currency: 'XAF',
      } as any);

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders: { affected_rows: 0, returning: [] },
      });

      mobilePaymentsDatabaseService.updateTransaction.mockResolvedValue({} as any);

      await expect(
        service.retryDepositPayment('order-123')
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            success: false,
            code: 'CONCURRENT_RETRY_DETECTED',
          }),
          status: HttpStatus.CONFLICT,
        })
      );

      expect(mobilePaymentsDatabaseService.updateTransaction).toHaveBeenCalledWith(
        'txn-new-456',
        expect.objectContaining({
          status: 'failed',
          error_message: 'Concurrent retry detected',
        })
      );
    });

    it('should restore prior FK when initiatePayment fails', async () => {
      const order = {
        ...mockOrder,
        deposit_mobile_payment_transaction_id: 'txn-old-123',
      };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      mobilePaymentsDatabaseService.getTransactionById.mockResolvedValue({
        id: 'txn-old-123',
        status: 'failed',
      } as any);

      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        currency: 'XAF',
      } as any);

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
      } as any);

      hasuraSystemService.executeMutation
        .mockResolvedValueOnce({
          update_orders: { affected_rows: 1, returning: [{ id: 'order-123' }] },
        })
        .mockResolvedValueOnce({ update_orders: { affected_rows: 1 } });

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: false,
        message: 'Provider error',
        errorCode: 'PROVIDER_ERROR',
      });

      mobilePaymentsDatabaseService.updateTransaction.mockResolvedValue({} as any);

      await expect(
        service.retryDepositPayment('order-123')
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            success: false,
            error: 'DEPOSIT_INITIATION_FAILED',
          }),
          status: HttpStatus.BAD_REQUEST,
        })
      );

      expect(mobilePaymentsDatabaseService.updateTransaction).toHaveBeenCalledWith(
        'txn-new-456',
        expect.objectContaining({
          status: 'failed',
          error_message: 'Provider error',
        })
      );

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('RestoreDepositFKAfterInitiateFail'),
        expect.objectContaining({
          orderId: 'order-123',
          failedTxnId: 'txn-new-456',
          priorTxnId: 'txn-old-123',
        })
      );
    });

    it('should use phone_number override if provided', async () => {
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(mockOrder as any);

      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        currency: 'XAF',
      } as any);

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders: { affected_rows: 1, returning: [{ id: 'order-123' }] },
      });

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-new',
        message: 'Payment initiated',
      });

      mobilePaymentsDatabaseService.updateTransaction.mockResolvedValue({} as any);

      await service.retryDepositPayment('order-123', '+241077777777');

      expect(mobilePaymentsService.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          customerPhone: '+241077777777',
        }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should schedule deposit payment timeout', async () => {
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(mockOrder as any);

      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        currency: 'XAF',
      } as any);

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders: { affected_rows: 1, returning: [{ id: 'order-123' }] },
      });

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-new',
        message: 'Payment initiated',
      });

      mobilePaymentsDatabaseService.updateTransaction.mockResolvedValue({} as any);

      await service.retryDepositPayment('order-123');

      expect(service.waitAndExecuteScheduleService.schedulePaymentTimeout).toHaveBeenCalledWith(
        'order.created',
        { order_id: 'order-123', transaction_id: 'txn-new-456' }
      );
    });
  });
});
