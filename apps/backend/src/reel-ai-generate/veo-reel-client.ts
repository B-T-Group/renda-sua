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

export interface StartVeoVideoParams {
  model: string;
  prompt: string;
  imageBase64: string;
  mimeType: string;
  aspectRatio: string;
  resolution: string;
  durationSeconds: number;
  personGeneration: 'dont_allow' | 'allow_adult';
  generateAudio: boolean;
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
    try {
      const response = await axios.post<{ name?: string }>(
        `${GEMINI_BASE}/models/${params.model}:predictLongRunning`,
        this.buildStartBody(params),
        this.authJsonHeaders()
      );
      const name = response.data?.name;
      if (!name) throw new Error('Veo did not return an operation name');
      return name;
    } catch (error: any) {
      throw this.toVeoHttpError(error);
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

  private buildStartBody(params: StartVeoVideoParams) {
    return {
      instances: [
        {
          prompt: params.prompt,
          image: {
            bytesBase64Encoded: params.imageBase64,
            mimeType: params.mimeType,
          },
        },
      ],
      parameters: {
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        durationSeconds: params.durationSeconds,
        personGeneration: params.personGeneration,
        generateAudio: params.generateAudio,
        sampleCount: 1,
      },
    };
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
