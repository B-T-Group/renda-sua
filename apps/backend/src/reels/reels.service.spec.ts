import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReelsService } from './reels.service';

describe('ReelsService.retryProcessing', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const mediaQueue = { enqueue: jest.fn() };
  const config = { get: jest.fn() };
  const aws = {};

  let service: ReelsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReelsService(
      hasura as never,
      aws as never,
      config as never,
      mediaQueue as never
    );
  });

  it('requeues a failed AI reel', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses: [{ id: 'biz-1', reels_enabled_allowlist: true }],
      })
      .mockResolvedValueOnce({
        reels_by_pk: {
          id: 'reel-1',
          business_id: 'biz-1',
          source_s3_key: 'source/biz-1/reel-1/veo.mp4',
          moderation_status: 'pending',
          processing_status: 'failed',
          generation_source: 'ai',
          processing_error: 'ffprobe missing',
        },
      });
    hasura.executeMutation.mockResolvedValue({});
    mediaQueue.enqueue.mockResolvedValue(undefined);

    const result = await service.retryProcessing('user-1', 'reel-1');

    expect(mediaQueue.enqueue).toHaveBeenCalledWith(
      'reel-1',
      'source/biz-1/reel-1/veo.mp4',
      'ai'
    );
    expect(result.processing_status).toBe('queued');
  });

  it('rejects retry when source media is missing', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses: [{ id: 'biz-1', reels_enabled_allowlist: true }],
      })
      .mockResolvedValueOnce({
        reels_by_pk: {
          id: 'reel-1',
          business_id: 'biz-1',
          source_s3_key: null,
          moderation_status: 'pending',
          processing_status: 'failed',
          generation_source: 'ai',
        },
      });

    await expect(service.retryProcessing('user-1', 'reel-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(mediaQueue.enqueue).not.toHaveBeenCalled();
  });

  it('rejects retry when the reel was rejected', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses: [{ id: 'biz-1', reels_enabled_allowlist: true }],
      })
      .mockResolvedValueOnce({
        reels_by_pk: {
          id: 'reel-1',
          business_id: 'biz-1',
          source_s3_key: 'source/biz-1/reel-1/veo.mp4',
          moderation_status: 'rejected',
          processing_status: 'failed',
          generation_source: 'ai',
        },
      });

    await expect(service.retryProcessing('user-1', 'reel-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(mediaQueue.enqueue).not.toHaveBeenCalled();
  });

  it('rejects retry when not failed', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses: [{ id: 'biz-1', reels_enabled_allowlist: true }],
      })
      .mockResolvedValueOnce({
        reels_by_pk: {
          id: 'reel-1',
          business_id: 'biz-1',
          source_s3_key: 'source/x.mp4',
          moderation_status: 'pending',
          processing_status: 'ready',
          generation_source: 'merchant',
        },
      });

    await expect(service.retryProcessing('user-1', 'reel-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(mediaQueue.enqueue).not.toHaveBeenCalled();
  });
});

describe('ReelsService merchant gates', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const mediaQueue = { enqueue: jest.fn() };
  const config = { get: jest.fn(() => ({ dailyQuota: 10 })) };
  const aws = {};
  let service: ReelsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReelsService(
      hasura as never,
      aws as never,
      config as never,
      mediaQueue as never
    );
  });

  it('rejects create when the merchant is not allowlisted', async () => {
    hasura.executeQuery.mockResolvedValueOnce({
      businesses: [{ id: 'biz-1', reels_enabled_allowlist: false }],
    });

    await expect(
      service.create('user-1', {
        subjectType: 'item',
        subjectId: 'item-1',
        marketCountry: 'CM',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects create when the item belongs to another business', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses: [{ id: 'biz-1', reels_enabled_allowlist: true }],
      })
      .mockResolvedValueOnce({
        reels_aggregate: { aggregate: { count: 0 } },
      })
      .mockResolvedValueOnce({
        subject: { id: 'item-1', business_id: 'other-biz' },
      });

    await expect(
      service.create('user-1', {
        subjectType: 'item',
        subjectId: 'item-1',
        marketCountry: 'cm',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects editing an approved reel', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses: [{ id: 'biz-1', reels_enabled_allowlist: true }],
      })
      .mockResolvedValueOnce({
        reels_by_pk: {
          id: 'reel-1',
          business_id: 'biz-1',
          moderation_status: 'approved',
        },
      });

    await expect(
      service.update('user-1', 'reel-1', { caption: 'New' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('rejects deleting a pending reel', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses: [{ id: 'biz-1', reels_enabled_allowlist: true }],
      })
      .mockResolvedValueOnce({
        reels_by_pk: {
          id: 'reel-1',
          business_id: 'biz-1',
          moderation_status: 'pending',
        },
      });

    await expect(service.delete('user-1', 'reel-1')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('hides another merchant reel as not found', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses: [{ id: 'biz-1', reels_enabled_allowlist: true }],
      })
      .mockResolvedValueOnce({
        reels_by_pk: {
          id: 'reel-1',
          business_id: 'other-biz',
          moderation_status: 'draft',
        },
      });

    await expect(service.delete('user-1', 'reel-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

describe('ReelsService.setActive', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const mediaQueue = { enqueue: jest.fn() };
  const config = { get: jest.fn() };
  const aws = {};
  let service: ReelsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ReelsService(
      hasura as never,
      aws as never,
      config as never,
      mediaQueue as never
    );
  });

  function mockOwnedLiveReel() {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses: [{ id: 'biz-1', reels_enabled_allowlist: true }],
      })
      .mockResolvedValueOnce({
        reels_by_pk: {
          id: 'reel-1',
          business_id: 'biz-1',
          moderation_status: 'approved',
          processing_status: 'ready',
          is_active: true,
          subject_type: 'item',
          subject_id: 'item-1',
        },
      });
  }

  it('hides an approved ready reel without changing moderation', async () => {
    mockOwnedLiveReel();
    hasura.executeQuery
      .mockResolvedValueOnce({ rows: [{ id: 'item-1', name: 'Soap' }] })
      .mockResolvedValueOnce({ rows: [] });
    hasura.executeMutation.mockResolvedValue({
      update_reels_by_pk: {
        id: 'reel-1',
        business_id: 'biz-1',
        subject_type: 'item',
        subject_id: 'item-1',
        moderation_status: 'approved',
        processing_status: 'ready',
        is_active: false,
      },
    });

    const result = await service.setActive('user-1', 'reel-1', {
      isActive: false,
    });

    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('is_active'),
      expect.objectContaining({ isActive: false })
    );
    expect(result.is_active).toBe(false);
    expect(result.subject_title).toBe('Soap');
  });

  it('rejects toggling a non-live reel', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        businesses: [{ id: 'biz-1', reels_enabled_allowlist: true }],
      })
      .mockResolvedValueOnce({
        reels_by_pk: {
          id: 'reel-1',
          business_id: 'biz-1',
          moderation_status: 'pending',
          processing_status: 'processing',
          is_active: true,
        },
      });

    await expect(
      service.setActive('user-1', 'reel-1', { isActive: false })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });
});

