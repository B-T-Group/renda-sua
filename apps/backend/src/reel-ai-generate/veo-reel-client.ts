import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Configuration } from '../config/configuration';
import { VideoGenerationError } from './video-generation/video-generation.error';
import type { VideoGenerationErrorCategory } from './video-generation/video-generation.types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const VEO_MAX_REFERENCE_IMAGES = 3;

export interface VeoImageInput {
  imageBase64: string;
  mimeType: string;
}

export interface StartVeoVideoParams {
  model: string;
  prompt: string;
  images: VeoImageInput[];
  aspectRatio: string;
  resolution: string;
  durationSeconds: number;
  personGeneration: 'dont_allow' | 'allow_adult';
}

export interface VeoOperationStatus {
  name: string;
  done: boolean;
  error?: { message?: string };
  videoUri?: string | null;
}

@Injectable()
export class VeoReelClient {
  private readonly logger = new Logger(VeoReelClient.name);

  constructor(private readonly config: ConfigService<Configuration>) {}

  async startImageToVideo(params: StartVeoVideoParams): Promise<string> {
    if (!params.images.length) {
      throw new VideoGenerationError({
        message: 'Add at least one product photo before generating an AI reel',
        category: 'INVALID_REQUEST',
        provider: 'google',
      });
    }
    try {
      return await this.postPredict(params.model, this.buildReferenceBody(params));
    } catch (error: any) {
      if (!this.shouldFallbackToSingleImage(error)) {
        throw this.toVideoError(error);
      }
      this.logger.warn(
        'Veo referenceImages rejected; retrying with single image'
      );
      try {
        return await this.postPredict(
          params.model,
          this.buildSingleImageBody(params)
        );
      } catch (retryError: any) {
        throw this.toVideoError(retryError);
      }
    }
  }

  async getOperation(operationName: string): Promise<VeoOperationStatus> {
    try {
      return await this.fetchOperation(operationName);
    } catch (error: any) {
      throw this.toVideoError(error);
    }
  }

  async downloadVideo(videoUri: string): Promise<Buffer> {
    const apiKey = this.requireApiKey();
    try {
      const response = await axios.get<ArrayBuffer>(videoUri, {
        headers: { 'x-goog-api-key': apiKey },
        responseType: 'arraybuffer',
        timeout: 120_000,
        maxRedirects: 5,
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      throw this.toVideoError(error);
    }
  }

  private async postPredict(model: string, body: unknown): Promise<string> {
    const response = await axios.post<{ name?: string }>(
      `${GEMINI_BASE}/models/${model}:predictLongRunning`,
      body,
      this.authJsonHeaders()
    );
    const name = response.data?.name;
    if (!name) {
      throw new VideoGenerationError({
        message: 'Veo did not return an operation name',
        category: 'UNKNOWN_PROVIDER_ERROR',
        provider: 'google',
      });
    }
    return name;
  }

  private async fetchOperation(
    operationName: string
  ): Promise<VeoOperationStatus> {
    const response = await axios.get<{
      name?: string;
      done?: boolean;
      error?: { message?: string };
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{ video?: { uri?: string } }>;
        };
      };
    }>(`${GEMINI_BASE}/${operationName}`, {
      headers: { 'x-goog-api-key': this.requireApiKey() },
      timeout: 30_000,
    });
    const data = response.data;
    const videoUri =
      data.response?.generateVideoResponse?.generatedSamples?.[0]?.video
        ?.uri ?? null;
    return {
      name: data.name || operationName,
      done: Boolean(data.done),
      error: data.error,
      videoUri,
    };
  }

  private buildReferenceBody(params: StartVeoVideoParams) {
    const images = params.images.slice(0, VEO_MAX_REFERENCE_IMAGES);
    return {
      instances: [
        {
          prompt: params.prompt,
          referenceImages: images.map((img) => ({
            image: {
              bytesBase64Encoded: img.imageBase64,
              mimeType: img.mimeType,
            },
            referenceType: 'asset',
          })),
        },
      ],
      parameters: this.buildParameters(params),
    };
  }

