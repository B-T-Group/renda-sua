import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getTokenProvider } from '@aws/bedrock-token-generator';
import axios from 'axios';
import type { Configuration } from '../config/configuration';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './chat-completion.types';
import {
  extractOutputText,
  mapChatMessagesToResponses,
  type BedrockReasoningEffort,
} from './bedrock-responses.mapper';

export type BedrockCompleteOptions = {
  messages: ChatCompletionRequest['messages'];
  /** Per-call override; otherwise uses bedrock.chatModel. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonObject?: boolean;
  reasoningEffort?: BedrockReasoningEffort;
  timeoutMs?: number;
};

export type BedrockCompleteResult = {
  text: string;
  usage: unknown;
  model: string;
  raw: unknown;
};

const DEFAULT_CHAT_MODEL = 'openai.gpt-5.6-luna';
const DEFAULT_BEDROCK_REGION = 'us-east-1';

@Injectable()
export class BedrockLunaService {
  private readonly logger = new Logger(BedrockLunaService.name);
  private readonly tokenProvider: () => Promise<string>;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const region = this.getRegion();
    const aws = this.configService.get('aws', { infer: true });
    this.tokenProvider = getTokenProvider({
      region,
      credentials: {
        accessKeyId: aws?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey:
          aws?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  getRegion(): string {
    const configured = this.configService
      .get('bedrock.region', { infer: true })
      ?.trim();
    return configured || DEFAULT_BEDROCK_REGION;
  }

  getDefaultChatModel(): string {
    const configured = this.configService
      .get('bedrock.chatModel', { infer: true })
      ?.trim();
    return configured || DEFAULT_CHAT_MODEL;
  }

  getResponsesBaseUrl(): string {
    return `https://bedrock-mantle.${this.getRegion()}.api.aws/openai/v1`;
  }

  resolveModel(override?: string | null): string {
    const trimmed = override?.trim();
    if (trimmed) return trimmed;
    return this.getDefaultChatModel();
  }

  async complete(options: BedrockCompleteOptions): Promise<BedrockCompleteResult> {
    const model = this.resolveModel(options.model);
    const body = mapChatMessagesToResponses({
      model,
      messages: options.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      jsonObject: options.jsonObject,
      reasoningEffort: options.reasoningEffort ?? 'none',
    });
    const raw = await this.postResponses(body, options.timeoutMs ?? 90000);
    const text = extractOutputText(raw);
    if (!text) {
      throw new HttpException(
        'AI temporarily unavailable. Please try again.',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    const usage =
      raw && typeof raw === 'object'
        ? (raw as { usage?: unknown }).usage ?? null
        : null;
    return { text, usage, model, raw };
  }

  /**
   * OpenAI-compatible adapter so existing callers can swap providers with
   * minimal changes. Returns a ChatCompletionResponse-shaped object.
   */
  async chatCompletions(
    request: ChatCompletionRequest,
    timeoutMs: number,
    opts?: {
      reasoningEffort?: BedrockReasoningEffort;
      jsonObject?: boolean;
    }
  ): Promise<ChatCompletionResponse> {
    const result = await this.complete({
      messages: request.messages,
      model: request.model,
      maxTokens: request.max_tokens,
      temperature: request.temperature,
      jsonObject:
        opts?.jsonObject ??
        request.response_format?.type === 'json_object',
      reasoningEffort: opts?.reasoningEffort ?? 'none',
      timeoutMs,
    });
    return {
      choices: [{ message: { content: result.text } }],
    };
  }

  private async postResponses(
    body: Record<string, unknown>,
    timeoutMs: number,
    maxAttempts = 4
  ): Promise<unknown> {
    const url = `${this.getResponsesBaseUrl()}/responses`;
    let attempt = 0;
    while (true) {
      try {
        const token = await this.tokenProvider();
        const { data } = await axios.post(url, body, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: timeoutMs,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });
        return data;
      } catch (error: any) {
        attempt++;
        if (!this.shouldRetry(error, attempt, maxAttempts)) {
          this.throwMappedError(error);
        }
        await this.sleep(this.backoffMs(error, attempt));
      }
    }
  }

  private shouldRetry(
    error: any,
    attempt: number,
    maxAttempts: number
  ): boolean {
    if (attempt >= maxAttempts) return false;
    const status = error?.response?.status;
    return status === 429 || (status != null && status >= 500);
  }

  private backoffMs(error: any, attempt: number): number {
    const retryAfterSec = parseInt(
      error?.response?.headers?.['retry-after'] ?? '0',
      10
    );
    if (retryAfterSec > 0) return retryAfterSec * 1000;
    return Math.min(2000 * 2 ** (attempt - 1), 30000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private throwMappedError(error: any): never {
    const status = error?.response?.status;
    this.logger.error(
      `Bedrock Responses API failed (HTTP ${status ?? 'n/a'}): ${
        error?.message ?? 'unknown'
      }`
    );
    if (status === 429) {
      throw new HttpException(
        'AI temporarily unavailable. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    if (status === 401 || status === 403) {
      throw new HttpException(
        'AI temporarily unavailable. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    if (error?.code === 'ECONNABORTED') {
      throw new HttpException(
        'AI request timed out. Please try again.',
        HttpStatus.REQUEST_TIMEOUT
      );
    }
    throw new HttpException(
      'AI temporarily unavailable. Please try again.',
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}
