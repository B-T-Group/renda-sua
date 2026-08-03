import { ItemAiReviewService } from './item-ai-review.service';

describe('ItemAiReviewService cleanup deferral', () => {
  function buildService(overrides: {
    cleanupOpen?: boolean;
    cleanupStatus?: string;
    moderationStatus?: string;
    reviewVersion?: number;
    enqueue?: jest.Mock;
    requestReview?: jest.Mock;
  }) {
    const hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('GetOpenAiImageCleanupJobForAiReview')) {
          return {
            ai_image_cleanup_jobs: overrides.cleanupOpen
              ? [
                  {
                    id: 'job-1',
                    status: overrides.cleanupStatus ?? 'processing',
                  },
                ]
              : [],
          };
        }
        if (query.includes('GetItemModerationStatus')) {
          return {
            items_by_pk: {
              id: 'item-1',
              moderation_status: overrides.moderationStatus ?? 'ai_reviewing',
              ai_review_version: overrides.reviewVersion ?? 3,
            },
          };
        }
        if (query.includes('ItemForAiReview')) {
          return {
            items_by_pk: {
              id: 'item-1',
              name: 'Widget',
              description: 'A widget',
              price: 10,
              currency: 'CAD',
              business_id: 'biz-1',
              moderation_status: 'ai_reviewing',
              ai_review_version: overrides.reviewVersion ?? 3,
              is_active: false,
              business: { user_id: 'user-1', name: 'Biz' },
              item_images: [
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
        return {};
      }),
      executeMutation: jest.fn(async (query: string) => {
        if (query.includes('ResetItemPendingIfAiReviewing')) {
          return { update_items: { affected_rows: 1, returning: [{ id: 'item-1' }] } };
        }
        return { update_items_by_pk: { id: 'item-1' } };
      }),
    };
    const enqueue =
      overrides.enqueue ?? jest.fn(async () => true);
    const queue = { enqueueItemReview: enqueue };
    const model = { reviewItem: jest.fn() };
    const notifications = {
      sendSaleItemApprovedEmail: jest.fn(),
      sendSaleItemRejectedEmail: jest.fn(),
      sendSaleItemAiProposalEmail: jest.fn(),
      sendSaleItemAiProposalPush: jest.fn(),
      notifySuperusersItemAiReviewFailed: jest.fn(),
    };
    const configService = {
      get: jest.fn(() => ({ enabled: true })),
    };
    const activationValidation = {
      assertItemCanActivateAsSystem: jest.fn(),
    };
    const merchantLifecycleService = { recompute: jest.fn() };
    const service = new ItemAiReviewService(
      hasura as never,
      queue as never,
      model as never,
      notifications as never,
      configService as never,
      activationValidation as never,
      merchantLifecycleService as never
    );
    if (overrides.requestReview) {
      jest
        .spyOn(service, 'requestReview')
        .mockImplementation(overrides.requestReview);
    }
    return { service, enqueue, model, hasura };
  }

  it('defers review while a cleanup job is open', async () => {
    const { service, model } = buildService({ cleanupOpen: true });
    const result = await service.runReview('item-1', 3);
    expect(result).toEqual({ success: false, retryLater: true });
    expect(model.reviewItem).not.toHaveBeenCalled();
  });

  it('soft-defers while cleanup awaits merchant review', async () => {
    const { service, model } = buildService({
      cleanupOpen: true,
      cleanupStatus: 'ready_for_review',
    });
    const result = await service.runReview('item-1', 3);
    expect(result).toEqual({ success: true, skipped: true });
    expect(model.reviewItem).not.toHaveBeenCalled();
  });

  it('re-enqueues when resuming an ai_reviewing item after cleanup', async () => {
    const enqueue = jest.fn(async () => true);
    const { service } = buildService({
      cleanupOpen: false,
      moderationStatus: 'ai_reviewing',
      reviewVersion: 4,
      enqueue,
    });
    await service.resumeReviewAfterCleanup('item-1');
    expect(enqueue).toHaveBeenCalledWith('item-1', 4);
  });

  it('does not resume while cleanup is still open', async () => {
    const enqueue = jest.fn(async () => true);
    const { service } = buildService({
      cleanupOpen: true,
      moderationStatus: 'ai_reviewing',
      enqueue,
    });
    await service.resumeReviewAfterCleanup('item-1');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('resets to pending when resume enqueue fails', async () => {
    const enqueue = jest.fn(async () => false);
    const { service, hasura } = buildService({
      cleanupOpen: false,
      moderationStatus: 'ai_reviewing',
      enqueue,
    });
    await service.resumeReviewAfterCleanup('item-1');
    expect(enqueue).toHaveBeenCalledWith('item-1', 3);
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('ResetItemPendingIfAiReviewing'),
      { id: 'item-1' }
    );
  });
});
