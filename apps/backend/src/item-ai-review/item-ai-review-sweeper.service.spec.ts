import { ItemAiReviewSweeperService } from './item-ai-review-sweeper.service';

describe('ItemAiReviewSweeperService', () => {
  function buildService(opts?: {
    staleItems?: Array<{ id: string; name: string; updated_at: string }>;
    openCleanupItemIds?: string[];
    resetAffectedRows?: number;
  }) {
    const notify = jest.fn();
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('StaleAiReviewingItems')) {
        return { items: opts?.staleItems ?? [] };
      }
      if (query.includes('OpenCleanupJobsForItems')) {
        return {
          ai_image_cleanup_jobs: (opts?.openCleanupItemIds ?? []).map(
            (item_id) => ({ item_id, id: 'job', status: 'ready_for_review' })
          ),
        };
      }
      return {};
    });
    const executeMutation = jest.fn(async (query: string) => {
      if (query.includes('FailRunningAiReviewsForItem')) {
        return { update_item_ai_reviews: { affected_rows: 1 } };
      }
      if (query.includes('ResetItemPendingIfAiReviewing')) {
        return {
          update_items: {
            affected_rows: opts?.resetAffectedRows ?? 1,
          },
        };
      }
      return {};
    });
    const service = new ItemAiReviewSweeperService(
      { executeQuery, executeMutation } as any,
      { notifySuperusersItemAiReviewFailed: notify } as any
    );
    return { service, executeQuery, executeMutation, notify };
  }

  it('resets stale ai_reviewing items without open cleanup jobs', async () => {
    const { service, executeMutation, notify } = buildService({
      staleItems: [
        {
          id: 'item-1',
          name: 'Widget',
          updated_at: '2020-01-01T00:00:00Z',
        },
      ],
    });
    await service.sweepStuckAiReviewing();
    expect(executeMutation).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'item-1' })
    );
  });

  it('skips items with open cleanup jobs', async () => {
    const { service, executeMutation, notify } = buildService({
      staleItems: [
        {
          id: 'item-1',
          name: 'Widget',
          updated_at: '2020-01-01T00:00:00Z',
        },
      ],
      openCleanupItemIds: ['item-1'],
    });
    await service.sweepStuckAiReviewing();
    expect(executeMutation).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('does nothing when no stale items', async () => {
    const { service, executeMutation, notify } = buildService({
      staleItems: [],
    });
    await service.sweepStuckAiReviewing();
    expect(executeMutation).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});
