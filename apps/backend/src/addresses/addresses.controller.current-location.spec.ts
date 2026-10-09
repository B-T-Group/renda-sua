import { HttpException, HttpStatus } from '@nestjs/common';
import { AddressesController } from './addresses.controller';

describe('AddressesController.resolveCurrentLocation', () => {
  const resolved = { address: { id: 'addr-1' }, reused: false };

  function build(resolve: jest.Mock) {
    return new AddressesController({} as never, { resolve } as never);
  }

  it('coerces numeric strings before resolving', async () => {
    const resolve = jest.fn(async () => resolved);
    const controller = build(resolve);

    await expect(
      controller.resolveCurrentLocation({
        latitude: '3.848' as unknown as number,
        longitude: '11.502' as unknown as number,
      })
    ).resolves.toEqual({ success: true, data: resolved });

    expect(resolve).toHaveBeenCalledWith(3.848, 11.502);
  });

  it('passes NaN when a coordinate is missing', async () => {
    const resolve = jest.fn(async () => resolved);
    const controller = build(resolve);

    await controller.resolveCurrentLocation({} as never);

    expect(resolve).toHaveBeenCalledWith(Number.NaN, Number.NaN);
  });

  it('rethrows an HttpException from the service', async () => {
    const denied = new HttpException(
      { success: false, error: 'latitude and longitude are required' },
      HttpStatus.BAD_REQUEST
    );
    const controller = build(jest.fn(async () => {
      throw denied;
    }));

    await expect(controller.resolveCurrentLocation({ latitude: 91, longitude: 0 })).rejects.toBe(
      denied
    );
  });

  it('wraps an unexpected failure as a 500', async () => {
    const controller = build(jest.fn(async () => {
      throw new Error('db down');
    }));

    try {
      await controller.resolveCurrentLocation({ latitude: 3.8, longitude: 11.5 });
      throw new Error('expected HttpException');
    } catch (caught) {
      expect(caught).toBeInstanceOf(HttpException);
      const error = caught as HttpException;
      expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.getResponse()).toEqual({
        success: false,
        error: 'Failed to resolve current location',
      });
    }
  });
});
