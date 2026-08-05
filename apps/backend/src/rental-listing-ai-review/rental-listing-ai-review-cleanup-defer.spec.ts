import { RentalListingAiReviewService } from './rental-listing-ai-review.service';

describe('RentalListingAiReviewService cleanup deferral', () => {
  function listingRow(overrides: {
    moderationStatus?: string;
    reviewVersion?: number;
    deletedAt?: string | null;
  } = {}) {
    return {
      id: 'listing-1',
      moderation_status: overrides.moderationStatus ?? 'ai_reviewing',
      ai_review_version: overrides.reviewVersion ?? 3,
      deleted_at: overrides.deletedAt ?? null,
      rental_item: {
        id: 'rental-1',
        name: 'Drill',
        description: 'Cordless drill',
        business_id: 'biz-1',
        business: { user_id: 'user-1', name: 'Biz' },
        rental_item_images: [
          {
            id: 'img-1',
            image_url: 'https://example.com/a.jpg',
            display_order: 0,
            width: 1200,
            height: 1200,
            quality_score: 90,
            validation_warnings: [{ code: 'CLUTTERED_BACKGROUND' }],
          },
        ],
      },
    };
  }

  function buildService(overrides: {
    cleanupStatus?: string | null;
    moderationStatus?: string;
    reviewVersion?: number;
    enqueue?: jest.Mock;
  }) {
    const cleanupStatus =
      overrides.cleanupStatus === undefined
        ? 'processing'
        : overrides.cleanupStatus;
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('GetOpenCleanupForRentalImages')) {
          return {
            ai_image_cleanup_results:
              cleanupStatus == null
                ? []
                : [{ id: 'res-1', job: { status: cleanupStatus } }],
          };
        }
        if (query.includes('GetListingModerationStatus')) {
          return {
            rental_location_listings_by_pk: {
              id: 'listing-1',
              moderation_status: overrides.moderationStatus ?? 'ai_reviewing',
              ai_review_version: overrides.reviewVersion ?? 3,
              deleted_at: null,
            },
          };
        }
        if (query.includes('ListingForAiReview')) {
          return {
            rental_location_listings_by_pk: listingRow({
              moderationStatus: overrides.moderationStatus,
              reviewVersion: overrides.reviewVersion,
            }),
          };
        }
        return {};
      }),
      executeMutation: jest.fn(async (query: string) => {
        if (query.includes('ResetListingPendingIfAiReviewing')) {
          return {
            update_rental_location_listings: {
              affected_rows: 1,
              returning: [{ id: 'listing-1' }],
            },
          };
        }
        return {};
      }),
    };
    const enqueue =
      overrides.enqueue ?? jest.fn(async () => true);
    const queue = { enqueueListingReview: enqueue };
    const model = { reviewListing: jest.fn() };
    const notifications = {
      sendRentalListingApprovedEmail: jest.fn(),
      sendRentalListingRejectedEmail: jest.fn(),
      notifySuperusersRentalListingAiReviewFailed: jest.fn(),
    };
    const configService = {
      get: jest.fn(() => ({ enabled: true })),
    };
    const merchantLifecycleService = { recompute: jest.fn() };
    const service = new RentalListingAiReviewService(
      hasura as never,
      queue as never,
      model as never,
      notifications as never,
      configService as never,
      merchantLifecycleService as never
    );
    return { service, enqueue, model, hasura };
  }

  it('retries later while cleanup is still processing', async () => {
    const { service, model } = buildService({ cleanupStatus: 'processing' });
    const result = await service.runReview('listing-1', 3);
    expect(result).toEqual({ success: false, retryLater: true });
    expect(model.reviewListing).not.toHaveBeenCalled();
  });

  it('soft-defers while cleanup awaits merchant review', async () => {
    const { service, model } = buildService({
      cleanupStatus: 'ready_for_review',
    });
    const result = await service.runReview('listing-1', 3);
    expect(result).toEqual({ success: true, skipped: true });
    expect(model.reviewListing).not.toHaveBeenCalled();
  });

  it('re-enqueues when resuming an ai_reviewing listing after cleanup', async () => {
    const enqueue = jest.fn(async () => true);
    const { service } = buildService({
      cleanupStatus: null,
      moderationStatus: 'ai_reviewing',
      reviewVersion: 4,
      enqueue,
    });
    await service.resumeReviewAfterCleanup('listing-1');
    expect(enqueue).toHaveBeenCalledWith('listing-1', 4);
  });

  it('does not resume while cleanup is still open', async () => {
    const enqueue = jest.fn(async () => true);
    const { service } = buildService({
      cleanupStatus: 'queued',
      moderationStatus: 'ai_reviewing',
      enqueue,
    });
    await service.resumeReviewAfterCleanup('listing-1');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('resets to pending when resume enqueue fails', async () => {
    const enqueue = jest.fn(async () => false);
    const { service, hasura } = buildService({
      cleanupStatus: null,
      moderationStatus: 'ai_reviewing',
      enqueue,
    });
    await service.resumeReviewAfterCleanup('listing-1');
    expect(enqueue).toHaveBeenCalledWith('listing-1', 3);
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('ResetListingPendingIfAiReviewing'),
      { id: 'listing-1' }
    );
  });
});
