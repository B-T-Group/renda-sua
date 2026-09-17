import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../../../config/configuration';
import {
  resolveVeoPersonGeneration,
  resolveVeoReelModel,
  VEO_REEL_MODEL_BY_TIER,
  type VeoReelTier,
} from '../../veo-reel-model.util';
import { VeoReelClient } from '../../veo-reel-client';
import type { VideoGenerationProvider } from '../video-generation-provider.interface';
import { VideoGenerationError } from '../video-generation.error';
import type {
  GenerateVideoRequest,
  GenerateVideoResponse,
  VideoGenerationTier,
  VideoJobStatus,
  VideoProviderMetadata,
} from '../video-generation.types';

@Injectable()
export class GoogleVideoGenerationProvider implements VideoGenerationProvider {
  readonly id = 'google' as const;

  constructor(
    private readonly veo: VeoReelClient,
    private readonly config: ConfigService<Configuration>
  ) {}

  supports(request: GenerateVideoRequest): boolean {
    if (!request.images.length) return false;
    if (request.durationSeconds < 1 || request.durationSeconds > 8) {
      return false;
    }
    return request.tier === 'fast' || request.tier === 'standard';
  }

  async submit(request: GenerateVideoRequest): Promise<GenerateVideoResponse> {
    if (!this.supports(request)) {
      throw new VideoGenerationError({
        message: 'Google Veo does not support this generation configuration',
        category: 'UNSUPPORTED_CONFIGURATION',
        provider: 'google',
      });
    }
    const providerModel = this.resolveModel(request.tier);
    const jobId = await this.veo.startImageToVideo({
      model: providerModel,
      prompt: request.prompt,
      images: request.images,
      aspectRatio: request.aspectRatio,
      resolution: request.resolution,
      durationSeconds: request.durationSeconds,
      personGeneration: resolveVeoPersonGeneration(providerModel),
    });
    return {
      jobId,
      provider: 'google',
      providerModel,
      tier: request.tier,
      status: 'PROCESSING',
      fallbackUsed: false,
    };
  }

  async getJobStatus(jobId: string): Promise<VideoJobStatus> {
    const op = await this.veo.getOperation(jobId);
    if (!op.done) {
      return { jobId, status: 'PROCESSING' };
    }
    if (op.error?.message || !op.videoUri) {
      const errorMessage =
        op.error?.message || 'Veo generation returned no video';
      return {
        jobId,
        status: 'FAILED',
        errorMessage,
        failureCategory: this.classifyOperationFailure(errorMessage),
      };
    }
    return {
      jobId,
      status: 'COMPLETED',
      videoUri: op.videoUri,
    };
  }

  retrieveVideo(videoUri: string): Promise<Buffer> {
    return this.veo.downloadVideo(videoUri);
  }

  getMetadata(): VideoProviderMetadata {
    return {
      id: 'google',
      modelsByTier: { ...VEO_REEL_MODEL_BY_TIER },
    };
  }

  private classifyOperationFailure(
    message: string
  ): VideoJobStatus['failureCategory'] {
    const lower = message.toLowerCase();
    if (
      lower.includes('quota') ||
      lower.includes('resource_exhausted') ||
      lower.includes('resource exhausted')
    ) {
      return 'QUOTA_EXCEEDED';
    }
    if (
      lower.includes('rate') ||
      lower.includes('too many') ||
      lower.includes('throttl')
    ) {
      return 'RATE_LIMITED';
    }
    if (
      lower.includes('unavailable') ||
      lower.includes('temporarily') ||
      lower.includes('deadline') ||
      lower.includes('internal')
    ) {
      return 'PROVIDER_UNAVAILABLE';
    }
    if (lower.includes('timeout') || lower.includes('timed out')) {
      return 'TIMEOUT';
    }
    if (
      lower.includes('invalid') ||
      lower.includes('safety') ||
      lower.includes('blocked') ||
      lower.includes('policy')
    ) {
      return 'INVALID_REQUEST';
    }
    return 'UNKNOWN_PROVIDER_ERROR';
  }

  private resolveModel(tier: VideoGenerationTier): string {
    const veo = this.config.get('veo');
    return resolveVeoReelModel({
      modelOverride: veo?.modelOverride,
      tierOverride: tier as VeoReelTier,
    });
  }
}
