jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: jest.fn(),
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: jest.fn(),
}));
jest.mock('../item-ai-review/item-ai-review.service', () => ({
  ItemAiReviewService: jest.fn(),
}));
jest.mock('../rental-listing-ai-review/rental-listing-ai-review.service', () => ({
  RentalListingAiReviewService: jest.fn(),
}));
jest.mock('../ai/ai.service', () => ({
  AiService: jest.fn(),
}));
jest.mock('./rembg-cleanup.service', () => ({
  RembgCleanupService: jest.fn(),
}));
jest.mock('../business-tokens/business-tokens.service', () => ({
  BusinessTokensService: jest.fn(),
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { CLEANUP_TOKEN_COST } from '../business-tokens/business-tokens.packs';
import { AiImageCleanupService } from './ai-image-cleanup.service';

describe('AiImageCleanupService admin no-charge path', () => {
  const image = {
    id: 'img-1',
    image_url: 'https://example.com/a.jpg',
    validation_warnings: [],
    validation_errors: [],
    quality_score: 80,
    width: 1200,
    height: 1200,
  };

  function buildService() {
    const tokens = {
      getBalance: jest.fn().mockResolvedValue(9),
      tryReserveTokens: jest.fn(),
      recordCleanupUsage: jest.fn(),
    };
    const queue = {
      enqueueJob: jest.fn().mockResolvedValue(undefined),
      registerLocalHandler: jest.fn(),
    };
    const service = new AiImageCleanupService(
      {} as never,
      {} as never,
      tokens as never,
      {} as never,
      {} as never,
      queue as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    return { service, tokens, queue };
  }

  describe('requestAdminItemCleanup', () => {
    it('conflicts when a job is already queued or processing', async () => {
      const { service } = buildService();
      jest
        .spyOn(service as any, 'loadItemBusiness')
        .mockResolvedValue({ businessId: 'biz-1' });
      jest
        .spyOn(service as any, 'findOpenJobForItem')
        .mockResolvedValue({ id: 'open-1', status: 'processing' });
      const enqueue = jest.spyOn(service as any, 'enqueueCleanupJob');

      const error = await service
        .requestAdminItemCleanup('item-1', 'admin-1')
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect(enqueue).not.toHaveBeenCalled();
    });

    it('enqueues admin cleanup without charging merchant tokens', async () => {
      const { service } = buildService();
      jest
        .spyOn(service as any, 'loadItemBusiness')
        .mockResolvedValue({ businessId: 'biz-1' });
      jest.spyOn(service as any, 'findOpenJobForItem').mockResolvedValue(null);
      jest
        .spyOn(service as any, 'loadEligibleItemImages')
        .mockResolvedValue([image]);
      const enqueue = jest
        .spyOn(service as any, 'enqueueCleanupJob')
        .mockResolvedValue({
          job: { id: 'job-1', status: 'queued' },
          ai_tokens_remaining: 9,
        });

      const result = await service.requestAdminItemCleanup(
        'item-1',
        'admin-1',
        ['img-1']
      );

      expect(result).toEqual({
        job: { id: 'job-1', status: 'queued' },
        ai_tokens_remaining: 9,
        appliedExistingReview: false,
      });
      expect(enqueue).toHaveBeenCalledWith({
        businessId: 'biz-1',
        userId: 'admin-1',
        itemId: 'item-1',
        itemVariantId: null,
        images: [image],
        source: 'admin_moderation',
        chargeTokens: false,
      });
    });

    it('applies a ready review and returns it when no replacement images exist', async () => {
      const { service, tokens } = buildService();
      jest
        .spyOn(service as any, 'loadItemBusiness')
        .mockResolvedValue({ businessId: 'biz-1' });
      jest.spyOn(service as any, 'findOpenJobForItem').mockResolvedValue({
        id: 'old-job',
        status: 'ready_for_review',
      });
      const apply = jest
        .spyOn(service as any, 'adminForceApplyOpenJob')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'loadEligibleItemImages')
        .mockRejectedValue(
          new HttpException(
            'No eligible images to clean',
            HttpStatus.BAD_REQUEST
          )
        );
      const resume = jest
        .spyOn(service as any, 'maybeResumeModeration')
        .mockResolvedValue(undefined);
      jest.spyOn(service as any, 'loadJob').mockResolvedValue({
        id: 'old-job',
        status: 'completed',
      });

      const result = await service.requestAdminItemCleanup('item-1', 'admin-1');

      expect(apply).toHaveBeenCalledWith('old-job');
      expect(resume).toHaveBeenCalled();
      expect(tokens.getBalance).toHaveBeenCalledWith('biz-1');
      expect(result).toEqual({
        job: { id: 'old-job', status: 'completed' },
        ai_tokens_remaining: 9,
        appliedExistingReview: true,
      });
    });
  });

  describe('enqueueCleanupJob token charging', () => {
    function stubEnqueueDeps(service: AiImageCleanupService) {
      jest.spyOn(service as any, 'classifyByContentHash').mockResolvedValue({
        toProcess: [image],
        reusable: [],
      });
      jest
        .spyOn(service as any, 'getAdminCleanupModel')
        .mockResolvedValue('gpt-image-1-mini');
      jest
        .spyOn(service as any, 'ensureValidationForCleanup')
        .mockImplementation(async (img: unknown) => img);
      jest.spyOn(service as any, 'resolveJobMode').mockResolvedValue('review');
      jest
        .spyOn(service as any, 'createJob')
        .mockResolvedValue({ id: 'job-1', status: 'queued' });
      jest.spyOn(service as any, 'createResults').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'createIneligibleResults')
        .mockResolvedValue(undefined);
      jest.spyOn(service as any, 'trackEvent').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'rollbackFailedRequest')
        .mockResolvedValue(undefined);
    }

    const enqueueArgs = {
      businessId: 'biz-1',
      userId: 'user-1',
      itemId: 'item-1',
      itemVariantId: null,
      images: [image],
      source: 'creation' as const,
    };

    it('skips reservation and usage when chargeTokens is false', async () => {
      const { service, tokens, queue } = buildService();
      stubEnqueueDeps(service);
      const createJob = (service as any).createJob as jest.Mock;

      await (service as any).enqueueCleanupJob({
        ...enqueueArgs,
        source: 'admin_moderation',
        chargeTokens: false,
      });

      expect(tokens.tryReserveTokens).not.toHaveBeenCalled();
      expect(tokens.recordCleanupUsage).not.toHaveBeenCalled();
      expect(createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          tokensReserved: 0,
          source: 'admin_moderation',
          mode: 'auto_apply',
        })
      );
      expect(queue.enqueueJob).toHaveBeenCalledWith('job-1');
    });

    it('reserves tokens for merchant-triggered cleanup', async () => {
      const { service, tokens } = buildService();
      stubEnqueueDeps(service);
      tokens.tryReserveTokens.mockResolvedValue(8);
      const createJob = (service as any).createJob as jest.Mock;

      await (service as any).enqueueCleanupJob(enqueueArgs);

      expect(tokens.tryReserveTokens).toHaveBeenCalledWith(
        'biz-1',
        CLEANUP_TOKEN_COST
      );
      expect(tokens.recordCleanupUsage).toHaveBeenCalled();
      expect(createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          tokensReserved: CLEANUP_TOKEN_COST,
          source: 'creation',
        })
      );
    });

    it('returns 402 when the merchant has no tokens', async () => {
      const { service, tokens } = buildService();
      stubEnqueueDeps(service);
      tokens.tryReserveTokens.mockResolvedValue(null);
      const createJob = (service as any).createJob as jest.Mock;

      const error = await (service as any)
        .enqueueCleanupJob(enqueueArgs)
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.PAYMENT_REQUIRED
      );
      expect(createJob).not.toHaveBeenCalled();
    });
  });

  describe('tokenUnitForJob', () => {
    it('does not refund images on unpaid admin jobs', () => {
      const { service } = buildService();
      expect((service as any).tokenUnitForJob({ tokens_reserved: 0 })).toBe(0);
      expect((service as any).tokenUnitForJob({})).toBe(0);
      expect((service as any).tokenUnitForJob({ tokens_reserved: 2 })).toBe(
        CLEANUP_TOKEN_COST
      );
    });
  });
});
