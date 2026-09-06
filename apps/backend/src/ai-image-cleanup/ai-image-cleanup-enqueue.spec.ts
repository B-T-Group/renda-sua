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
import { VALIDATION_CODES } from '../image-validation/types/image-validation.types';
import { AiImageCleanupService } from './ai-image-cleanup.service';
import type { CleanupEligibleImage } from './ai-image-cleanup.types';

describe('AiImageCleanupService.enqueueCleanupJob skip-all', () => {
  function createService() {
    return new AiImageCleanupService(
      { executeQuery: jest.fn(), executeMutation: jest.fn() } as any,
      {} as any,
      { getBalance: jest.fn().mockResolvedValue(10) } as any,
      {} as any,
      {} as any,
      { registerLocalHandler: jest.fn(), enqueueJob: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
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
});
