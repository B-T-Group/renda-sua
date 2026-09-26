import { UnauthorizedException } from '@nestjs/common';
import { OrderMarkReadyInternalController } from './order-mark-ready-internal.controller';

describe('OrderMarkReadyInternalController', () => {
  const markReadyService = { onMarkReadyPrompt: jest.fn() };
  const cookedFoodFlow = {
    shouldAutoMarkReady: jest.fn(),
    shouldCancelUnpaid: jest.fn(),
  };
  const ordersService = {
    completePreparation: jest.fn(),
    cancelUnpaidCookedFoodAfterConfirm: jest.fn(),
  };
  const configService = { get: jest.fn() };
  let controller: OrderMarkReadyInternalController;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue({ apiKey: 'internal-secret' });
    markReadyService.onMarkReadyPrompt.mockResolvedValue({ success: true });
    cookedFoodFlow.shouldAutoMarkReady.mockResolvedValue({
      success: true,
      shouldMarkReady: true,
    });
    cookedFoodFlow.shouldCancelUnpaid.mockResolvedValue({
      success: true,
      shouldCancel: true,
    });
    ordersService.completePreparation.mockResolvedValue({ success: true });
    ordersService.cancelUnpaidCookedFoodAfterConfirm.mockResolvedValue(undefined);
    controller = new OrderMarkReadyInternalController(
      markReadyService as never,
      cookedFoodFlow as never,
      ordersService as never,
      configService as never
    );
  });

  it('rejects a missing internal key', async () => {
    await expect(
      controller.markReadyPrompt({ orderId: 'o1' }, undefined)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(markReadyService.onMarkReadyPrompt).not.toHaveBeenCalled();
  });

  it('rejects a wrong internal key', async () => {
    await expect(
      controller.markReadyPrompt({ orderId: 'o1' }, 'wrong')
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the configured internal key is empty', async () => {
    configService.get.mockReturnValue({ apiKey: '' });
    await expect(
      controller.markReadyPrompt({ orderId: 'o1' }, 'internal-secret')
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a blank orderId without calling the service', async () => {
    await expect(
      controller.markReadyPrompt({ orderId: '   ' }, 'internal-secret')
    ).resolves.toEqual({ success: false, error: 'orderId is required' });
    expect(markReadyService.onMarkReadyPrompt).not.toHaveBeenCalled();
  });

  it('trims orderId and forwards a matching key', async () => {
    await expect(
      controller.markReadyPrompt({ orderId: ' o1 ' }, 'internal-secret')
    ).resolves.toEqual({ success: true });
    expect(configService.get).toHaveBeenCalledWith('notificationsInternal');
    expect(markReadyService.onMarkReadyPrompt).toHaveBeenCalledWith('o1');
  });

  it('does not auto-mark when the internal key is wrong', async () => {
    await expect(
      controller.autoMarkReady({ orderId: 'o1' }, 'wrong')
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cookedFoodFlow.shouldAutoMarkReady).not.toHaveBeenCalled();
  });

  it('rejects a blank auto-mark order id', async () => {
    await expect(
      controller.autoMarkReady({ orderId: '  ' }, 'internal-secret')
    ).resolves.toEqual({ success: false, error: 'orderId is required' });
    expect(ordersService.completePreparation).not.toHaveBeenCalled();
  });

  it('skips auto-mark when the order is unpaid', async () => {
    cookedFoodFlow.shouldAutoMarkReady.mockResolvedValue({
      success: true,
      shouldMarkReady: false,
      reason: 'unpaid',
    });
    await expect(
      controller.autoMarkReady({ orderId: ' o1 ' }, 'internal-secret')
    ).resolves.toEqual({ success: true, skipped: true, reason: 'unpaid' });
    expect(cookedFoodFlow.shouldAutoMarkReady).toHaveBeenCalledWith('o1');
    expect(ordersService.completePreparation).not.toHaveBeenCalled();
  });

  it('returns a failed auto-mark check without completing prep', async () => {
    cookedFoodFlow.shouldAutoMarkReady.mockResolvedValue({
      success: false,
      shouldMarkReady: false,
      reason: 'order_not_found',
    });
    await expect(
      controller.autoMarkReady({ orderId: 'o1' }, 'internal-secret')
    ).resolves.toEqual({
      success: false,
      shouldMarkReady: false,
      reason: 'order_not_found',
    });
    expect(ordersService.completePreparation).not.toHaveBeenCalled();
  });

  it('completes preparation when the prep timer is due', async () => {
    await expect(
      controller.autoMarkReady({ orderId: 'o1' }, 'internal-secret')
    ).resolves.toEqual({ success: true });
    expect(ordersService.completePreparation).toHaveBeenCalledWith({
      orderId: 'o1',
      notes: 'Auto-marked ready after prep timer',
      viaSystem: true,
    });
  });

  it('skips unpaid cancel when the order is already paid', async () => {
    cookedFoodFlow.shouldCancelUnpaid.mockResolvedValue({
      success: true,
      shouldCancel: false,
      reason: 'already_paid',
    });
    await expect(
      controller.cookedFoodUnpaidCancel({ orderId: 'o1' }, 'internal-secret')
    ).resolves.toEqual({
      success: true,
      skipped: true,
      reason: 'already_paid',
    });
    expect(ordersService.cancelUnpaidCookedFoodAfterConfirm).not.toHaveBeenCalled();
  });

  it('cancels a confirmed unpaid cooked-food order', async () => {
    await expect(
      controller.cookedFoodUnpaidCancel({ orderId: ' o1 ' }, 'internal-secret')
    ).resolves.toEqual({ success: true });
    expect(cookedFoodFlow.shouldCancelUnpaid).toHaveBeenCalledWith('o1');
    expect(ordersService.cancelUnpaidCookedFoodAfterConfirm).toHaveBeenCalledWith(
      'o1'
    );
  });

  it('rejects unpaid cancel without an order id', async () => {
    await expect(
      controller.cookedFoodUnpaidCancel({}, 'internal-secret')
    ).resolves.toEqual({ success: false, error: 'orderId is required' });
    expect(cookedFoodFlow.shouldCancelUnpaid).not.toHaveBeenCalled();
  });
});
