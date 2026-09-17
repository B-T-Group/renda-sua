import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { Configuration } from '../../../config/configuration';
import { VideoGenerationError } from '../video-generation.error';
import type { VideoGenerationErrorCategory } from '../video-generation.types';

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1';
/** Runway data-URI payload limit is 5MB; leave headroom for the data: prefix. */
export const RUNWAY_MAX_DATA_URI_BYTES = 4_500_000;
export const RUNWAY_PROMPT_MAX_UTF16 = 1000;

export interface StartRunwayVideoParams {
  model: string;
  prompt: string;
  promptImageDataUri: string;
  ratio: string;
  duration: number;
}

export interface RunwayTaskStatus {
  id: string;
  status: string;
  output?: string[] | null;
  failure?: string | null;
  failureCode?: string | null;
}

@Injectable()
export class RunwayReelClient {
  private readonly logger = new Logger(RunwayReelClient.name);

  constructor(private readonly config: ConfigService<Configuration>) {}

  async startImageToVideo(params: StartRunwayVideoParams): Promise<string> {
    try {
      const response = await axios.post<{ id?: string }>(
        `${RUNWAY_BASE}/image_to_video`,
        {
          model: params.model,
          promptText: truncateUtf16(params.prompt, RUNWAY_PROMPT_MAX_UTF16),
          promptImage: params.promptImageDataUri,
          ratio: params.ratio,
          duration: params.duration,
        },
        this.authJsonHeaders()
      );
      const id = response.data?.id;
      if (!id) {
        throw new VideoGenerationError({
          message: 'Runway did not return a task id',
          category: 'UNKNOWN_PROVIDER_ERROR',
          provider: 'runway',
        });
      }
      return id;
    } catch (error: any) {
      throw this.toVideoError(error);
    }
  }

  async getTask(taskId: string): Promise<RunwayTaskStatus> {
    try {
      const response = await axios.get<RunwayTaskStatus>(
        `${RUNWAY_BASE}/tasks/${taskId}`,
        {
          headers: this.authHeaders(),
          timeout: 30_000,
        }
      );
      return response.data;
    } catch (error: any) {
      throw this.toVideoError(error);
    }
  }

  async downloadVideo(videoUri: string): Promise<Buffer> {
    try {
      const response = await axios.get<ArrayBuffer>(videoUri, {
        responseType: 'arraybuffer',
        timeout: 120_000,
        maxRedirects: 5,
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      throw this.toVideoError(error);
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config.get('runway')?.apiKey?.trim());
  }

  private authHeaders(): Record<string, string> {
    const runway = this.config.get('runway');
    const key = runway?.apiKey?.trim();
    if (!key) {
      this.logger.error('RUNWAY_API_KEY is not configured');
      throw new VideoGenerationError({
        message: 'Runway API key is not configured',
        category: 'AUTHENTICATION_ERROR',
        provider: 'runway',
      });
    }
    return {
      Authorization: `Bearer ${key}`,
      'X-Runway-Version': runway?.apiVersion || '2024-11-06',
    };
  }

  private authJsonHeaders() {
    return {
      headers: {
        ...this.authHeaders(),
        'Content-Type': 'application/json',
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
        provider: 'runway',
      });
    }
    const status = error.response?.status;
    const message = this.runwayErrorMessage(error.response?.data);
    if (message) this.logger.error(`Runway request failed: ${message}`);
    const category = this.categoryForStatus(status, message);
    return new VideoGenerationError({
      message: message || this.defaultMessageForCategory(category),
      category,
      provider: 'runway',
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
      if (lower.includes('quota') || lower.includes('credit')) {
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

  private runwayErrorMessage(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const obj = data as {
      error?: string | { message?: string };
      message?: string;
      failure?: string;
    };
    if (typeof obj.error === 'string') return obj.error.trim() || undefined;
    if (obj.error && typeof obj.error === 'object') {
      return obj.error.message?.trim() || undefined;
    }
    return obj.message?.trim() || obj.failure?.trim() || undefined;
  }
}

export function truncateUtf16(text: string, maxUnits: number): string {
  let units = 0;
  let end = 0;
  for (const char of text) {
    const charUnits = char.length; // UTF-16 code units (surrogate pairs = 2)
    if (units + charUnits > maxUnits) break;
    units += charUnits;
    end += char.length;
  }
  return text.slice(0, end);
}

export function toDataUri(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}
