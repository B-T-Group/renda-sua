import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Configuration } from '../config/configuration';

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
      throw new BadRequestException(
        'Add at least one product photo before generating an AI reel'
      );
    }
    try {
      return await this.postPredict(params.model, this.buildReferenceBody(params));
    } catch (error: any) {
      if (!this.shouldFallbackToSingleImage(error)) {
        throw this.toVeoHttpError(error);
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
        throw this.toVeoHttpError(retryError);
      }
    }
  }

  async getOperation(operationName: string): Promise<VeoOperationStatus> {
    try {
      return await this.fetchOperation(operationName);
    } catch (error: any) {
      throw this.toVeoHttpError(error);
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
      throw this.toVeoHttpError(error);
    }
  }

  private async postPredict(model: string, body: unknown): Promise<string> {
    const response = await axios.post<{ name?: string }>(
      `${GEMINI_BASE}/models/${model}:predictLongRunning`,
      body,
      this.authJsonHeaders()
    );
    const name = response.data?.name;
    if (!name) throw new Error('Veo did not return an operation name');
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

  private toVeoHttpError(error: any): Error {
    if (error instanceof HttpException) return error;
    if (!axios.isAxiosError(error)) {
      return error instanceof Error ? error : new Error(String(error));
    }
    const status = error.response?.status;
    const googleMessage = this.googleErrorMessage(error.response?.data);
    if (googleMessage) this.logger.error(`Veo request failed: ${googleMessage}`);
    return this.httpErrorForStatus(status);
  }

  private httpErrorForStatus(status?: number): HttpException {
    if (status === 429) {
      return new HttpException(
        'AI reel generation is busy. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    if (status && status >= 400 && status < 500) {
      return new BadRequestException(
        'Could not start AI reel generation. Try a different product photo.'
      );
    }
    return new HttpException(
      'AI video generation is temporarily unavailable. Please try again.',
      HttpStatus.BAD_GATEWAY
    );
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
      throw new Error('Gemini API key is not configured');
    }
    return key;
  }
}
