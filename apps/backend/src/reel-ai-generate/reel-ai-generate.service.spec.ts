import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ReelAiGenerateService } from './reel-ai-generate.service';
import { VideoGenerationError } from './video-generation/video-generation.error';

function pendingJob(overrides: Record<string, unknown> = {}) {
  return {
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
    updated_at: '2026-09-18T10:00:00.000Z',
    ...overrides,
  };
}

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
    hasura.executeQuery.mockResolvedValue({
      reel_ai_generations: [pendingJob()],
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
    hasura.executeQuery
      .mockResolvedValueOnce({ reel_ai_generations: [pendingJob()] })
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
    hasura.executeQuery
      .mockResolvedValueOnce({
        reel_ai_generations: [
          pendingJob({ generation_tier: 'standard', tokens_reserved: 4 }),
        ],
      })
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

  it('retries a quota-failed Google job on Runway without refunding', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_ai_generations: [pendingJob()],
    });
    videoRouter.getJobStatus.mockResolvedValue({
      jobId: 'operations/1',
      status: 'FAILED',
      errorMessage: 'quota',
      failureCategory: 'QUOTA_EXCEEDED',
    });
    jest
      .spyOn(service as never, 'rebuildRequestFromRow' as never)
      .mockResolvedValue({ prompt: 'ad' } as never);
    hasura.executeMutation
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 1 },
      })
      .mockResolvedValueOnce({
        update_reel_ai_generations_by_pk: { id: 'gen-1' },
      });
    videoRouter.fallbackAfterPrimaryJobFailure.mockResolvedValue({
      jobId: 'runway-job-1',
      provider: 'runway',
      providerModel: 'gen4_turbo',
      tier: 'fast',
      status: 'QUEUED',
      fallbackUsed: true,
      originalProvider: 'google',
    });

    await service.pollPendingGenerations();

    expect(tokens.refundTokens).not.toHaveBeenCalled();
    expect(videoRouter.fallbackAfterPrimaryJobFailure).toHaveBeenCalledWith({
      request: { prompt: 'ad' },
      originalProvider: 'google',
      failureCategory: 'QUOTA_EXCEEDED',
    });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('original_provider'),
      expect.objectContaining({
        provider: 'runway',
        jobId: 'runway-job-1',
        original: 'google',
      })
    );
  });

  it('does not fail or refund when another sweeper already claimed fallback', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_ai_generations: [pendingJob()],
    });
    videoRouter.getJobStatus.mockResolvedValue({
      jobId: 'operations/1',
      status: 'FAILED',
      failureCategory: 'RATE_LIMITED',
    });
    hasura.executeMutation.mockResolvedValueOnce({
      update_reel_ai_generations: { affected_rows: 0 },
    });

    await service.pollPendingGenerations();

    expect(videoRouter.fallbackAfterPrimaryJobFailure).not.toHaveBeenCalled();
    expect(tokens.refundTokens).not.toHaveBeenCalled();
  });

  it('refunds after a claimed poll-time fallback also fails', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_ai_generations: [pendingJob()],
    });
    videoRouter.getJobStatus.mockResolvedValue({
      jobId: 'operations/1',
      status: 'FAILED',
      errorMessage: 'quota',
      failureCategory: 'QUOTA_EXCEEDED',
    });
    jest
      .spyOn(service as never, 'rebuildRequestFromRow' as never)
      .mockResolvedValue({ prompt: 'ad' } as never);
    videoRouter.fallbackAfterPrimaryJobFailure.mockRejectedValue(
      new Error('runway down')
    );
    hasura.executeMutation
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 1 },
      })
      .mockResolvedValueOnce({ update_reels_by_pk: { id: 'reel-1' } })
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 1 },
      });

    await service.pollPendingGenerations();

    expect(tokens.refundTokens).toHaveBeenCalledWith('business-1', 1);
  });

  it('skips a fresh mid-fallback Google claim so a peer can finish Runway submit', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_ai_generations: [
        pendingJob({
          fallback_used: true,
          updated_at: new Date().toISOString(),
        }),
      ],
    });
    videoRouter.getJobStatus.mockResolvedValue({
      jobId: 'operations/1',
      status: 'FAILED',
      failureCategory: 'TIMEOUT',
    });

    await service.pollPendingGenerations();

    expect(videoRouter.fallbackAfterPrimaryJobFailure).not.toHaveBeenCalled();
    expect(tokens.refundTokens).not.toHaveBeenCalled();
  });

  it('refunds a stale mid-fallback Google claim as an orphaned submit', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_ai_generations: [
        pendingJob({
          fallback_used: true,
          updated_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        }),
      ],
    });
    videoRouter.getJobStatus.mockResolvedValue({
      jobId: 'operations/1',
      status: 'FAILED',
      errorMessage: 'timed out',
      failureCategory: 'TIMEOUT',
    });
    hasura.executeMutation
      .mockResolvedValueOnce({ update_reels_by_pk: { id: 'reel-1' } })
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 1 },
      });

    await service.pollPendingGenerations();

    expect(videoRouter.fallbackAfterPrimaryJobFailure).not.toHaveBeenCalled();
    expect(tokens.refundTokens).toHaveBeenCalledWith('business-1', 1);
  });

  it('refunds a later Runway job failure instead of falling back again', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_ai_generations: [
        pendingJob({
          provider: 'runway',
          provider_job_id: 'runway-job-1',
          fallback_used: true,
        }),
      ],
    });
    videoRouter.getJobStatus.mockResolvedValue({
      jobId: 'runway-job-1',
      status: 'FAILED',
      errorMessage: 'runway failed',
      failureCategory: 'UNKNOWN_PROVIDER_ERROR',
    });
    hasura.executeMutation
      .mockResolvedValueOnce({ update_reels_by_pk: { id: 'reel-1' } })
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 1 },
      });

    await service.pollPendingGenerations();

    expect(videoRouter.getJobStatus).toHaveBeenCalledWith(
      'runway',
      'runway-job-1'
    );
    expect(videoRouter.fallbackAfterPrimaryJobFailure).not.toHaveBeenCalled();
    expect(tokens.refundTokens).toHaveBeenCalledWith('business-1', 1);
  });

  it('does not poll-time fallback when the feature flag is off', async () => {
    const previousImpl = config.get.getMockImplementation();
    config.get.mockImplementation((key: string) => {
      if (key === 'videoGeneration') {
        return {
          primaryProvider: 'google',
          fallbackProviders: ['runway'],
          enableFallback: false,
        };
      }
      return undefined;
    });
    hasura.executeQuery.mockResolvedValueOnce({
      reel_ai_generations: [pendingJob()],
    });
    videoRouter.getJobStatus.mockResolvedValue({
      jobId: 'operations/1',
      status: 'FAILED',
      failureCategory: 'QUOTA_EXCEEDED',
    });
    hasura.executeMutation
      .mockResolvedValueOnce({ update_reels_by_pk: { id: 'reel-1' } })
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 1 },
      });

    try {
      await service.pollPendingGenerations();
      expect(videoRouter.fallbackAfterPrimaryJobFailure).not.toHaveBeenCalled();
      expect(tokens.refundTokens).toHaveBeenCalledWith('business-1', 1);
    } finally {
      if (previousImpl) config.get.mockImplementation(previousImpl);
    }
  });

  it('skips rows that have no provider job id yet', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reel_ai_generations: [
        pendingJob({
          provider_job_id: null,
          gemini_operation_name: null,
        }),
      ],
    });

    await service.pollPendingGenerations();

    expect(videoRouter.getJobStatus).not.toHaveBeenCalled();
    expect(tokens.refundTokens).not.toHaveBeenCalled();
  });

  it('rebuilds a fallback request from the generation row and reel subject', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reels_by_pk: {
        subject_type: 'item',
        subject_id: 'item-1',
        market_country: 'CM',
      },
    });
    const loadProduct = jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: 'Bar soap',
        brand: 'CleanCo',
        imageUrls: ['https://cdn/x.jpg'],
      } as never);
    jest
      .spyOn(service as never, 'fetchImagesForGeneration' as never)
      .mockResolvedValue([
        { imageBase64: 'abc', mimeType: 'image/jpeg' },
      ] as never);

    const request = await (service as any).rebuildRequestFromRow(
      pendingJob({
        user_prompt: 'Make it pop',
        generation_tier: 'standard',
        preset_id: 'premium',
      })
    );

    expect(hasura.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('reels_by_pk'),
      { id: 'reel-1' }
    );
    expect(loadProduct).toHaveBeenCalledWith(
      'business-1',
      expect.objectContaining({
        subjectType: 'item',
        subjectId: 'item-1',
        presetId: 'premium',
        marketCountry: 'CM',
        prompt: 'Make it pop',
      })
    );
    expect(request.tier).toBe('standard');
    expect(request.images).toEqual([
      { imageBase64: 'abc', mimeType: 'image/jpeg' },
    ]);
    expect(request.prompt).toContain('Soap');
    expect(request.prompt).toContain('Make it pop');
    expect(request.metadata).toEqual({
      reelId: 'reel-1',
      businessId: 'business-1',
    });
  });

  it('fails fallback rebuild when the reel row is gone', async () => {
    hasura.executeQuery.mockResolvedValueOnce({ reels_by_pk: null });

    await expect(
      (service as any).rebuildRequestFromRow(pendingJob())
    ).rejects.toThrow('Reel not found for fallback');
  });

  it('defaults a missing generation tier to fast and omits a blank user prompt', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      reels_by_pk: {
        subject_type: 'rental',
        subject_id: 'rental-1',
        market_country: 'GA',
      },
    });
    const loadProduct = jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Drill',
        description: null,
        brand: null,
        imageUrls: ['https://cdn/d.jpg'],
      } as never);
    jest
      .spyOn(service as never, 'fetchImagesForGeneration' as never)
      .mockResolvedValue([
        { imageBase64: 'def', mimeType: 'image/png' },
      ] as never);

    const request = await (service as any).rebuildRequestFromRow(
      pendingJob({
        user_prompt: null,
        generation_tier: null,
        preset_id: 'unknown-legacy',
      })
    );

    expect(loadProduct).toHaveBeenCalledWith(
      'business-1',
      expect.objectContaining({
        subjectType: 'rental',
        subjectId: 'rental-1',
        prompt: undefined,
      })
    );
    expect(request.tier).toBe('fast');
    expect(request.prompt).toContain('Drill');
    expect(request.prompt).not.toContain('unknown-legacy');
  });
});

