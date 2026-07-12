import { HttpException, HttpStatus } from '@nestjs/common';
import { RentalListingAiProposalService } from './rental-listing-ai-proposal.service';

describe('RentalListingAiProposalService', () => {
  const hasuraSystem = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const hasuraUser = { getUser: jest.fn() };
  const activationValidation = {
    assertRentalItemCanActivateAsSystem: jest.fn(),
  };

  const createService = () =>
    new RentalListingAiProposalService(
      hasuraSystem as never,
      hasuraUser as never,
      {} as never,
      activationValidation as never
    );

  beforeEach(() => {
    jest.clearAllMocks();
    hasuraUser.getUser.mockResolvedValue({
      user_type_id: 'business',
      business: { id: 'business-1' },
    });
    hasuraSystem.executeQuery.mockResolvedValue({
      rental_location_listings_by_pk: {
        id: 'listing-1',
        moderation_status: 'proposal_pending',
        rental_item: {
          id: 'rental-1',
          business_id: 'business-1',
          rental_item_images: [],
        },
      },
      rental_listing_ai_reviews: [
        {
          id: 'review-1',
          proposed_title: null,
          proposed_description: null,
          proposed_images: [],
        },
      ],
    });
  });

  it('does not approve accepted proposals that fail activation validation', async () => {
    activationValidation.assertRentalItemCanActivateAsSystem.mockRejectedValue(
      new HttpException('Needs images', HttpStatus.BAD_REQUEST)
    );

    await expect(
      createService().acceptProposal('listing-1', {})
    ).rejects.toBeInstanceOf(HttpException);
    expect(
      activationValidation.assertRentalItemCanActivateAsSystem
    ).toHaveBeenCalledWith('rental-1');
    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });
});
