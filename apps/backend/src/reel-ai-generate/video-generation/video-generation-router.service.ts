import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../config/configuration';
import type { VideoGenerationProvider } from './video-generation-provider.interface';
import { VIDEO_GENERATION_EVENTS } from './video-generation-events';
import {
  isVideoGenerationError,
  VideoGenerationError,
} from './video-generation.error';
import type {
  GenerateVideoRequest,
  GenerateVideoResponse,
  VideoGenerationProviderId,
  VideoGenerationRoutingConfig,
  VideoJobStatus,
} from './video-generation.types';
import { GoogleVideoGenerationProvider } from './providers/google-video-generation.provider';
import { RunwayVideoGenerationProvider } from './providers/runway-video-generation.provider';

@Injectable()
export class VideoGenerationRouter {
  private readonly logger = new Logger(VideoGenerationRouter.name);
  private readonly providers: Map<
    VideoGenerationProviderId,
    VideoGenerationProvider
  >;

  constructor(
    private readonly config: ConfigService<Configuration>,
    google: GoogleVideoGenerationProvider,
    runway: RunwayVideoGenerationProvider
  ) {
    this.providers = new Map<
      VideoGenerationProviderId,
      VideoGenerationProvider
    >([
      ['google', google],
      ['runway', runway],
    ]);
  }

