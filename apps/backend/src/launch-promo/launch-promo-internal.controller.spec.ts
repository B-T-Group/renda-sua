import { UnauthorizedException } from '@nestjs/common';
import { LaunchPromoInternalController } from './launch-promo-internal.controller';

describe('LaunchPromoInternalController', () => {
  const launchPromoService = {
    releaseExpiredSlots: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  let controller: LaunchPromoInternalController;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue({ apiKey: 'internal-secret' });
    launchPromoService.releaseExpiredSlots.mockResolvedValue({ released: 2 });
    controller = new LaunchPromoInternalController(
      launchPromoService as never,
      configService as never
    );
  });

  it('rejects missing internal key', async () => {
    await expect(controller.releaseExpired(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(launchPromoService.releaseExpiredSlots).not.toHaveBeenCalled();
  });

  it('rejects wrong internal key', async () => {
    await expect(controller.releaseExpired('wrong')).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(launchPromoService.releaseExpiredSlots).not.toHaveBeenCalled();
  });

  it('rejects when configured internal key is empty', async () => {
    configService.get.mockReturnValue({ apiKey: '' });
    await expect(
      controller.releaseExpired('internal-secret')
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(launchPromoService.releaseExpiredSlots).not.toHaveBeenCalled();
  });

  it('releases expired slots when internal key matches', async () => {
    await expect(controller.releaseExpired('internal-secret')).resolves.toEqual(
      { released: 2 }
    );
    expect(configService.get).toHaveBeenCalledWith('notificationsInternal');
    expect(launchPromoService.releaseExpiredSlots).toHaveBeenCalledTimes(1);
  });
});
