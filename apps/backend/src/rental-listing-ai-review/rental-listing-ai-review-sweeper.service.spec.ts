import { RentalListingAiReviewSweeperService } from './rental-listing-ai-review-sweeper.service';

describe('RentalListingAiReviewSweeperService', () => {
  function buildService(opts?: {
    listings?: Array<{
      id: string;
      updated_at: string;
      rental_item?: { name: string; rental_item_images: Array<{ id: string }> };
    }>;
    open?: Array<{
      rental_item_image_id: string;
      job: { status: string; updated_at: string };
    }>;
  }) {
    const notify = jest.fn();
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('StaleAiReviewingListings')) {
        return { rental_location_listings: opts?.listings ?? [] };
      }
      if (query.includes('OpenCleanupForRentalImageIds')) {
        return { ai_image_cleanup_results: opts?.open ?? [] };
      }
      return {};
    });
    const executeMutation = jest.fn(async (query: string) => {
      if (query.includes('FailRunningAiReviewsForListing')) {
        return { update_rental_listing_ai_reviews: { affected_rows: 1 } };
      }
      if (query.includes('ResetListingPendingIfAiReviewing')) {
        return { update_rental_location_listings: { affected_rows: 1 } };
      }
      return {};
    });
    const service = new RentalListingAiReviewSweeperService(
      { executeQuery, executeMutation } as never,
      { notifySuperusersListingAiReviewFailed: notify } as never
    );
    return { service, executeMutation, notify };
  }

  const listing = {
    id: 'listing-1',
    updated_at: '2020-01-01T00:00:00Z',
    rental_item: {
      name: 'Camera',
      rental_item_images: [{ id: 'img-1' }],
    },
  };

  it('resets a stale listing with no blocking cleanup', async () => {
    const { service, notify } = buildService({ listings: [listing] });
    await service.sweepStuckAiReviewing();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: 'listing-1' })
    );
  });

  it('skips a listing whose photos are still in a fresh review', async () => {
    const { service, executeMutation, notify } = buildService({
      listings: [listing],
      open: [
        {
          rental_item_image_id: 'img-1',
          job: { status: 'ready_for_review', updated_at: new Date().toISOString() },
        },
      ],
    });
    await service.sweepStuckAiReviewing();
    expect(executeMutation).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});
