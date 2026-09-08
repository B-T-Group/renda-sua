import { UnauthorizedException } from '@nestjs/common';
import { OrderMarkReadyInternalController } from './order-mark-ready-internal.controller';

describe('OrderMarkReadyInternalController', () => {
  const markReadyService = { onMarkReadyPrompt: jest.fn() };
  const configService = { get: jest.fn() };
  let controller: OrderMarkReadyInternalController;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue({ apiKey: 'internal-secret' });
    markReadyService.onMarkReadyPrompt.mockResolvedValue({ success: true });
    controller = new OrderMarkReadyInternalController(
      markReadyService as never,
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
});