  getProvider(id: VideoGenerationProviderId): VideoGenerationProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new VideoGenerationError({
        message: `Unknown video generation provider: ${id}`,
        category: 'UNSUPPORTED_CONFIGURATION',
        provider: 'google',
      });
    }
    return provider;
  }

  async submit(request: GenerateVideoRequest): Promise<GenerateVideoResponse> {
    const routing = this.getRoutingConfig();
    this.logEvent(VIDEO_GENERATION_EVENTS.REQUESTED, {
      tier: request.tier,
      primaryProvider: routing.primaryProvider,
      enableFallback: routing.enableFallback,
      reelId: request.metadata?.reelId,
    });
    const primary = this.requireProvider(routing.primaryProvider);
    this.logEvent(VIDEO_GENERATION_EVENTS.PROVIDER_SELECTED, {
      provider: primary.id,
      tier: request.tier,
      reelId: request.metadata?.reelId,
    });
    try {
      return await this.submitWithProvider(primary, request, false);
    } catch (error: any) {
      return this.tryFallback(request, routing, primary.id, error);
    }
  }

  async getJobStatus(
    providerId: VideoGenerationProviderId,
    jobId: string
  ): Promise<VideoJobStatus> {
    return this.getProvider(providerId).getJobStatus(jobId);
  }

  async retrieveVideo(
    providerId: VideoGenerationProviderId,
    videoUri: string
  ): Promise<Buffer> {
    return this.getProvider(providerId).retrieveVideo(videoUri);
  }

  /**
   * Submit-time fallback already attempted. Used when a completed primary job
   * fails with a retryable category and no fallback was used yet.
   */
  async fallbackAfterPrimaryJobFailure(params: {
    request: GenerateVideoRequest;
    originalProvider: VideoGenerationProviderId;
    failureCategory: string;
  }): Promise<GenerateVideoResponse> {
    const routing = this.getRoutingConfig();
    if (!routing.enableFallback) {
      throw new VideoGenerationError({
        message: 'Video generation fallback is disabled',
        category: 'PROVIDER_UNAVAILABLE',
        provider: params.originalProvider,
      });
    }
    const fallbackId = routing.fallbackProviders.find(
      (id) => id !== params.originalProvider
    );
    if (!fallbackId) {
      throw new VideoGenerationError({
        message: 'No fallback video provider configured',
        category: 'PROVIDER_UNAVAILABLE',
        provider: params.originalProvider,
      });
    }
    const fallback = this.requireProvider(fallbackId);
    if (!fallback.supports(params.request)) {
      throw new VideoGenerationError({
        message: 'Fallback provider does not support this configuration',
        category: 'UNSUPPORTED_CONFIGURATION',
        provider: fallback.id,
      });
    }
    this.logEvent(VIDEO_GENERATION_EVENTS.PROVIDER_FALLBACK, {
      tier: params.request.tier,
      primaryProvider: params.originalProvider,
      primaryFailureCategory: params.failureCategory,
      fallbackProvider: fallback.id,
      fallbackModel: fallback.getMetadata().modelsByTier[params.request.tier],
      reelId: params.request.metadata?.reelId,
    });
    const response = await this.submitWithProvider(
      fallback,
      params.request,
      true,
      params.originalProvider
    );
    return response;
  }

  private async tryFallback(
    request: GenerateVideoRequest,
    routing: VideoGenerationRoutingConfig,
    primaryId: VideoGenerationProviderId,
    error: unknown
  ): Promise<GenerateVideoResponse> {
    const videoError = this.asVideoError(error, primaryId);
    if (!videoError.retryable || !routing.enableFallback) {
      this.logEvent(VIDEO_GENERATION_EVENTS.FAILED, {
        provider: primaryId,
        category: videoError.category,
        retryable: videoError.retryable,
        reelId: request.metadata?.reelId,
      });
      throw videoError;
    }
    const fallbackId = routing.fallbackProviders.find((id) => id !== primaryId);
    if (!fallbackId) {
      throw videoError;
    }
    const fallback = this.providers.get(fallbackId);
    if (!fallback?.supports(request)) {
      throw videoError;
    }
    this.logEvent(VIDEO_GENERATION_EVENTS.PROVIDER_FALLBACK, {
      tier: request.tier,
      primaryProvider: primaryId,
      primaryModel: this.providers
        .get(primaryId)
        ?.getMetadata().modelsByTier[request.tier],
      primaryFailureCategory: videoError.category,
      fallbackProvider: fallback.id,
      fallbackModel: fallback.getMetadata().modelsByTier[request.tier],
      reelId: request.metadata?.reelId,
    });
    try {
      return await this.submitWithProvider(
        fallback,
        request,
        true,
        primaryId
      );
    } catch (fallbackError: any) {
      const mapped = this.asVideoError(fallbackError, fallback.id);
      this.logEvent(VIDEO_GENERATION_EVENTS.FAILED, {
        provider: fallback.id,
        category: mapped.category,
        originalProvider: primaryId,
        reelId: request.metadata?.reelId,
      });
      throw mapped;
    }
  }

  private async submitWithProvider(
    provider: VideoGenerationProvider,
    request: GenerateVideoRequest,
    fallbackUsed: boolean,
    originalProvider?: VideoGenerationProviderId
  ): Promise<GenerateVideoResponse> {
    if (!provider.supports(request)) {
      throw new VideoGenerationError({
        message: `${provider.id} does not support this generation configuration`,
        category: 'UNSUPPORTED_CONFIGURATION',
        provider: provider.id,
      });
    }
    this.logEvent(VIDEO_GENERATION_EVENTS.PROVIDER_STARTED, {
      provider: provider.id,
      model: provider.getMetadata().modelsByTier[request.tier],
      tier: request.tier,
      fallbackUsed,
      reelId: request.metadata?.reelId,
    });
    const response = await provider.submit(request);
    return {
      ...response,
      fallbackUsed,
      originalProvider: fallbackUsed ? originalProvider : undefined,
    };
  }

  private getRoutingConfig(): VideoGenerationRoutingConfig {
    const cfg = this.config.get('videoGeneration');
    const primary =
      this.normalizeProviderId(cfg?.primaryProvider || 'google', 'google') ??
      'google';
    const rawFallbacks = cfg?.fallbackProviders?.length
      ? cfg.fallbackProviders
      : ['runway'];
    const fallbacks: VideoGenerationProviderId[] = [];
    for (const raw of rawFallbacks) {
      const id = this.normalizeProviderId(String(raw), null);
      if (id) fallbacks.push(id);
    }
    return {
      primaryProvider: primary,
      fallbackProviders: fallbacks,
      enableFallback: cfg?.enableFallback !== false,
    };
  }

  private normalizeProviderId(
    value: string,
    fallback: VideoGenerationProviderId | null
  ): VideoGenerationProviderId | null {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'google' || normalized === 'runway') return normalized;
    return fallback;
  }

  private requireProvider(
    id: VideoGenerationProviderId
  ): VideoGenerationProvider {
    return this.getProvider(id);
  }

  private asVideoError(
    error: unknown,
    provider: VideoGenerationProviderId
  ): VideoGenerationError {
    if (isVideoGenerationError(error)) return error;
    return new VideoGenerationError({
      message: error instanceof Error ? error.message : String(error),
      category: 'UNKNOWN_PROVIDER_ERROR',
      provider,
    });
  }

  private logEvent(
    event: string,
    fields: Record<string, string | number | boolean | undefined>
  ): void {
    this.logger.log(JSON.stringify({ event, ...fields }));
  }
}
