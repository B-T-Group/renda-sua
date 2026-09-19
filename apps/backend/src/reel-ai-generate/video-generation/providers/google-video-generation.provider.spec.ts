import { GoogleVideoGenerationProvider } from './google-video-generation.provider';
import { VideoGenerationError } from '../video-generation.error';
import type { GenerateVideoRequest } from '../video-generation.types';
import { VEO_REEL_MODEL_BY_TIER } from '../../veo-reel-model.util';

function makeRequest(
  overrides: Partial<GenerateVideoRequest> = {}
): GenerateVideoRequest {
  return {
    prompt: 'Product ad',
    images: [{ imageBase64: 'abc', mimeType: 'image/jpeg' }],
    durationSeconds: 8,
    aspectRatio: '9:16',
    resolution: '720p',
    tier: 'fast',
    ...overrides,
  };
}

describe('GoogleVideoGenerationProvider', () => {
  const veo = {
    startImageToVideo: jest.fn(),
    getOperation: jest.fn(),
    downloadVideo: jest.fn(),
  };
  const config = {
    get: jest.fn(() => ({ modelOverride: '' })),
  };
  const provider = new GoogleVideoGenerationProvider(
    veo as never,
    config as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue({ modelOverride: '' });
  });

  it('rejects requests without images or with an illegal duration', () => {
    expect(provider.supports(makeRequest({ images: [] }))).toBe(false);
    expect(provider.supports(makeRequest({ durationSeconds: 12 }))).toBe(false);
    expect(provider.supports(makeRequest())).toBe(true);
  });

  it('starts a Veo 3.1 job with allow_adult and returns PROCESSING', async () => {
    veo.startImageToVideo.mockResolvedValue('op-1');

    await expect(provider.submit(makeRequest())).resolves.toEqual({
      jobId: 'op-1',
      provider: 'google',
      providerModel: VEO_REEL_MODEL_BY_TIER.fast,
      tier: 'fast',
      status: 'PROCESSING',
      fallbackUsed: false,
    });
    expect(veo.startImageToVideo).toHaveBeenCalledWith({
      model: VEO_REEL_MODEL_BY_TIER.fast,
      prompt: 'Product ad',
      images: [{ imageBase64: 'abc', mimeType: 'image/jpeg' }],
      aspectRatio: '9:16',
      resolution: '720p',
      durationSeconds: 8,
      personGeneration: 'allow_adult',
    });
  });

  it('uses dont_allow only for non-Veo-3 model overrides', async () => {
    config.get.mockReturnValue({ modelOverride: 'veo-2.0-generate-001' });
    veo.startImageToVideo.mockResolvedValue('op-2');

    await expect(provider.submit(makeRequest())).resolves.toMatchObject({
      jobId: 'op-2',
      providerModel: 'veo-2.0-generate-001',
    });
    expect(veo.startImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'veo-2.0-generate-001',
        personGeneration: 'dont_allow',
      })
    );
  });

  it('throws UNSUPPORTED_CONFIGURATION instead of starting Veo', async () => {
    await expect(
      provider.submit(makeRequest({ images: [] }))
    ).rejects.toBeInstanceOf(VideoGenerationError);
    await expect(
      provider.submit(makeRequest({ images: [] }))
    ).rejects.toMatchObject({
      category: 'UNSUPPORTED_CONFIGURATION',
      provider: 'google',
    });
    expect(veo.startImageToVideo).not.toHaveBeenCalled();
  });

  it('returns PROCESSING while the Veo operation is still running', async () => {
    veo.getOperation.mockResolvedValue({ done: false });

    await expect(provider.getJobStatus('op-1')).resolves.toEqual({
      jobId: 'op-1',
      status: 'PROCESSING',
    });
  });

  it('classifies quota and rate-limit operation errors as retryable', async () => {
    veo.getOperation.mockResolvedValueOnce({
      done: true,
      error: { message: 'resource_exhausted: quota' },
    });
    await expect(provider.getJobStatus('op-1')).resolves.toMatchObject({
      status: 'FAILED',
      failureCategory: 'QUOTA_EXCEEDED',
    });

    veo.getOperation.mockResolvedValueOnce({
      done: true,
      error: { message: 'Too many requests, throttled' },
    });
    await expect(provider.getJobStatus('op-2')).resolves.toMatchObject({
      status: 'FAILED',
      failureCategory: 'RATE_LIMITED',
    });
  });

  it('classifies timeout and unavailable operation errors as retryable', async () => {
    veo.getOperation.mockResolvedValueOnce({
      done: true,
      error: { message: 'Deadline exceeded: timed out' },
    });
    await expect(provider.getJobStatus('op-1')).resolves.toMatchObject({
      failureCategory: 'PROVIDER_UNAVAILABLE',
    });

    veo.getOperation.mockResolvedValueOnce({
      done: true,
      error: { message: 'upstream timeout' },
    });
    await expect(provider.getJobStatus('op-2')).resolves.toMatchObject({
      failureCategory: 'TIMEOUT',
    });
  });

  it('classifies safety and missing-video failures as non-retryable', async () => {
    veo.getOperation.mockResolvedValueOnce({
      done: true,
      error: { message: 'blocked by safety policy' },
    });
    await expect(provider.getJobStatus('op-1')).resolves.toMatchObject({
      status: 'FAILED',
      failureCategory: 'INVALID_REQUEST',
    });

    veo.getOperation.mockResolvedValueOnce({ done: true, videoUri: null });
    await expect(provider.getJobStatus('op-2')).resolves.toMatchObject({
      status: 'FAILED',
      failureCategory: 'UNKNOWN_PROVIDER_ERROR',
      errorMessage: 'Veo generation returned no video',
    });
  });

  it('returns COMPLETED with the video URI when Veo finishes', async () => {
    veo.getOperation.mockResolvedValue({
      done: true,
      videoUri: 'https://veo.example/video.mp4',
    });

    await expect(provider.getJobStatus('op-1')).resolves.toEqual({
      jobId: 'op-1',
      status: 'COMPLETED',
      videoUri: 'https://veo.example/video.mp4',
    });
  });
});
