import { HttpException } from '@nestjs/common';
import { ItemActivationValidationService } from './item-activation-validation.service';

describe('ItemActivationValidationService', () => {
  const hasuraUser = { executeQuery: jest.fn() };
  const hasuraSystem = { executeQuery: jest.fn() };

  const createService = () =>
    new ItemActivationValidationService(hasuraUser as never, hasuraSystem as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks system rental activation with fewer than two images', async () => {
    hasuraSystem.executeQuery.mockResolvedValue({
      rental_item_images: [{ validation_errors: [] }],
    });

    await expect(
      createService().assertRentalItemCanActivateAsSystem('rental-1')
    ).rejects.toBeInstanceOf(HttpException);
    expect(hasuraUser.executeQuery).not.toHaveBeenCalled();
  });

  it('allows system rental activation when images are ready', async () => {
    hasuraSystem.executeQuery.mockResolvedValue({
      rental_item_images: [
        { validation_errors: [] },
        { validation_errors: [] },
      ],
    });

    await expect(
      createService().assertRentalItemCanActivateAsSystem('rental-1')
    ).resolves.toBeUndefined();
  });
});
