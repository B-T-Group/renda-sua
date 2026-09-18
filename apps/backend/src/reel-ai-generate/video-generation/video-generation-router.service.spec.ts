import { VideoGenerationError } from './video-generation.error';
import { VideoGenerationRouter } from './video-generation-router.service';
import type { GenerateVideoRequest } from './video-generation.types';
import type { VideoGenerationProvider } from './video-generation-provider.interface';

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
    metadata: { reelId: 'reel-1', businessId: 'biz-1' },
    ...overrides,
  };
}

function makeProvider(
  id: 'google' | 'runway',
  model: string
): jest.Mocked<VideoGenerationProvider> {
  return {
    id,
    supports: jest.fn().mockReturnValue(true),
    submit: jest.fn().mockResolvedValue({
      jobId: `${id}-job-1`,
      provider: id,
      providerModel: model,
      tier: 'fast',
      status: id === 'google' ? 'PROCESSING' : 'QUEUED',
      fallbackUsed: false,
    }),
    getJobStatus: jest.fn(),
    retrieveVideo: jest.fn(),
    getMetadata: jest.fn().mockReturnValue({
      id,
      modelsByTier: {
        fast: model,
        standard: model,
      },
    }),
  };
}

describe('VideoGenerationRouter', () => {
  const google = makeProvider('google', 'veo-3.1-fast-generate-preview');
  const runway = makeProvider('runway', 'gen4_turbo');
  const defaultVideoGeneration = {
    primaryProvider: 'google',
    fallbackProviders: ['runway'],
    enableFallback: true,
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'videoGeneration') return { ...defaultVideoGeneration };
      return undefined;
    }),
  };

  let router: VideoGenerationRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string) => {
      if (key === 'videoGeneration') return { ...defaultVideoGeneration };
      return undefined;
    });
    google.supports.mockReturnValue(true);
    runway.supports.mockReturnValue(true);
    google.submit.mockImplementation(async (req) => ({
      jobId: 'google-job-1',
      provider: 'google' as const,
      providerModel: 'veo-3.1-fast-generate-preview',
      tier: req.tier,
      status: 'PROCESSING' as const,
      fallbackUsed: false,
    }));
    runway.submit.mockImplementation(async (req) => ({
      jobId: 'runway-job-1',
      provider: 'runway' as const,
      providerModel: 'gen4_turbo',
      tier: req.tier,
      status: 'QUEUED' as const,
      fallbackUsed: false,
    }));
    router = new VideoGenerationRouter(
      config as never,
      google as never,
      runway as never
    );
  });

  it('1. Google provider successfully generates a video job', async () => {
    const response = await router.submit(makeRequest());
    expect(response.provider).toBe('google');
    expect(response.jobId).toBe('google-job-1');
    expect(response.providerModel).toBe('veo-3.1-fast-generate-preview');
  });

  it('2. Runway provider successfully generates a video job', async () => {
    const response = await runway.submit(makeRequest());
    expect(response.provider).toBe('runway');
    expect(response.jobId).toBe('runway-job-1');
    expect(response.providerModel).toBe('gen4_turbo');
  });

  it('3. Google succeeds → Runway is never called', async () => {
    await router.submit(makeRequest());
    expect(google.submit).toHaveBeenCalledTimes(1);
    expect(runway.submit).not.toHaveBeenCalled();
  });

  it('4. Google quota exceeded → Runway is called', async () => {
    google.submit.mockRejectedValue(
      new VideoGenerationError({
        message: 'quota',
        category: 'QUOTA_EXCEEDED',
        provider: 'google',
      })
    );

    const response = await router.submit(makeRequest());

    expect(runway.submit).toHaveBeenCalledTimes(1);
    expect(response.provider).toBe('runway');
    expect(response.fallbackUsed).toBe(true);
    expect(response.originalProvider).toBe('google');
  });

  it('5. Google rate limited → Runway is called', async () => {
    google.submit.mockRejectedValue(
      new VideoGenerationError({
        message: 'rate limit',
        category: 'RATE_LIMITED',
        provider: 'google',
      })
    );

    const response = await router.submit(makeRequest());

    expect(runway.submit).toHaveBeenCalledTimes(1);
    expect(response.fallbackUsed).toBe(true);
  });

  it('6. Google invalid request → Runway is NOT called', async () => {
    google.submit.mockRejectedValue(
      new VideoGenerationError({
        message: 'bad image',
        category: 'INVALID_REQUEST',
        provider: 'google',
      })
    );

    await expect(router.submit(makeRequest())).rejects.toMatchObject({
      category: 'INVALID_REQUEST',
      retryable: false,
    });
    expect(runway.submit).not.toHaveBeenCalled();
  });

  it('7. Google authentication error → Runway is NOT called', async () => {
    google.submit.mockRejectedValue(
      new VideoGenerationError({
        message: 'missing key',
        category: 'AUTHENTICATION_ERROR',
        provider: 'google',
      })
    );

    await expect(router.submit(makeRequest())).rejects.toMatchObject({
      category: 'AUTHENTICATION_ERROR',
      retryable: false,
    });
    expect(runway.submit).not.toHaveBeenCalled();
  });

  it('8. Runway failure is normalized correctly', async () => {
    google.submit.mockRejectedValue(
      new VideoGenerationError({
        message: 'quota',
        category: 'QUOTA_EXCEEDED',
        provider: 'google',
      })
    );
    runway.submit.mockRejectedValue(
      new VideoGenerationError({
        message: 'runway down',
        category: 'PROVIDER_UNAVAILABLE',
        provider: 'runway',
      })
    );

    await expect(router.submit(makeRequest())).rejects.toMatchObject({
      category: 'PROVIDER_UNAVAILABLE',
      provider: 'runway',
      retryable: true,
    });
  });

  it('9. Provider-specific errors do not leak into the application layer', async () => {
    google.submit.mockRejectedValue(
      new VideoGenerationError({
        message: 'resource_exhausted',
        category: 'QUOTA_EXCEEDED',
        provider: 'google',
      })
    );

    const response = await router.submit(makeRequest());

    expect(response).toEqual(
      expect.objectContaining({
        jobId: expect.any(String),
        provider: 'runway',
        providerModel: expect.any(String),
        tier: 'fast',
        status: expect.stringMatching(/QUEUED|PROCESSING/),
        fallbackUsed: true,
      })
    );
    expect(JSON.stringify(response)).not.toContain('predictLongRunning');
    expect(JSON.stringify(response)).not.toContain('promptImage');
  });

  it('10. Same request produces the same normalized response shape from both providers', async () => {
    const googleResponse = await google.submit(makeRequest());
    const runwayResponse = await runway.submit(makeRequest());

    expect(Object.keys(googleResponse).sort()).toEqual(
      Object.keys(runwayResponse).sort()
    );
    for (const key of [
      'jobId',
      'provider',
      'providerModel',
      'tier',
      'status',
      'fallbackUsed',
    ]) {
      expect(googleResponse).toHaveProperty(key);
      expect(runwayResponse).toHaveProperty(key);
    }
  });

  it('11. Fallback metadata is returned for persistence', async () => {
    google.submit.mockRejectedValue(
      new VideoGenerationError({
        message: 'busy',
        category: 'RATE_LIMITED',
        provider: 'google',
      })
    );

    const response = await router.submit(makeRequest({ tier: 'standard' }));

    expect(response).toMatchObject({
      provider: 'runway',
      fallbackUsed: true,
      originalProvider: 'google',
      tier: 'standard',
    });
  });

  it('does not fall back when enableFallback is false', async () => {
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
    router = new VideoGenerationRouter(
      config as never,
      google as never,
      runway as never
    );
    google.submit.mockRejectedValue(
      new VideoGenerationError({
        message: 'quota',
        category: 'QUOTA_EXCEEDED',
        provider: 'google',
      })
    );

    await expect(router.submit(makeRequest())).rejects.toMatchObject({
      category: 'QUOTA_EXCEEDED',
    });
    expect(runway.submit).not.toHaveBeenCalled();
  });

  it('wraps unknown primary errors as UNKNOWN_PROVIDER_ERROR without fallback', async () => {
    google.submit.mockRejectedValue(new Error('socket hang up'));

    await expect(router.submit(makeRequest())).rejects.toMatchObject({
      category: 'UNKNOWN_PROVIDER_ERROR',
      provider: 'google',
      retryable: false,
    });
    expect(runway.submit).not.toHaveBeenCalled();
  });

  it('does not fall back when Runway does not support the request', async () => {
    google.submit.mockRejectedValue(
      new VideoGenerationError({
        message: 'quota',
        category: 'QUOTA_EXCEEDED',
        provider: 'google',
      })
    );
    runway.supports.mockReturnValue(false);

    await expect(router.submit(makeRequest())).rejects.toMatchObject({
      category: 'QUOTA_EXCEEDED',
      provider: 'google',
    });
    expect(runway.submit).not.toHaveBeenCalled();
  });

  it('falls back after a completed primary job fails', async () => {
    const response = await router.fallbackAfterPrimaryJobFailure({
      request: makeRequest(),
      originalProvider: 'google',
      failureCategory: 'QUOTA_EXCEEDED',
    });

    expect(google.submit).not.toHaveBeenCalled();
    expect(runway.submit).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({
      provider: 'runway',
      fallbackUsed: true,
      originalProvider: 'google',
    });
  });

  it('throws when poll-time fallback is disabled', async () => {
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
    router = new VideoGenerationRouter(
      config as never,
      google as never,
      runway as never
    );

    await expect(
      router.fallbackAfterPrimaryJobFailure({
        request: makeRequest(),
        originalProvider: 'google',
        failureCategory: 'RATE_LIMITED',
      })
    ).rejects.toMatchObject({
      category: 'PROVIDER_UNAVAILABLE',
      message: 'Video generation fallback is disabled',
    });
    expect(runway.submit).not.toHaveBeenCalled();
  });

  it('throws when no other fallback provider is configured', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'videoGeneration') {
        return {
          primaryProvider: 'google',
          fallbackProviders: ['google'],
          enableFallback: true,
        };
      }
      return undefined;
    });
    router = new VideoGenerationRouter(
      config as never,
      google as never,
      runway as never
    );

    await expect(
      router.fallbackAfterPrimaryJobFailure({
        request: makeRequest(),
        originalProvider: 'google',
        failureCategory: 'TIMEOUT',
      })
    ).rejects.toMatchObject({
      category: 'PROVIDER_UNAVAILABLE',
      message: 'No fallback video provider configured',
    });
  });

  it('throws when the fallback provider rejects the configuration', async () => {
    runway.supports.mockReturnValue(false);

    await expect(
      router.fallbackAfterPrimaryJobFailure({
        request: makeRequest(),
        originalProvider: 'google',
        failureCategory: 'PROVIDER_UNAVAILABLE',
      })
    ).rejects.toMatchObject({
      category: 'UNSUPPORTED_CONFIGURATION',
      provider: 'runway',
    });
    expect(runway.submit).not.toHaveBeenCalled();
  });

  it('treats an unknown primary provider id as google', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'videoGeneration') {
        return {
          primaryProvider: 'not-a-vendor',
          fallbackProviders: ['runway'],
          enableFallback: true,
        };
      }
      return undefined;
    });
    router = new VideoGenerationRouter(
      config as never,
      google as never,
      runway as never
    );

    const response = await router.submit(makeRequest());

    expect(response.provider).toBe('google');
    expect(google.submit).toHaveBeenCalledTimes(1);
  });
});
