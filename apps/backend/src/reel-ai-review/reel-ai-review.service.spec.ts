import { ReelAiReviewService } from './reel-ai-review.service';

describe('ReelAiReviewService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const config = {
    get: jest.fn(),
  };
  const queue = { enqueue: jest.fn() };
  const model = { review: jest.fn() };

  let service: ReelAiReviewService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) =>
      key === 'reelAiReview' ? { enabled: true } : undefined
    );
    service = new ReelAiReviewService(
      hasura as never,
      config as never,
      queue as never,
      model as never
    );
  });

  function reviewingReel() {
    return {
      caption: 'Soap',
      subject_type: 'item',
      market_country: 'CM',
      thumbnail_url: 'https://cdn/t.jpg',
      moderation_status: 'ai_reviewing',
    };
  }

  describe('requestReview', () => {
    it('does nothing when AI review is disabled', async () => {
      config.get.mockReturnValue({ enabled: false });

      await service.requestReview('reel-1');

      expect(hasura.executeMutation).not.toHaveBeenCalled();
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('does not enqueue when the pending+ready claim loses', async () => {
      hasura.executeMutation.mockResolvedValueOnce({
        update_reels: { affected_rows: 0 },
      });

      await service.requestReview('reel-1');

      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('resets the reel to pending when enqueue fails after a successful claim', async () => {
      hasura.executeMutation
        .mockResolvedValueOnce({ update_reels: { affected_rows: 1 } })
        .mockResolvedValueOnce({});
      queue.enqueue.mockResolvedValueOnce(false);

      await service.requestReview('reel-1');

      expect(hasura.executeMutation).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('moderation_status:pending'),
        { id: 'reel-1' }
      );
    });
  });

  describe('runReview', () => {
    it('skips when the reel is no longer in ai_reviewing', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        reels_by_pk: { ...reviewingReel(), moderation_status: 'pending' },
      });

      await expect(service.runReview('reel-1')).resolves.toEqual({
        success: true,
        skipped: true,
      });
      expect(model.review).not.toHaveBeenCalled();
    });

    it('auto-approves when the model returns approve', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        reels_by_pk: reviewingReel(),
      });
      hasura.executeMutation
        .mockResolvedValueOnce({
          insert_reel_ai_reviews_one: { id: 'review-1' },
        })
        .mockResolvedValueOnce({});
      model.review.mockResolvedValueOnce({
        approve: true,
        reason: 'On-topic product ad',
        raw: { decision: 'approve' },
        model: 'luna',
      });

      await expect(service.runReview('reel-1')).resolves.toEqual({
        success: true,
      });
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('moderation_status:approved'),
        expect.objectContaining({
          reelId: 'reel-1',
          reviewId: 'review-1',
          reason: 'On-topic product ad',
        })
      );
    });

    it('defers to admin and resets pending when the model withholds approval', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        reels_by_pk: reviewingReel(),
      });
      hasura.executeMutation
        .mockResolvedValueOnce({
          insert_reel_ai_reviews_one: { id: 'review-1' },
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      model.review.mockResolvedValueOnce({
        approve: false,
        reason: 'Needs human review',
        raw: { decision: 'manual_review' },
        model: 'luna',
      });

      await expect(service.runReview('reel-1')).resolves.toEqual({
        success: true,
        skipped: true,
      });
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('status:skipped'),
        expect.objectContaining({
          id: 'review-1',
          reason: 'Needs human review',
        })
      );
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('moderation_status:pending'),
        { id: 'reel-1' }
      );
    });

    it('resets pending when the model throws', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        reels_by_pk: reviewingReel(),
      });
      hasura.executeMutation
        .mockResolvedValueOnce({
          insert_reel_ai_reviews_one: { id: 'review-1' },
        })
        .mockResolvedValueOnce({});
      model.review.mockRejectedValueOnce(new Error('bedrock timeout'));

      await expect(service.runReview('reel-1')).resolves.toEqual({
        success: false,
        error: 'bedrock timeout',
      });
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('moderation_status:pending'),
        { id: 'reel-1' }
      );
    });
  });
});
