import { BadRequestException, HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { CurrentLocationDto } from './current-location-address.dto';
import { AddressesController } from './addresses.controller';

describe('AddressesController.resolveCurrentLocation', () => {
  const resolved = { address: { id: 'addr-1' }, reused: false };

  function build(resolve: jest.Mock) {
    return new AddressesController({} as never, { resolve } as never);
  }

  it('passes validated numbers to the service', async () => {
    const resolve = jest.fn(async () => resolved);
    const controller = build(resolve);

    await expect(
      controller.resolveCurrentLocation({ latitude: 3.848, longitude: 11.502 })
    ).resolves.toEqual({ success: true, data: resolved });

    expect(resolve).toHaveBeenCalledWith(3.848, 11.502);
  });

  describe('L1: DTO validation (the route runs a ValidationPipe)', () => {
    const pipe = new ValidationPipe({ transform: true });
    const meta = { type: 'body' as const, metatype: CurrentLocationDto };
    const run = (body: unknown) => pipe.transform(body, meta);

    it('accepts valid numbers, including the poles and antimeridian', async () => {
      await expect(run({ latitude: 3.848, longitude: 11.502 })).resolves.toMatchObject({
        latitude: 3.848,
      });
      await expect(run({ latitude: -90, longitude: 180 })).resolves.toBeDefined();
    });

    it.each([
      ['latitude null', { latitude: null, longitude: 9.7 }],
      ['longitude null', { latitude: 4, longitude: null }],
      ['array latitude', { latitude: [4.05], longitude: 9.7 }],
      ['array longitude', { latitude: 4.05, longitude: [9.7] }],
      ['empty array', { latitude: [], longitude: 9.7 }],
      ['string', { latitude: '3.848', longitude: '11.502' }],
      ['empty string', { latitude: '', longitude: 9.7 }],
      ['boolean', { latitude: true, longitude: 9.7 }],
      ['object', { latitude: {}, longitude: 9.7 }],
      ['missing', {}],
      ['out of range lat', { latitude: 91, longitude: 0 }],
      ['out of range lng', { latitude: 0, longitude: -181 }],
      ['NaN-ish string', { latitude: 'NaN', longitude: 0 }],
    ])('rejects %s with a 400', async (_label, body) => {
      const error = await run(body).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
    });

    it('is attached to the route with a 10/min per-user throttle', () => {
      const params = Reflect.getMetadata(
        '__routeArguments__',
        AddressesController,
        'resolveCurrentLocation'
      );
      expect(JSON.stringify(Object.keys(params ?? {}))).toContain('3');
      const limit = Reflect.getMetadata(
        'THROTTLER:LIMITshort',
        AddressesController.prototype.resolveCurrentLocation
      );
      const ttl = Reflect.getMetadata(
        'THROTTLER:TTLshort',
        AddressesController.prototype.resolveCurrentLocation
      );
      expect(limit).toBe(10);
      expect(ttl).toBe(60000);
    });
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
