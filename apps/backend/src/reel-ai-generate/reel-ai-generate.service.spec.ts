import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ReelAiGenerateService } from './reel-ai-generate.service';

describe('ReelAiGenerateService.generate', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'veo') {
        return {
          tier: 'fast',
          modelOverride: '',
          resolution: '720p',
          durationSeconds: 8,
          aspectRatio: '9:16',
        };
      }
      if (key === 'videoGeneration') {
        return {
          primaryProvider: 'google',
          fallbackProviders: ['runway'],
          enableFallback: true,
        };
      }
      return undefined;
    }),
  };
  const aws = { getS3Client: jest.fn(), getBucketName: jest.fn() };
  const rbac = { getEffectiveAccess: jest.fn() };
  const tokens = {
    tryReserveTokens: jest.fn(),
    refundTokens: jest.fn(),
    recordUsage: jest.fn(),
  };
  const videoRouter = {
    submit: jest.fn(),
    getJobStatus: jest.fn(),
    retrieveVideo: jest.fn(),
    fallbackAfterPrimaryJobFailure: jest.fn(),
  };
  const mediaQueue = { enqueue: jest.fn() };

  let service: ReelAiGenerateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReelAiGenerateService(
      hasura as never,
      config as never,
      aws as never,
      rbac as never,
      tokens as never,
      videoRouter as never,
      mediaQueue as never,
      { notifyFailed: jest.fn() } as never
    );
    jest
      .spyOn(service as never, 'requireAllowedBusiness' as never)
      .mockResolvedValue({ id: 'business-1' } as never);
    jest
      .spyOn(service as never, 'assertDailyQuota' as never)
      .mockResolvedValue(undefined as never);
  });

  it('skips token debit for superusers', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: true });
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrls: ['https://cdn/x.jpg'],
      } as never);
    jest
      .spyOn(service as never, 'insertGeneratingReel' as never)
      .mockResolvedValue({
        id: 'reel-1',
        business_id: 'business-1',
        processing_status: 'generating',
      } as never);
    jest
      .spyOn(service as never, 'startGenerationJob' as never)
      .mockResolvedValue(undefined as never);

    await service.generate('user-1', {
      subjectType: 'item',
      subjectId: 'item-1',
      presetId: 'premium',
      marketCountry: 'CM',
    });

    expect(tokens.tryReserveTokens).not.toHaveBeenCalled();
  });

  it('refunds reserved tokens when reel insert fails', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: false });
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrls: ['https://cdn/x.jpg'],
      } as never);
    tokens.tryReserveTokens.mockResolvedValue(0);
    jest
      .spyOn(service as never, 'insertGeneratingReel' as never)
      .mockRejectedValue(new Error('insert failed'));

    await expect(
      service.generate('user-1', {
        subjectType: 'item',
        subjectId: 'item-1',
        presetId: 'premium',
        marketCountry: 'CM',
      })
    ).rejects.toThrow('insert failed');

    expect(tokens.refundTokens).toHaveBeenCalledWith('business-1', 1);
  });

  it('debits one token for default fast tier', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: false });
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrls: ['https://cdn/x.jpg'],
      } as never);
    tokens.tryReserveTokens.mockResolvedValue(3);
    jest
      .spyOn(service as never, 'insertGeneratingReel' as never)
      .mockResolvedValue({
        id: 'reel-1',
        business_id: 'business-1',
        processing_status: 'generating',
      } as never);
    jest
      .spyOn(service as never, 'startGenerationJob' as never)
      .mockResolvedValue(undefined as never);

    await service.generate('user-1', {
      subjectType: 'item',
      subjectId: 'item-1',
      presetId: 'premium',
      marketCountry: 'CM',
    });

    expect(tokens.tryReserveTokens).toHaveBeenCalledWith('business-1', 1);
  });

  it('persists provider metadata from the router response', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: true });
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrls: ['https://cdn/x.jpg'],
      } as never);
    jest
      .spyOn(service as never, 'insertGeneratingReel' as never)
      .mockResolvedValue({
        id: 'reel-1',
        business_id: 'business-1',
        processing_status: 'generating',
      } as never);
    jest
      .spyOn(service as never, 'fetchImagesForGeneration' as never)
      .mockResolvedValue([
        { imageBase64: 'abc', mimeType: 'image/jpeg' },
      ] as never);
    videoRouter.submit.mockResolvedValue({
      jobId: 'operations/1',
      provider: 'google',
      providerModel: 'veo-3.1-fast-generate-preview',
      tier: 'fast',
      status: 'PROCESSING',
      fallbackUsed: false,
    });
    hasura.executeMutation.mockResolvedValue({
      insert_reel_ai_generations_one: { id: 'gen-1' },
    });

    await service.generate('user-1', {
      subjectType: 'item',
      subjectId: 'item-1',
      presetId: 'premium',
      marketCountry: 'CM',
      tier: 'fast',
    });

    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('insert_reel_ai_generations_one'),
      expect.objectContaining({
        object: expect.objectContaining({
          provider: 'google',
          provider_job_id: 'operations/1',
          generation_tier: 'fast',
          fallback_used: false,
          gemini_operation_name: 'operations/1',
          model: 'veo-3.1-fast-generate-preview',
        }),
      })
    );
  });

  it('uses the original catalog photo instead of the display thumbnail', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: true });
    hasura.executeQuery.mockResolvedValue({
      items_by_pk: {
        id: 'item-1',
        business_id: 'business-1',
        name: 'Soap',
        description: null,
        brand: null,
        item_images: [
          {
            image_url: 'https://cdn/original.jpg',
            display_url: 'https://cdn/thumbs/item_image/x.webp',
          },
        ],
      },
    });
    jest
      .spyOn(service as never, 'insertGeneratingReel' as never)
      .mockResolvedValue({
        id: 'reel-1',
        business_id: 'business-1',
        processing_status: 'generating',
      } as never);
    const startGenerationJob = jest
      .spyOn(service as never, 'startGenerationJob' as never)
      .mockResolvedValue(undefined as never);

    await service.generate('user-1', {
      subjectType: 'item',
      subjectId: 'item-1',
      presetId: 'premium',
      marketCountry: 'CM',
    });

    expect(startGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({
          imageUrls: ['https://cdn/original.jpg'],
        }),
      })
    );
  });

  it('rejects generation when the product has no photos', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: false });
    hasura.executeQuery.mockResolvedValue({
      items_by_pk: {
        id: 'item-1',
        business_id: 'business-1',
        name: 'Soap',
        description: null,
        brand: null,
        item_images: [],
      },
    });

    await expect(
      service.generate('user-1', {
        subjectType: 'item',
        subjectId: 'item-1',
        presetId: 'premium',
        marketCountry: 'CM',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tokens.tryReserveTokens).not.toHaveBeenCalled();
  });

  it('refunds reserved tokens only once when two polls see the same failed job', async () => {
    const failedJob = {
      id: 'gen-1',
      reel_id: 'reel-1',
      business_id: 'business-1',
      gemini_operation_name: 'operations/1',
      provider: 'google',
      provider_job_id: 'operations/1',
      generation_tier: 'fast',
      fallback_used: false,
      original_provider: null,
      model: 'veo',
      status: 'running',
      tokens_reserved: 1,
      preset_id: 'premium',
      user_prompt: null,
    };
    hasura.executeQuery.mockResolvedValue({
      reel_ai_generations: [failedJob],
    });
    videoRouter.getJobStatus.mockResolvedValue({
      jobId: 'operations/1',
      status: 'FAILED',
      errorMessage: 'safety filter',
      failureCategory: 'UNKNOWN_PROVIDER_ERROR',
    });
    hasura.executeMutation
      .mockResolvedValueOnce({ update_reels_by_pk: { id: 'reel-1' } })
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 1 },
      })
      .mockResolvedValueOnce({ update_reels_by_pk: { id: 'reel-1' } })
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 0 },
      });

    await service.pollPendingGenerations();
    await service.pollPendingGenerations();

    expect(tokens.refundTokens).toHaveBeenCalledTimes(1);
    expect(tokens.refundTokens).toHaveBeenCalledWith('business-1', 1);
  });

  it('refunds tokens when generation finishes after the merchant cancelled the reel', async () => {
    const runningJob = {
      id: 'gen-1',
      reel_id: 'reel-1',
      business_id: 'business-1',
      gemini_operation_name: 'operations/1',
      provider: 'google',
      provider_job_id: 'operations/1',
      generation_tier: 'fast',
      fallback_used: false,
      original_provider: null,
      model: 'veo',
      status: 'running',
      tokens_reserved: 1,
      preset_id: 'premium',
      user_prompt: null,
    };
    hasura.executeQuery
      .mockResolvedValueOnce({ reel_ai_generations: [runningJob] })
      .mockResolvedValueOnce({
        reels_by_pk: {
          deleted_at: '2026-09-17T00:00:00.000Z',
          moderation_status: 'draft',
        },
      });
    videoRouter.getJobStatus.mockResolvedValue({
      jobId: 'operations/1',
      status: 'COMPLETED',
      videoUri: 'https://veo.example/video.mp4',
    });
    videoRouter.retrieveVideo.mockResolvedValue(Buffer.from('mp4'));
    aws.getS3Client.mockReturnValue({ send: jest.fn().mockResolvedValue({}) });
    config.get.mockImplementation((key: string) => {
      if (key === 'reels') return { bucketName: 'reels-bucket' };
      if (key === 'veo') {
        return {
          tier: 'fast',
          modelOverride: '',
          resolution: '720p',
          durationSeconds: 8,
          aspectRatio: '9:16',
        };
      }
      if (key === 'videoGeneration') {
        return {
          primaryProvider: 'google',
          fallbackProviders: ['runway'],
          enableFallback: true,
        };
      }
      return undefined;
    });
    hasura.executeMutation
      .mockResolvedValueOnce({ update_reels: { affected_rows: 0 } })
      .mockResolvedValueOnce({ update_reels_by_pk: { id: 'reel-1' } })
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 1 },
      });

    await service.pollPendingGenerations();

    expect(mediaQueue.enqueue).not.toHaveBeenCalled();
    expect(tokens.refundTokens).toHaveBeenCalledWith('business-1', 1);
  });

  it('does not overwrite an admin rejection when ingesting a finished job', async () => {
    const runningJob = {
      id: 'gen-1',
      reel_id: 'reel-1',
      business_id: 'business-1',
      gemini_operation_name: 'operations/1',
      provider: 'google',
      provider_job_id: 'operations/1',
      generation_tier: 'standard',
      fallback_used: false,
      original_provider: null,
      model: 'veo',
      status: 'running',
      tokens_reserved: 4,
      preset_id: 'premium',
      user_prompt: null,
    };
    hasura.executeQuery
      .mockResolvedValueOnce({ reel_ai_generations: [runningJob] })
      .mockResolvedValueOnce({
        reels_by_pk: { deleted_at: null, moderation_status: 'rejected' },
      });
    videoRouter.getJobStatus.mockResolvedValue({
      jobId: 'operations/1',
      status: 'COMPLETED',
      videoUri: 'https://veo.example/video.mp4',
    });
    videoRouter.retrieveVideo.mockResolvedValue(Buffer.from('mp4'));
    aws.getS3Client.mockReturnValue({ send: jest.fn().mockResolvedValue({}) });
    config.get.mockImplementation((key: string) => {
      if (key === 'reels') return { bucketName: 'reels-bucket' };
      if (key === 'veo') {
        return {
          tier: 'fast',
          modelOverride: '',
          resolution: '720p',
          durationSeconds: 8,
          aspectRatio: '9:16',
        };
      }
      if (key === 'videoGeneration') {
        return {
          primaryProvider: 'google',
          fallbackProviders: ['runway'],
          enableFallback: true,
        };
      }
      return undefined;
    });
    hasura.executeMutation
      .mockResolvedValueOnce({ update_reels: { affected_rows: 0 } })
      .mockResolvedValueOnce({ update_reels_by_pk: { id: 'reel-1' } })
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 1 },
      });

    await service.pollPendingGenerations();

    expect(mediaQueue.enqueue).not.toHaveBeenCalled();
    expect(tokens.refundTokens).toHaveBeenCalledWith('business-1', 4);
  });

  it('throws payment required when no tokens remain', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: false });
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrls: ['https://cdn/x.jpg'],
      } as never);
    tokens.tryReserveTokens.mockResolvedValue(null);

    await expect(
      service.generate('user-1', {
        subjectType: 'item',
        subjectId: 'item-1',
        presetId: 'premium',
        marketCountry: 'CM',
      })
    ).rejects.toBeInstanceOf(HttpException);

    try {
      await service.generate('user-1', {
        subjectType: 'item',
        subjectId: 'item-1',
        presetId: 'premium',
        marketCountry: 'CM',
      });
    } catch (error: any) {
      expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
    }
  });
});
