import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import type { Configuration } from '../../../config/configuration';
import type { VideoGenerationProvider } from '../video-generation-provider.interface';
import { VideoGenerationError } from '../video-generation.error';
import type {
  GenerateVideoRequest,
  GenerateVideoResponse,
  VideoGenerationTier,
  VideoImageInput,
  VideoJobStatus,
  VideoProviderMetadata,
} from '../video-generation.types';
import {
  RUNWAY_MAX_DATA_URI_BYTES,
  RunwayReelClient,
  toDataUri,
} from './runway-reel-client';

const ASPECT_TO_RATIO: Record<string, string> = {
  '9:16': '720:1280',
  '16:9': '1280:720',
  '1:1': '960:960',
};

@Injectable()
export class RunwayVideoGenerationProvider implements VideoGenerationProvider {
  readonly id = 'runway' as const;
  private readonly logger = new Logger(RunwayVideoGenerationProvider.name);

  constructor(
    private readonly runway: RunwayReelClient,
    private readonly config: ConfigService<Configuration>
  ) {}

  supports(request: GenerateVideoRequest): boolean {
    if (!this.runway.isConfigured()) return false;
    if (!request.images.length) return false;
    if (request.durationSeconds < 2 || request.durationSeconds > 10) {
      return false;
    }
    if (!this.mapAspectRatio(request.aspectRatio)) return false;
    return request.tier === 'fast' || request.tier === 'standard';
  }

  async submit(request: GenerateVideoRequest): Promise<GenerateVideoResponse> {
    if (!this.supports(request)) {
      throw new VideoGenerationError({
        message: 'Runway does not support this generation configuration',
        category: 'UNSUPPORTED_CONFIGURATION',
        provider: 'runway',
      });
    }
    const providerModel = this.resolveModel(request.tier);
    const ratio = this.mapAspectRatio(request.aspectRatio)!;
    const promptImageDataUri = await this.buildPromptImageDataUri(
      request.images[0]
    );
    const jobId = await this.runway.startImageToVideo({
      model: providerModel,
      prompt: request.prompt,
      promptImageDataUri,
      ratio,
      duration: request.durationSeconds,
    });
    return {
      jobId,
      provider: 'runway',
      providerModel,
      tier: request.tier,
      status: 'QUEUED',
      fallbackUsed: false,
    };
  }

  async getJobStatus(jobId: string): Promise<VideoJobStatus> {
    const task = await this.runway.getTask(jobId);
    const status = this.normalizeStatus(task.status);
    if (status === 'COMPLETED') {
      const videoUri = task.output?.[0] ?? null;
      if (!videoUri) {
        return {
          jobId,
          status: 'FAILED',
          errorMessage: 'Runway generation returned no video',
          failureCategory: 'UNKNOWN_PROVIDER_ERROR',
        };
      }
      return { jobId, status, videoUri };
    }
    if (status === 'FAILED' || status === 'CANCELLED') {
      return {
        jobId,
        status,
        errorMessage: task.failure || `Runway task ${task.status}`,
        failureCategory: 'UNKNOWN_PROVIDER_ERROR',
      };
    }
    return { jobId, status };
  }

  retrieveVideo(videoUri: string): Promise<Buffer> {
    return this.runway.downloadVideo(videoUri);
  }

  getMetadata(): VideoProviderMetadata {
    return {
      id: 'runway',
      modelsByTier: {
        fast: this.resolveModel('fast'),
        standard: this.resolveModel('standard'),
      },
    };
  }

  private resolveModel(tier: VideoGenerationTier): string {
    const runway = this.config.get('runway');
    if (tier === 'standard') {
      return runway?.modelStandard || 'gen4.5';
    }
    return runway?.modelFast || 'gen4_turbo';
  }

  private mapAspectRatio(aspectRatio: string): string | null {
    return ASPECT_TO_RATIO[aspectRatio.trim()] ?? null;
  }

  private normalizeStatus(raw: string): VideoJobStatus['status'] {
    const status = raw?.toUpperCase();
    if (status === 'PENDING' || status === 'THROTTLED') return 'QUEUED';
    if (status === 'RUNNING') return 'PROCESSING';
    if (status === 'SUCCEEDED') return 'COMPLETED';
    if (status === 'FAILED') return 'FAILED';
    if (status === 'CANCELLED' || status === 'CANCELED') return 'CANCELLED';
    return 'PROCESSING';
  }

  private async buildPromptImageDataUri(
    image: VideoImageInput
  ): Promise<string> {
    let buffer = Buffer.from(image.imageBase64, 'base64');
    let mimeType = image.mimeType || 'image/jpeg';
    let dataUri = toDataUri(buffer.toString('base64'), mimeType);
    if (Buffer.byteLength(dataUri, 'utf8') <= RUNWAY_MAX_DATA_URI_BYTES) {
      return dataUri;
    }
    this.logger.warn('Runway image exceeds data-URI limit; compressing');
    buffer = await sharp(buffer)
      .resize({ width: 1280, height: 1280, fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
    mimeType = 'image/jpeg';
    dataUri = toDataUri(buffer.toString('base64'), mimeType);
    if (Buffer.byteLength(dataUri, 'utf8') > RUNWAY_MAX_DATA_URI_BYTES) {
      throw new VideoGenerationError({
        message: 'Product photo is too large for Runway video generation',
        category: 'INVALID_REQUEST',
        provider: 'runway',
      });
    }
    return dataUri;
  }
}
