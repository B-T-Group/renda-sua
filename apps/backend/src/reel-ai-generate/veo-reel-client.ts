import { Injectable, Logger } from '@nestjs/common';
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
  negativePrompt: string;
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
    const apiKey = this.requireApiKey();
    const url = `${GEMINI_BASE}/models/${params.model}:predictLongRunning`;
    const body = {
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
        negativePrompt: params.negativePrompt,
        sampleCount: 1,
      },
    };
    const response = await axios.post<{ name?: string }>(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      timeout: 60_000,
    });
    const name = response.data?.name;
    if (!name) throw new Error('Veo did not return an operation name');
    return name;
  }

  async getOperation(operationName: string): Promise<VeoOperationStatus> {
    const apiKey = this.requireApiKey();
    const url = `${GEMINI_BASE}/${operationName}`;
    const response = await axios.get<{
      name?: string;
      done?: boolean;
      error?: { message?: string };
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{ video?: { uri?: string } }>;
        };
      };
    }>(url, {
      headers: { 'x-goog-api-key': apiKey },
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

  async downloadVideo(videoUri: string): Promise<Buffer> {
    const apiKey = this.requireApiKey();
    const response = await axios.get<ArrayBuffer>(videoUri, {
      headers: { 'x-goog-api-key': apiKey },
      responseType: 'arraybuffer',
      timeout: 120_000,
      maxRedirects: 5,
    });
    return Buffer.from(response.data);
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
