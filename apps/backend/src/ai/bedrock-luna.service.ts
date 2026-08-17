import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import type { Configuration } from '../config/configuration';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './chat-completion.types';
import {
  extractConverseOutputText,
  mapChatMessagesToConverse,
} from './bedrock-converse.mapper';

export type BedrockReasoningEffort =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

export type BedrockCompleteOptions = {
  messages: ChatCompletionRequest['messages'];
  /** Per-call override; otherwise uses bedrock.chatModel. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonObject?: boolean;
  /** Ignored for Nova Converse; kept for call-site compatibility. */
  reasoningEffort?: BedrockReasoningEffort;
  timeoutMs?: number;
};

export type BedrockCompleteResult = {
  text: string;
  usage: unknown;
  model: string;
  raw: unknown;
};

const DEFAULT_CHAT_MODEL = 'amazon.nova-lite-v1:0';
const DEFAULT_BEDROCK_REGION = 'us-east-1';

/**
 * Bedrock chat/vision via Runtime Converse (default Amazon Nova Lite).
 * Class name kept for Nest DI stability after the Luna → Nova cutover.
 */
@Injectable()
export class BedrockLunaService {
  private readonly logger = new Logger(BedrockLunaService.name);
  private readonly client: BedrockRuntimeClient;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const aws = this.configService.get('aws', { infer: true });
    const accessKeyId =
      aws?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey =
      aws?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '';
    this.client = new BedrockRuntimeClient({
      region: this.getRegion(),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
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

  resolveModel(override?: string | null): string {
    const trimmed = override?.trim();
    if (trimmed) return trimmed;
    return this.getDefaultChatModel();
  }

  async complete(options: BedrockCompleteOptions): Promise<BedrockCompleteResult> {
    const model = this.resolveModel(options.model);
    const mapped = await mapChatMessagesToConverse(options.messages, {
      jsonObject: options.jsonObject,
    });
    const raw = await this.converse(
      {
        modelId: model,
        messages: mapped.messages,
        ...(mapped.system ? { system: mapped.system } : {}),
        inferenceConfig: {
          ...(options.maxTokens != null
            ? { maxTokens: Math.max(1, options.maxTokens) }
            : {}),
          ...(options.temperature != null
            ? { temperature: options.temperature }
            : {}),
        },
      },
      options.timeoutMs ?? 90000
    );
    const text = extractConverseOutputText(raw.output);
    if (!text) {
      throw new HttpException(
        'AI temporarily unavailable. Please try again.',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
    return { text, usage: raw.usage ?? null, model, raw };
  }

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

  private async converse(
    input: ConstructorParameters<typeof ConverseCommand>[0],
    timeoutMs: number,
    maxAttempts = 4
  ): Promise<ConverseCommandOutput> {
    let attempt = 0;
    while (true) {
      try {
        return await this.sendWithTimeout(input, timeoutMs);
      } catch (error: any) {
        attempt++;
        if (!this.shouldRetry(error, attempt, maxAttempts)) {
          this.throwMappedError(error);
        }
        await this.sleep(this.backoffMs(error, attempt));
      }
    }
  }

  private async sendWithTimeout(
    input: ConstructorParameters<typeof ConverseCommand>[0],
    timeoutMs: number
  ): Promise<ConverseCommandOutput> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.client.send(new ConverseCommand(input), {
        abortSignal: controller.signal,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        const timeoutError: any = new Error('Bedrock Converse timed out');
        timeoutError.code = 'ECONNABORTED';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private shouldRetry(
    error: any,
    attempt: number,
    maxAttempts: number
  ): boolean {
    if (attempt >= maxAttempts) return false;
    const status = error?.$metadata?.httpStatusCode;
    const name = String(error?.name || '');
    return (
      status === 429 ||
      (status != null && status >= 500) ||
      name === 'ThrottlingException' ||
      name === 'ServiceUnavailableException' ||
      name === 'ModelTimeoutException'
    );
  }

  private backoffMs(error: any, attempt: number): number {
    const retryAfterSec = parseInt(
      error?.$metadata?.httpHeaders?.['retry-after'] ?? '0',
      10
    );
    if (retryAfterSec > 0) return retryAfterSec * 1000;
    return Math.min(2000 * 2 ** (attempt - 1), 30000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private throwMappedError(error: any): never {
    const status = error?.$metadata?.httpStatusCode;
    this.logger.error(
      `Bedrock Converse failed (HTTP ${status ?? 'n/a'}): ${
        error?.name ?? 'Error'
      }: ${error?.message ?? 'unknown'}`
    );
    throw this.mapBedrockHttpError(error, status);
  }

  private mapBedrockHttpError(
    error: any,
    status: number | undefined
  ): HttpException {
    const options = { cause: error };
    if (status === 429 || error?.name === 'ThrottlingException') {
      return this.aiUnavailable(HttpStatus.TOO_MANY_REQUESTS, options, true);
    }
    if (status === 401 || status === 403) {
      return this.aiUnavailable(HttpStatus.SERVICE_UNAVAILABLE, options, true);
    }
    if (error?.code === 'ECONNABORTED') {
      return new HttpException(
        'AI request timed out. Please try again.',
        HttpStatus.REQUEST_TIMEOUT,
        options
      );
    }
    return this.aiUnavailable(HttpStatus.SERVICE_UNAVAILABLE, options, false);
  }

  private aiUnavailable(
    status: HttpStatus,
    options: { cause: unknown },
    later: boolean
  ): HttpException {
    const suffix = later ? ' later.' : '.';
    return new HttpException(
      `AI temporarily unavailable. Please try again${suffix}`,
      status,
      options
    );
  }
}
