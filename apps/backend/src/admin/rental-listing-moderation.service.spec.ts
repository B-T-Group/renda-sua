import { HttpException, HttpStatus } from '@nestjs/common';
import { RentalListingModerationService } from './rental-listing-moderation.service';

describe('RentalListingModerationService', () => {
  const hasuraSystem = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const notifications = { sendRentalListingApprovedEmail: jest.fn() };
  const activationValidation = {
    assertRentalItemCanActivateAsSystem: jest.fn(),
  };

  const createService = () =>
    new RentalListingModerationService(
      hasuraSystem as never,
      notifications as never,
      activationValidation as never
    );

  beforeEach(() => {
    jest.clearAllMocks();
    hasuraSystem.executeQuery.mockResolvedValue({
      rental_location_listings_by_pk: {
        id: 'listing-1',
        moderation_status: 'pending',
        deleted_at: null,
        rental_item: {
          id: 'rental-1',
          name: 'Camera',
          business: { user_id: 'user-1' },
        },
      },
    });
  });

  it('does not approve listings that fail activation validation', async () => {
    activationValidation.assertRentalItemCanActivateAsSystem.mockRejectedValue(
      new HttpException('Needs images', HttpStatus.BAD_REQUEST)
    );

    await expect(
      createService().approveListing('listing-1', 'admin-1')
    ).rejects.toBeInstanceOf(HttpException);
    expect(
      activationValidation.assertRentalItemCanActivateAsSystem
    ).toHaveBeenCalledWith('rental-1');
    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendRentalListingApprovedEmail).not.toHaveBeenCalled();
  });
});