describe('ReelAiGenerateService.generatePlatformSponsored', () => {
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

  let service: ReelAiGenerateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReelAiGenerateService(
      hasura as never,
      config as never,
      { getS3Client: jest.fn(), getBucketName: jest.fn() } as never,
      { getEffectiveAccess: jest.fn() } as never,
      tokens as never,
      videoRouter as never,
      { enqueue: jest.fn() } as never,
      { notifyFailed: jest.fn() } as never
    );
  });

  it('skips token debit and sets platform_sponsored', async () => {
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrls: ['https://cdn/x.jpg'],
      } as never);
    hasura.executeMutation.mockResolvedValueOnce({
      insert_reels_one: {
        id: 'reel-sponsored',
        business_id: 'business-1',
        processing_status: 'generating',
      },
    });
    const startGenerationJob = jest
      .spyOn(service as never, 'startGenerationJob' as never)
      .mockResolvedValue(undefined as never);

    await service.generatePlatformSponsored({
      businessId: 'business-1',
      subjectId: 'item-1',
      marketCountry: 'cm',
    });

    expect(tokens.tryReserveTokens).not.toHaveBeenCalled();
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('insert_reels_one'),
      expect.objectContaining({
        object: expect.objectContaining({
          platform_sponsored: true,
          generation_source: 'ai',
          prompt_preset: 'dynamic',
          market_country: 'CM',
        }),
      })
    );
    expect(startGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tokensReserved: 0,
        tier: 'fast',
      })
    );
  });

  it('marks the reel failed without refunding tokens when start throws', async () => {
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrls: ['https://cdn/x.jpg'],
      } as never);
    hasura.executeMutation
      .mockResolvedValueOnce({
        insert_reels_one: {
          id: 'reel-sponsored',
          business_id: 'business-1',
          processing_status: 'generating',
        },
      })
      .mockResolvedValueOnce({ update_reels_by_pk: { id: 'reel-sponsored' } })
      .mockResolvedValueOnce({
        update_reel_ai_generations: { affected_rows: 1 },
      });
    jest
      .spyOn(service as never, 'startGenerationJob' as never)
      .mockRejectedValue(
        new VideoGenerationError({
          message: 'quota',
          category: 'QUOTA_EXCEEDED',
          provider: 'google',
        })
      );

    try {
      await service.generatePlatformSponsored({
        businessId: 'business-1',
        subjectId: 'item-1',
        marketCountry: 'CM',
      });
      throw new Error('expected generatePlatformSponsored to reject');
    } catch (error: any) {
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
    expect(tokens.refundTokens).not.toHaveBeenCalled();
    expect(tokens.tryReserveTokens).not.toHaveBeenCalled();
  });
});
