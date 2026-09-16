import { BadRequestException } from '@nestjs/common';
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
