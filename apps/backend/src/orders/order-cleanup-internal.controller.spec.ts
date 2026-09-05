import { UnauthorizedException } from '@nestjs/common';
import { OrderCleanupInternalController } from './order-cleanup-internal.controller';

describe('OrderCleanupInternalController', () => {
  const orderCleanupService = {
    cancelUnpaidPendingPaymentAsSystem: jest.fn(),
    runDailyCleanup: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  let controller: OrderCleanupInternalController;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue({ apiKey: 'internal-secret' });
    orderCleanupService.cancelUnpaidPendingPaymentAsSystem.mockResolvedValue({
      cancelled: true,
    });
    orderCleanupService.runDailyCleanup.mockResolvedValue({
      pendingPaymentCancelled: 1,
      readyForPickupCancelled: 0,
      midFulfillmentFailed: 0,
    });
    controller = new OrderCleanupInternalController(
      orderCleanupService as never,
      configService as never
    );
  });

  describe('cancelUnpaid', () => {
    it('rejects missing internal key', async () => {
      await expect(
        controller.cancelUnpaid({ orderId: 'o1' }, undefined)
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(
        orderCleanupService.cancelUnpaidPendingPaymentAsSystem
      ).not.toHaveBeenCalled();
    });

    it('rejects wrong internal key', async () => {
      await expect(
        controller.cancelUnpaid({ orderId: 'o1' }, 'wrong')
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when configured internal key is empty', async () => {
      configService.get.mockReturnValue({ apiKey: '' });
      await expect(
        controller.cancelUnpaid({ orderId: 'o1' }, 'internal-secret')
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects blank orderId without calling cleanup', async () => {
      await expect(
        controller.cancelUnpaid({ orderId: '   ' }, 'internal-secret')
      ).resolves.toEqual({
        success: false,
        cancelled: false,
        reason: 'orderId is required',
      });
      expect(
        orderCleanupService.cancelUnpaidPendingPaymentAsSystem
      ).not.toHaveBeenCalled();
    });

    it('defaults reason to timeout and trims orderId', async () => {
      await expect(
        controller.cancelUnpaid({ orderId: ' o1 ' }, 'internal-secret')
      ).resolves.toEqual({ success: true, cancelled: true });
      expect(
        orderCleanupService.cancelUnpaidPendingPaymentAsSystem
      ).toHaveBeenCalledWith('o1', 'Order cancelled due to payment timeout', {
        reason: 'timeout',
      });
    });

    it('maps payment_failed_grace notes onto the CAS cancel', async () => {
      orderCleanupService.cancelUnpaidPendingPaymentAsSystem.mockResolvedValue({
        cancelled: false,
        skipped: true,
        reason: 'grace_not_elapsed',
      });

      await expect(
        controller.cancelUnpaid(
          { orderId: 'o1', reason: 'payment_failed_grace' },
          'internal-secret'
        )
      ).resolves.toEqual({
        success: true,
        cancelled: false,
        skipped: true,
        reason: 'grace_not_elapsed',
      });
      expect(
        orderCleanupService.cancelUnpaidPendingPaymentAsSystem
      ).toHaveBeenCalledWith(
        'o1',
        'Order cancelled due to payment failure (grace period elapsed)',
        { reason: 'payment_failed_grace' }
      );
    });
  });

  describe('cleanupStale', () => {
    it('runs daily cleanup when the internal key matches', async () => {
      await expect(controller.cleanupStale('internal-secret')).resolves.toEqual({
        success: true,
        pendingPaymentCancelled: 1,
        readyForPickupCancelled: 0,
        midFulfillmentFailed: 0,
      });
      expect(configService.get).toHaveBeenCalledWith('notificationsInternal');
      expect(orderCleanupService.runDailyCleanup).toHaveBeenCalledTimes(1);
    });
  });
});
