import { HttpException, HttpStatus } from '@nestjs/common';
import { GoogleDistanceController } from './google-distance.controller';

describe('GoogleDistanceController.reverseGeocode', () => {
  let controller: GoogleDistanceController;
  let reverseGeocode: jest.Mock;

  beforeEach(() => {
    reverseGeocode = jest.fn().mockResolvedValue({
      formatted_address: '123 Main St',
      country: 'CA',
    });
    controller = new GoogleDistanceController(
      { reverseGeocode } as any,
      {} as any
    );
  });

  async function expectBadRequest(lat: string, lng: string) {
    try {
      await controller.reverseGeocode(lat, lng);
      fail('expected Bad Request');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
    expect(reverseGeocode).not.toHaveBeenCalled();
  }

  it('rejects non-numeric coordinates', async () => {
    await expectBadRequest('abc', '-73.5');
  });

  it('rejects latitude outside [-90, 90]', async () => {
    await expectBadRequest('91', '-73.5');
  });

  it('rejects longitude outside [-180, 180]', async () => {
    await expectBadRequest('45.5', '181');
  });

  it('returns structured address for valid public geocode requests', async () => {
    const result = await controller.reverseGeocode('45.5017', '-73.5673');

    expect(reverseGeocode).toHaveBeenCalledWith(45.5017, -73.5673);
    expect(result).toEqual({
      success: true,
      result: {
        formatted_address: '123 Main St',
        country: 'CA',
      },
    });
  });

  it('returns success false when reverse geocode throws', async () => {
    reverseGeocode.mockRejectedValue(new Error('quota exceeded'));

    await expect(
      controller.reverseGeocode('45.5', '-73.5')
    ).resolves.toEqual({
      success: false,
      error: 'quota exceeded',
    });
  });
});
