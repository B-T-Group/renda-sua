import { HttpException, HttpStatus } from '@nestjs/common';
import { ItemActivationValidationService } from './item-activation-validation.service';

describe('ItemActivationValidationService', () => {
  let executeQuery: jest.Mock;
  let service: ItemActivationValidationService;

  beforeEach(() => {
    executeQuery = jest.fn();
    service = new ItemActivationValidationService({ executeQuery } as never);
  });

  function mockImages(key: string, images: unknown[]): void {
    executeQuery.mockResolvedValue({ [key]: images });
  }

  async function expectActivationError(
    action: () => Promise<void>,
    error: string
  ): Promise<void> {
    try {
      await action();
      throw new Error('Expected activation validation to fail');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(err.getResponse()).toEqual(
        expect.objectContaining({ success: false, error })
      );
    }
  }

  it('allows activating a sale item with two images and no blocking errors', async () => {
    mockImages('item_images', [
      { validation_errors: [] },
      { validation_errors: null },
    ]);

    await expect(service.assertItemCanActivate('item-1')).resolves.toBeUndefined();
    expect(executeQuery).toHaveBeenCalledWith(expect.any(String), {
      itemId: 'item-1',
    });
  });

  it('blocks activating a sale item with fewer than two images', async () => {
    mockImages('item_images', [{ validation_errors: [] }]);

    await expectActivationError(
      () => service.assertItemCanActivate('item-1'),
      'ITEM_MIN_IMAGES'
    );
  });

  it('blocks activating a sale item when any image has validation errors', async () => {
    mockImages('item_images', [
      { validation_errors: [] },
      { validation_errors: [{ code: 'LOW_RESOLUTION' }] },
    ]);

    await expectActivationError(
      () => service.assertItemCanActivate('item-1'),
      'IMAGE_VALIDATION_ERRORS'
    );
  });

  it('allows activating a rental item with two clean images', async () => {
    mockImages('rental_item_images', [
      { validation_errors: [] },
      { validation_errors: [] },
    ]);

    await expect(
      service.assertRentalItemCanActivate('rental-item-1')
    ).resolves.toBeUndefined();
    expect(executeQuery).toHaveBeenCalledWith(expect.any(String), {
      rentalItemId: 'rental-item-1',
    });
  });

  it('blocks activating a rental item with validation errors', async () => {
    mockImages('rental_item_images', [
      { validation_errors: [] },
      { validation_errors: [{ code: 'IMAGE_BLURRY' }] },
    ]);

    await expectActivationError(
      () => service.assertRentalItemCanActivate('rental-item-1'),
      'IMAGE_VALIDATION_ERRORS'
    );
  });
});
