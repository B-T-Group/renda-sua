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
      mediaQueue as never
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
        mimeType: 'image/jpeg',
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
        mimeType: 'image/jpeg',
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

    expect(tokens.refundTokens).toHaveBeenCalledWith('business-1', 1);
    expect(tokens.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'business-1',
        operationType: 'refund',
        tokensConsumed: 1,
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

  it('throws payment required when no tokens remain', async () => {
    rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: false });
    jest
      .spyOn(service as never, 'loadProduct' as never)
      .mockResolvedValue({
        name: 'Soap',
        description: null,
        brand: null,
        imageUrl: 'https://cdn/x.jpg',
        mimeType: 'image/jpeg',
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
