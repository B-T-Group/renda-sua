import { DepositCalculationService } from './deposit-calculation.service';
import { DepositRefundService } from './deposit-refund.service';

describe('DepositRefundService', () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const paidOrder = {
    id: orderId,
    order_number: 'ORD-100',
    current_status: 'confirmed',
    fulfillment_method: 'delivery',
    currency: 'XAF',
    deposit_amount: 500,
    deposit_mobile_payment_transaction_id: 'txn-1',
    deposit_status: 'paid',
    deposit_refund_status: null,
    deposit_forfeit_reason: null,
    deposit_forfeited_at: null,
    deposit_refunded_at: null,
    recipient_phone: '+237600000001',
    payer_phone: '+237600000002',
    business_location: { address: { country: 'CM' } },
  };

  const executeQuery = jest.fn();
  const executeMutation = jest.fn();
  const initiatePayment = jest.fn();
  const isAfterRefundLockPoint = jest.fn();

  let service: DepositRefundService;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    executeQuery.mockResolvedValue({ orders_by_pk: paidOrder });
    executeMutation.mockResolvedValue({});
    initiatePayment.mockResolvedValue({
      success: true,
      transactionId: 'withdraw-1',
    });
    isAfterRefundLockPoint.mockReturnValue(false);

    service = new DepositRefundService(
      { executeQuery, executeMutation } as never,
      { initiatePayment } as never,
      { isAfterRefundLockPoint } as DepositCalculationService
    );
  });

  describe('refundDeposit', () => {
    it('returns ORDER_NOT_FOUND when the order is missing', async () => {
      executeQuery.mockResolvedValue({ orders_by_pk: null });

      await expect(service.refundDeposit(orderId)).resolves.toEqual({
        success: false,
        message: 'Order not found',
        errorCode: 'ORDER_NOT_FOUND',
      });
      expect(initiatePayment).not.toHaveBeenCalled();
    });

    it('rejects unpaid or missing deposits before initiating a withdraw', async () => {
      executeQuery.mockResolvedValue({
        orders_by_pk: { ...paidOrder, deposit_amount: 0 },
      });
      await expect(service.refundDeposit(orderId)).resolves.toMatchObject({
        errorCode: 'NO_DEPOSIT',
      });

      executeQuery.mockResolvedValue({
        orders_by_pk: { ...paidOrder, deposit_status: 'pending' },
      });
      await expect(service.refundDeposit(orderId)).resolves.toMatchObject({
        errorCode: 'DEPOSIT_NOT_CAPTURED',
      });
      expect(initiatePayment).not.toHaveBeenCalled();
    });

    it('treats refunded and forfeited status as not captured (paid-only gate)', async () => {
      executeQuery.mockResolvedValue({
        orders_by_pk: { ...paidOrder, deposit_status: 'refunded' },
      });
      await expect(service.refundDeposit(orderId)).resolves.toMatchObject({
        errorCode: 'DEPOSIT_NOT_CAPTURED',
      });

      executeQuery.mockResolvedValue({
        orders_by_pk: { ...paidOrder, deposit_status: 'forfeited' },
      });
      await expect(service.refundDeposit(orderId)).resolves.toMatchObject({
        errorCode: 'DEPOSIT_NOT_CAPTURED',
      });
    });

    it('blocks a second withdraw when a refund is already pending or completed', async () => {
      executeQuery.mockResolvedValue({
        orders_by_pk: { ...paidOrder, deposit_refund_status: 'pending' },
      });
      await expect(service.refundDeposit(orderId)).resolves.toMatchObject({
        errorCode: 'REFUND_IN_PROGRESS',
      });

      executeQuery.mockResolvedValue({
        orders_by_pk: { ...paidOrder, deposit_refund_status: 'refunded' },
      });
      await expect(service.refundDeposit(orderId)).resolves.toMatchObject({
        errorCode: 'REFUND_IN_PROGRESS',
      });
      expect(initiatePayment).not.toHaveBeenCalled();
    });

    it('refuses refunds after the fulfillment lock point', async () => {
      isAfterRefundLockPoint.mockReturnValue(true);

      await expect(service.refundDeposit(orderId)).resolves.toEqual({
        success: false,
        message:
          'Order has passed refund lock point. Deposit can only be forfeited.',
        errorCode: 'AFTER_LOCK_POINT',
      });
      expect(isAfterRefundLockPoint).toHaveBeenCalledWith('delivery', 'confirmed');
      expect(initiatePayment).not.toHaveBeenCalled();
    });

    it('marks the refund failed when MoMo withdraw initiation fails', async () => {
      initiatePayment.mockResolvedValue({
        success: false,
        message: 'provider down',
        errorCode: 'PROVIDER_ERROR',
      });

      await expect(service.refundDeposit(orderId)).resolves.toEqual({
        success: false,
        message: 'provider down',
        errorCode: 'PROVIDER_ERROR',
      });
      expect(executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('MarkDepositRefundAttempted'),
        { orderId, status: 'failed' }
      );
    });

    it('initiates a GIVE_CHANGE withdraw to the recipient phone and marks pending', async () => {
      const result = await service.refundDeposit(orderId);

      expect(result).toEqual({
        success: true,
        transactionId: 'withdraw-1',
        message: 'Deposit refund initiated',
      });
      expect(initiatePayment).toHaveBeenCalledWith(
        {
          amount: 500,
          currency: 'XAF',
          description: 'Deposit refund for order ORD-100',
          customerPhone: '+237600000001',
          itemCountry: 'CM',
          transactionType: 'GIVE_CHANGE',
        },
        expect.stringMatching(/^M[0-9a-z]{13}$/)
      );
      expect(executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('MarkDepositRefundAttempted'),
        { orderId, status: 'pending' }
      );
    });

    it('falls back to payer phone when recipient phone is missing', async () => {
      executeQuery.mockResolvedValue({
        orders_by_pk: { ...paidOrder, recipient_phone: null },
      });

      await service.refundDeposit(orderId);

      expect(initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ customerPhone: '+237600000002' }),
        expect.any(String)
      );
    });

    it('returns REFUND_ERROR when Hasura or withdraw throws', async () => {
      executeQuery.mockRejectedValue(new Error('hasura down'));

      await expect(service.refundDeposit(orderId)).resolves.toEqual({
        success: false,
        message: 'hasura down',
        errorCode: 'REFUND_ERROR',
      });
    });
  });

  describe('forfeitDeposit', () => {
    it('fails when the order is missing or the deposit is not paid', async () => {
      executeQuery.mockResolvedValue({ orders_by_pk: null });
      await expect(
        service.forfeitDeposit(orderId, 'customer_cancel_after_lock')
      ).resolves.toEqual({ success: false, message: 'Order not found' });

      executeQuery.mockResolvedValue({
        orders_by_pk: { ...paidOrder, deposit_status: 'pending' },
      });
      await expect(
        service.forfeitDeposit(orderId, 'customer_no_show_pickup')
      ).resolves.toEqual({ success: false, message: 'No deposit to forfeit' });
    });

    it('is idempotent when the deposit was already forfeited', async () => {
      executeQuery.mockResolvedValue({
        orders_by_pk: {
          ...paidOrder,
          deposit_forfeited_at: '2026-09-09T10:00:00.000Z',
        },
      });

      await expect(
        service.forfeitDeposit(orderId, 'customer_refuse_delivery')
      ).resolves.toEqual({
        success: false,
        message: 'Deposit already forfeited',
      });
      expect(executeMutation).not.toHaveBeenCalled();
    });

    it('writes forfeited status with the immutable reason code', async () => {
      const now = '2026-09-10T10:00:00.000Z';
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(now);

      await expect(
        service.forfeitDeposit(orderId, 'customer_cancel_after_lock')
      ).resolves.toEqual({ success: true, message: 'Deposit forfeited' });

      expect(executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('ForfeitDeposit'),
        {
          orderId,
          reason: 'customer_cancel_after_lock',
          now,
        }
      );
    });
  });

  describe('completeDepositRefund', () => {
    it('marks the deposit refunded after the withdraw callback', async () => {
      const now = '2026-09-10T11:00:00.000Z';
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(now);

      await service.completeDepositRefund(orderId, 'withdraw-1');

      expect(executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('CompleteDepositRefund'),
        { orderId, now }
      );
    });
  });
});
