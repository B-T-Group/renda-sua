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

import { HttpException, HttpStatus } from '@nestjs/common';
import { AiImageCleanupService } from './ai-image-cleanup.service';
import type { AiImageCleanupJobRow } from './ai-image-cleanup.types';

describe('AiImageCleanupService.failJobAfterQueueExhaustion', () => {
  function createService() {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const tokens = { refundTokens: jest.fn() };
    const service = new AiImageCleanupService(
      hasura as any,
      {} as any,
      tokens as any,
      {} as any,
      {} as any,
      { registerLocalHandler: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { service, hasura, tokens };
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
      status: 'queued',
      tokens_reserved: 1,
      tokens_consumed: 0,
      tokens_refunded: 0,
      created_at: '2026-08-17T09:00:00.000Z',
      updated_at: '2026-08-17T10:00:00.000Z',
      completed_at: null,
      results: [],
      ...overrides,
    };
  }

  it('ignores a missing job so stale DLQ messages are no-ops', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'loadJob').mockRejectedValue(
      new HttpException('Job not found', HttpStatus.NOT_FOUND)
    );
    const finalize = jest.spyOn(service as any, 'finalizeJobAfterProcess');

    await expect(
      service.failJobAfterQueueExhaustion('missing-job')
    ).resolves.toEqual({ success: true });
    expect(finalize).not.toHaveBeenCalled();
  });

  it('does not fail a job that already left queued/processing', async () => {
    const { service } = createService();
    jest
      .spyOn(service as any, 'loadJob')
      .mockResolvedValue(job({ status: 'completed' }));
    const finalize = jest.spyOn(service as any, 'finalizeJobAfterProcess');

    await expect(
      service.failJobAfterQueueExhaustion('job-1')
    ).resolves.toEqual({ success: true });
    expect(finalize).not.toHaveBeenCalled();
  });

  it('ignores a stale DLQ message after the job was re-queued', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'loadJob').mockResolvedValue(
      job({
        status: 'queued',
        updated_at: '2026-08-17T10:00:00.000Z',
      })
    );
    const finalize = jest.spyOn(service as any, 'finalizeJobAfterProcess');

    await expect(
      service.failJobAfterQueueExhaustion(
        'job-1',
        '2026-08-17T09:00:00.000Z'
      )
    ).resolves.toEqual({ success: true });
    expect(finalize).not.toHaveBeenCalled();
  });

  it('conflicts when a processing job cannot be exclusively claimed', async () => {
    const { service, hasura } = createService();
    jest
      .spyOn(service as any, 'loadJob')
      .mockResolvedValue(job({ status: 'processing' }));
    hasura.executeMutation.mockResolvedValue({
      update_ai_image_cleanup_jobs: { affected_rows: 0 },
    });

    await expect(
      service.failJobAfterQueueExhaustion('job-1')
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
    await expect(service.failJobAfterQueueExhaustion('job-1')).rejects.toThrow(
      /still processing/i
    );
  });

  it('conflicts when cleanup results are still processing', async () => {
    const { service } = createService();
    const fresh = job({
      status: 'queued',
      results: [
        {
          id: 'res-1',
          job_id: 'job-1',
          business_image_id: 'img-1',
          item_variant_image_id: null,
          original_image_url: 'https://example.com/a.jpg',
          original_s3_key: null,
          cleaned_image_url: null,
          cleaned_s3_key: null,
          status: 'processing',
          error_message: null,
          retry_of_result_id: null,
          created_at: '2026-08-17T10:00:00.000Z',
          updated_at: new Date().toISOString(),
          completed_at: null,
        },
      ],
    });
    jest.spyOn(service as any, 'loadJob').mockResolvedValue(fresh);

    await expect(
      service.failJobAfterQueueExhaustion('job-1')
    ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
  });

  it('fails pending results and finalizes when the claim is exclusive', async () => {
    const { service } = createService();
    jest.spyOn(service as any, 'loadJob').mockResolvedValue(job());
    const failPending = jest
      .spyOn(service as any, 'failPendingResults')
      .mockResolvedValue(1);
    const finalize = jest
      .spyOn(service as any, 'finalizeJobAfterProcess')
      .mockResolvedValue(undefined);

    await expect(
      service.failJobAfterQueueExhaustion('job-1')
    ).resolves.toEqual({ success: true });
    expect(failPending).toHaveBeenCalled();
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-1' }), 0, 1);
  });
});
