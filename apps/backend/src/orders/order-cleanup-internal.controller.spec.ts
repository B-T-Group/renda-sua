import { UnauthorizedException } from '@nestjs/common';
import { OrderCleanupInternalController } from './order-cleanup-internal.controller';

describe('OrderCleanupInternalController', () => {
  const cleanupResult = {
    pendingPaymentCancelled: 1,
    readyForPickupCancelled: 2,
    midFulfillmentFailed: 0,
  };

  function createController(apiKey: string | undefined) {
    const orderCleanupService = {
      runDailyCleanup: jest.fn().mockResolvedValue(cleanupResult),
    };
    const configService = {
      get: jest.fn().mockReturnValue(
        apiKey === undefined ? undefined : { apiKey }
      ),
    };
    const controller = new OrderCleanupInternalController(
      orderCleanupService as any,
      configService as any
    );
    return { controller, orderCleanupService, configService };
  }

  it('rejects missing internal key', async () => {
    const { controller, orderCleanupService } = createController('secret');
    await expect(controller.cleanupStale(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(orderCleanupService.runDailyCleanup).not.toHaveBeenCalled();
  });

  it('rejects wrong internal key', async () => {
    const { controller, orderCleanupService } = createController('secret');
    await expect(controller.cleanupStale('other')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(orderCleanupService.runDailyCleanup).not.toHaveBeenCalled();
  });

  it('rejects when internal api key is not configured', async () => {
    const { controller, orderCleanupService } = createController('');
    await expect(controller.cleanupStale('')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(orderCleanupService.runDailyCleanup).not.toHaveBeenCalled();
  });

  it('runs daily cleanup when internal key matches', async () => {
    const { controller, orderCleanupService, configService } =
      createController('secret');

    await expect(controller.cleanupStale('secret')).resolves.toEqual({
      success: true,
      ...cleanupResult,
    });
    expect(configService.get).toHaveBeenCalledWith('notificationsInternal');
    expect(orderCleanupService.runDailyCleanup).toHaveBeenCalledTimes(1);
  });
});
