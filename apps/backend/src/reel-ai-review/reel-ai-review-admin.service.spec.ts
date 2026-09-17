import { HttpException, HttpStatus } from '@nestjs/common';
import { ReelAiReviewAdminService } from './reel-ai-review-admin.service';
import * as Q from './reel-ai-review.queries';

describe('ReelAiReviewAdminService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const reviewService = { requestReview: jest.fn() };
  const reels = { moderate: jest.fn() };

  let service: ReelAiReviewAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReelAiReviewAdminService(
      hasura as never,
      reviewService as never,
      reels as never
    );
  });

  function mockReview(overrides: Record<string, unknown> = {}) {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_ai_reviews_by_pk: {
        reel_id: 'reel-1',
        reel: { moderation_status: 'pending' },
        ...overrides,
      },
    });
  }

  describe('listReviews', () => {
    it('clamps page and limit and computes pagination', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        reel_ai_reviews: [{ id: 'r1' }],
        reel_ai_reviews_aggregate: { aggregate: { count: 51 } },
      });

      const result = await service.listReviews({ page: 0, limit: 99 });

      expect(hasura.executeQuery).toHaveBeenCalledWith(
        Q.REEL_AI_REVIEWS_ADMIN_LIST,
        expect.objectContaining({ limit: 50, offset: 0 })
      );
      expect(result.pagination).toEqual({
        page: 1,
        limit: 50,
        total: 51,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
      expect(result.reviews).toEqual([{ id: 'r1' }]);
    });

    it('maps deferred to skipped and always excludes running reviews', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        reel_ai_reviews: [],
        reel_ai_reviews_aggregate: { aggregate: { count: 0 } },
      });

      const result = await service.listReviews({
        status: 'deferred',
        adminFeedback: 'none',
        promptVersion: '  reel-ai-review-v2  ',
        page: 2,
        limit: 10,
      });

      expect(hasura.executeQuery).toHaveBeenCalledWith(
        Q.REEL_AI_REVIEWS_ADMIN_LIST,
        {
          where: {
            _and: [
              { status: { _neq: 'running' } },
              { status: { _eq: 'skipped' } },
              { admin_feedback: { _is_null: true } },
              { prompt_version: { _eq: 'reel-ai-review-v2' } },
            ],
          },
          limit: 10,
          offset: 10,
        }
      );
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('filters agree feedback and a concrete status', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        reel_ai_reviews: [],
        reel_ai_reviews_aggregate: { aggregate: null },
      });

      await service.listReviews({
        status: 'Approved',
        adminFeedback: 'agree',
        page: 1,
        limit: 20,
      });

      expect(hasura.executeQuery.mock.calls[0][1].where).toEqual({
        _and: [
          { status: { _neq: 'running' } },
          { status: { _eq: 'approved' } },
          { admin_feedback: { _eq: 'agree' } },
        ],
      });
    });

    it('ignores unknown feedback and treats all as no extra status', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        reel_ai_reviews: null,
        reel_ai_reviews_aggregate: { aggregate: { count: 0 } },
      });

      const result = await service.listReviews({
        status: 'all',
        adminFeedback: 'maybe',
        page: 1,
        limit: 20,
      });

      expect(hasura.executeQuery.mock.calls[0][1].where).toEqual({
        _and: [{ status: { _neq: 'running' } }],
      });
      expect(result.reviews).toEqual([]);
    });
  });

  describe('getReview', () => {
    it('returns 404 when the review is missing', async () => {
      hasura.executeQuery.mockResolvedValueOnce({ reel_ai_reviews_by_pk: null });

      const error = await service.getReview('missing').catch((err: unknown) => err);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('submitFeedback', () => {
    it('stores trimmed notes or null', async () => {
      mockReview();
      hasura.executeMutation.mockResolvedValueOnce({});

      await expect(
        service.submitFeedback('review-1', 'admin-1', {
          feedback: 'disagree',
          notes: '  needs another look  ',
        })
      ).resolves.toEqual({ success: true });

      expect(hasura.executeMutation).toHaveBeenCalledWith(
        Q.SET_REEL_AI_REVIEW_FEEDBACK,
        expect.objectContaining({
          id: 'review-1',
          feedback: 'disagree',
          notes: 'needs another look',
          userId: 'admin-1',
        })
      );
    });

    it('does not write feedback when the review is missing', async () => {
      hasura.executeQuery.mockResolvedValueOnce({ reel_ai_reviews_by_pk: null });

      await expect(
        service.submitFeedback('missing', 'admin-1', { feedback: 'agree' })
      ).rejects.toBeInstanceOf(HttpException);
      expect(hasura.executeMutation).not.toHaveBeenCalled();
    });
  });

  describe('override', () => {
    it('force-approves through merchant moderation', async () => {
      mockReview();
      hasura.executeMutation.mockResolvedValueOnce({});
      reels.moderate.mockResolvedValueOnce(undefined);

      await service.override('review-1', 'admin-1', { action: 'force_approve' });

      expect(hasura.executeMutation).toHaveBeenCalledWith(
        Q.SET_REEL_AI_REVIEW_OVERRIDE,
        { id: 'review-1', action: 'force_approve' }
      );
      expect(reels.moderate).toHaveBeenCalledWith('reel-1', 'admin-1', {
        status: 'approved',
      });
      expect(reviewService.requestReview).not.toHaveBeenCalled();
    });

    it('force-rejects with a default reason when none is given', async () => {
      mockReview();
      hasura.executeMutation.mockResolvedValueOnce({});

      await service.override('review-1', 'admin-1', {
        action: 'force_reject',
        reason: '   ',
      });

      expect(reels.moderate).toHaveBeenCalledWith('reel-1', 'admin-1', {
        status: 'rejected',
        reason: 'An admin reversed the AI decision. Please update your reel.',
      });
    });

    it('force-rejects with the admin reason when provided', async () => {
      mockReview();
      hasura.executeMutation.mockResolvedValueOnce({});

      await service.override('review-1', 'admin-1', {
        action: 'force_reject',
        reason: '  Off-policy  ',
      });

      expect(reels.moderate).toHaveBeenCalledWith('reel-1', 'admin-1', {
        status: 'rejected',
        reason: 'Off-policy',
      });
    });

    it('force-requeues to pending and requests another AI review', async () => {
      mockReview();
      hasura.executeMutation.mockResolvedValueOnce({}).mockResolvedValueOnce({});
      reviewService.requestReview.mockResolvedValueOnce(undefined);

      await service.override('review-1', 'admin-1', { action: 'force_requeue' });

      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('moderation_status:pending'),
        { id: 'reel-1' }
      );
      expect(reviewService.requestReview).toHaveBeenCalledWith('reel-1');
      expect(reels.moderate).not.toHaveBeenCalled();
    });
  });
});
