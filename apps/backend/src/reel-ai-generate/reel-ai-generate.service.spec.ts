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
          tier: 'lite',
          modelOverride: '',
          resolution: '720p',
          durationSeconds: 8,
          aspectRatio: '9:16',
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
  const veo = {
    startImageToVideo: jest.fn(),
    getOperation: jest.fn(),
    downloadVideo: jest.fn(),
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
      veo as never,
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
        imageUrl: 'https://cdn/x.jpg',
      } as never);
    jest
      .spyOn(service as never, 'insertGeneratingReel' as never)
      .mockResolvedValue({
        id: 'reel-1',
        business_id: 'business-1',
        processing_status: 'generating',
      } as never);
    jest
      .spyOn(service as never, 'startVeoJob' as never)
      .mockResolvedValue(undefined as never);

    await service.generate('user-1', {
      subjectType: 'item',
      subjectId: 'item-1',
      presetId: 'product_centered',
      marketCountry: 'CM',
    });

    expect(tokens.tryReserveTokens).not.toHaveBeenCalled();
    expect(service['assertDailyQuota']).toHaveBeenCalledWith(
      'business-1',
      true
    );
  });

  it('refunds reserved tokens when reel insert fails', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: false });
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrl: 'https://cdn/x.jpg',
      } as never);
    tokens.tryReserveTokens.mockResolvedValue(0);
    jest
      .spyOn(service as never, 'insertGeneratingReel' as never)
      .mockRejectedValue(new Error('insert failed'));

    await expect(
      service.generate('user-1', {
        subjectType: 'item',
        subjectId: 'item-1',
        presetId: 'product_centered',
        marketCountry: 'CM',
      })
    ).rejects.toThrow('insert failed');

    expect(tokens.refundTokens).toHaveBeenCalledWith('business-1', 2);
    expect(tokens.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'business-1',
        operationType: 'refund',
        tokensConsumed: 2,
      })
    );
  });

  it('debits two tokens for default fast with audio', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: false });
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrl: 'https://cdn/x.jpg',
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
      .spyOn(service as never, 'startVeoJob' as never)
      .mockResolvedValue(undefined as never);

    await service.generate('user-1', {
      subjectType: 'item',
      subjectId: 'item-1',
      presetId: 'product_centered',
      marketCountry: 'CM',
    });

    expect(tokens.tryReserveTokens).toHaveBeenCalledWith('business-1', 2);
  });

  it('charges lite tier tokens for non-superusers', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: false });
    tokens.tryReserveTokens.mockResolvedValue(0);
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrl: 'https://cdn/x.jpg',
      } as never);
    jest
      .spyOn(service as never, 'insertGeneratingReel' as never)
      .mockResolvedValue({
        id: 'reel-1',
        business_id: 'business-1',
        processing_status: 'generating',
      } as never);
    jest
      .spyOn(service as never, 'fetchImageForVeo' as never)
      .mockResolvedValue({
        imageBase64: 'abc',
        mimeType: 'image/jpeg',
      } as never);
    jest
      .spyOn(service as never, 'insertGenerationRow' as never)
      .mockResolvedValue(undefined as never);
    veo.startImageToVideo.mockResolvedValue('operations/1');

    await service.generate('user-1', {
      subjectType: 'item',
      subjectId: 'item-1',
      presetId: 'product_centered',
      marketCountry: 'CM',
      tier: 'lite',
    });

    expect(tokens.tryReserveTokens).toHaveBeenCalledWith('business-1', 1);
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
    const startVeoJob = jest
      .spyOn(service as never, 'startVeoJob' as never)
      .mockResolvedValue(undefined as never);

    await service.generate('user-1', {
      subjectType: 'item',
      subjectId: 'item-1',
      presetId: 'product_centered',
      marketCountry: 'CM',
    });

    expect(startVeoJob).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({
          imageUrl: 'https://cdn/original.jpg',
        }),
      })
    );
  });

  it('sends allow_adult to Veo 3.1 even for no-people presets', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: true });
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrl: 'https://cdn/x.jpg',
      } as never);
    jest
      .spyOn(service as never, 'insertGeneratingReel' as never)
      .mockResolvedValue({
        id: 'reel-1',
        business_id: 'business-1',
        processing_status: 'generating',
      } as never);
    jest
      .spyOn(service as never, 'fetchImageForVeo' as never)
      .mockResolvedValue({
        imageBase64: 'abc',
        mimeType: 'image/jpeg',
      } as never);
    jest
      .spyOn(service as never, 'insertGenerationRow' as never)
      .mockResolvedValue(undefined as never);
    veo.startImageToVideo.mockResolvedValue('operations/1');

    await service.generate('user-1', {
      subjectType: 'item',
      subjectId: 'item-1',
      presetId: 'product_centered',
      marketCountry: 'CM',
      tier: 'lite',
    });

    expect(veo.startImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        personGeneration: 'allow_adult',
        model: 'veo-3.1-lite-generate-preview',
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
        presetId: 'product_centered',
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
      model: 'veo',
      status: 'running',
      tokens_reserved: 1,
    };
    hasura.executeQuery.mockResolvedValue({
      reel_ai_generations: [failedJob],
    });
    veo.getOperation.mockResolvedValue({
      done: true,
      error: { message: 'safety filter' },
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

  it('throws payment required when no tokens remain', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: false });
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrl: 'https://cdn/x.jpg',
      } as never);
    tokens.tryReserveTokens.mockResolvedValue(null);

    try {
      await service.generate('user-1', {
        subjectType: 'item',
        subjectId: 'item-1',
        presetId: 'product_centered',
        marketCountry: 'CM',
      });
      fail('expected payment required');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
    }
  });
});
