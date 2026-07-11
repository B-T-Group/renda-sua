import { HttpException, HttpStatus } from '@nestjs/common';
import { RentalListingAiReviewService } from './rental-listing-ai-review.service';

describe('RentalListingAiReviewService', () => {
  const hasura = { executeMutation: jest.fn() };
  const activationValidation = {
    assertRentalItemCanActivateAsSystem: jest.fn(),
  };
  const notifications = { sendRentalListingApprovedEmail: jest.fn() };

  const createService = () =>
    new RentalListingAiReviewService(
      hasura as never,
      {} as never,
      {} as never,
      notifications as never,
      {} as never,
      {} as never,
      {} as never,
      activationValidation as never
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not approve AI-reviewed listings that fail activation validation', async () => {
    activationValidation.assertRentalItemCanActivateAsSystem.mockRejectedValue(
      new HttpException('Needs images', HttpStatus.BAD_REQUEST)
    );
    const listing = {
      id: 'listing-1',
      rental_item: {
        id: 'rental-1',
        name: 'Camera',
        business: { user_id: 'user-1' },
      },
    };
    const result = { reason: 'ok', issues: [] };

    await expect(
      (createService() as any).applyApproveDecision(
        listing,
        'review-1',
        result,
        {}
      )
    ).rejects.toBeInstanceOf(HttpException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(notifications.sendRentalListingApprovedEmail).not.toHaveBeenCalled();
  });
});
