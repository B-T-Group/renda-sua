import { UnauthorizedException } from '@nestjs/common';
import { ReelAiReviewInternalController } from './reel-ai-review-internal.controller';

describe('ReelAiReviewInternalController', () => {
  const review = {
    runReview: jest.fn(),
  };
  const config = {
    get: jest.fn(),
  };
  let controller: ReelAiReviewInternalController;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue({ apiKey: 'internal-secret' });
    review.runReview.mockResolvedValue({ status: 'approved' });
    controller = new ReelAiReviewInternalController(
      review as never,
      config as never
    );
  });

  it('rejects a missing internal key', () => {
    expect(() => controller.run('reel-1', {}, undefined)).toThrow(
      UnauthorizedException
    );
    expect(review.runReview).not.toHaveBeenCalled();
  });

  it('rejects a wrong internal key', () => {
    expect(() => controller.run('reel-1', {}, 'wrong')).toThrow(
      UnauthorizedException
    );
    expect(review.runReview).not.toHaveBeenCalled();
  });

  it('rejects when the configured internal key is empty', () => {
    config.get.mockReturnValue({ apiKey: '' });
    expect(() => controller.run('reel-1', {}, 'internal-secret')).toThrow(
      UnauthorizedException
    );
    expect(review.runReview).not.toHaveBeenCalled();
  });

  it('rejects when the internal key is not configured', () => {
    config.get.mockReturnValue(undefined);
    expect(() => controller.run('reel-1', {}, 'internal-secret')).toThrow(
      UnauthorizedException
    );
    expect(review.runReview).not.toHaveBeenCalled();
  });

  it('runs review with version 1 when the body omits reviewVersion', async () => {
    await expect(
      controller.run('reel-1', {}, 'internal-secret')
    ).resolves.toEqual({ status: 'approved' });
    expect(config.get).toHaveBeenCalledWith('notificationsInternal');
    expect(review.runReview).toHaveBeenCalledWith('reel-1', 1);
  });

  it('forwards an explicit reviewVersion and treats 0 as the default', async () => {
    await controller.run('reel-1', { reviewVersion: 3 }, 'internal-secret');
    expect(review.runReview).toHaveBeenCalledWith('reel-1', 3);

    review.runReview.mockClear();
    await controller.run('reel-1', { reviewVersion: 0 }, 'internal-secret');
    expect(review.runReview).toHaveBeenCalledWith('reel-1', 1);
  });
});
