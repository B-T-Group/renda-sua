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
import { CLEANUP_TOKEN_COST } from '../business-tokens/business-tokens.packs';
import { VALIDATION_CODES } from '../image-validation/types/image-validation.types';
import { AiImageCleanupService } from './ai-image-cleanup.service';
import type { CleanupEligibleImage } from './ai-image-cleanup.types';

describe('AiImageCleanupService.enqueueCleanupJob skip-all', () => {
  function createHarness() {
    const tokens = {
      getBalance: jest.fn().mockResolvedValue(20),
      tryReserveTokens: jest.fn(),
      refundTokens: jest.fn().mockResolvedValue(undefined),
      recordCleanupUsage: jest.fn().mockResolvedValue(undefined),
    };
    const queue = {
      registerLocalHandler: jest.fn(),
      enqueueJob: jest.fn().mockResolvedValue(true),
    };
    const service = new AiImageCleanupService(
      { executeQuery: jest.fn(), executeMutation: jest.fn() } as any,
      {} as any,
      tokens as any,
      {} as any,
      {} as any,
      queue as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { service, tokens, queue };
  }

  function createService() {
    return createHarness().service;
  }

  function image(
    overrides: Partial<CleanupEligibleImage> = {}
  ): CleanupEligibleImage {
    return {
      id: 'img-1',
      image_url: 'https://cdn.example/a.jpg',
      s3_key: 'a.jpg',
      source: 'item_image',
      kind: 'ai',
      width: 1200,
      height: 1200,
      quality_score: 90,
      validation_warnings: [],
      validation_errors: [],
      ...overrides,
    };
  }

  it('returns 400 when an explicit opt-in still has only ineligible images', async () => {
    const service = createService();
    jest.spyOn(service as any, 'assertNoOpenKindLocks').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'classifyByContentHash').mockResolvedValue({
      toProcess: [image()],
      reusable: [],
    });
    jest.spyOn(service as any, 'getAdminCleanupModel').mockResolvedValue(
      'gpt-image-1.5'
    );
    jest.spyOn(service as any, 'ensureValidationForCleanup').mockResolvedValue(
      image({
        validation_errors: [{ code: VALIDATION_CODES.INAPPROPRIATE_CONTENT }],
      })
    );
    const createJob = jest.spyOn(service as any, 'createJob');

    try {
      await (service as any).enqueueCleanupJob({
        businessId: 'biz-1',
        userId: 'user-1',
        itemId: 'item-1',
        itemVariantId: null,
        images: [image()],
        source: 'creation',
      });
      throw new Error('expected HttpException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(String(error.message)).toContain('not eligible for AI cleanup');
    }
    expect(createJob).not.toHaveBeenCalled();
  });

  it('still queues rembg selections when AI images are skipped', async () => {
    const service = createService();
    const rembg = image({ id: 'img-rembg', kind: 'rembg' });
    const blocked = image({
      id: 'img-ai',
      validation_errors: [{ code: VALIDATION_CODES.INAPPROPRIATE_CONTENT }],
    });
    jest.spyOn(service as any, 'assertNoOpenKindLocks').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'classifyByContentHash').mockResolvedValue({
      toProcess: [rembg, blocked],
      reusable: [],
    });
    jest
      .spyOn(service as any, 'ensureValidationForCleanup')
      .mockImplementation(async (img: CleanupEligibleImage) => img);
    jest.spyOn(service as any, 'getAdminCleanupModel').mockResolvedValue(
      'gpt-image-1.5'
    );
    jest.spyOn(service as any, 'findAppendableOpenJob').mockResolvedValue(null);
    jest.spyOn(service as any, 'trackEvent').mockResolvedValue(undefined);
    const createJob = jest
      .spyOn(service as any, 'createJob')
      .mockResolvedValue({ id: 'job-1' });
    jest.spyOn(service as any, 'createResults').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'createIneligibleResults').mockResolvedValue([]);

    const result = await (service as any).enqueueCleanupJob({
      businessId: 'biz-1',
      userId: 'user-1',
      itemId: 'item-1',
      itemVariantId: null,
      images: [rembg, blocked],
      source: 'creation',
    });

    expect(createJob).toHaveBeenCalled();
    expect(result.job).toEqual({ id: 'job-1' });
  });

  function stubEligible(service: AiImageCleanupService, images: CleanupEligibleImage[]) {
    jest.spyOn(service as any, 'assertNoOpenKindLocks').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'classifyByContentHash').mockResolvedValue({
      toProcess: images,
      reusable: [],
    });
    jest.spyOn(service as any, 'getAdminCleanupModel').mockResolvedValue('gpt-image-1.5');
    jest
      .spyOn(service as any, 'ensureValidationForCleanup')
      .mockImplementation(async (img: CleanupEligibleImage) => img);
  }

  function enqueue(
    service: AiImageCleanupService,
    images: CleanupEligibleImage[],
    source: 'creation' | 'admin_moderation' = 'creation'
  ) {
    return (service as any).enqueueCleanupJob({
      businessId: 'biz-1',
      userId: 'user-1',
      itemId: 'item-1',
      itemVariantId: null,
      images,
      source,
    });
  }

  it('restores only the free tokens spent when a new cleanup job fails', async () => {
    const { service, tokens, queue } = createHarness();
    const images = [0, 1, 2, 3, 4].map((index) => image({ id: `img-${index}` }));
    stubEligible(service, images);
    jest.spyOn(service as any, 'findAppendableOpenJob').mockResolvedValue(null);
    const createJob = jest
      .spyOn(service as any, 'createJob')
      .mockResolvedValue({ id: 'job-1' });
    jest.spyOn(service as any, 'createResults').mockRejectedValue(new Error('insert failed'));
    const cancel = jest.spyOn(service as any, 'setJobStatus').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'loadJob').mockResolvedValue({ id: 'job-1' });
    jest.spyOn(service as any, 'maybeResumeModeration').mockResolvedValue(undefined);
    tokens.tryReserveTokens.mockResolvedValue({ balanceAfter: 15, spentNongiftable: 3 });

    await expect(enqueue(service, images)).rejects.toThrow('insert failed');

    expect(tokens.tryReserveTokens).toHaveBeenCalledWith(
      'biz-1',
      images.length * CLEANUP_TOKEN_COST
    );
    expect(tokens.refundTokens).toHaveBeenCalledWith(
      'biz-1',
      images.length * CLEANUP_TOKEN_COST,
      3
    );
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tokensReserved: images.length * CLEANUP_TOKEN_COST,
        nongiftableReserved: 3,
      })
    );
    expect(cancel).toHaveBeenCalledWith('job-1', 'cancelled');
    expect(queue.enqueueJob).not.toHaveBeenCalled();
  });

  it('refunds the free spend when appending to an open job fails', async () => {
    const { service, tokens } = createHarness();
    const images = [image({ id: 'img-a' }), image({ id: 'img-b' })];
    stubEligible(service, images);
    jest
      .spyOn(service as any, 'findAppendableOpenJob')
      .mockResolvedValue({ id: 'open-1', status: 'queued' });
    jest
      .spyOn(service as any, 'appendResultsToOpenJob')
      .mockRejectedValue(new Error('append failed'));
    const cancel = jest.spyOn(service as any, 'setJobStatus');
    tokens.tryReserveTokens.mockResolvedValue({ balanceAfter: 18, spentNongiftable: 2 });

    await expect(enqueue(service, images)).rejects.toThrow('append failed');

    expect(tokens.tryReserveTokens).toHaveBeenCalledWith('biz-1', 2 * CLEANUP_TOKEN_COST);
    expect(tokens.refundTokens).toHaveBeenCalledWith('biz-1', 2 * CLEANUP_TOKEN_COST, 2);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('keeps the reservation after the open job has already been updated', async () => {
    const { service, tokens } = createHarness();
    const images = [image()];
    stubEligible(service, images);
    jest
      .spyOn(service as any, 'findAppendableOpenJob')
      .mockResolvedValue({ id: 'open-1', status: 'queued' });
    jest.spyOn(service as any, 'appendResultsToOpenJob').mockResolvedValue({ id: 'open-1' });
    jest.spyOn(service as any, 'trackEvent').mockRejectedValue(new Error('analytics down'));
    tokens.tryReserveTokens.mockResolvedValue({ balanceAfter: 19, spentNongiftable: 1 });

    await expect(enqueue(service, images)).rejects.toThrow('analytics down');
    expect(tokens.refundTokens).not.toHaveBeenCalled();
  });

  it('refuses cleanup when the reserve finds no tokens', async () => {
    const { service, tokens } = createHarness();
    const images = [image()];
    stubEligible(service, images);
    const createJob = jest.spyOn(service as any, 'createJob');
    tokens.tryReserveTokens.mockResolvedValue(null);

    try {
      await enqueue(service, images);
      throw new Error('expected HttpException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({ code: 'INSUFFICIENT_AI_TOKENS' })
      );
    }
    expect(createJob).not.toHaveBeenCalled();
    expect(tokens.refundTokens).not.toHaveBeenCalled();
  });

  it('does not reserve merchant tokens for admin moderation', async () => {
    const { service, tokens } = createHarness();
    const images = [image()];
    stubEligible(service, images);
    jest.spyOn(service as any, 'findAppendableOpenJob').mockResolvedValue(null);
    jest.spyOn(service as any, 'createJob').mockResolvedValue({ id: 'job-admin' });
    jest.spyOn(service as any, 'createResults').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'trackEvent').mockResolvedValue(undefined);

    const result = await enqueue(service, images, 'admin_moderation');

    expect(tokens.tryReserveTokens).not.toHaveBeenCalled();
    expect(tokens.refundTokens).not.toHaveBeenCalled();
    expect(result.ai_tokens_remaining).toBe(20);
    expect(result.job).toEqual({ id: 'job-admin' });
  });

  it('charges only AI selections when a background removal is in the same request', async () => {
    const { service, tokens } = createHarness();
    const images = [image({ id: 'img-ai' }), image({ id: 'img-bg', kind: 'rembg' })];
    stubEligible(service, images);
    jest.spyOn(service as any, 'findAppendableOpenJob').mockResolvedValue(null);
    jest.spyOn(service as any, 'createJob').mockResolvedValue({ id: 'job-1' });
    jest.spyOn(service as any, 'createResults').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'trackEvent').mockResolvedValue(undefined);
    tokens.tryReserveTokens.mockResolvedValue({ balanceAfter: 19, spentNongiftable: 1 });

    const result = await enqueue(service, images);

    expect(tokens.tryReserveTokens).toHaveBeenCalledTimes(1);
    expect(tokens.tryReserveTokens).toHaveBeenCalledWith('biz-1', CLEANUP_TOKEN_COST);
    expect(tokens.refundTokens).not.toHaveBeenCalled();
    expect(result.ai_tokens_remaining).toBe(19);
  });

  it('still throws the cleanup error when the token refund fails', async () => {
    const { service, tokens } = createHarness();
    const images = [image()];
    stubEligible(service, images);
    jest.spyOn(service as any, 'findAppendableOpenJob').mockResolvedValue(null);
    jest.spyOn(service as any, 'createJob').mockRejectedValue(new Error('insert failed'));
    tokens.tryReserveTokens.mockResolvedValue({ balanceAfter: 19, spentNongiftable: 1 });
    tokens.refundTokens.mockRejectedValue(new Error('refund down'));

    await expect(enqueue(service, images)).rejects.toThrow('insert failed');
    expect(tokens.refundTokens).toHaveBeenCalledWith('biz-1', CLEANUP_TOKEN_COST, 1);
  });
});