  private buildSingleImageBody(params: StartVeoVideoParams) {
    const first = params.images[0];
    return {
      instances: [
        {
          prompt: params.prompt,
          image: {
            bytesBase64Encoded: first.imageBase64,
            mimeType: first.mimeType,
          },
        },
      ],
      parameters: this.buildParameters(params),
    };
  }

  private buildParameters(params: StartVeoVideoParams) {
    // Gemini API Veo 3.1 rejects `generateAudio` — native audio is always on.
    return {
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      durationSeconds: params.durationSeconds,
      personGeneration: params.personGeneration,
      sampleCount: 1,
    };
  }

  private shouldFallbackToSingleImage(error: any): boolean {
    if (!axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    if (status !== 400) return false;
    const message = this.googleErrorMessage(error.response?.data)?.toLowerCase();
    if (!message) return true;
    return (
      message.includes('not supported') ||
      message.includes('reference') ||
      message.includes('invalid')
    );
  }

  private authJsonHeaders() {
    return {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.requireApiKey(),
      },
      timeout: 60_000,
    };
  }

  private toVideoError(error: any): VideoGenerationError {
    if (error instanceof VideoGenerationError) return error;
    if (!axios.isAxiosError(error)) {
      return new VideoGenerationError({
        message: error instanceof Error ? error.message : String(error),
        category: 'UNKNOWN_PROVIDER_ERROR',
        provider: 'google',
      });
    }
    const status = error.response?.status;
    const googleMessage = this.googleErrorMessage(error.response?.data);
    if (googleMessage) this.logger.error(`Veo request failed: ${googleMessage}`);
    const category = this.categoryForStatus(status, googleMessage);
    return new VideoGenerationError({
      message: googleMessage || this.defaultMessageForCategory(category),
      category,
      provider: 'google',
      httpStatus: status,
    });
  }

  private categoryForStatus(
    status: number | undefined,
    message?: string
  ): VideoGenerationErrorCategory {
    const lower = message?.toLowerCase() ?? '';
    if (status === 401 || status === 403) return 'AUTHENTICATION_ERROR';
    if (status === 429) {
      if (lower.includes('quota') || lower.includes('resource_exhausted')) {
        return 'QUOTA_EXCEEDED';
      }
      return 'RATE_LIMITED';
    }
    if (status === 408 || lower.includes('timeout')) return 'TIMEOUT';
    if (status && status >= 500) return 'PROVIDER_UNAVAILABLE';
    if (status === 400) {
      if (lower.includes('not supported') || lower.includes('unsupported')) {
        return 'UNSUPPORTED_CONFIGURATION';
      }
      return 'INVALID_REQUEST';
    }
    if (status && status >= 400 && status < 500) return 'INVALID_REQUEST';
    return 'UNKNOWN_PROVIDER_ERROR';
  }

  private defaultMessageForCategory(
    category: VideoGenerationErrorCategory
  ): string {
    if (category === 'RATE_LIMITED' || category === 'QUOTA_EXCEEDED') {
      return 'AI reel generation is busy. Please try again shortly.';
    }
    if (
      category === 'INVALID_REQUEST' ||
      category === 'UNSUPPORTED_CONFIGURATION'
    ) {
      return 'Could not start AI reel generation. Try a different product photo.';
    }
    return 'AI video generation is temporarily unavailable. Please try again.';
  }

  private googleErrorMessage(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const message = (data as { error?: { message?: string } }).error?.message;
    return message?.trim() || undefined;
  }

  private requireApiKey(): string {
    const key = this.config.get('gemini')?.apiKey?.trim();
    if (!key) {
      this.logger.error('GEMINI_API_KEY is not configured');
      throw new VideoGenerationError({
        message: 'Gemini API key is not configured',
        category: 'AUTHENTICATION_ERROR',
        provider: 'google',
      });
    }
    return key;
  }
}
