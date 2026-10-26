jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../item-ai-review/item-ai-review.service', () => ({
  ItemAiReviewService: class ItemAiReviewService {},
}));
jest.mock('../rental-listing-ai-review/rental-listing-ai-review.service', () => ({
  RentalListingAiReviewService: class RentalListingAiReviewService {},
}));
jest.mock('../ai/ai.service', () => ({
  AiService: class AiService {},
}));
jest.mock('./rembg-cleanup.service', () => ({
  RembgCleanupService: class RembgCleanupService {},
}));
jest.mock('../business-tokens/business-tokens.service', () => ({
  BusinessTokensService: class BusinessTokensService {},
}));

import { AiImageCleanupService } from './ai-image-cleanup.service';
import * as Q from './ai-image-cleanup.queries';
import type {
  AiImageCleanupJobRow,
  AiImageCleanupResultRow,
} from './ai-image-cleanup.types';

describe('AI cleanup failure refunds', () => {
  function createService() {
    const hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
    const tokens = { refundTokens: jest.fn().mockResolvedValue(undefined) };
    const confidence = {
      assess: jest.fn().mockResolvedValue({
        score: 0.9,
        tier: 'high',
        signals: {},
        changes: [],
      }),
    };
    const service = new AiImageCleanupService(
      hasura as any,
      {} as any,
      tokens as any,
      {} as any,
      {} as any,
      { registerLocalHandler: jest.fn(), enqueueJob: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      confidence as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { service, hasura, tokens };
  }

  function result(id: string): AiImageCleanupResultRow {
    return {
      id,
      job_id: 'job-1',
      business_image_id: id,
      item_variant_image_id: null,
      original_image_url: 'https://example.com/a.jpg',
      original_s3_key: null,
      cleaned_image_url: null,
      cleaned_s3_key: null,
      status: 'queued',
      error_message: null,
      retry_of_result_id: null,
      created_at: '2026-10-26T00:00:00.000Z',
      updated_at: '2026-10-26T00:00:00.000Z',
      completed_at: null,
    };
  }

  function job(
    overrides: Partial<AiImageCleanupJobRow> = {}
  ): AiImageCleanupJobRow {
    return {
      id: 'job-1',
      business_id: 'biz-1',
      item_id: 'item-1',
      item_variant_id: null,
      requested_by_user_id: 'user-1',
      status: 'processing',
      tokens_reserved: 5,
      tokens_consumed: 0,
      tokens_refunded: 0,
      nongiftable_reserved: 2,
      created_at: '2026-10-26T00:00:00.000Z',
      updated_at: '2026-10-26T00:00:00.000Z',
      completed_at: null,
      results: ['r1', 'r2', 'r3', 'r4', 'r5'].map(result),
      ...overrides,
    };
  }

  it('returns purchased tokens before the signup allotment when photos fail', async () => {
    const { service, hasura, tokens } = createService();
    const row = job();
    jest.spyOn(service as any, 'claimJob').mockResolvedValue(true);
    jest.spyOn(service as any, 'loadJob').mockResolvedValue(row);
    jest.spyOn(service as any, 'claimResult').mockResolvedValue(true);
    jest
      .spyOn(service as any, 'cleanupWithOpenAi')
      .mockRejectedValue(new Error('model down'));
    hasura.executeMutation.mockResolvedValue({});
    jest.spyOn(service as any, 'finalizeJobAfterProcess').mockResolvedValue(undefined);

    await service.processJob('job-1');

    const restored = tokens.refundTokens.mock.calls.map((call) => call[2]);
    expect(restored).toEqual([0, 0, 0, 1, 1]);
    expect(tokens.refundTokens).toHaveBeenCalledWith('biz-1', 1, 0);
    expect(tokens.refundTokens).toHaveBeenCalledWith('biz-1', 1, 1);
  });

  it('does not turn a consumed free token into a giftable refund', async () => {
    const { service, hasura, tokens } = createService();
    const row = job({
      tokens_reserved: 2,
      nongiftable_reserved: 1,
      results: [result('ok'), result('bad')],
    });
    jest.spyOn(service as any, 'claimJob').mockResolvedValue(true);
    jest.spyOn(service as any, 'loadJob').mockResolvedValue(row);
    jest.spyOn(service as any, 'claimResult').mockResolvedValue(true);
    jest
      .spyOn(service as any, 'cleanupWithOpenAi')
      .mockResolvedValueOnce({
        url: 'https://example.com/clean.jpg',
        key: 'clean',
        provider: 'openai',
        model: 'gpt-image-1.5',
      })
      .mockRejectedValueOnce(new Error('model down'));
    hasura.executeMutation.mockResolvedValue({});

    await service.processJob('job-1');

    expect(tokens.refundTokens).toHaveBeenCalledTimes(1);
    expect(tokens.refundTokens).toHaveBeenCalledWith('biz-1', 1, 0);
    const holdDeltas = hasura.executeMutation.mock.calls
      .filter((call) => call[0] === Q.INC_JOB_TOKENS)
      .map((call) => call[1]);
    expect(holdDeltas).toEqual([
      expect.objectContaining({ consumed: 1, refunded: 0, nongiftable: -1 }),
      expect.objectContaining({ consumed: 0, refunded: 1, nongiftable: 0 }),
    ]);
    const sets = hasura.executeMutation.mock.calls
      .map((call) => call[1]?._set)
      .filter((set) => set && 'tokens_consumed' in set);
    expect(sets.length).toBeGreaterThan(0);
    for (const set of sets) {
      // Appends during the run _inc nongiftable_reserved; finalize must not overwrite it.
      expect(set).not.toHaveProperty('nongiftable_reserved');
      expect(set).toEqual(
        expect.objectContaining({ tokens_consumed: 1, tokens_refunded: 1 })
      );
    }
  });

  it('restores the free portion once when the queue gives up on the batch', async () => {
    const { service, hasura, tokens } = createService();
    hasura.executeMutation.mockResolvedValue({
      update_ai_image_cleanup_results: {
        affected_rows: 5,
        returning: ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => ({
          id,
          kind: 'ai',
        })),
      },
    });
    const row = job({ status: 'queued', results: [] });

    await expect(
      (service as any).failPendingResults(row)
    ).resolves.toBe(5);
    expect(tokens.refundTokens).toHaveBeenCalledWith('biz-1', 5, 2);
  });
});
