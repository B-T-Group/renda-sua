import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ReelAiReviewService } from '../reel-ai-review/reel-ai-review.service';
import { ReelMediaService, type ReelMediaResult } from './reel-media.service';

describe('ReelMediaService', () => {
  const hasura = {
    executeMutation: jest.fn(),
    executeQuery: jest.fn(),
  };
  const config = {
    get: jest.fn(() => ({ cloudFrontDomain: 'cdn.example.com' })),
  };
  const aiReview = { requestReview: jest.fn() };
  const merchantNotify = {
    notifyLive: jest.fn(),
    notifyPendingReview: jest.fn(),
    notifyFailed: jest.fn(),
  };

  let service: ReelMediaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReelMediaService(
      hasura as unknown as HasuraSystemService,
      config as unknown as ConfigService<Configuration>,
      aiReview as unknown as ReelAiReviewService,
      merchantNotify as never
    );
  });

  const readyResult: ReelMediaResult = {
    status: 'ready',
    processedS3Key: 'processed/r1.mp4',
    thumbnailS3Key: 'thumbnails/r1.jpg',
    durationMs: 8000,
    width: 720,
    height: 1280,
  };

  it('auto-approves AI-generated reels when media is ready', async () => {
    hasura.executeQuery.mockResolvedValue({
      reels_by_pk: { generation_source: 'ai' },
    });
    hasura.executeMutation.mockResolvedValue({});

    await service.complete('reel-1', readyResult);

    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({
        id: 'reel-1',
        changes: expect.objectContaining({
          processing_status: 'ready',
          video_url: 'https://cdn.example.com/processed/r1.mp4',
        }),
      })
    );
    expect(hasura.executeMutation.mock.calls[0][1].changes).not.toHaveProperty(
      'moderation_status'
    );
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('moderation_status:{_in:[pending,draft]}'),
      expect.objectContaining({
        id: 'reel-1',
        reason: 'Auto-approved AI-generated reel',
      })
    );
    expect(aiReview.requestReview).not.toHaveBeenCalled();
    expect(merchantNotify.notifyLive).toHaveBeenCalledWith('reel-1');
  });

  it('does not auto-approve a rejected AI reel after media completes', async () => {
    hasura.executeQuery.mockResolvedValue({
      reels_by_pk: { generation_source: 'ai' },
    });
    hasura.executeMutation.mockResolvedValue({
      update_reels: { affected_rows: 0 },
    });

    await service.complete('reel-rejected', readyResult);

    const processingChanges = hasura.executeMutation.mock.calls[0][1].changes;
    expect(processingChanges.processing_status).toBe('ready');
    expect(processingChanges).not.toHaveProperty('moderation_status');
    expect(hasura.executeMutation).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('moderation_status:{_in:[pending,draft]}'),
      expect.objectContaining({ id: 'reel-rejected' })
    );
    expect(aiReview.requestReview).not.toHaveBeenCalled();
  });

  it('queues AI review for merchant uploads', async () => {
    hasura.executeQuery.mockResolvedValue({
      reels_by_pk: { generation_source: 'merchant' },
    });
    hasura.executeMutation.mockResolvedValue({});

    await service.complete('reel-2', readyResult);

    expect(hasura.executeMutation).toHaveBeenCalledTimes(1);
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        changes: expect.not.objectContaining({
          moderation_status: 'approved',
        }),
      })
    );
    expect(aiReview.requestReview).toHaveBeenCalledWith('reel-2');
    expect(merchantNotify.notifyPendingReview).toHaveBeenCalledWith('reel-2');
  });
});
