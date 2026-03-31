import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './chat-completion.types';

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);
  private static readonly CHAT_COMPLETIONS_URL =
    'https://api.deepseek.com/v1/chat/completions';
  readonly defaultChatModel = 'deepseek-chat';

  constructor(private readonly configService: ConfigService) {}

  requireApiKey(): string {
    const key = this.configService.get<string>('deepseek.apiKey')?.trim();
    if (!key) {
      this.logger.error('DEEPSEEK_API_KEY not configured');
      throw new HttpException(
        'DeepSeek API key not configured',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
    return key;
  }

  async chatCompletions(
    body: ChatCompletionRequest,
    timeoutMs: number
  ): Promise<ChatCompletionResponse> {
    const apiKey = this.requireApiKey();
    const payload: ChatCompletionRequest = {
      ...body,
      model: body.model || this.defaultChatModel,
    };
    const { data } = await axios.post<ChatCompletionResponse>(
      DeepseekService.CHAT_COMPLETIONS_URL,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: timeoutMs,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    return data;
  }
}
