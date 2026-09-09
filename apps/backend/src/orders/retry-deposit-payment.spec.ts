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
    payment_source: 'mobile_money',
    deposit_amount: 2000,
    deposit_status: 'pending',
    deposit_mobile_payment_transaction_id: null,
    client: {
      user_id: 'user-123',
      phone_number: '+241062345678',
    },
    payer_phone: '+241062345678',
  };

  beforeEach(() => {
    mobilePaymentsDatabaseService = {
      getTransactionById: jest.fn(),
      createTransaction: jest.fn(),
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
      waitAndExecuteScheduleService: {
        schedulePaymentTimeout: jest.fn(),
      },
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
      },
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

    it('should reject if deposit_status is failed', async () => {
      const order = { ...mockOrder, deposit_status: 'failed' };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      await expect(
        service.retryDepositPayment('order-123')
      ).rejects.toThrow(
        new HttpException(
          'Cannot retry deposit payment when deposit_status is failed',
          HttpStatus.BAD_REQUEST
        )
      );
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

    it('should reject if currency is not XAF', async () => {
      const order = { ...mockOrder, currency: 'USD' };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      await expect(
        service.retryDepositPayment('order-123')
      ).rejects.toThrow(
        new HttpException(
          'Deposit payment retry is only available for XAF currency',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should reject if payment_source is not mobile_money', async () => {
      const order = { ...mockOrder, payment_source: 'credit_card' };
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(order as any);

      await expect(
        service.retryDepositPayment('order-123')
      ).rejects.toThrow(
        new HttpException(
          'Deposit payment retry is only available for mobile money orders',
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe('CRITICAL: Prior pending transaction guard', () => {
    it('should return 409 if prior deposit transaction is still pending', async () => {
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

    it('should allow retry if prior deposit transaction is failed', async () => {
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

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-new',
        message: 'Payment initiated',
      });

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({});

      const result = await service.retryDepositPayment('order-123');

      expect(result.success).toBe(true);
      expect(result.deposit_amount).toBe(2000);
      expect(mobilePaymentsService.initiatePayment).toHaveBeenCalled();
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

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-new',
        message: 'Payment initiated',
      });

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({});

      const result = await service.retryDepositPayment('order-123');

      expect(result.success).toBe(true);
      expect(mobilePaymentsService.initiatePayment).toHaveBeenCalled();
    });
  });

  describe('Successful retry', () => {
    it('should create new deposit transaction and update order FK', async () => {
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(mockOrder as any);

      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        currency: 'XAF',
      } as any);

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-new',
        message: 'Payment initiated',
      });

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
        amount: 2000,
        currency: 'XAF',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({});

      const result = await service.retryDepositPayment('order-123');

      expect(result.success).toBe(true);
      expect(result.deposit_amount).toBe(2000);
      expect(result.amount_due).toBe(8000);
      expect(result.payment_transaction.transaction_id).toBe('provider-tx-new');

      expect(mobilePaymentsDatabaseService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2000,
          currency: 'XAF',
          payment_entity: 'order_deposit',
          entity_id: 'ORD-123',
        })
      );

      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('UpdateOrderDepositTransaction'),
        expect.objectContaining({
          orderId: 'order-123',
          depositMobilePaymentTransactionId: 'txn-new-456',
        })
      );
    });

    it('should use phone_number override if provided', async () => {
      jest.spyOn(service, 'getOrderDetails').mockResolvedValue(mockOrder as any);

      hasuraSystemService.getAccount.mockResolvedValue({
        id: 'account-123',
        currency: 'XAF',
      } as any);

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-new',
        message: 'Payment initiated',
      });

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({});

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

      mobilePaymentsService.initiatePayment.mockResolvedValue({
        success: true,
        transactionId: 'provider-tx-new',
        message: 'Payment initiated',
      });

      mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
        id: 'txn-new-456',
        reference: 'ORD-123-DEP-67890-retry',
        status: 'pending',
      } as any);

      hasuraSystemService.executeMutation.mockResolvedValue({});

      await service.retryDepositPayment('order-123');

      expect(service.waitAndExecuteScheduleService.schedulePaymentTimeout).toHaveBeenCalledWith(
        'order.created',
        { order_id: 'order-123', transaction_id: 'txn-new-456' }
      );
    });
  });
});
